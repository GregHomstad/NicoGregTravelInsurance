import { guardGet } from '../../_lib/middleware.js';

export default async function handler(req, res) {
  if (guardGet(req, res)) return;

  const area = String(req.query.area).toUpperCase().slice(0, 2);

  try {
    const response = await fetch(`https://api.weather.gov/alerts/active?area=${area}`, {
      headers: { 'User-Agent': 'TripKavach Travel Monitor (contact@tripkavach.com)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    console.error(`[TravelInfo:Weather] ${area}:`, e.message);
    res.status(502).json({ isSuccess: false, message: 'External API error' });
  }
}
