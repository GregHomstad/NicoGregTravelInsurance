import { randomUUID } from 'node:crypto';
import { guardPost } from './_lib/middleware.js';
import { validateConsent } from './_lib/validation.js';
import { getSupabase } from './_lib/supabase.js';

/**
 * Current version identifier for the TripKavach Terms & Conditions copy.
 * Bump this whenever terms.html is updated so the audit log can show which
 * version a user agreed to. Keep in sync with TERMS_VERSION in js/quote.js.
 */
export const CURRENT_TERMS_VERSION = '2026-04-10';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  try {
    const err = validateConsent(req.body);
    if (err) return res.status(400).json({ isSuccess: false, message: err });

    // Whitelist + truncate — never forward raw req.body anywhere.
    const record = {
      consentId: randomUUID(),
      termsVersion: String(req.body.termsVersion).slice(0, 32),
      referenceId: String(req.body.referenceId).slice(0, 64),
      email: String(req.body.email).slice(0, 200),
      name: String(req.body.name || '').slice(0, 200),
      phone: String(req.body.phone || '').slice(0, 30),
      agreedAt: String(req.body.agreedAt).slice(0, 40),
      serverTimestamp: new Date().toISOString(),
      ip: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '',
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
    };

    // Structured audit log (always fires, even if Supabase is down).
    console.log('[Consent]', JSON.stringify(record));

    // Persist to Supabase if configured. Non-blocking — failures are logged
    // but the 200 response still returns so payment is never gated on this.
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('consent_records').insert({
        consent_id: record.consentId,
        terms_version: record.termsVersion,
        reference_id: record.referenceId,
        email: record.email,
        name: record.name,
        phone: record.phone,
        agreed_at: record.agreedAt,
        server_timestamp: record.serverTimestamp,
        ip: record.ip,
        user_agent: record.userAgent,
      });
      if (error) console.error('[Consent] Supabase insert failed:', error.message);
    }

    res.status(200).json({ isSuccess: true, consentId: record.consentId });
  } catch (e) {
    console.error('[Consent]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to record consent' });
  }
}
