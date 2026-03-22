/**
 * US TravelShield — Plan Finder Wizard
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
      name: 'Short-term Plan',
      description: 'Perfect for trips of 5 to 90 days. Comprehensive medical coverage with no deductibles and no co-pays.',
      detailsUrl: 'plans/short-term.html',
      features: ['5-90 day coverage', 'No deductibles ($0)', 'Pre-existing conditions covered', 'Emergency dental included', '24/7 global assistance']
    },
    longterm: {
      name: 'Long-term Plan',
      description: 'Designed for extended stays of 60 to 365 days. Ideal for students, executives, or long-term visitors.',
      detailsUrl: 'plans/long-term.html',
      features: ['60-365 day coverage', 'No deductibles ($0)', 'Pre-existing conditions covered', 'Emergency evacuation', 'Direct billing available']
    },
    annual: {
      name: 'Annual Multi-trip Plan',
      description: 'One policy covers unlimited trips throughout the calendar year. Most cost-effective for frequent travelers.',
      detailsUrl: 'plans/annual.html',
      features: ['Unlimited trips per year', 'Up to 90 days per trip', 'No deductibles ($0)', 'Full medical coverage', '24/7 global assistance']
    },
    family: {
      name: 'Family Plan',
      description: 'Coverage for your entire family under one convenient policy with group rates.',
      detailsUrl: 'plans/family.html',
      features: ['All family members covered', 'Group discount rates', 'No deductibles ($0)', 'Pre-existing conditions covered', '24/7 global assistance']
    },
    corporate: {
      name: 'Corporate Plan',
      description: 'Flexible group coverage for businesses sending employees to the United States.',
      detailsUrl: 'plans/corporate.html',
      features: ['Flexible group enrollment', 'Dedicated account support', 'No deductibles ($0)', 'Full medical coverage', 'Direct billing available']
    },
    student: {
      name: 'Student Plan',
      description: 'Affordable coverage designed for international students studying in the US.',
      detailsUrl: 'plans/student.html',
      features: ['Academic year coverage', 'Affordable student rates', 'No deductibles ($0)', 'Pre-existing conditions covered', '24/7 global assistance']
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

