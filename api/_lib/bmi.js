/**
 * TripKavach — BMI API Helpers (Serverless)
 * Token management, POST/GET helpers for BMI Travel Assist API.
 * Module-level cache survives warm starts within the same Vercel instance.
 */

const BMI_BASE = process.env.BMI_API_BASE || 'https://api.bmicos.com/bmiecommerce/sandbox/v4';
const BMI_AUTH_USER = process.env.BMI_AUTH_USER;
const BMI_AUTH_KEY = process.env.BMI_AUTH_KEY;
export const BMI_AGENT_ID = parseInt(process.env.BMI_AGENT_ID, 10);

const FETCH_TIMEOUT = 20_000;

// --- Token Management (persists across warm invocations) ---
let cachedToken = null;
let tokenExpiry = 0;
let tokenPromise = null;

async function fetchNewToken() {
  if (!BMI_AUTH_USER || !BMI_AUTH_KEY) {
    throw new Error('BMI credentials not configured');
  }
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

// --- BMI API Helpers ---
export async function bmiPost(endpoint, body) {
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

export async function bmiGet(endpoint, params = {}) {
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
