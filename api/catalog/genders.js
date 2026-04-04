import { bmiGet } from '../_lib/bmi.js';
import { guardGet } from '../_lib/middleware.js';

export default async function handler(req, res) {
  if (guardGet(req, res)) return;

  try {
    const data = await bmiGet('/api/v1/ecommerce/Bmita/MasterGender_Catalog');
    res.status(200).json(data);
  } catch (e) {
    console.error('[Catalog:Genders]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Failed to load genders' });
  }
}
