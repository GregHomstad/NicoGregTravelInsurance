import { guardGet } from '../../_lib/middleware.js';

export default async function handler(req, res) {
  if (guardGet(req, res)) return;

  const code = String(req.query.code).toUpperCase().slice(0, 3);

  try {
    const response = await fetch('https://nasstatus.faa.gov/api/airport-status-information', {
      headers: {
        'Accept': 'application/json, text/xml',
        'User-Agent': 'TripKavach Travel Monitor (contact@tripkavach.com)',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`FAA API returned ${response.status}`);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      const airportData = Array.isArray(data) ? data.find(a => a.AirportCode === code) : data;
      res.status(200).json({ Status: airportData || { Delay: 'false', Reason: 'No delays reported' } });
    } else {
      res.status(200).json({ Status: { Delay: 'false', Reason: 'Status available (XML)' } });
    }
  } catch (e) {
    console.error(`[TravelInfo:Airport] ${code}:`, e.message);
    res.status(502).json({ isSuccess: false, message: 'External API error' });
  }
}
