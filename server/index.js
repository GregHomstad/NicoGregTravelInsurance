import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env') });

// --- Secrets Engine: prefer encrypted vault, fall back to .env ---
let secrets = {};
const vaultPath = join(__dirname, 'vault.enc');

if (existsSync(vaultPath) && process.env.VAULT_KEY) {
  try {
    const { load } = await import('./vault.js');
    secrets = load(process.env.VAULT_KEY);
    console.log('[Secrets] Loaded credentials from encrypted vault');
  } catch (e) {
    console.error(`[Secrets] FATAL: Failed to decrypt vault: ${e.message}`);
    process.exit(1);
  }
} else if (process.env.BMI_AUTH_USER && process.env.BMI_AUTH_KEY) {
  console.log('[Secrets] Using .env credentials (vault not found or VAULT_KEY not set)');
} else {
  console.error('FATAL: No credentials available. Either set VAULT_KEY + vault.enc, or provide BMI_AUTH_USER/BMI_AUTH_KEY in .env');
  process.exit(1);
}

// --- Startup Validation ---
const BMI_BASE = process.env.BMI_API_BASE || 'https://api.bmicos.com/bmiecommerce/sandbox/v4';
const BMI_AUTH_USER = secrets.BMI_AUTH_USER || process.env.BMI_AUTH_USER;
const BMI_AUTH_KEY = secrets.BMI_AUTH_KEY || process.env.BMI_AUTH_KEY;
const BMI_AGENT_ID = parseInt(secrets.BMI_AGENT_ID || process.env.BMI_AGENT_ID || '16111', 10);
const PROXY_API_KEY = secrets.PROXY_API_KEY || process.env.PROXY_API_KEY;
const PORT = parseInt(process.env.PORT || '3001', 10);

if (!BMI_AUTH_USER || !BMI_AUTH_KEY) {
  console.error('FATAL: BMI_AUTH_USER and BMI_AUTH_KEY must be set in server/.env or vault');
  process.exit(1);
}

if (!BMI_BASE.startsWith('https://api.bmicos.com/')) {
  console.error('FATAL: BMI_API_BASE must point to https://api.bmicos.com/');
  process.exit(1);
}

if (!PROXY_API_KEY) {
  console.warn('[Security] WARNING: PROXY_API_KEY not set — proxy endpoints are unprotected');
}

const FETCH_TIMEOUT = 20_000; // 20s timeout for upstream BMI calls

const app = express();

app.get('/test-ping', (req, res) => res.send('pong'));

// --- Trust proxy (required for rate limiter behind nginx/cloudflare) ---
app.set('trust proxy', 1);

// --- Security Headers ---
app.use(helmet());

// --- Compression ---
app.use(compression());

// --- CORS ---
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json({ limit: '100kb' }));

// --- Rate Limiter (all /api/ routes) ---
const rateLimit = new Map();
const RATE_WINDOW = 60_000;
const RATE_MAX = 30;

function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress;
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateLimit.set(ip, { start: now, count: 1 });
    return next();
  }
  entry.count++;
  if (entry.count > RATE_MAX) {
    return res.status(429).json({ isSuccess: false, message: 'Too many requests. Please try again later.' });
  }
  next();
}
app.use('/api/', rateLimiter);

// --- API Key Authentication (skip health check + test-ping) ---
function apiKeyAuth(req, res, next) {
  if (!PROXY_API_KEY) return next(); // no key configured → allow (dev mode)
  if (req.path === '/health') return next(); // health check is public (path is relative to /api/ mount)
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== PROXY_API_KEY) {
    return res.status(401).json({ isSuccess: false, message: 'Unauthorized' });
  }
  next();
}
app.use('/api/', apiKeyAuth);

// Clean up rate limit map periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimit) {
    if (now - entry.start > RATE_WINDOW) rateLimit.delete(ip);
  }
}, RATE_WINDOW);

// --- Token Management (with race condition protection) ---
let cachedToken = null;
let tokenExpiry = 0;
let tokenPromise = null;

