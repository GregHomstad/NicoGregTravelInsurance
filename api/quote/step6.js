import { bmiGet } from '../_lib/bmi.js';
import { guardGet } from '../_lib/middleware.js';

export default async function handler(req, res) {
  if (guardGet(req, res)) return;

  try {
    if (!req.query.nId) return res.status(400).json({ isSuccess: false, message: 'nId is required' });
    const data = await bmiGet('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep6', { nId: req.query.nId });
    res.status(200).json(data);
  } catch (e) {
    console.error('[Step6]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to send quote email' });
  }
}
