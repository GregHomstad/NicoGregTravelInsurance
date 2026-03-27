import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const BMI_BASE = process.env.BMI_API_BASE || 'https://api.bmicos.com/bmiecommerce/sandbox/v4';
const BMI_AUTH_USER = process.env.BMI_AUTH_USER;
const BMI_AUTH_KEY = process.env.BMI_AUTH_KEY;
const BMI_AGENT_ID = parseInt(process.env.BMI_AGENT_ID || '16111', 10);
const PORT = parseInt(process.env.PORT || '3001', 10);

// --- Token Management ---
let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${BMI_BASE}/api/v1/ecommerce/Token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authUser: BMI_AUTH_USER, authKey: BMI_AUTH_KEY }),
  });
  const json = await res.json();

  if (!json.isSuccess) {
    throw new Error(json.message || 'BMI token authentication failed');
  }

  cachedToken = json.data;
  tokenExpiry = Date.now() + 55 * 60 * 1000; // refresh every 55 min
  console.log('[BMI] Token obtained successfully');
  return cachedToken;
}

async function bmiPost(endpoint, body) {
  const token = await getToken();
  const res = await fetch(`${BMI_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function bmiGet(endpoint, params = {}) {
  const token = await getToken();
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `${BMI_BASE}${endpoint}?${qs}` : `${BMI_BASE}${endpoint}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

// --- Quote Routes ---

// Step 1: Get plans + prices
app.post('/api/quote/step1', async (req, res) => {
  try {
    const body = { ...req.body, nAgentID: BMI_AGENT_ID, sLanguage: req.body.sLanguage || 'en-us' };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep1', body);
    res.json(data);
  } catch (e) {
    console.error('[Step1]', e.message);
    res.status(500).json({ isSuccess: false, message: e.message });
  }
});

// Step 2: Select coverages
app.post('/api/quote/step2', async (req, res) => {
  try {
    const body = { ...req.body, nAgentID: BMI_AGENT_ID, sLanguage: req.body.sLanguage || 'en-us' };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep2', body);
    res.json(data);
  } catch (e) {
    console.error('[Step2]', e.message);
    res.status(500).json({ isSuccess: false, message: e.message });
  }
});

// Step 3: Email illustration
app.post('/api/quote/step3', async (req, res) => {
  try {
    const body = { ...req.body, nAgentID: BMI_AGENT_ID, sLanguage: req.body.sLanguage || 'en-us' };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep3', body);
    res.json(data);
  } catch (e) {
    console.error('[Step3]', e.message);
    res.status(500).json({ isSuccess: false, message: e.message });
  }
});

// Step 4: List riders per coverage
app.post('/api/quote/step4', async (req, res) => {
  try {
    const body = { ...req.body, nAgentID: BMI_AGENT_ID, sLanguage: req.body.sLanguage || 'en-us' };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep4', body);
    res.json(data);
  } catch (e) {
    console.error('[Step4]', e.message);
    res.status(500).json({ isSuccess: false, message: e.message });
  }
});

// Step 5: Select riders + promo code
app.post('/api/quote/step5', async (req, res) => {
  try {
    const body = { ...req.body, nAgentID: BMI_AGENT_ID, sLanguage: req.body.sLanguage || 'en-us' };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep5', body);
    res.json(data);
  } catch (e) {
    console.error('[Step5]', e.message);
    res.status(500).json({ isSuccess: false, message: e.message });
  }
});

// Step 6: Send quote email (GET)
app.get('/api/quote/step6', async (req, res) => {
  try {
    const data = await bmiGet('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep6', { nId: req.query.nId });
    res.json(data);
  } catch (e) {
    console.error('[Step6]', e.message);
    res.status(500).json({ isSuccess: false, message: e.message });
  }
});

// Step 7: Pay + issue voucher
app.post('/api/quote/step7', async (req, res) => {
  try {
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep7', req.body);
    res.json(data);
  } catch (e) {
    console.error('[Step7]', e.message);
    res.status(500).json({ isSuccess: false, message: e.message });
  }
});

// --- Catalog Routes ---

app.get('/api/catalog/countries', async (_req, res) => {
  try {
    const data = await bmiGet('/api/v1/ecommerce/Bmita/MasterCountry_Catalog', { UserLanguage: 1 });
    res.json(data);
  } catch (e) {
    console.error('[Catalog:Countries]', e.message);
    res.status(500).json({ isSuccess: false, message: e.message });
  }
});

app.get('/api/catalog/destinations', async (_req, res) => {
  try {
    const data = await bmiGet('/api/v1/ecommerce/Bmita/MasterDestination_Catalog', { UserLanguage: 1 });
    res.json(data);
  } catch (e) {
    console.error('[Catalog:Destinations]', e.message);
    res.status(500).json({ isSuccess: false, message: e.message });
  }
});

app.get('/api/catalog/genders', async (_req, res) => {
  try {
    const data = await bmiGet('/api/v1/ecommerce/Bmita/MasterGender_Catalog');
    res.json(data);
  } catch (e) {
    console.error('[Catalog:Genders]', e.message);
    res.status(500).json({ isSuccess: false, message: e.message });
  }
});

app.get('/api/catalog/creditcards', async (_req, res) => {
  try {
    const data = await bmiGet('/api/v1/ecommerce/Bmita/MasterCreditCard_Catalog');
    res.json(data);
  } catch (e) {
    console.error('[Catalog:CreditCards]', e.message);
    res.status(500).json({ isSuccess: false, message: e.message });
  }
});

app.post('/api/catalog/benefits', async (req, res) => {
  try {
    const data = await bmiPost('/api/v1/ecommerce/Bmita/MasterBenefits_Catalog', req.body);
    res.json(data);
  } catch (e) {
    console.error('[Catalog:Benefits]', e.message);
    res.status(500).json({ isSuccess: false, message: e.message });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', agentId: BMI_AGENT_ID, apiBase: BMI_BASE });
});

app.listen(PORT, () => {
  console.log(`[BMI Proxy] Running on http://localhost:${PORT}`);
  console.log(`[BMI Proxy] API Base: ${BMI_BASE}`);
  console.log(`[BMI Proxy] Agent ID: ${BMI_AGENT_ID}`);
});
