// Small helpers shared by the screens.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a value before placing it inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Parse a number typed with comma or dot; NaN when empty or invalid. */
export function num(text) {
  const clean = String(text ?? '').trim().replace(',', '.');
  return clean === '' ? NaN : Number(clean);
}

/** Format kg without trailing zeros: 42.5, 40. */
export function kg(value) {
  return String(Number(Number(value).toFixed(2)));
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function shortDate(ms) {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function tinyDate(ms) {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * Destructive buttons need two taps: the first one arms the button for 3 seconds.
 * Returns true when the action should run.
 */
export function confirmTap(button, armedText) {
  if (button.dataset.armed === '1') return true;
  const original = button.textContent;
  button.dataset.armed = '1';
  button.textContent = armedText;
  button.classList.add('armed');
  setTimeout(() => {
    button.dataset.armed = '';
    button.textContent = original;
    button.classList.remove('armed');
  }, 3000);
  return false;
}