async function fetchNewToken() {
  const res = await fetch(`${BMI_BASE}/api/v1/ecommerce/Token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authUser: BMI_AUTH_USER, authKey: BMI_AUTH_KEY }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) throw new Error(`BMI token endpoint returned ${res.status}`);
  const json = await res.json();
  if (!json.isSuccess) throw new Error(json.message || 'BMI token authentication failed');

  cachedToken = json.data;
  tokenExpiry = Date.now() + 55 * 60 * 1000;
  console.log('[BMI] Token obtained successfully');
  return cachedToken;
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  if (!tokenPromise) {
    tokenPromise = fetchNewToken().finally(() => { tokenPromise = null; });
  }
  return tokenPromise;
}

// --- BMI API Helpers (with timeout + status checks) ---
async function bmiPost(endpoint, body) {
  const token = await getToken();
  const url = `${BMI_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[BMI] POST ${endpoint} returned ${res.status}: ${text}`);
      throw new Error(`BMI API error (${res.status}): ${text.slice(0, 500)}`);
    }
    return res.json();
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      console.error(`[BMI] POST ${endpoint} TIMEOUT after ${FETCH_TIMEOUT}ms`);
      throw new Error('BMI API request timed out');
    }
    throw e;
  }
}

async function bmiGet(endpoint, params = {}) {
  const token = await getToken();
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `${BMI_BASE}${endpoint}?${qs}` : `${BMI_BASE}${endpoint}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[BMI] GET ${endpoint} returned ${res.status}: ${text.slice(0, 200)}`);
    throw new Error(`BMI API error (${res.status})`);
  }
  return res.json();
}

// --- Input Validation Helpers ---
function validateStep1(body) {
  const { sClient, nDeparture, nDestination, dFromDate, dToDate, travelers } = body;
  if (!sClient || typeof sClient !== 'string') return 'Client name is required';
  if (sClient.length > 200) return 'Client name is too long';
  if (!Number.isInteger(Number(nDeparture))) return 'Valid departure country is required';
  if (!Number.isInteger(Number(nDestination))) return 'Valid destination is required';
  if (!dFromDate || !dToDate) return 'Travel dates are required';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dFromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(dToDate)) return 'Invalid date format (expected YYYY-MM-DD)';
  if (!Array.isArray(travelers) || travelers.length === 0) return 'At least one traveler is required';
  if (travelers.length > 20) return 'Maximum 20 travelers allowed';
  for (const t of travelers) {
    if (!t.travelerId || !t.genderId || !t.dateOfBirth) return 'Each traveler must have travelerId, genderId, and dateOfBirth';
  }
  return null;
}

function validateReferenceId(body) {
  if (!body.sReferenceID || typeof body.sReferenceID !== 'string') return 'Reference ID is required';
  return null;
}

function validateStep7(body) {
  const { sReferenceID, sContactName, sContactEmail, sCardNumber, nCardType, sCardName, nCardMonth, nCardYear, travelers } = body;
  if (!sReferenceID) return 'Reference ID is required';
  if (!sContactName || !sContactEmail) return 'Contact info is required';
  if (!sCardNumber || !nCardType || !sCardName || !nCardMonth || !nCardYear) return 'Card details are required';
  if (!/^\d{13,19}$/.test(String(sCardNumber).replace(/\s/g, ''))) return 'Invalid card number';
  if (!Array.isArray(travelers) || travelers.length === 0) return 'Traveler details are required';
  return null;
}

// --- Travel Info Proxy Routes (FAA / NWS) ---
const travelCache = new Map();
const CACHE_TTL = 300_000; // 5 minutes

app.get('/api/travel/airport-status/:code', async (req, res) => {
  console.log(`[TravelInfo] Hit: /api/travel/airport-status/${req.params.code}`);
  const code = req.params.code.toUpperCase().slice(0, 3);
  const cacheKey = `airport-${code}`;
  const now = Date.now();
  
  if (travelCache.has(cacheKey)) {
    const entry = travelCache.get(cacheKey);
    if (now - entry.timestamp < CACHE_TTL) return res.json(entry.data);
  }

  try {
    // New FAA NAS Status API (returns status info for major US airports)
    const response = await fetch('https://nasstatus.faa.gov/api/airport-status-information', {
      headers: { 
        'Accept': 'application/json, text/xml',
        'User-Agent': 'TripKavach Travel Monitor (contact@tripkavach.com)'
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`FAA API returned ${response.status}`);
    
    // The API might return XML or JSON. Let's try to handle it.
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      // Find the specific airport in the array
      const airportData = Array.isArray(data) ? data.find(a => a.AirportCode === code) : data;
      travelCache.set(cacheKey, { timestamp: now, data: { Status: airportData || { Delay: 'false', Reason: 'No delays reported' } } });
      res.json(travelCache.get(cacheKey).data);
    } else {
      // If XML, we just return a "Normal" status for now as we don't have an XML parser in the proxy yet
      // but we know the API is alive.
      res.json({ Status: { Delay: 'false', Reason: 'Status available (XML)' } });
    }
  } catch (e) {
    console.error(`[TravelInfo:Airport] ${code}:`, e.message);
    res.status(502).json({ isSuccess: false, message: 'External API error' });
  }
});

app.get('/api/travel/weather-alerts/:area', async (req, res) => {
  console.log(`[TravelInfo] Hit: /api/travel/weather-alerts/${req.params.area}`);
  const area = req.params.area.toUpperCase().slice(0, 2); // e.g. "NY", "CA"
  const cacheKey = `weather-${area}`;
  const now = Date.now();

  if (travelCache.has(cacheKey)) {
    const entry = travelCache.get(cacheKey);
    if (now - entry.timestamp < CACHE_TTL) return res.json(entry.data);
  }

  try {
    const response = await fetch(`https://api.weather.gov/alerts/active?area=${area}`, {
      headers: { 'User-Agent': 'TripKavach Travel Monitor (contact@tripkavach.com)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
    const data = await response.json();
    travelCache.set(cacheKey, { timestamp: now, data });
    res.json(data);
  } catch (e) {
    console.error(`[TravelInfo:Weather] ${area}:`, e.message);
    res.status(502).json({ isSuccess: false, message: 'External API error' });
  }
});

// --- Quote Routes ---

// Step 1: Get plans + prices
app.post('/api/quote/step1', async (req, res) => {
  try {
    const err = validateStep1(req.body);
    if (err) return res.status(400).json({ isSuccess: false, message: err });
    const body = {
      sLanguage: 'en-us',
      sClient: String(req.body.sClient).slice(0, 200),
      nDeparture: parseInt(req.body.nDeparture, 10),
      nDestination: parseInt(req.body.nDestination, 10),
      dFromDate: String(req.body.dFromDate).slice(0, 10),
      dToDate: String(req.body.dToDate).slice(0, 10),
      nAgentID: BMI_AGENT_ID,
      travelers: req.body.travelers.slice(0, 20).map(t => ({
        travelerId: Number(t.travelerId),
        genderId: Number(t.genderId),
        dateOfBirth: String(t.dateOfBirth).slice(0, 10),
      })),
    };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep1', body);
    res.json(data);
  } catch (e) {
    console.error('[Step1] ERROR:', e.message, e.stack);
    res.status(500).json({ isSuccess: false, message: `Failed to calculate premiums: ${e.message}` });
  }
});

// Step 2: Select coverages
app.post('/api/quote/step2', async (req, res) => {
  try {
    const err = validateReferenceId(req.body);
    if (err) return res.status(400).json({ isSuccess: false, message: err });
    const body = { ...req.body, nAgentID: BMI_AGENT_ID, sLanguage: req.body.sLanguage || 'en-us' };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep2', body);
    res.json(data);
  } catch (e) {
    console.error('[Step2] ERROR:', e.message, e.stack);
    res.status(500).json({ isSuccess: false, message: `Failed to confirm selection: ${e.message}` });
  }
});

// Step 3: Email illustration
app.post('/api/quote/step3', async (req, res) => {
  try {
    const err = validateReferenceId(req.body);
    if (err) return res.status(400).json({ isSuccess: false, message: err });
    const body = { ...req.body, nAgentID: BMI_AGENT_ID, sLanguage: req.body.sLanguage || 'en-us' };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep3', body);
    res.json(data);
  } catch (e) {
    console.error('[Step3]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to send illustration' });
  }
});

