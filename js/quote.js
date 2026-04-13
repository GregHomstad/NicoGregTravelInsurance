/**
 * TripKavach Quote Wizard — BMI Travel Assist API Integration
 * 4-step quote engine: Trip Details → Choose Coverage → Review & Pay → Confirmation
 */

const TOTAL_STEPS = 4;
const STEP_NAMES = ['Trip Details', 'Choose Coverage', 'Review & Pay', 'Confirmation'];
const TIER_TAGS = [
  'Solid coverage at an affordable price',
  'Premium protection with extra benefits',
  'Our highest level of coverage',
];

// Coverage tier names we sell (BMI API may return more — we filter to these 3)
const SOLD_TIERS = ['ultra', 'vip', 'vip plus'];

// Rename BMI's "Ultra" tier to "Ultra Plus" for display
const TIER_RENAME = { 'Ultra': 'Ultra Plus', 'ultra': 'Ultra Plus' };

// T&C version identifier. Bump when terms.html changes.
// Keep in sync with CURRENT_TERMS_VERSION in api/consent.js.
const TERMS_VERSION = '2026-04-10';

// --- State ---
const state = {
  currentStep: 1,
  step2Phase: 'plans', // 'plans' | 'addons'
  addonsLoadedForPlan: null,
  catalogs: {
    countries: [],
    destinations: [],
    genders: [{ id: 1, genderDescription: 'Female' }, { id: 2, genderDescription: 'Male' }],
    creditCards: [],
  },
  travelers: [],
  quoteParams: {},
  step1Response: null,
  selectedPlan: null,
  selectedCoverageIds: '',
  referenceId: '',
  headerId: null,
  riders: [],
  selectedBenefits: '',
  totalPremium: 0,
};

// --- DOM Refs ---
const $ = (id) => document.getElementById(id);
const stepEls = [];
for (let i = 1; i <= TOTAL_STEPS; i++) stepEls.push($(`wizard-step-${i}`));

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  initTravelers();
  bindNavigation();
  populateExpiryYears();
  initCardFormatting();
  stepEls[0]?.classList.add('active');
  await loadCatalogs();
});

// --- Fallback Catalog Data ---
const FALLBACK_COUNTRIES = [
  { nCountryID: 84, countryName: 'India' },
  { nCountryID: 10, countryName: 'Argentina' },
  { nCountryID: 16, countryName: 'Brazil' },
  { nCountryID: 32, countryName: 'Colombia' },
  { nCountryID: 110, countryName: 'Mexico' },
  { nCountryID: 138, countryName: 'United Kingdom' },
  { nCountryID: 72, countryName: 'Germany' },
  { nCountryID: 28, countryName: 'China' },
  { nCountryID: 96, countryName: 'Japan' },
  { nCountryID: 24, countryName: 'Chile' },
];
const FALLBACK_DESTINATIONS = [
  { nDestination: 8, destinationName: 'North America' },
  { nDestination: 5, destinationName: 'Europe' },
  { nDestination: 7, destinationName: 'Worldwide' },
  { nDestination: 6, destinationName: 'Latin America' },
  { nDestination: 2, destinationName: 'Asia' },
];
const FALLBACK_GENDERS = [
  { id: 1, genderDescription: 'Female' },
  { id: 2, genderDescription: 'Male' },
];
const FALLBACK_CREDIT_CARDS = [
  { nCard_Type: 4, creditCardDesc: 'Visa' },
  { nCard_Type: 3, creditCardDesc: 'Mastercard' },
  { nCard_Type: 1, creditCardDesc: 'American Express' },
  { nCard_Type: 6, creditCardDesc: 'Discover' },
];

