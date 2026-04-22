/**
 * Catalog dispatcher — consolidates 5 endpoints into one serverless function
 * to stay under Vercel Hobby's 12-function limit.
 *
 * Routes:
 *   GET  /api/catalog/countries     → MasterCountry_Catalog
 *   GET  /api/catalog/destinations  → MasterDestination_Catalog
 *   GET  /api/catalog/genders       → MasterGender_Catalog
 *   GET  /api/catalog/creditcards   → MasterCreditCard_Catalog
 *   POST /api/catalog/benefits      → MasterBenefits_Catalog (forwards body)
 */

import { bmiGet, bmiPost } from '../_lib/bmi.js';
import { guardGet, guardPost } from '../_lib/middleware.js';

const GET_CATALOGS = {
  countries:    { endpoint: '/api/v1/ecommerce/Bmita/MasterCountry_Catalog',     params: { UserLanguage: 1 } },
  destinations: { endpoint: '/api/v1/ecommerce/Bmita/MasterDestination_Catalog', params: { UserLanguage: 1 } },
  genders:      { endpoint: '/api/v1/ecommerce/Bmita/MasterGender_Catalog',      params: {} },
  creditcards:  { endpoint: '/api/v1/ecommerce/Bmita/MasterCreditCard_Catalog',  params: {} },
};

export default async function handler(req, res) {
  const name = String(req.query.name || '').toLowerCase();

  if (name === 'benefits') {
    if (guardPost(req, res)) return;
    try {
      const data = await bmiPost('/api/v1/ecommerce/Bmita/MasterBenefits_Catalog', req.body);
      return res.status(200).json(data);
    } catch (e) {
      console.error('[Catalog:Benefits]', e.message);
      return res.status(500).json({ isSuccess: false, message: 'Failed to load benefits' });
    }
  }

  const cfg = GET_CATALOGS[name];
  if (!cfg) {
    return res.status(404).json({ isSuccess: false, message: 'Unknown catalog' });
  }

  if (guardGet(req, res)) return;
  try {
    const data = await bmiGet(cfg.endpoint, cfg.params);
    res.status(200).json(data);
  } catch (e) {
    console.error(`[Catalog:${name}]`, e.message);
    res.status(500).json({ isSuccess: false, message: `Failed to load ${name}` });
  }
}
