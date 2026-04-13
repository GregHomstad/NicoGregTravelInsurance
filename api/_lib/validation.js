/**
 * TripKavach — Input Validation Helpers
 * Extracted from server/index.js — pure functions, no dependencies.
 */

export function validateStep1(body) {
  const { sClient, nDeparture, nDestination, dFromDate, dToDate, travelers } = body;
  if (!sClient || typeof sClient !== 'string') return 'Client name is required';
  if (sClient.length > 200) return 'Client name is too long';
  if (!Number.isInteger(Number(nDeparture))) return 'Valid departure country is required';
  if (!Number.isInteger(Number(nDestination))) return 'Valid destination is required';
  if (!dFromDate || !dToDate) return 'Travel dates are required';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dFromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(dToDate)) return 'Invalid date format (expected YYYY-MM-DD)';
  if (!Array.isArray(travelers) || travelers.length === 0) return 'At least one traveler is required';
  if (travelers.length > 20) return 'Maximum 20 travelers allowed';
  for (const t of travelers) {
    if (!t.travelerId || !t.genderId || !t.dateOfBirth) return 'Each traveler must have travelerId, genderId, and dateOfBirth';
  }
  return null;
}

export function validateReferenceId(body) {
  if (!body.sReferenceID || typeof body.sReferenceID !== 'string') return 'Reference ID is required';
  return null;
}

export function validateStep7(body) {
  const { sReferenceID, sContactName, sContactEmail, sCardNumber, nCardType, sCardName, nCardMonth, nCardYear, travelers } = body;
  if (!sReferenceID) return 'Reference ID is required';
  if (!sContactName || !sContactEmail) return 'Contact info is required';
  if (!sCardNumber || !nCardType || !sCardName || !nCardMonth || !nCardYear) return 'Card details are required';
  if (!/^\d{13,19}$/.test(String(sCardNumber).replace(/\s/g, ''))) return 'Invalid card number';
  if (!Array.isArray(travelers) || travelers.length === 0) return 'Traveler details are required';
  return null;
}

export function validateConsent(body) {
  if (!body || typeof body !== 'object') return 'Request body is required';
  if (!body.termsVersion || typeof body.termsVersion !== 'string') return 'termsVersion is required';
  if (!body.referenceId || typeof body.referenceId !== 'string') return 'referenceId is required';
  if (!body.email || typeof body.email !== 'string') return 'email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return 'Invalid email';
  if (!body.agreedAt || typeof body.agreedAt !== 'string') return 'agreedAt is required';
  if (Number.isNaN(Date.parse(body.agreedAt))) return 'agreedAt must be an ISO 8601 timestamp';
  return null;
}
