/**
 * TripKavach Quote Wizard — BMI Travel Assist API Integration
 * Multi-step quote engine: Trip Details → Plans → Riders → Review → Payment → Voucher
 */

const API_BASE = '/api';

// --- State ---
const state = {
  currentStep: 1,
  catalogs: { countries: [], destinations: [], genders: [], creditCards: [] },
  travelers: [],
  quoteParams: {},     // step1 request body
  step1Response: null, // all plans returned
  selectedPlan: null,  // chosen plan object
  selectedCoverageIds: '',
  referenceId: '',
  headerId: null,
  riders: [],          // step4 response
  selectedBenefits: '',
  totalPremium: 0,
};

// --- DOM Refs ---
const $ = (id) => document.getElementById(id);
const stepEls = [];
for (let i = 1; i <= 6; i++) stepEls.push($(`wizard-step-${i}`));

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  initTravelers();
  bindNavigation();
  await loadCatalogs();
});

// --- Catalog Loading ---
async function loadCatalogs() {
  try {
    const [countries, destinations, genders, creditCards] = await Promise.all([
      apiFetch('/api/catalog/countries'),
      apiFetch('/api/catalog/destinations'),
      apiFetch('/api/catalog/genders'),
      apiFetch('/api/catalog/creditcards'),
    ]);

    if (countries.isSuccess) {
      state.catalogs.countries = countries.data?.details || [];
      populateSelect($('q-departure'), state.catalogs.countries, 'nCountryID', 'countryName', 'Select departure country');
    }
    if (destinations.isSuccess) {
      state.catalogs.destinations = destinations.data?.details || [];
      populateSelect($('q-destination'), state.catalogs.destinations, 'nDestination', 'destinationName', 'Select destination');
    }
    if (genders.isSuccess) {
      state.catalogs.genders = genders.data?.details || [];
    }
    if (creditCards.isSuccess) {
      state.catalogs.creditCards = creditCards.data?.details || [];
      populateSelect($('pay-card-type'), state.catalogs.creditCards, 'nCard_Type', 'creditCardDesc', 'Select card type');
    }
  } catch (e) {
    showError('Could not load form data. Please refresh the page. If the problem persists, the API server may not be running.');
    console.error('[Catalogs]', e);
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
        <label class="block text-xs font-medium text-gray-500 mb-1">Date of Birth</label>
        <input type="date" id="t-dob-${id}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
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

  // Bind remove
  const removeBtn = row.querySelector('[data-remove]');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      row.remove();
      renumberTravelers();
    });
  }
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
    const dob = $(`t-dob-${id}`)?.value;
    const genderId = $(`t-gender-${id}`)?.value;
    if (dob && genderId) {
      const [y, m, d] = dob.split('-');
      travelers.push({
        travelerId: i + 1,
        genderId: parseInt(genderId, 10),
        dateOfBirth: `${m}-${d}-${y}`, // MM-DD-YYYY
      });
    }
  });
  return travelers;
}

// --- Step Navigation ---
function bindNavigation() {
  $('step1-next').addEventListener('click', handleStep1);
  $('step2-back').addEventListener('click', () => goToStep(1));
  $('step2-next').addEventListener('click', handleStep2);
  $('step3-back').addEventListener('click', () => goToStep(2));
  $('step3-next').addEventListener('click', handleStep3);
  $('step4-back').addEventListener('click', () => goToStep(3));
  $('step4-next').addEventListener('click', () => goToStep(5));
  $('step5-back').addEventListener('click', () => goToStep(4));
  $('step5-submit').addEventListener('click', handleStep7);
  $('send-email-btn').addEventListener('click', handleSendEmail);
}

function goToStep(n) {
  state.currentStep = n;
  stepEls.forEach((el, i) => {
    el.classList.toggle('hidden', i !== n - 1);
  });
  $('step-label').textContent = `Step ${n} of 6`;
  const names = ['Trip Details', 'Select Plan', 'Optional Add-ons', 'Review Quote', 'Payment', 'Confirmation'];
  $('step-name').textContent = names[n - 1];
  $('progress-bar').style.width = `${(n / 6) * 100}%`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  hideError();
  // Prepare payment step
  if (n === 5) preparePaymentStep();
}

