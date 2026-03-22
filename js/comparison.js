/**
 * US TravelShield — Plan Comparison Tool
 * Toggles plan columns on/off in the comparison table
 */

const toggles = document.querySelectorAll('.plan-toggle');

toggles.forEach(toggle => {
  toggle.addEventListener('change', () => {
    const plan = toggle.dataset.plan;
    const cols = document.querySelectorAll(`.plan-col-${plan}`);

    cols.forEach(col => {
      if (toggle.checked) {
        col.classList.remove('hidden');
      } else {
        col.classList.add('hidden');
      }
    });

    // Ensure at least one plan is always visible
    const checkedCount = document.querySelectorAll('.plan-toggle:checked').length;
    if (checkedCount === 0) {
      toggle.checked = true;
      const cols2 = document.querySelectorAll(`.plan-col-${plan}`);
      cols2.forEach(col => col.classList.remove('hidden'));
    }
  });
});
