/**
 * TripKavach — Plan Finder Wizard
 * 3-step questionnaire: Duration → Pre-existing → Priority
 * Recommends a plan type (Daily or Long-term) + coverage tier (Ultra Plus / VIP / VIP Plus)
 */

const wizard = document.getElementById('plan-finder-wizard');

if (wizard) {
  const steps = wizard.querySelectorAll('.wizard-step');
  const progressBar = document.getElementById('wizard-progress');
  const backBtn = document.getElementById('wizard-back');
  const resultPanel = document.getElementById('wizard-result');

  let currentStep = 0;
  const answers = {};

  const totalSteps = steps.length;

  function showStep(index) {
    steps.forEach((step, i) => {
      if (i === index) {
        step.classList.remove('hidden');
        setTimeout(() => step.classList.add('active'), 10);
      } else {
        step.classList.add('hidden');
        step.classList.remove('active');
      }
    });

    // Update progress
    const pct = ((index + 1) / totalSteps) * 100;
    if (progressBar) {
      progressBar.style.width = pct + '%';
      progressBar.setAttribute('aria-valuenow', index + 1);
      progressBar.setAttribute('aria-valuetext', `Step ${index + 1} of ${totalSteps}`);
    }

    // Back button
    if (backBtn) {
      backBtn.classList.toggle('hidden', index === 0);
    }

    // Focus management
    const heading = steps[index]?.querySelector('h3, h2');
    if (heading) heading.focus({ preventScroll: true });
  }

  function nextStep(answer) {
    const stepEl = steps[currentStep];
    const key = stepEl.dataset.question;
    answers[key] = answer;

    if (currentStep < totalSteps - 1) {
      currentStep++;
      showStep(currentStep);
    } else {
      showResult();
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  }

  function showResult() {
    wizard.classList.add('hidden');
    if (backBtn) backBtn.classList.add('hidden');
    resultPanel.classList.remove('hidden');

    const plan = recommendPlan(answers);

    document.getElementById('result-plan-name').textContent = plan.name;
    document.getElementById('result-plan-desc').textContent = plan.description;
    document.getElementById('result-plan-link').href = plan.detailsUrl;

    // Build features list
    const featuresList = document.getElementById('result-features');
    featuresList.innerHTML = '';
    plan.features.forEach(f => {
      const li = document.createElement('li');
      li.className = 'flex items-center gap-2';
      li.innerHTML = `<svg class="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> ${f}`;
      featuresList.appendChild(li);
    });

    resultPanel.focus({ preventScroll: true });
  }

  // --- Recommendation engine ---
  // Picks plan type (Daily vs Long-term) from duration,
  // then picks coverage tier from priority + pre-existing answers
  function recommendPlan(a) {
    // 1. Determine plan type
    const isLong = a.duration === 'long';
    const planType = isLong ? 'longterm' : 'shortterm';

    // 2. Determine tier
    let tier;
    if (a.priority === 'comprehensive' || (a.preexisting === 'yes' && a.priority !== 'cost')) {
      tier = 'vipplus';
    } else if (a.priority === 'balanced' || a.preexisting === 'yes') {
      tier = 'vip';
    } else {
      tier = 'ultraplus';
    }

    // 3. Build result key
    const key = planType + '_' + tier;
    return results[key];
  }

  // --- Plan + Tier result definitions ---
  const results = {
    // Daily + Ultra Plus
    shortterm_ultraplus: {
      name: 'Daily Plan — Ultra Plus Tier',
      description: 'Affordable coverage for short trips up to 90 days. $30,000 medical coverage with $500 pre-existing conditions limit. Great value for healthy travelers.',
      detailsUrl: 'plans/short-term.html',
      features: [
        '5-90 day coverage · Ages up to 84',
        '$30,000 medical coverage (accident & illness)',
        '$500 pre-existing condition limit',
        '$300 emergency dental',
        '$2,000 trip cancellation',
        'Zero deductibles · Direct hospital payment',
        'COVID-19 included (age ≤ 75)',
        '24/7 Assistance Center · Hindi & English'
      ]
    },
    // Daily + VIP
    shortterm_vip: {
      name: 'Daily Plan — VIP Tier',
      description: 'Strong coverage for short trips up to 90 days. $100,000 medical coverage with $2,000 pre-existing conditions limit. Our most popular tier.',
      detailsUrl: 'plans/short-term.html',
      features: [
        '5-90 day coverage · Ages up to 84',
        '$100,000 medical coverage (accident & illness)',
        '$2,000 pre-existing condition limit',
        '$1,500 emergency dental',
        '$2,000 trip cancellation',
        'Zero deductibles · Direct hospital payment',
        'COVID-19 included (age ≤ 75)',
        '24/7 Assistance Center · Hindi & English'
      ]
    },
    // Daily + VIP Plus
    shortterm_vipplus: {
      name: 'Daily Plan — VIP Plus Tier',
      description: 'Our highest coverage for short trips up to 90 days. $250,000 medical coverage with $6,000 pre-existing conditions limit. Maximum protection and peace of mind.',
      detailsUrl: 'plans/short-term.html',
      features: [
        '5-90 day coverage · Ages up to 84',
        '$250,000 medical coverage (accident & illness)',
        '$6,000 pre-existing condition limit',
        '$1,700 emergency dental',
        'Medical evacuation included (no sub-limit)',
        '$2,200 trip cancellation · $3,000 lost baggage',
        'Zero deductibles · Direct hospital payment',
        '24/7 Assistance Center · Hindi & English'
      ]
    },
    // Long-term + Ultra Plus
    longterm_ultraplus: {
      name: 'Long-term Plan — Ultra Plus Tier',
      description: 'Affordable coverage for extended stays of 60 to 365 days. $30,000 medical coverage. Ideal for budget-conscious travelers on long visits.',
      detailsUrl: 'plans/long-term.html',
      features: [
        '60-365 day coverage · Ages up to 65',
        '$30,000 medical coverage (accident & illness)',
        '$500 pre-existing condition limit',
        '$300 emergency dental',
        'Zero deductibles · Direct hospital payment',
        'Medical evacuation up to $30,000',
        'COVID-19 included (age ≤ 75)',
        '24/7 Assistance Center · Hindi & English'
      ]
    },
    // Long-term + VIP
    longterm_vip: {
      name: 'Long-term Plan — VIP Tier',
      description: 'Strong coverage for extended stays of 60 to 365 days. $100,000 medical coverage with $2,000 pre-existing conditions limit. Popular with IT professionals and long-term visitors.',
      detailsUrl: 'plans/long-term.html',
      features: [
        '60-365 day coverage · Ages up to 65',
        '$100,000 medical coverage (accident & illness)',
        '$2,000 pre-existing condition limit',
        '$1,500 emergency dental',
        'Zero deductibles · Direct hospital payment',
        'Medical evacuation up to $100,000',
        'COVID-19 included (age ≤ 75)',
        '24/7 Assistance Center · Hindi & English'
      ]
    },
    // Long-term + VIP Plus
    longterm_vipplus: {
      name: 'Long-term Plan — VIP Plus Tier',
      description: 'Our highest coverage for extended stays of 60 to 365 days. $250,000 medical coverage with $6,000 pre-existing conditions limit. Maximum protection for long visits.',
      detailsUrl: 'plans/long-term.html',
      features: [
        '60-365 day coverage · Ages up to 65',
        '$250,000 medical coverage (accident & illness)',
        '$6,000 pre-existing condition limit',
        '$1,700 emergency dental',
        'Medical evacuation included (no sub-limit)',
        '$2,200 trip cancellation · $3,000 lost baggage',
        'Zero deductibles · Direct hospital payment',
        '24/7 Assistance Center · Hindi & English'
      ]
    }
  };

  // Event delegation for option buttons
  wizard.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-answer]');
    if (btn) {
      nextStep(btn.dataset.answer);
    }
  });

  // Back button
  if (backBtn) {
    backBtn.addEventListener('click', prevStep);
  }

  // Start over
  const restartBtn = document.getElementById('wizard-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      currentStep = 0;
      Object.keys(answers).forEach(k => delete answers[k]);
      wizard.classList.remove('hidden');
      resultPanel.classList.add('hidden');
      showStep(0);
    });
  }

  // Init
  showStep(0);
} // end if (wizard)
