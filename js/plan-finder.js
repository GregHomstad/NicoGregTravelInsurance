/**
 * TripKavach — Plan Finder Wizard
 * Interactive questionnaire that recommends a plan
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
        // Small timeout to allow display:block to apply before animating opacity
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

  function recommendPlan(a) {
    // Traveler type overrides
    if (a.traveler === 'family') {
      return plans.family;
    }
    if (a.traveler === 'corporate') {
      return plans.corporate;
    }
    if (a.traveler === 'student') {
      return plans.student;
    }

    // Duration-based
    if (a.duration === 'multi') {
      return plans.annual;
    }
    if (a.duration === 'long') {
      return plans.longterm;
    }

    return plans.shortterm;
  }

  const plans = {
    shortterm: {
      name: 'Daily Trip Type (Short-term)',
      description: 'Perfect for trips of 5 to 90 days. Coverage from US$10,000 to US$250,000 with zero deductibles and zero co-pays. Direct payment to hospitals.',
      detailsUrl: 'plans/short-term.html',
      features: ['5-90 day coverage', 'Zero deductibles, zero co-pays', 'Up to US$250,000 medical coverage', 'Pre-existing conditions up to US$6,000', 'COVID-19 included (WHO-approved vaccine required)', '24/7 own Assistance Center']
    },
    longterm: {
      name: 'Long-stay Trip Type',
      description: 'Designed for extended stays of 60 to 365 days. Ideal for IT professionals on assignments, extended family visits, or long-term travel. Ages up to 65.',
      detailsUrl: 'plans/long-term.html',
      features: ['60-365 day coverage', 'Zero deductibles, zero co-pays', 'Up to US$250,000 medical coverage', 'Pre-existing conditions up to US$6,000', 'Direct payment to providers', 'Medical evacuation included']
    },
    annual: {
      name: 'Annual Multi-trip Type',
      description: 'One policy covers unlimited trips for a full year. Choose 30, 45, 60, or 90 days maximum per trip. Must start each trip from India.',
      detailsUrl: 'plans/annual.html',
      features: ['Unlimited trips per year', 'Up to 90 days per trip', 'Zero deductibles, zero co-pays', 'Up to US$250,000 medical coverage', 'Trip cancellation up to US$2,200', '24/7 own Assistance Center']
    },
    family: {
      name: 'Family Trip Type',
      description: 'Cover your whole family under one policy. 2 adults (21-74) plus up to 3 children under 21. Minimum 3 people.',
      detailsUrl: 'plans/family.html',
      features: ['2 adults + up to 3 children', '5-90 day coverage', 'Zero deductibles, zero co-pays', 'Up to US$250,000 medical coverage', 'Pre-existing conditions covered', '24/7 own Assistance Center']
    },
    corporate: {
      name: 'Corporate Trip Type',
      description: 'Bulk day-pool for companies sending employees abroad. Pre-purchase 250+ days, assign to any traveler via self-service platform.',
      detailsUrl: 'plans/corporate.html',
      features: ['Pre-purchase 250+ days', 'Self-administration platform', 'Max 90 days per trip', 'Zero deductibles, zero co-pays', 'Up to US$250,000 medical coverage', 'Direct payment to providers']
    },
    student: {
      name: 'Student Trip Type',
      description: 'Designed for Indian students studying abroad. 4 to 12 months coverage, ages up to 45. Includes virtual doctor and psychological support.',
      detailsUrl: 'plans/student.html',
      features: ['4-12 month coverage', 'Ages up to 45', 'Up to US$100,000 medical coverage', 'Virtual doctor & psychological support', 'Concierge service included', 'Trip & cruise tracking']
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

