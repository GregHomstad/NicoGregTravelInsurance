document.addEventListener('DOMContentLoaded', () => {
  const airportTable = document.getElementById('airport-table');
  const weatherGrid = document.getElementById('weather-grid');
  const lastUpdatedEl = document.getElementById('last-updated');

  const AIRPORTS = [
    { code: 'JFK', name: 'JFK – New York' },
    { code: 'ORD', name: 'ORD – Chicago' },
    { code: 'ATL', name: 'ATL – Atlanta' },
    { code: 'LAX', name: 'LAX – Los Angeles' },
    { code: 'SFO', name: 'SFO – San Francisco' }
  ];

  const WEATHER_AREAS = [
    { code: 'NY', label: 'Northeast U.S.', id: 'US-NE' },
    { code: 'FL', label: 'Southeast U.S.', id: 'US-SE' },
    { code: 'IL', label: 'Midwest U.S.', id: 'US-MW' },
    { code: 'CA', label: 'West Coast', id: 'US-WE' }
  ];

  const API_BASE = '/api/travel';

  async function fetchAirportStatus(code) {
    try {
      const res = await fetch(`${API_BASE}/airport-status/${code}`, { headers: { 'x-api-key': import.meta.env.VITE_API_KEY || '' } });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      return data;
    } catch (e) {
      console.error(`Failed to fetch ${code}`, e);
      return null;
    }
  }

  async function fetchWeatherAlerts(areaCode) {
    try {
      const res = await fetch(`${API_BASE}/weather-alerts/${areaCode}`, { headers: { 'x-api-key': import.meta.env.VITE_API_KEY || '' } });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      return data;
    } catch (e) {
      console.error(`Failed to fetch weather for ${areaCode}`, e);
      return null;
    }
  }

  async function updateAirports() {
    for (const airport of AIRPORTS) {
      const row = airportTable.querySelector(`[data-code="${airport.code}"]`).parentElement;
      const statusCell = row.querySelector('.status-cell');
      const reasonCell = row.querySelector('.reason-cell');

      const data = await fetchAirportStatus(airport.code);
      if (data && data.Status) {
        const delay = data.Status.Delay === 'true' || data.Status.Delay === true;
        statusCell.innerHTML = delay 
          ? `<span class="bg-red-500/20 text-red-300 px-2 py-1 rounded">Delayed</span>` 
          : `<span class="bg-green-500/20 text-green-300 px-2 py-1 rounded">Normal</span>`;
        reasonCell.textContent = data.Status.Reason || 'No significant delays';
      } else {
        statusCell.textContent = 'Unavailable';
        reasonCell.textContent = 'Data unavailable';
      }
    }
  }

  async function updateWeather() {
    for (const area of WEATHER_AREAS) {
      const card = weatherGrid.querySelector(`[data-area="${area.id}"]`);
      const alertEl = card.querySelector('.alert-text');

      const data = await fetchWeatherAlerts(area.code);
      if (data && data.features) {
        const count = data.features.length;
        if (count > 0) {
          const topAlert = data.features[0].properties.headline || data.features[0].properties.event;
          alertEl.innerHTML = `<span class="text-orange-400 font-medium">${count} active alerts</span><br><span class="text-xs opacity-80">${topAlert.slice(0, 60)}...</span>`;
        } else {
          alertEl.textContent = 'No active weather alerts';
        }
      } else {
        alertEl.textContent = 'Weather data unavailable';
      }
    }
  }

  function updateTimestamp() {
    lastUpdatedEl.textContent = `Last updated: ${new Date().toUTCString()}`;
  }

  // Initial load
  updateAirports();
  updateWeather();
  updateTimestamp();

  // Refresh every 5 minutes
  setInterval(() => {
    updateAirports();
    updateWeather();
    updateTimestamp();
  }, 300000);
});
