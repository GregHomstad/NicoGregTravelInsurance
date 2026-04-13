/**
 * TripKavach — Supabase Client Helper (Serverless)
 * Lazy singleton for Supabase Postgres access.
 * Returns null when env vars are missing — callers degrade to log-only mode.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client = null;

export function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
