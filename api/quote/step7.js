import { bmiPost } from '../_lib/bmi.js';
import { guardPost } from '../_lib/middleware.js';
import { validateStep7 } from '../_lib/validation.js';

export default async function handler(req, res) {
  if (guardPost(req, res)) return;

  try {
    const err = validateStep7(req.body);
    if (err) return res.status(400).json({ isSuccess: false, message: err });

    // Whitelist only expected fields — never forward raw req.body
    const body = {
      sReferenceID: req.body.sReferenceID,
      sContactName: String(req.body.sContactName).slice(0, 200),
      sContactEmail: String(req.body.sContactEmail).slice(0, 200),
      sContactPhone: String(req.body.sContactPhone || '').slice(0, 30),
      sContactComment: String(req.body.sContactComment || '').slice(0, 500),
      sCardNumber: String(req.body.sCardNumber).replace(/\s/g, ''),
      nCardType: parseInt(req.body.nCardType, 10),
      sCardName: String(req.body.sCardName).slice(0, 200),
      sCardCVV: String(req.body.sCardCVV || '').slice(0, 4),
      nCardMonth: parseInt(req.body.nCardMonth, 10),
      nCardYear: parseInt(req.body.nCardYear, 10),
      sPayerEmail: String(req.body.sPayerEmail || '').slice(0, 200),
      nChargeAmount: parseFloat(req.body.nChargeAmount) || 0,
      travelers: (req.body.travelers || []).slice(0, 20).map(t => ({
        travelerId: Number(t.travelerId),
        name: String(t.name || '').slice(0, 100),
        lastName: String(t.lastName || '').slice(0, 100),
        genderId: Number(t.genderId),
        dob: String(t.dob || '').slice(0, 10),
        email: String(t.email || '').slice(0, 200),
        phoneNumber: String(t.phoneNumber || '').slice(0, 30),
        passportNumber: String(t.passportNumber || '').slice(0, 30),
      })),
    };
    const data = await bmiPost('/api/v1/ecommerce/Bmita/BmitaPremiumCalculationStep7', body);
    res.status(200).json(data);
  } catch (e) {
    console.error('[Step7]', e.message);
    res.status(500).json({ isSuccess: false, message: 'Payment processing failed' });
  }
}
