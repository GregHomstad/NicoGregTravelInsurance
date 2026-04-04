/**
 * TripKavach — Serverless Middleware Helpers
 * API key auth, CORS, body size check.
 */

const PROXY_API_KEY = process.env.PROXY_API_KEY;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];

/**
 * Set CORS headers on the response. Returns true if this is a preflight (OPTIONS) request.
 */
export function handleCors(req, res) {
  const origin = req.headers.origin || req.headers.Origin || '';
  const allowed = !origin || ALLOWED_ORIGINS.includes(origin);

  res.setHeader('Access-Control-Allow-Origin', allowed ? (origin || '*') : '');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Check API key. Returns true if unauthorized (and sends the response).
 */
export function checkAuth(req, res) {
  if (!PROXY_API_KEY) return false; // no key configured — dev mode
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== PROXY_API_KEY) {
    res.status(401).json({ isSuccess: false, message: 'Unauthorized' });
    return true;
  }
  return false;
}

/**
 * Check request body size. Returns true if too large (and sends the response).
 */
export function checkBodySize(req, res) {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 100 * 1024) {
    res.status(413).json({ isSuccess: false, message: 'Request too large' });
    return true;
  }
  return false;
}

/**
 * Check HTTP method. Returns true if method doesn't match (and sends the response).
 */
export function checkMethod(req, res, allowed) {
  if (req.method !== allowed) {
    res.status(405).json({ isSuccess: false, message: 'Method not allowed' });
    return true;
  }
  return false;
}

/**
 * Run all common checks for a POST endpoint. Returns true if request was rejected.
 */
export function guardPost(req, res) {
  if (handleCors(req, res)) return true;
  if (checkAuth(req, res)) return true;
  if (checkMethod(req, res, 'POST')) return true;
  if (checkBodySize(req, res)) return true;
  return false;
}

/**
 * Run all common checks for a GET endpoint. Returns true if request was rejected.
 */
export function guardGet(req, res) {
  if (handleCors(req, res)) return true;
  if (checkAuth(req, res)) return true;
  if (checkMethod(req, res, 'GET')) return true;
  return false;
}
