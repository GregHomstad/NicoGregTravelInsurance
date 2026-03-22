/**
 * US TravelShield — Main JavaScript
 * Shared functionality: navigation, FAQ accordion, smooth scroll
 */

initMobileNav();
initDropdowns();
initAccordions();
initSmoothScroll();
setActiveNavLink();

/* ========================================
   Mobile Navigation
   ======================================== */

function initMobileNav() {
  const toggle = document.getElementById('mobile-nav-toggle');
  const nav = document.getElementById('mobile-nav');
  const close = document.getElementById('mobile-nav-close');
  const overlay = document.getElementById('mobile-nav-overlay');

  if (!toggle || !nav) return;

  const openNav = () => {
    nav.classList.add('open');
    overlay?.classList.remove('hidden');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const closeNav = () => {
    nav.classList.remove('open');
    overlay?.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  toggle.addEventListener('click', openNav);
  close?.addEventListener('click', closeNav);
  overlay?.addEventListener('click', closeNav);

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      closeNav();
      toggle.focus();
    }
  });

  // Close on link click (mobile)
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeNav);
  });
}

/* ========================================
   Desktop Dropdown Menus
   ======================================== */

function initDropdowns() {
  const dropdowns = document.querySelectorAll('.dropdown');

  dropdowns.forEach(dropdown => {
    const trigger = dropdown.querySelector('.dropdown-trigger');
    const menu = dropdown.querySelector('.dropdown-menu');

    if (!trigger || !menu) return;

    // Keyboard support
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const isOpen = menu.classList.contains('active');
        closeAllDropdowns();
        if (!isOpen) {
          menu.classList.add('active');
          trigger.setAttribute('aria-expanded', 'true');
        }
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        menu.classList.remove('active');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu').forEach(menu => {
    menu.classList.remove('active');
  });
  document.querySelectorAll('.dropdown-trigger').forEach(trigger => {
    trigger.setAttribute('aria-expanded', 'false');
  });
}

/* ========================================
   FAQ Accordion
   ======================================== */

function initAccordions() {
  const triggers = document.querySelectorAll('[data-accordion-trigger]');

  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const content = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!content) return;

      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      // Close all other accordions in the same group
      const group = trigger.closest('[data-accordion-group]');
      if (group) {
        group.querySelectorAll('[data-accordion-trigger]').forEach(otherTrigger => {
          if (otherTrigger !== trigger) {
            otherTrigger.setAttribute('aria-expanded', 'false');
            const otherContent = document.getElementById(otherTrigger.getAttribute('aria-controls'));
            if (otherContent) otherContent.classList.remove('open');
          }
        });
      }

      // Toggle clicked accordion
      trigger.setAttribute('aria-expanded', !isOpen);
      content.classList.toggle('open', !isOpen);
    });

    // Keyboard support
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger.click();
      }
    });
  });
}

/* ========================================
   Smooth Scroll for Anchor Links
   ======================================== */

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href').slice(1);
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.focus({ preventScroll: true });
      }
    });
  });
}

/* ========================================
   Active Nav Link
   ======================================== */

function setActiveNavLink() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPath.endsWith(href.replace('./', '').replace('../', ''))) {
      link.setAttribute('aria-current', 'page');
      link.classList.add('text-primary', 'font-semibold');
    }
  });
}
