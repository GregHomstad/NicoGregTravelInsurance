import { bmiPost } from '../_lib/bmi.js';
import { guardPost } from '../_lib/middleware.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  try {
    const data = await bmiPost('/api/v1/ecommerce/Bmita/MasterBenefits_Catalog', req.body);
    res.status(200).json(data);
  } catch (e) {
    console.error('[Catalog:Benefits]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to load benefits' });
  }
}
