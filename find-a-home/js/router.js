/**
 * Tiny hash router: #/welcome, #/results, #/place/<id>, #/compare, #/list, #/next-steps
 * Views register themselves in main.js, which keeps this module free of view imports.
 */
import { closeModal } from './core/util.js';

const routes = {};
let fallback = null;
export const app = document.getElementById('app');

export function register(name, render, { isDefault = false } = {}) {
  routes[name] = render;
  if (isDefault) fallback = render;
}

export function route({ keepScroll = false } = {}) {
  const [view, arg] = location.hash.replace(/^#\/?/, '').split('/');
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active',
    a.dataset.nav === view || (a.dataset.nav === 'results' && view === 'place')));
  closeModal();
  const x = window.scrollX, y = window.scrollY;
  const render = routes[view] || fallback;
  const result = render(arg ? decodeURIComponent(arg) : undefined);
  if (keepScroll) window.scrollTo(x, y); else window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
  window.dispatchEvent(new CustomEvent('fah:route', { detail: { view, arg } }));
  return result;
}

/** Navigate to a hash (re-renders even when it's already the current hash). */
export const go = h => { if (location.hash === h) route(); else location.hash = h; };

/** Re-render the current screen (after a state change). */
export const refresh = () => route({ keepScroll: true });

window.addEventListener('hashchange', route);