// Step 4: List riders per coverage
app.post('/api/quote/step4', async (req, res) => {
  try {
    const err = validateReferenceId(req.body);
    if (err) return res.status(400).json({ isSuccess: false, message: err });
    const body = { ...req.body, nAgentID: BMI_AGENT_ID, sLanguage: req.body.sLanguage || 'en-us' };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep4', body);
    res.json(data);
  } catch (e) {
    console.error('[Step4]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to load add-ons' });
  }
});

// Step 5: Select riders + promo code
app.post('/api/quote/step5', async (req, res) => {
  try {
    const err = validateReferenceId(req.body);
    if (err) return res.status(400).json({ isSuccess: false, message: err });
    const body = { ...req.body, nAgentID: BMI_AGENT_ID, sLanguage: req.body.sLanguage || 'en-us' };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep5', body);
    res.json(data);
  } catch (e) {
    console.error('[Step5]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to finalize quote' });
  }
});

// Step 6: Send quote email (GET)
app.get('/api/quote/step6', async (req, res) => {
  try {
    if (!req.query.nId) return res.status(400).json({ isSuccess: false, message: 'nId is required' });
    const data = await bmiGet('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep6', { nId: req.query.nId });
    res.json(data);
  } catch (e) {
    console.error('[Step6]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to send quote email' });
  }
});

