/**
 * Quote wizard dispatcher — consolidates step1-step7 into one serverless
 * function to stay under Vercel Hobby's 12-function limit.
 *
 * Routes:
 *   POST /api/quote/step1  → BmitaPremiumCalculationStep1 (custom body shape)
 *   POST /api/quote/step2  → BmitaPremiumCalculationStep2 (reference + spread)
 *   POST /api/quote/step3  → BmitaPremiumCalculationStep3 (reference + spread)
 *   POST /api/quote/step4  → BmitaPremiumCalculationStep4 (reference + spread)
 *   POST /api/quote/step5  → BmitaPremiumCalculationStep5 (reference + spread)
 *   GET  /api/quote/step6  → BmitaPremiumCalculationStep6 (nId query param)
 *   POST /api/quote/step7  → BmitaPremiumCalculationStep7 (whitelisted payment body)
 */

import { bmiGet, bmiPost, BMI_AGENT_ID } from '../_lib/bmi.js';
import { guardGet, guardPost } from '../_lib/middleware.js';
import { validateStep1, validateStep7, validateReferenceId } from '../_lib/validation.js';

const BMI = '/api/v1/ecommerce/Bmita';
const SIMPLE_STEPS = new Set(['step2', 'step3', 'step4', 'step5']);

export default async function handler(req, res) {
  const step = String(req.query.step || '').toLowerCase();

  // --- Step 6: GET with nId query param ---
  if (step === 'step6') {
    if (guardGet(req, res)) return;
    try {
      if (!req.query.nId) {
        return res.status(400).json({ isSuccess: false, message: 'nId is required' });
      }
      const data = await bmiGet(`${BMI}/BmitaPremiumCalculationStep6`, { nId: req.query.nId });
      return res.status(200).json(data);
    } catch (e) {
      console.error('[Step6]', e.message);
      return res.status(500).json({ isSuccess: false, message: 'Failed to send quote email' });
    }
  }

  // All other steps are POST
  if (guardPost(req, res)) return;

  try {
    // --- Step 1: custom body shape with travelers ---
    if (step === 'step1') {
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
      const data = await bmiPost(`${BMI}/BmitaPremiumCalculationStep1`, body);
      return res.status(200).json(data);
    }

    // --- Step 7: whitelisted payment body + traveler details ---
    if (step === 'step7') {
      const err = validateStep7(req.body);
      if (err) return res.status(400).json({ isSuccess: false, message: err });

      const body = {
        sReferenceID: req.body.sReferenceID,
        sContactName: String(req.body.sContactName).slice(0, 200),
        sContactEmail: String(req.body.sContactEmail).slice(0, 200),
        sContactPhone: String(req.body.sContactPhone || '').slice(0, 30),
        sContactComment: String(req.body.sContactComment || '').slice(0, 500),
        sCardNumber: String(req.body.sCardNumber).replace(/\s/g, ''),
        nCardType: parseInt(req.body.nCardType, 10),
        sCardName: String(req.body.sCardName).slice(0, 200),
        // BMI's Step 7 payment gateway requires the CVV as "cvv" (lowercase, no prefix).
        // Their API doc lists "sCardCVV", but that field is silently ignored and the
        // gateway returns "source.card.securityCode invalid or missing" — verified 2026-04.
        cvv: String(req.body.sCardCVV || '').slice(0, 4),
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
      const data = await bmiPost(`${BMI}/BmitaPremiumCalculationStep7`, body);
      return res.status(200).json(data);
    }

    // --- Steps 2-5: simple reference ID + spread body ---
    if (SIMPLE_STEPS.has(step)) {
      const err = validateReferenceId(req.body);
      if (err) return res.status(400).json({ isSuccess: false, message: err });

      const body = { ...req.body, nAgentID: BMI_AGENT_ID, sLanguage: req.body.sLanguage || 'en-us' };
      const endpoint = `${BMI}/BmitaPremiumCalculation${step.charAt(0).toUpperCase() + step.slice(1)}`;
      const data = await bmiPost(endpoint, body);
      return res.status(200).json(data);
    }

    return res.status(404).json({ isSuccess: false, message: 'Unknown step' });
  } catch (e) {
    console.error(`[${step}]`, e.message);
    res.status(500).json({ isSuccess: false, message: `Request failed: ${e.message}` });
  }
}
