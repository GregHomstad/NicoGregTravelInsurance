import { bmiPost, BMI_AGENT_ID } from '../_lib/bmi.js';
import { guardPost } from '../_lib/middleware.js';
import { validateStep1 } from '../_lib/validation.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  try {
    const err = validateStep1(req.body);
    if (err) return res.status(400).json({ isSuccess: false, message: err });

    const body = {
      sLanguage: 'en-us',
      sClient: String(req.body.sClient).slice(0, 200),
      nDeparture: parseInt(req.body.nDeparture, 10),
      nDestination: parseInt(req.body.nDestination, 10),
      dFromDate: String(req.body.dFromDate).slice(0, 10),
      dToDate: String(req.body.dToDate).slice(0, 10),
      nAgentID: BMI_AGENT_ID,
      travelers: req.body.travelers.slice(0, 20).map(t => ({
        travelerId: Number(t.travelerId),
        genderId: Number(t.genderId),
        dateOfBirth: String(t.dateOfBirth).slice(0, 10),
      })),
    };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep1', body);
    res.status(200).json(data);
  } catch (e) {
    console.error('[Step1] ERROR:', e.message);
    res.status(500).json({ isSuccess: false, message: `Failed to calculate premiums: ${e.message}` });
  }
}