// --- Catalog Loading ---
async function loadCatalogs() {
  state.catalogs.countries = FALLBACK_COUNTRIES;
  state.catalogs.destinations = FALLBACK_DESTINATIONS;
  state.catalogs.genders = FALLBACK_GENDERS;
  state.catalogs.creditCards = FALLBACK_CREDIT_CARDS;
  populateSelect($('q-departure'), state.catalogs.countries, 'nCountryID', 'countryName', 'Select departure country');
  populateSelect($('q-destination'), state.catalogs.destinations, 'nDestination', 'destinationName', 'Select destination');
  populateSelect($('pay-card-type'), state.catalogs.creditCards, 'nCard_Type', 'creditCardDesc', 'Select card type');
  applySmartDefaults();

  try {
    const [countries, destinations, genders, creditCards] = await Promise.all([
      apiFetch('/api/catalog/countries'),
      apiFetch('/api/catalog/destinations'),
      apiFetch('/api/catalog/genders'),
      apiFetch('/api/catalog/creditcards'),
    ]);

    if (countries.isSuccess && countries.data?.details?.length) {
      state.catalogs.countries = countries.data.details;
      populateSelect($('q-departure'), state.catalogs.countries, 'nCountryID', 'countryName', 'Select departure country');
    }
    if (destinations.isSuccess && destinations.data?.details?.length) {
      state.catalogs.destinations = destinations.data.details;
      populateSelect($('q-destination'), state.catalogs.destinations, 'nDestination', 'destinationName', 'Select destination');
    }
    if (genders.isSuccess && genders.data?.details?.length) {
      state.catalogs.genders = genders.data.details;
    }
    if (creditCards.isSuccess && creditCards.data?.details?.length) {
      state.catalogs.creditCards = creditCards.data.details;
      populateSelect($('pay-card-type'), state.catalogs.creditCards, 'nCard_Type', 'creditCardDesc', 'Select card type');
    }
    applySmartDefaults();
  } catch (e) {
    console.warn('[Catalogs] API not available, using fallback data:', e.message);
  }
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dobBounds() {
  const now = new Date();
  const maxDate = localDateStr(now);
  const minD = new Date(now.getFullYear() - 85, now.getMonth(), now.getDate() + 1);
  const minDate = localDateStr(minD);
  return { minDate, maxDate };
}

function applySmartDefaults() {
  const depEl = $('q-departure');
  if (!depEl.value) {
    const indiaOpt = Array.from(depEl.options).find(o => o.value === '84');
    if (indiaOpt) depEl.value = '84';
  }
  const destEl = $('q-destination');
  if (!destEl.value) {
    const naOpt = Array.from(destEl.options).find(o => o.value === '8');
    if (naOpt) destEl.value = '8';
  }
  const today = localDateStr(new Date());
  const fromEl = $('q-from-date');
  const toEl = $('q-to-date');
  if (fromEl) fromEl.min = today;
  if (toEl) toEl.min = today;

  // --- Prefill from homepage quick-quote URL params ---
  const params = new URLSearchParams(window.location.search);
  const pDeparture = params.get('departure');
  const pReturn = params.get('return');
  const pAge = params.get('age');

  if (pDeparture && fromEl && !fromEl.value) {
    fromEl.value = pDeparture;
  }
  if (pReturn && toEl && !toEl.value) {
    toEl.value = pReturn;
  }
  if (pAge) {
    const age = parseInt(pAge, 10);
    if (age >= 0 && age <= 84) {
      // Calculate approximate DOB from age
      const now = new Date();
      const birthYear = now.getFullYear() - age;
      const dob = `${birthYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const dobEl = $('t-dob-1');
      if (dobEl && !dobEl.value) {
        dobEl.value = dob;
        // Trigger the age display update
        dobEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }
}

function populateSelect(el, items, valKey, labelKey, placeholder) {
  el.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item[valKey];
    opt.textContent = item[labelKey];
    el.appendChild(opt);
  });
}

function populateExpiryYears() {
  const el = $('pay-card-year');
  if (!el) return;
  const currentYear = new Date().getFullYear();
  el.innerHTML = '<option value="">YYYY</option>';
  for (let y = currentYear; y <= currentYear + 10; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    el.appendChild(opt);
  }
}

function initCardFormatting() {
  const cardEl = $('pay-card-number');
  if (cardEl) {
    cardEl.addEventListener('input', function () {
      const v = this.value.replace(/\D/g, '').substring(0, 16);
      this.value = v.replace(/(.{4})/g, '$1 ').trim();
    });
  }
  const cvvEl = $('pay-card-cvv');
  if (cvvEl) {
    cvvEl.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').substring(0, 4);
    });
  }
}

// --- Traveler Rows ---
let travelerCount = 0;

function initTravelers() {
  addTravelerRow();
  $('add-traveler-btn').addEventListener('click', addTravelerRow);
}

function addTravelerRow() {
  travelerCount++;
  const id = travelerCount;
  const container = $('travelers-container');
  const row = document.createElement('div');
  row.className = 'bg-gray-50 rounded-xl p-4 relative';
  row.id = `traveler-row-${id}`;
  row.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm font-bold text-heading">Traveler ${id}</span>
      ${id > 1 ? `<button type="button" data-remove="${id}" class="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>` : ''}
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">First Name</label>
        <input type="text" id="t-fname-${id}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="First name">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
        <input type="text" id="t-lname-${id}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Last name">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Date of Birth <span id="t-age-${id}" class="text-gray-400 font-normal"></span></label>
        <input type="date" id="t-dob-${id}" min="${dobBounds().minDate}" max="${dobBounds().maxDate}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Gender</label>
        <select id="t-gender-${id}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
          <option value="">Select</option>
          ${state.catalogs.genders.map(g => `<option value="${g.id}">${g.genderDescription}</option>`).join('')}
        </select>
      </div>
    </div>
  `;
  container.appendChild(row);

  const removeBtn = row.querySelector('[data-remove]');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      row.remove();
      renumberTravelers();
    });
  }

  const dobInput = $(`t-dob-${id}`);
  const updateDobAge = () => {
    const ageSpan = $(`t-age-${id}`);
    if (!dobInput.value) { ageSpan.textContent = ''; return; }
    const birth = new Date(dobInput.value + 'T00:00:00');
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    ageSpan.textContent = `(Age: ${age})`;
  };
  const validateDob = () => {
    if (!dobInput.value) return;
    const { minDate, maxDate } = dobBounds();
    if (dobInput.value < minDate) {
      validateField(dobInput, false, 'Maximum age is 85 years.');
    } else if (dobInput.value > maxDate) {
      validateField(dobInput, false, 'Date of birth cannot be in the future.');
    } else {
      validateField(dobInput, true, '');
    }
    updateDobAge();
  };
  dobInput.addEventListener('change', validateDob);
  dobInput.addEventListener('blur', validateDob);
}

function renumberTravelers() {
  const rows = $('travelers-container').querySelectorAll('[id^="traveler-row-"]');
  rows.forEach((row, i) => {
    row.querySelector('span').textContent = `Traveler ${i + 1}`;
  });
}

function collectTravelers() {
  const rows = $('travelers-container').querySelectorAll('[id^="traveler-row-"]');
  const travelers = [];
  rows.forEach((row, i) => {
    const id = row.id.replace('traveler-row-', '');
    const fname = $(`t-fname-${id}`)?.value.trim() || '';
    const lname = $(`t-lname-${id}`)?.value.trim() || '';
    const dob = $(`t-dob-${id}`)?.value;
    const genderId = $(`t-gender-${id}`)?.value;
    if (fname && lname && dob && genderId) {
      travelers.push({
        travelerId: i + 1,
        firstName: fname,
        lastName: lname,
        genderId: parseInt(genderId, 10),
        dateOfBirth: dob,
      });
    }
  });
  return travelers;
}

// --- Step Navigation ---
function bindNavigation() {
  // Step 1
  $('step1-next').addEventListener('click', handleStep1);
  // Step 2 — Plans phase
  $('step2-back').addEventListener('click', () => goToStep(1));
  $('step2-next').addEventListener('click', handleStep2Continue);
  // Step 2 — Add-ons phase
  $('step2-addons-back').addEventListener('click', showPlansPhase);
  $('step2-addons-next').addEventListener('click', handleAddonsFinalize);
  // Step 3 — Review & Payment
  $('edit-trip-btn').addEventListener('click', () => goToStep(1));
  $('change-plan-btn').addEventListener('click', () => {
    state.step2Phase = 'plans';
    state.addonsLoadedForPlan = null;
    goToStep(2);
  });
  $('step3-back').addEventListener('click', () => goToStep(2));
  $('step3-submit').addEventListener('click', handlePayment);
  $('send-email-btn').addEventListener('click', handleSendEmail);
  $('print-quote-btn').addEventListener('click', () => window.print());
  // Date validation on change/blur
  $('q-from-date').addEventListener('change', validateStartDate);
  $('q-from-date').addEventListener('blur', validateStartDate);
  $('q-to-date').addEventListener('change', validateEndDate);
  $('q-to-date').addEventListener('blur', validateEndDate);
}

function validateStartDate() {
  const val = $('q-from-date').value;
  if (!val) return;
  const selected = new Date(val + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  validateField($('q-from-date'), selected >= today, 'Start date cannot be in the past');
}

function validateEndDate() {
  const val = $('q-to-date').value;
  if (!val) return;
  const selected = new Date(val + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fromVal = $('q-from-date').value;
  if (fromVal) {
    const from = new Date(fromVal + 'T00:00:00');
    if (selected <= from) {
      validateField($('q-to-date'), false, 'End date must be after start date');
      return;
    }
  }
  validateField($('q-to-date'), selected >= today, 'End date must be a future date');
}

function goToStep(n) {
  state.currentStep = n;
  stepEls.forEach((el, i) => {
    if (i === n - 1) {
      el.classList.remove('hidden');
      el.classList.add('active');
    } else {
      el.classList.add('hidden');
      el.classList.remove('active');
    }
  });
  $('step-label').textContent = `Step ${n} of ${TOTAL_STEPS}`;
  $('step-name').textContent = STEP_NAMES[n - 1];
  $('progress-bar').style.width = `${(n / TOTAL_STEPS) * 100}%`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  hideError();

  if (n === 2) {
    if (state.step2Phase === 'addons' && state.riders.length > 0) {
      showAddonsPhase();
    } else {
      showPlansPhase();
    }
  }
  if (n === 3) {
    renderReview();
    preparePaymentStep();
  }
}

function showPlansPhase() {
  state.step2Phase = 'plans';
  $('step2-plans').classList.remove('hidden');
  $('step2-addons').classList.add('hidden');
}

function showAddonsPhase() {
  state.step2Phase = 'addons';
  $('step2-plans').classList.add('hidden');
  $('step2-addons').classList.remove('hidden');
}

// --- Step 1: Get Quotes ---
async function handleStep1() {
  const departure = $('q-departure').value;
  const destination = $('q-destination').value;
  const fromDate = $('q-from-date').value;
  const toDate = $('q-to-date').value;
  const travelers = collectTravelers();

  // Inline validation
  let valid = true;
  valid = validateField($('q-departure'), !!departure, 'Please select a departure country') && valid;
  valid = validateField($('q-destination'), !!destination, 'Please select a destination') && valid;
  valid = validateField($('q-from-date'), !!fromDate, 'Please select a start date') && valid;
  valid = validateField($('q-to-date'), !!toDate, 'Please select an end date') && valid;

  if (!valid) return;

  if (travelers.length === 0) {
    showError('Please add at least one traveler with complete details (name, date of birth, gender).');
    return;
  }

  const from = new Date(fromDate + 'T00:00:00');
  const to = new Date(toDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (from < today) { showError('Start date cannot be in the past.'); return; }
  if (to <= from) { showError('End date must be after start date.'); return; }

  const travelerRows = $('travelers-container').querySelectorAll('[id^="traveler-row-"]');
  if (travelers.length < travelerRows.length) {
    // Highlight missing traveler fields
    travelerRows.forEach(row => {
      const id = row.id.replace('traveler-row-', '');
      const fname = $(`t-fname-${id}`);
      const lname = $(`t-lname-${id}`);
      const dob = $(`t-dob-${id}`);
      const gender = $(`t-gender-${id}`);
      if (fname) validateField(fname, !!fname.value.trim(), 'Required');
      if (lname) validateField(lname, !!lname.value.trim(), 'Required');
      if (dob) validateField(dob, !!dob.value, 'Required');
      if (gender) validateField(gender, !!gender.value, 'Required');
    });
    showError(`Please fill in all fields for all ${travelerRows.length} traveler(s).`);
    return;
  }

  const { minDate, maxDate } = dobBounds();
  for (const t of travelers) {
    if (t.dateOfBirth < minDate) {
      showError(`Traveler ${t.firstName} ${t.lastName}: date of birth cannot be more than 85 years ago.`);
      return;
    }
    if (t.dateOfBirth > maxDate) {
      showError(`Traveler ${t.firstName} ${t.lastName}: date of birth cannot be in the future.`);
      return;
    }
  }

  const client = `${travelers[0].firstName} ${travelers[0].lastName}`;
  state.quoteParams = {
    sLanguage: 'en-us',
    sClient: client,
    nDeparture: parseInt(departure, 10),
    nDestination: parseInt(destination, 10),
    dFromDate: fromDate,
    dToDate: toDate,
    travelers,
  };

  // Reset downstream state
  state.selectedPlan = null;
  state.step2Phase = 'plans';
  state.addonsLoadedForPlan = null;
  state.riders = [];

  showLoading('Calculating your premiums...');
  try {
    const res = await apiFetch('/api/quote/step1', 'POST', state.quoteParams);
    if (!res.isSuccess) throw new Error(res.message || 'Failed to get quotes');

    state.step1Response = res.data;
    state.referenceId = res.data.details?.[0]?.reference || '';
    renderPlanCards(res.data.details || []);
    hideLoading();
    goToStep(2);
  } catch (e) {
    hideLoading();
    showError(e.message, () => handleStep1());
  }
}

// --- Plan Cards ---
function renderPlanCards(plans) {
  const grid = $('plans-grid');
  grid.innerHTML = '';
  // Remove any previous tab bar
  const oldTabs = grid.parentElement.querySelector('.plan-tab-bar');
  if (oldTabs) oldTabs.remove();

  if (!plans || plans.length === 0) {
    grid.innerHTML = '<p class="text-gray-500 text-center py-8 col-span-full">No plans available for this trip. Please adjust your dates or destination.</p>';
    return;
  }

  const planGroups = {};
  plans.forEach(p => {
    if (!planGroups[p.planId]) {
      planGroups[p.planId] = { planName: p.planName, planId: p.planId, planSeq: p.planSeq, coverages: [], description: p.sLongDescription || p.sShortDescription || '' };
    }
    planGroups[p.planId].coverages.push(p);
  });

  const allPlans = Object.values(planGroups).sort((a, b) => a.planSeq - b.planSeq);

  // Only show Daily and Long-term plan types (filter out Annual, Student, Corporate, Family, etc.)
  const ALLOWED_PLAN_TYPES = ['short-term', 'long-term', 'diario', 'larga'];
  const sortedPlans = allPlans.filter(p => {
    const name = translateEsToEn(p.planName || '').toLowerCase();
    return ALLOWED_PLAN_TYPES.some(t => name.includes(t));
  });

  // Fallback: if filter produced nothing, show all (shouldn't happen with normal API)
  const finalPlans = sortedPlans.length > 0 ? sortedPlans : allPlans;

  if (finalPlans.length === 1) {
    renderCoverageTierCards(grid, finalPlans[0]);
  } else {
    const tabBar = document.createElement('div');
    tabBar.className = 'plan-tab-bar flex gap-2 mb-6 overflow-x-auto pb-2';
    finalPlans.forEach((plan, i) => {
      const tab = document.createElement('button');
      tab.className = `px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors plan-type-tab ${i === 0 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;
      tab.textContent = translateEsToEn(plan.planName);
      tab.dataset.planId = plan.planId;
      tab.addEventListener('click', () => {
        tabBar.querySelectorAll('.plan-type-tab').forEach(t => {
          t.className = t.className.replace('bg-primary text-white', 'bg-gray-100 text-gray-600 hover:bg-gray-200');
        });
        tab.className = tab.className.replace('bg-gray-100 text-gray-600 hover:bg-gray-200', 'bg-primary text-white');
        renderCoverageTierCards(grid, plan);
      });
      tabBar.appendChild(tab);
    });
    grid.before(tabBar);
    renderCoverageTierCards(grid, finalPlans[0]);
  }

  $('step2-next').disabled = true;
  const hint = $('plan-hint');
  if (hint) hint.classList.remove('hidden');
}

function renderCoverageTierCards(container, plan) {
  container.innerHTML = '';
  const days = tripDays(state.quoteParams.dFromDate, state.quoteParams.dToDate);

  if (plan.description) {
    const desc = document.createElement('p');
    desc.className = 'text-sm text-gray-500 mb-5 col-span-full';
    desc.textContent = translateEsToEn(plan.description);
    container.appendChild(desc);
  }

  const allTiers = plan.coverages.sort((a, b) => a.coverageSeq - b.coverageSeq);

  // Filter to only the 3 tiers we sell (Ultra→Ultra Plus, VIP, VIP Plus)
  const tiers = allTiers.filter(t => {
    const name = translateEsToEn(t.coverageName || '').toLowerCase().trim();
    return SOLD_TIERS.some(sold => name === sold || name.includes(sold));
  });

  // Fallback: if filter produced nothing (unexpected API shape), show all
  const finalTiers = tiers.length > 0 ? tiers : allTiers;
  const popularIndex = finalTiers.length >= 3 ? 1 : -1;

  finalTiers.forEach((tier, i) => {
    const card = document.createElement('div');
    const isPopular = i === popularIndex;
    const perDay = days > 0 ? (parseFloat(tier.tPrice) / days).toFixed(2) : '\u2014';
    const tagline = TIER_TAGS[Math.min(i, TIER_TAGS.length - 1)];

    // Rename Ultra → Ultra Plus for display
    let displayName = translateEsToEn(tier.coverageName);
    if (TIER_RENAME[displayName]) displayName = TIER_RENAME[displayName];

    card.className = `bg-white rounded-2xl border-2 border-gray-200 p-5 cursor-pointer hover:border-primary hover:shadow-lg transition-all relative plan-card ${isPopular ? 'shadow-md' : ''}`;
    card.dataset.planId = plan.planId;
    card.dataset.coverageSeq = tier.coverageSeq;

    card.innerHTML = `
      ${isPopular ? '<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</div>' : ''}
      <h3 class="text-lg font-bold text-heading mb-1">${sanitize(displayName)}</h3>
      <p class="text-xs text-gray-500 mb-3">${tagline}</p>
      <p class="text-3xl font-bold text-primary">${formatCurrency(tier.tPrice)}</p>
      <p class="text-xs text-gray-400 mt-1">$${perDay}/day &middot; ${days} day${days !== 1 ? 's' : ''}</p>
      ${tier.brochure ? `<a href="${sanitize(tier.brochure)}" target="_blank" class="inline-flex items-center gap-1 mt-4 text-xs text-primary hover:underline font-medium" onclick="event.stopPropagation()"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>View full benefits</a>` : ''}
    `;

    card.addEventListener('click', () => {
      container.querySelectorAll('.plan-card').forEach(c => {
        c.classList.remove('border-primary', 'ring-2', 'ring-primary/20');
        c.classList.add('border-gray-200');
        c.querySelector('.selected-indicator')?.remove();
      });
      card.classList.remove('border-gray-200');
      card.classList.add('border-primary', 'ring-2', 'ring-primary/20');

      const indicator = document.createElement('div');
      indicator.className = 'selected-indicator absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center';
      indicator.innerHTML = '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
      card.appendChild(indicator);

      // Track whether add-ons need reloading
      const newKey = `${plan.planId}-${tier.coverageSeq}`;
      if (state.addonsLoadedForPlan !== newKey) {
        state.addonsLoadedForPlan = null;
      }

      state.selectedPlan = {
        planName: plan.planName,
        planId: plan.planId,
        planSeq: plan.planSeq,
        coverages: [tier],
        description: plan.description,
      };
      state.totalPremium = parseFloat(tier.tPrice);
      $('step2-next').disabled = false;
      const hint = $('plan-hint');
      if (hint) hint.classList.add('hidden');
    });

    container.appendChild(card);
  });
}

// --- Step 2 Continue: Load riders (API Step 2 + Step 4) ---
async function handleStep2Continue() {
  if (!state.selectedPlan) { showError('Please select a coverage tier.'); return; }

  const coverageId = String(state.selectedPlan.coverages[0].coverageSeq);
  state.selectedCoverageIds = coverageId;

  showLoading('Loading coverage options...');
  try {
    // Confirm selection (API Step 2)
    const step2Body = {
      ...state.quoteParams,
      sReferenceID: state.referenceId,
      sCoverageID: state.selectedCoverageIds,
    };
    const step2Res = await apiFetch('/api/quote/step2', 'POST', step2Body);
    if (!step2Res.isSuccess && step2Res.code !== 0) throw new Error(step2Res.message || 'Failed to confirm selection');

    // Get riders (API Step 4)
    const step4Body = {
      ...state.quoteParams,
      sReferenceID: state.referenceId,
      sPlanID: String(state.selectedPlan.planId),
      nCoverage: parseInt(coverageId, 10),
    };
    const step4Res = await apiFetch('/api/quote/step4', 'POST', step4Body);
    if (!step4Res.isSuccess) throw new Error(step4Res.message || 'Failed to load add-ons');

    state.riders = step4Res.data?.details || [];
    state.headerId = step2Res.data?.details?.[0]?.headerId || state.headerId;
    state.addonsLoadedForPlan = `${state.selectedPlan.planId}-${state.selectedPlan.coverages[0].coverageSeq}`;

    hideLoading();

    if (state.riders.length > 0) {
      renderRiders(state.riders);
      showAddonsPhase();
    } else {
      // No riders — finalize and proceed directly
      await finalizeAndProceed();
    }
  } catch (e) {
    hideLoading();
    showError(e.message, () => handleStep2Continue());
  }
}

// --- Riders ---
function renderRiders(riders) {
  const container = $('riders-container');
  container.innerHTML = '';

  if (!riders || riders.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">No optional add-ons available for this plan.</p>';
    updateRidersTotal(riders);
    return;
  }

  const byTraveler = {};
  riders.forEach(r => {
    if (!byTraveler[r.travelerID]) byTraveler[r.travelerID] = { description: r.travelerDescription, benefits: [] };
    byTraveler[r.travelerID].benefits.push(r);
  });

  Object.entries(byTraveler).forEach(([tid, group]) => {
    const section = document.createElement('div');
    section.className = 'bg-gray-50 rounded-xl p-4';
    const label = travelerLabel(group.description, parseInt(tid, 10));
    section.innerHTML = `<h4 class="text-sm font-bold text-heading mb-3">${sanitize(label)}</h4>`;

    group.benefits.forEach(b => {
      const row = document.createElement('label');
      row.className = 'flex items-center justify-between py-2 text-sm cursor-pointer';
      const isRequired = b.required === 1;
      row.innerHTML = `
        <span class="flex items-center gap-2">
          <input type="checkbox" class="rider-cb rounded text-primary" data-traveler="${tid}" data-benefit="${b.benefit_ID}" ${b.selected === 1 || isRequired ? 'checked' : ''} ${isRequired ? 'disabled' : ''}>
          ${sanitize(translateEsToEn(b.benefit_Name))} ${isRequired ? '<span class="text-xs text-gray-400">(included)</span>' : ''}
        </span>
        <span class="font-medium text-heading">${formatCurrency(b.premium)}</span>
      `;
      section.appendChild(row);
    });
    container.appendChild(section);
  });

  const handler = () => updateRidersTotal(riders);
  if (container._ridersHandler) container.removeEventListener('change', container._ridersHandler);
  container._ridersHandler = handler;
  container.addEventListener('change', handler);
  updateRidersTotal(riders);
}

function updateRidersTotal(riders) {
  const checked = document.querySelectorAll('.rider-cb:checked');
  if (!riders || riders.length === 0) {
    if (state.selectedPlan) {
      const total = state.selectedPlan.coverages.reduce((sum, c) => sum + parseFloat(c.tPrice), 0);
      state.totalPremium = total;
      $('riders-total-amount').textContent = formatCurrency(total);
    }
    return;
  }
  let total = 0;
  checked.forEach(cb => {
    const tid = cb.dataset.traveler;
    const bid = cb.dataset.benefit;
    const rider = riders.find(r => String(r.travelerID) === tid && String(r.benefit_ID) === bid);
    if (rider) total += parseFloat(rider.premium);
  });
  state.totalPremium = total;
  $('riders-total-amount').textContent = formatCurrency(total);
}

// --- Finalize Riders (API Step 5) and proceed to Step 3 ---
async function handleAddonsFinalize() {
  await finalizeAndProceed();
}

async function finalizeAndProceed() {
  const checked = document.querySelectorAll('.rider-cb:checked');
  const benefitPairs = [];
  checked.forEach(cb => {
    benefitPairs.push(cb.dataset.traveler);
    benefitPairs.push(cb.dataset.benefit);
  });

  state.selectedBenefits = benefitPairs.length > 0 ? benefitPairs.join(',') : '';
  const promo = $('q-promo')?.value.trim() || '';

  showLoading('Finalizing your quote...');
  try {
    const step5Body = {
      ...state.quoteParams,
      sReferenceID: state.referenceId,
      sPlanID: String(state.selectedPlan.planId),
      nCoverage: parseInt(state.selectedCoverageIds.split(',')[0], 10),
      sBenefits: state.selectedBenefits,
      sPromotionalCode: promo,
    };
    const res = await apiFetch('/api/quote/step5', 'POST', step5Body);
    if (!res.isSuccess) throw new Error(res.message || 'Failed to finalize quote');

    if (res.data?.details) {
      const lastItem = res.data.details[res.data.details.length - 1];
      if (lastItem?.total) state.totalPremium = parseFloat(lastItem.total);
    }

    // Fallback: if totalPremium is still 0, use plan price
    if (state.totalPremium === 0 && state.selectedPlan) {
      state.totalPremium = state.selectedPlan.coverages.reduce((sum, c) => sum + parseFloat(c.tPrice), 0);
    }

    hideLoading();
    goToStep(3);
  } catch (e) {
    hideLoading();
    showError(e.message, () => finalizeAndProceed());
  }
}

// --- Review Summary ---
function renderReview() {
  const summary = $('review-summary');
  const plan = state.selectedPlan;
  const params = state.quoteParams;
  const days = tripDays(params.dFromDate, params.dToDate);
  const tierName = plan.coverages[0] ? translateEsToEn(plan.coverages[0].coverageName) : '';

  summary.innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        <p class="text-xs text-gray-500">Plan</p>
        <p class="font-bold text-heading">${sanitize(translateEsToEn(plan.planName))}</p>
        <p class="text-sm text-primary font-medium">${sanitize(tierName)}</p>
      </div>
      <div class="text-right">
        <p class="text-xs text-gray-500">Total Premium</p>
        <p class="text-2xl font-bold text-primary">${formatCurrency(state.totalPremium)}</p>
      </div>
    </div>
    <hr class="border-gray-100">
    <div class="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p class="text-gray-500">Travel Dates</p>
        <p class="font-medium text-heading">${formatDate(params.dFromDate)} \u2014 ${formatDate(params.dToDate)}</p>
      </div>
      <div>
        <p class="text-gray-500">Duration</p>
        <p class="font-medium text-heading">${days} day${days !== 1 ? 's' : ''}</p>
      </div>
      <div>
        <p class="text-gray-500">Travelers</p>
        <p class="font-medium text-heading">${params.travelers.map(t => `${sanitize(t.firstName)} ${sanitize(t.lastName)}`).join(', ')}</p>
      </div>
      <div>
        <p class="text-gray-500">Reference</p>
        <p class="font-medium text-heading text-xs">${sanitize(state.referenceId || 'N/A')}</p>
      </div>
    </div>
  `;
}

// --- Email Quote ---
async function handleSendEmail() {
  const sendBtn = $('send-email-btn');
  if (sendBtn.disabled) return;
  sendBtn.disabled = true;

  const email = $('q-email').value.trim();
  if (!email || !isValidEmail(email)) {
    showError('Please enter a valid email address.');
    sendBtn.disabled = false;
    return;
  }

  const statusEl = $('email-status');
  const spinnerEl = $('send-email-spinner');
  const textEl = $('send-email-text');
  textEl.textContent = 'Sending...';
  spinnerEl.classList.remove('hidden');
  statusEl.classList.add('hidden');

  try {
    const step3Body = {
      ...state.quoteParams,
      sReferenceID: state.referenceId,
      sCoverageID: state.selectedCoverageIds,
      sEmailAddress: email,
      nSendQuote: 1,
    };
    await apiFetch('/api/quote/step3', 'POST', step3Body);

    if (state.headerId) {
      await apiFetch(`/api/quote/step6?nId=${state.headerId}`, 'GET');
    }

    statusEl.textContent = 'Quote sent to ' + email;
    statusEl.className = 'text-sm text-green-600 mt-2 font-medium';
    statusEl.classList.remove('hidden');
  } catch (e) {
    statusEl.textContent = 'Failed to send: ' + e.message;
    statusEl.className = 'text-sm text-red-600 mt-2';
    statusEl.classList.remove('hidden');
  } finally {
    textEl.textContent = 'Send Quote';
    spinnerEl.classList.add('hidden');
    sendBtn.disabled = false;
  }
}

// --- Payment Step Prep ---
function preparePaymentStep() {
  $('pay-total').textContent = formatCurrency(state.totalPremium);

  // Pre-fill contact info from Traveler 1
  const t1 = state.quoteParams.travelers[0];
  if (t1 && !$('pay-name').value) {
    $('pay-name').value = `${t1.firstName} ${t1.lastName}`;
  }

  // Generate traveler detail fields
  const container = $('traveler-details-container');
  container.innerHTML = '';
  state.quoteParams.travelers.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'bg-gray-50 rounded-xl p-4';
    div.innerHTML = `
      <h4 class="text-sm font-bold text-heading mb-3">${sanitize(t.firstName)} ${sanitize(t.lastName)}</h4>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input type="email" id="td-email-${i}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="email@example.com">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Phone</label>
          <input type="tel" id="td-phone-${i}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="+91 XXXXX XXXXX">
        </div>
        <div class="col-span-2">
          <label class="block text-xs font-medium text-gray-500 mb-1">Passport Number</label>
          <input type="text" id="td-passport-${i}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Passport/ID number">
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// --- Payment Handler (API Step 7) ---
async function handlePayment() {
  const submitBtn = $('step3-submit');
  if (submitBtn.disabled) return;

  const contactName = $('pay-name').value.trim();
  const contactEmail = $('pay-email').value.trim();
  const contactPhone = $('pay-phone').value.trim();
  const cardType = $('pay-card-type').value;
  const cardNumber = $('pay-card-number').value.replace(/\s/g, '');
  const cardMonth = $('pay-card-month').value;
  const cardYear = $('pay-card-year').value;
  const cardName = $('pay-card-name').value.trim();
  const cardCvv = $('pay-card-cvv')?.value.trim() || '';
  const payerEmail = $('pay-payer-email').value.trim();

  // Inline validation
  let valid = true;
  valid = validateField($('pay-name'), !!contactName, 'Required') && valid;
  valid = validateField($('pay-email'), !!contactEmail && isValidEmail(contactEmail), 'Valid email required') && valid;
  valid = validateField($('pay-phone'), !!contactPhone, 'Required') && valid;
  valid = validateField($('pay-card-type'), !!cardType, 'Required') && valid;
  valid = validateField($('pay-card-number'), cardNumber.length >= 13 && cardNumber.length <= 19, 'Valid card number required') && valid;
  valid = validateField($('pay-card-month'), !!cardMonth, 'Required') && valid;
  valid = validateField($('pay-card-year'), !!cardYear, 'Required') && valid;
  valid = validateField($('pay-card-cvv'), cardCvv.length >= 3 && cardCvv.length <= 4, '3\u20134 digits') && valid;
  valid = validateField($('pay-card-name'), !!cardName, 'Required') && valid;
  valid = validateField($('pay-payer-email'), !!payerEmail && isValidEmail(payerEmail), 'Valid email required') && valid;

  // Terms & Conditions
  const termsChecked = $('terms-agree')?.checked;
  const termsErr = $('terms-error');
  if (!termsChecked) {
    if (termsErr) termsErr.classList.remove('hidden');
    valid = false;
  } else {
    if (termsErr) termsErr.classList.add('hidden');
  }

  if (!valid) { showError('Please fix the highlighted fields.'); return; }

  // Record T&C agreement audit trail before attempting payment, so we have
  // proof of consent even if the BMI payment call fails downstream.
  // Failures here are logged but do not block the user.
  try {
    const consentRes = await apiFetch('/api/consent', 'POST', {
      termsVersion: TERMS_VERSION,
      referenceId: state.referenceId,
      email: payerEmail,
      name: contactName,
      phone: contactPhone,
      agreedAt: new Date().toISOString(),
    });
    if (consentRes?.isSuccess) state.consentId = consentRes.consentId;
  } catch (e) {
    console.warn('[Consent] Failed to record:', e.message);
  }

  // Validate traveler details
  const travelers = state.quoteParams.travelers.map((t, i) => ({
    travelerId: t.travelerId,
    name: t.firstName,
    lastName: t.lastName,
    genderId: t.genderId,
    dob: t.dateOfBirth,
    email: $(`td-email-${i}`)?.value.trim() || '',
    phoneNumber: $(`td-phone-${i}`)?.value.trim() || '',
    passportNumber: $(`td-passport-${i}`)?.value.trim() || '',
  }));

  for (const t of travelers) {
    if (!t.email || !t.passportNumber) {
      showError(`Please fill in email and passport for ${t.name} ${t.lastName}.`);
      return;
    }
  }

  submitBtn.disabled = true;
  showLoading('Processing payment...');
  try {
    const body = {
      sReferenceID: state.referenceId,
      sContactName: contactName,
      sContactEmail: contactEmail,
      sContactPhone: contactPhone,
      sContactComment: '',
      sCardNumber: cardNumber,
      nCardType: parseInt(cardType, 10),
      sCardName: cardName,
      sCardCVV: cardCvv,
      nCardMonth: parseInt(cardMonth, 10),
      nCardYear: parseInt(cardYear, 10),
      sPayerEmail: payerEmail,
      nChargeAmount: state.totalPremium,
      travelers,
    };

    const res = await apiFetch('/api/quote/step7', 'POST', body);
    if (!res.isSuccess) throw new Error(res.message || 'Payment failed');

    const details = res.data?.details || res.data || {};
    renderConfirmation(details);
    hideLoading();
    goToStep(4);
  } catch (e) {
    hideLoading();
    showError(e.message, () => handlePayment());
    submitBtn.disabled = false;
  }
}

// --- Confirmation ---
function renderConfirmation(details) {
  const el = $('voucher-details');
  el.innerHTML = `
    <div class="flex justify-between py-2">
      <span class="text-gray-600">Voucher Code</span>
      <span class="font-bold text-heading">${sanitize(details.sVoucherCode || 'N/A')}</span>
    </div>
    <div class="flex justify-between py-2">
      <span class="text-gray-600">Transaction ID</span>
      <span class="font-medium text-heading">${sanitize(details.sTransactionID || 'N/A')}</span>
    </div>
    <div class="flex justify-between py-2">
      <span class="text-gray-600">Authorization Code</span>
      <span class="font-medium text-heading">${sanitize(details.sAuthorizationCode || 'N/A')}</span>
    </div>
    <div class="flex justify-between py-2">
      <span class="text-gray-600">Amount Charged</span>
      <span class="font-bold text-primary">${formatCurrency(details.nChargeAmount || state.totalPremium)}</span>
    </div>
  `;

  const downloadLink = $('voucher-download-link');
  if (details.voucherReport) {
    downloadLink.href = details.voucherReport;
    downloadLink.classList.remove('hidden');
  } else {
    downloadLink.classList.add('hidden');
  }
}

// ============================================================
// Utilities
// ============================================================

async function apiFetch(url, method = 'GET', body = null) {
  if (!navigator.onLine) {
    throw new Error('You appear to be offline. Please check your connection and try again.');
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  const opts = { method, headers: { 'x-api-key': TRIPKAVACH_API_KEY }, signal: controller.signal };
  if (body && method !== 'GET') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      if (res.status === 401) throw new Error('Authentication failed. Please refresh the page and try again.');
      if (res.status >= 500) throw new Error('Our servers are unavailable. Please try again in a moment.');
      throw new Error(`Request failed (${res.status}). Please try again.`);
    }
    return res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The request took too long. Please try again.');
    if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
      throw new Error('Unable to connect to the server. Please check your internet connection.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

function sanitize(str) {
  if (!str || typeof str !== 'string') return str || '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatCurrency(amount) {
  return `$${parseFloat(amount).toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function tripDays(from, to) {
  if (!from || !to) return 0;
  const ms = new Date(to) - new Date(from);
  return Math.max(1, Math.ceil(ms / 86400000));
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function travelerLabel(apiDescription, travelerId) {
  const t = state.quoteParams.travelers?.find(t => t.travelerId === travelerId);
  if (t) return `${t.firstName} ${t.lastName}`;
  return translateEsToEn(apiDescription || `Traveler ${travelerId}`);
}

function validateField(el, isValid, message) {
  if (!el) return true;
  const wrapper = el.closest('div');
  let errorEl = wrapper?.querySelector('.field-error');
  if (!isValid) {
    el.classList.add('border-red-500');
    el.classList.remove('border-gray-300');
    if (wrapper && !errorEl) {
      errorEl = document.createElement('p');
      errorEl.className = 'field-error text-xs text-red-500 mt-1';
      wrapper.appendChild(errorEl);
    }
    if (errorEl) errorEl.textContent = message;
    return false;
  } else {
    el.classList.remove('border-red-500');
    el.classList.add('border-gray-300');
    errorEl?.remove();
    return true;
  }
}

function translateEsToEn(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/Cl\u00e1sico/gi, 'Classic')
    .replace(/Clasico/gi, 'Classic')
    .replace(/Diario/gi, 'Short-term')
    .replace(/Larga Estad\u00eda/gi, 'Long-term')
    .replace(/Larga Estadia/gi, 'Long-term')
    .replace(/Anual Multiviaje(s?)/gi, 'Annual Multi-trip')
    .replace(/Estudiantil/gi, 'Student')
    .replace(/Familiar/gi, 'Family')
    .replace(/Corporativo/gi, 'Corporate')
    .replace(/Futura Mam\u00e1/gi, 'Maternity')
    .replace(/Futura Mama/gi, 'Maternity')
    .replace(/Repatriaci\u00f3n Sanitaria/gi, 'Medical Evacuation')
    .replace(/Repatriaci\u00f3n Funeraria/gi, 'Repatriation of Remains')
    .replace(/Repatriaci[o\u00f3]n/gi, 'Repatriation')
    .replace(/Asistencia Legal/gi, 'Legal Assistance')
    .replace(/Asistencia M[e\u00e9]dica/gi, 'Medical Assistance')
    .replace(/Compensaci[o\u00f3]n por Equipaje/gi, 'Baggage Compensation')
    .replace(/Gastos M[e\u00e9]dicos/gi, 'Medical Expenses')
    .replace(/Cancelaci[o\u00f3]n de Viaje/gi, 'Trip Cancellation')
    .replace(/Demora de Equipaje/gi, 'Baggage Delay')
    .replace(/P[e\u00e9]rdida de Equipaje/gi, 'Baggage Loss')
    .replace(/Accidente Personal/gi, 'Personal Accident')
    .replace(/P[e\u00e9]rdida de Documentos/gi, 'Loss of Documents')
    .replace(/Odontol[o\u00f3]gica/gi, 'Dental')
    .replace(/Regreso Anticipado/gi, 'Early Return')
    .replace(/Muerte Accidental/gi, 'Accidental Death')
    .replace(/Traslado de Familiar/gi, 'Family Transfer')
    .replace(/Hospedaje por Convalecencia/gi, 'Convalescence Hotel')
    .replace(/Vuelo Perdido/gi, 'Missed Flight')
    .replace(/Demora de Vuelo/gi, 'Flight Delay')
    .replace(/Transferencia de Fondos/gi, 'Fund Transfer')
    .replace(/Fianza Legal/gi, 'Legal Bail Fund');
}

function showLoading(text) {
  $('loading-text').textContent = text || 'Loading...';
  $('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
  $('loading-overlay').classList.add('hidden');
}

function showError(msg, retryFn) {
  $('error-text').textContent = msg;
  const retryBtn = $('error-retry');
  if (retryFn && retryBtn) {
    retryBtn.classList.remove('hidden');
    retryBtn.onclick = () => { hideError(); retryFn(); };
  } else if (retryBtn) {
    retryBtn.classList.add('hidden');
  }
  // Show contact link for server/connection errors
  const contactLink = $('error-contact');
  if (contactLink) {
    const isServerError = msg.includes('unavailable') || msg.includes('Unable to connect') || msg.includes('offline');
    contactLink.classList.toggle('hidden', !isServerError);
  }
  $('error-banner').classList.remove('hidden');
  $('error-banner').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  $('error-banner').classList.add('hidden');
}