// --- Step 1: Get Quotes ---
async function handleStep1() {
  const departure = $('q-departure').value;
  const destination = $('q-destination').value;
  const fromDate = $('q-from-date').value;
  const toDate = $('q-to-date').value;
  const client = $('q-client').value.trim();
  const travelers = collectTravelers();

  if (!departure || !destination || !fromDate || !toDate || !client || travelers.length === 0) {
    showError('Please fill in all fields and add at least one traveler with date of birth and gender.');
    return;
  }

  const [fy, fm, fd] = fromDate.split('-');
  const [ty, tm, td] = toDate.split('-');

  state.quoteParams = {
    sLanguage: 'en-us',
    sClient: client,
    nDeparture: parseInt(departure, 10),
    nDestination: parseInt(destination, 10),
    dFromDate: `${fm}-${fd}-${fy}`,
    dToDate: `${tm}-${td}-${ty}`,
    travelers,
  };

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
    showError(e.message);
  }
}

// --- Plan Cards Rendering ---
function renderPlanCards(plans) {
  const grid = $('plans-grid');
  grid.innerHTML = '';

  // Group by plan
  const planGroups = {};
  plans.forEach(p => {
    if (!planGroups[p.planId]) {
      planGroups[p.planId] = { planName: p.planName, planId: p.planId, planSeq: p.planSeq, coverages: [], description: p.sShortDescription || '' };
    }
    planGroups[p.planId].coverages.push(p);
  });

  const sortedPlans = Object.values(planGroups).sort((a, b) => a.planSeq - b.planSeq);

  sortedPlans.forEach(plan => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl border-2 border-gray-200 p-5 cursor-pointer hover:border-primary hover:shadow-lg transition-all relative plan-card';
    card.dataset.planId = plan.planId;

    const coverageHtml = plan.coverages
      .sort((a, b) => a.coverageSeq - b.coverageSeq)
      .map(c => `
        <label class="flex items-center justify-between py-1.5 text-sm cursor-pointer">
          <span class="flex items-center gap-2">
            <input type="checkbox" class="coverage-cb rounded text-primary" data-plan-id="${plan.planId}" data-coverage-seq="${c.coverageSeq}" checked>
            ${c.coverageName}
          </span>
          <span class="font-medium text-heading">$${parseFloat(c.tPrice).toFixed(2)}</span>
        </label>
      `).join('');

    card.innerHTML = `
      <h3 class="text-lg font-bold text-heading mb-1">${plan.planName}</h3>
      <p class="text-xs text-gray-500 mb-3">${plan.description}</p>
      <div class="divide-y divide-gray-100">${coverageHtml}</div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('input')) return; // don't toggle on checkbox click
      document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('border-primary', 'ring-2', 'ring-primary/30'));
      card.classList.add('border-primary', 'ring-2', 'ring-primary/30');
      state.selectedPlan = plan;
      $('step2-next').disabled = false;
    });

    grid.appendChild(card);
  });
}

// --- Step 2: Select Plan + Coverages ---
async function handleStep2() {
  if (!state.selectedPlan) { showError('Please select a plan.'); return; }

  const checkboxes = document.querySelectorAll(`.coverage-cb[data-plan-id="${state.selectedPlan.planId}"]:checked`);
  const coverageIds = Array.from(checkboxes).map(cb => cb.dataset.coverageSeq);
  if (coverageIds.length === 0) { showError('Please select at least one coverage.'); return; }

  state.selectedCoverageIds = `{${coverageIds.join(',')}}`;

  showLoading('Loading coverage details...');
  try {
    // Step 2 — confirm selection
    const step2Body = {
      ...state.quoteParams,
      sReferenceID: state.referenceId,
      sCoverageID: state.selectedCoverageIds,
    };
    const step2Res = await apiFetch('/api/quote/step2', 'POST', step2Body);
    if (!step2Res.isSuccess) throw new Error(step2Res.message || 'Failed to confirm selection');

    // Step 4 — get riders for the selected plan + first coverage
    const step4Body = {
      ...state.quoteParams,
      sReferenceID: state.referenceId,
      sPlanID: `{${state.selectedPlan.planId}}`,
      nCoverage: parseInt(coverageIds[0], 10),
    };
    const step4Res = await apiFetch('/api/quote/step4', 'POST', step4Body);
    if (!step4Res.isSuccess) throw new Error(step4Res.message || 'Failed to load add-ons');

    state.riders = step4Res.data?.details || [];
    state.headerId = step2Res.data?.details?.[0]?.headerId || state.headerId;
    renderRiders(state.riders);
    hideLoading();
    goToStep(3);
  } catch (e) {
    hideLoading();
    showError(e.message);
  }
}

// --- Riders Rendering ---
function renderRiders(riders) {
  const container = $('riders-container');
  container.innerHTML = '';

  if (!riders || riders.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">No optional add-ons available for this plan.</p>';
    updateRidersTotal(riders);
    return;
  }

  // Group by traveler
  const byTraveler = {};
  riders.forEach(r => {
    if (!byTraveler[r.travelerID]) byTraveler[r.travelerID] = { description: r.travelerDescription, benefits: [] };
    byTraveler[r.travelerID].benefits.push(r);
  });

  Object.entries(byTraveler).forEach(([tid, group]) => {
    const section = document.createElement('div');
    section.className = 'bg-gray-50 rounded-xl p-4';
    section.innerHTML = `<h4 class="text-sm font-bold text-heading mb-3">${group.description}</h4>`;

    group.benefits.forEach(b => {
      const row = document.createElement('label');
      row.className = 'flex items-center justify-between py-2 text-sm cursor-pointer';
      const isRequired = b.required === 1;
      row.innerHTML = `
        <span class="flex items-center gap-2">
          <input type="checkbox" class="rider-cb rounded text-primary" data-traveler="${tid}" data-benefit="${b.benefit_ID}" ${b.selected === 1 || isRequired ? 'checked' : ''} ${isRequired ? 'disabled' : ''}>
          ${b.benefit_Name} ${isRequired ? '<span class="text-xs text-gray-400">(included)</span>' : ''}
        </span>
        <span class="font-medium text-heading">$${parseFloat(b.premium).toFixed(2)}</span>
      `;
      section.appendChild(row);
    });
    container.appendChild(section);
  });

  // Bind checkbox changes
  container.addEventListener('change', () => updateRidersTotal(riders));
  updateRidersTotal(riders);
}

function updateRidersTotal(riders) {
  // Calculate from checked boxes
  const checked = document.querySelectorAll('.rider-cb:checked');
  if (!riders || riders.length === 0) {
    // Use plan's first coverage price as total
    if (state.selectedPlan) {
      const total = state.selectedPlan.coverages.reduce((sum, c) => sum + parseFloat(c.tPrice), 0);
      state.totalPremium = total;
      $('riders-total-amount').textContent = `$${total.toFixed(2)}`;
    }
    return;
  }
  // Sum up subTotal from rider data if available, else calculate manually
  let total = 0;
  checked.forEach(cb => {
    const tid = cb.dataset.traveler;
    const bid = cb.dataset.benefit;
    const rider = riders.find(r => String(r.travelerID) === tid && String(r.benefit_ID) === bid);
    if (rider) total += parseFloat(rider.premium);
  });
  state.totalPremium = total;
  $('riders-total-amount').textContent = `$${total.toFixed(2)}`;
}

// --- Step 3: Finalize Riders (Step 5 API) ---
async function handleStep3() {
  // Collect selected riders
  const checked = document.querySelectorAll('.rider-cb:checked');
  const benefitPairs = [];
  checked.forEach(cb => {
    benefitPairs.push(cb.dataset.traveler);
    benefitPairs.push(cb.dataset.benefit);
  });

  state.selectedBenefits = benefitPairs.length > 0 ? `{${benefitPairs.join(',')}}` : '';
  const promo = $('q-promo')?.value.trim() || '';

  showLoading('Finalizing your quote...');
  try {
    const step5Body = {
      ...state.quoteParams,
      sReferenceID: state.referenceId,
      sPlanID: `{${state.selectedPlan.planId}}`,
      nCoverage: parseInt(state.selectedCoverageIds.replace(/[{}]/g, '').split(',')[0], 10),
      sBenefits: state.selectedBenefits,
      sPromotionalCode: promo,
    };
    const res = await apiFetch('/api/quote/step5', 'POST', step5Body);
    if (!res.isSuccess) throw new Error(res.message || 'Failed to finalize quote');

    // Update total from response
    if (res.data?.details) {
      const lastItem = res.data.details[res.data.details.length - 1];
      if (lastItem?.total) {
        state.totalPremium = parseFloat(lastItem.total);
      }
    }

    renderReview();
    hideLoading();
    goToStep(4);
  } catch (e) {
    hideLoading();
    showError(e.message);
  }
}

// --- Review Summary ---
function renderReview() {
  const summary = $('review-summary');
  const plan = state.selectedPlan;
  const params = state.quoteParams;

  summary.innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        <p class="text-xs text-gray-500">Plan</p>
        <p class="font-bold text-heading">${plan.planName}</p>
      </div>
      <div class="text-right">
        <p class="text-xs text-gray-500">Total Premium</p>
        <p class="text-2xl font-bold text-primary">$${state.totalPremium.toFixed(2)}</p>
      </div>
    </div>
    <hr class="border-gray-100">
    <div class="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p class="text-gray-500">Travel Dates</p>
        <p class="font-medium text-heading">${params.dFromDate} — ${params.dToDate}</p>
      </div>
      <div>
        <p class="text-gray-500">Travelers</p>
        <p class="font-medium text-heading">${params.travelers.length} traveler${params.travelers.length > 1 ? 's' : ''}</p>
      </div>
      <div>
        <p class="text-gray-500">Client</p>
        <p class="font-medium text-heading">${params.sClient}</p>
      </div>
      <div>
        <p class="text-gray-500">Reference</p>
        <p class="font-medium text-heading text-xs">${state.referenceId || 'N/A'}</p>
      </div>
    </div>
  `;
}

// --- Email Quote (Step 3 + Step 6) ---
async function handleSendEmail() {
  const email = $('q-email').value.trim();
  if (!email) { showError('Please enter an email address.'); return; }

  const statusEl = $('email-status');
  statusEl.textContent = 'Sending...';
  statusEl.className = 'text-sm text-gray-500 mt-2';
  statusEl.classList.remove('hidden');

  try {
    // Step 3 — send illustration
    const step3Body = {
      ...state.quoteParams,
      sReferenceID: state.referenceId,
      sCoverageID: state.selectedCoverageIds,
      sEmailAddress: email,
      nSendQuote: 1,
    };
    await apiFetch('/api/quote/step3', 'POST', step3Body);

    // Step 6 — send quote PDF
    if (state.headerId) {
      await apiFetch(`/api/quote/step6?nId=${state.headerId}`, 'GET');
    }

    statusEl.textContent = '✓ Quote sent to ' + email;
    statusEl.className = 'text-sm text-green-600 mt-2 font-medium';
  } catch (e) {
    statusEl.textContent = 'Failed to send: ' + e.message;
    statusEl.className = 'text-sm text-red-600 mt-2';
  }
}

// --- Payment Step Prep ---
function preparePaymentStep() {
  $('pay-total').textContent = `$${state.totalPremium.toFixed(2)}`;

  // Generate traveler detail fields
  const container = $('traveler-details-container');
  container.innerHTML = '';
  state.quoteParams.travelers.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'bg-gray-50 rounded-xl p-4';
    div.innerHTML = `
      <h4 class="text-sm font-bold text-heading mb-3">Traveler ${i + 1}</h4>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">First Name</label>
          <input type="text" id="td-name-${i}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="First name">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
          <input type="text" id="td-lastname-${i}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Last name">
        </div>
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

// --- Step 7: Payment ---
async function handleStep7() {
  const contactName = $('pay-name').value.trim();
  const contactEmail = $('pay-email').value.trim();
  const contactPhone = $('pay-phone').value.trim();
  const cardType = $('pay-card-type').value;
  const cardNumber = $('pay-card-number').value.replace(/\s/g, '');
  const cardMonth = $('pay-card-month').value;
  const cardYear = $('pay-card-year').value;
  const cardName = $('pay-card-name').value.trim();
  const payerEmail = $('pay-payer-email').value.trim();

  if (!contactName || !contactEmail || !contactPhone || !cardType || !cardNumber || !cardMonth || !cardYear || !cardName || !payerEmail) {
    showError('Please fill in all payment fields.');
    return;
  }

  // Collect traveler details
  const travelers = state.quoteParams.travelers.map((t, i) => ({
    travelerId: t.travelerId,
    name: $(`td-name-${i}`)?.value.trim() || '',
    lastName: $(`td-lastname-${i}`)?.value.trim() || '',
    genderId: t.genderId,
    dob: t.dateOfBirth,
    email: $(`td-email-${i}`)?.value.trim() || '',
    phoneNumber: $(`td-phone-${i}`)?.value.trim() || '',
    passportNumber: $(`td-passport-${i}`)?.value.trim() || '',
  }));

  // Validate each traveler has required fields
  for (const t of travelers) {
    if (!t.name || !t.lastName || !t.email || !t.passportNumber) {
      showError(`Please fill in all fields for Traveler ${t.travelerId}.`);
      return;
    }
  }

  showLoading('Processing payment...');
  try {
    const body = {
      ReferenceID: state.referenceId,
      sContactName: contactName,
      sContactEmail: contactEmail,
      sContactPhone: contactPhone,
      sContactComment: '',
      sCardNumber: cardNumber,
      nCardType: parseInt(cardType, 10),
      sCardName: cardName,
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
    goToStep(6);
  } catch (e) {
    hideLoading();
    showError(e.message);
  }
}

// --- Confirmation ---
function renderConfirmation(details) {
  const el = $('voucher-details');
  el.innerHTML = `
    <div class="flex justify-between py-2">
      <span class="text-gray-600">Voucher Code</span>
      <span class="font-bold text-heading">${details.sVoucherCode || 'N/A'}</span>
    </div>
    <div class="flex justify-between py-2">
      <span class="text-gray-600">Transaction ID</span>
      <span class="font-medium text-heading">${details.sTransactionID || 'N/A'}</span>
    </div>
    <div class="flex justify-between py-2">
      <span class="text-gray-600">Authorization Code</span>
      <span class="font-medium text-heading">${details.sAuthorizationCode || 'N/A'}</span>
    </div>
    <div class="flex justify-between py-2">
      <span class="text-gray-600">Amount Charged</span>
      <span class="font-bold text-primary">$${parseFloat(details.nChargeAmount || state.totalPremium).toFixed(2)}</span>
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

// --- Utilities ---
async function apiFetch(url, method = 'GET', body = null) {
  const opts = { method, headers: {} };
  if (body && method !== 'GET') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  return res.json();
}

function showLoading(text) {
  $('loading-text').textContent = text || 'Loading...';
  $('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
  $('loading-overlay').classList.add('hidden');
}

function showError(msg) {
  $('error-text').textContent = msg;
  $('error-banner').classList.remove('hidden');
}

function hideError() {
  $('error-banner').classList.add('hidden');
}
