/**
 * TripKavach API Configuration
 * This key authenticates the frontend against the proxy server.
 * It does NOT contain BMI credentials — those are server-side only.
 */
const TRIPKAVACH_API_KEY = 'seZXyChI_lXoiAPoGnYRiogs2Lyn2q2VY4eVoGqJMYQ';

/**
 * Add standard API headers to a fetch options object
 */
function withApiHeaders(opts = {}) {
  opts.headers = opts.headers || {};
  opts.headers['x-api-key'] = TRIPKAVACH_API_KEY;
  return opts;
}
