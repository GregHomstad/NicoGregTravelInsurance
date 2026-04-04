import { bmiPost, BMI_AGENT_ID } from '../_lib/bmi.js';
import { guardPost } from '../_lib/middleware.js';
import { validateReferenceId } from '../_lib/validation.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  try {
    const err = validateReferenceId(req.body);
    if (err) return res.status(400).json({ isSuccess: false, message: err });

    const body = { ...req.body, nAgentID: BMI_AGENT_ID, sLanguage: req.body.sLanguage || 'en-us' };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep2', body);
    res.status(200).json(data);
  } catch (e) {
    console.error('[Step2] ERROR:', e.message);
    res.status(500).json({ isSuccess: false, message: `Failed to confirm selection: ${e.message}` });
  }
}