// Step 7: Pay + issue voucher
// NOTE: Credit card data passes through this proxy. For PCI compliance in production,
// consider having the client post directly to BMI's payment endpoint or using tokenization.
app.post('/api/quote/step7', async (req, res) => {
  try {
    const err = validateStep7(req.body);
    if (err) return res.status(400).json({ isSuccess: false, message: err });
    // Whitelist only expected fields — never forward raw req.body
    const body = {
      sReferenceID: req.body.sReferenceID,
      sContactName: String(req.body.sContactName).slice(0, 200),
      sContactEmail: String(req.body.sContactEmail).slice(0, 200),
      sContactPhone: String(req.body.sContactPhone || '').slice(0, 30),
      sContactComment: String(req.body.sContactComment || '').slice(0, 500),
      sCardNumber: String(req.body.sCardNumber).replace(/\s/g, ''),
      nCardType: parseInt(req.body.nCardType, 10),
      sCardName: String(req.body.sCardName).slice(0, 200),
      sCardCVV: String(req.body.sCardCVV || '').slice(0, 4),
      nCardMonth: parseInt(req.body.nCardMonth, 10),
      nCardYear: parseInt(req.body.nCardYear, 10),
      sPayerEmail: String(req.body.sPayerEmail || '').slice(0, 200),
      nChargeAmount: parseFloat(req.body.nChargeAmount) || 0,
      travelers: (req.body.travelers || []).slice(0, 20).map(t => ({
        travelerId: Number(t.travelerId),
        name: String(t.name || '').slice(0, 100),
        lastName: String(t.lastName || '').slice(0, 100),
        genderId: Number(t.genderId),
        dob: String(t.dob || '').slice(0, 10),
        email: String(t.email || '').slice(0, 200),
        phoneNumber: String(t.phoneNumber || '').slice(0, 30),
        passportNumber: String(t.passportNumber || '').slice(0, 30),
      })),
    };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep7', body);
    res.json(data);
  } catch (e) {
    console.error('[Step7]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Payment processing failed' });
  }
});

// --- Catalog Routes ---

app.get('/api/catalog/countries', async (_req, res) => {
  try {
    const data = await bmiGet('/api/v1/ecommerce/Bmita/MasterCountry_Catalog', { UserLanguage: 1 });
    res.json(data);
  } catch (e) {
    console.error('[Catalog:Countries]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to load countries' });
  }
});

app.get('/api/catalog/destinations', async (_req, res) => {
  try {
    const data = await bmiGet('/api/v1/ecommerce/Bmita/MasterDestination_Catalog', { UserLanguage: 1 });
    res.json(data);
  } catch (e) {
    console.error('[Catalog:Destinations]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to load destinations' });
  }
});

app.get('/api/catalog/genders', async (_req, res) => {
  try {
    const data = await bmiGet('/api/v1/ecommerce/Bmita/MasterGender_Catalog');
    res.json(data);
  } catch (e) {
    console.error('[Catalog:Genders]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to load genders' });
  }
});

app.get('/api/catalog/creditcards', async (_req, res) => {
  try {
    const data = await bmiGet('/api/v1/ecommerce/Bmita/MasterCreditCard_Catalog');
    res.json(data);
  } catch (e) {
    console.error('[Catalog:CreditCards]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to load credit card types' });
  }
});

app.post('/api/catalog/benefits', async (req, res) => {
  try {
    const data = await bmiPost('/api/v1/ecommerce/Bmita/MasterBenefits_Catalog', req.body);
    res.json(data);
  } catch (e) {
    console.error('[Catalog:Benefits]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to load benefits' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
});

// --- Graceful Shutdown ---
const server = app.listen(PORT, () => {
  console.log(`[BMI Proxy] Running on http://localhost:${PORT}`);
});

function shutdown(signal) {
  console.log(`[BMI Proxy] ${signal} received, shutting down gracefully...`);
  clearInterval(cleanupInterval);
  server.close(() => {
    console.log('[BMI Proxy] Closed.');
    process.exit(0);
  });
  // Force close after 10s
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
