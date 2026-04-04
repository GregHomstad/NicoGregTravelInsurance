/**
 * TripKavach — Path Selector
 * Manages self-traveler vs family/NRI path selection via localStorage.
 * Toggles body class (mode-self / mode-family) to show/hide path-specific content.
 */

const STORAGE_KEY = 'tripkavach_path';

function getPath() {
  return localStorage.getItem(STORAGE_KEY);
}

function setPath(mode) {
  localStorage.setItem(STORAGE_KEY, mode);
  applyPath(mode);
}

function applyPath(mode) {
  document.body.classList.remove('mode-self', 'mode-family');
  if (mode === 'self' || mode === 'family') {
    document.body.classList.add('mode-' + mode);
  }
}

function selectPath(mode) {
  setPath(mode);
  // Scroll to content below the path selector
  const problemSection = document.getElementById('problem-section');
  if (problemSection) {
    problemSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// On page load, restore saved path (default to 'self' if none saved)
const savedPath = getPath() || 'self';
applyPath(savedPath);

// Expose globally for onclick handlers
window.selectPath = selectPath;
window.tripkavachPath = { get: getPath, set: setPath, apply: applyPath };
