/** Small shared helpers: HTML escaping, number/date formatting, stars, icons, toasts and modals. */

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = n => Math.round(n).toLocaleString('en-US');
export const fmtDate = d => new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const telHref = phone => 'tel:' + String(phone).replace(/\D/g, '');

export function stars(v, max = 5) {
  if (v == null) return '<span class="muted small">No rating yet</span>';
  const full = Math.round(v);
  return `<span class="stars" aria-label="${v} out of ${max} stars">${'★'.repeat(full)}<span class="off">${'★'.repeat(max - full)}</span></span>`;
}

const ICON_ART = {
  nursing: '<rect x="12" y="20" width="40" height="34" rx="2" fill="#5b7fa6"/><rect x="18" y="26" width="7" height="7" fill="#fff"/><rect x="39" y="26" width="7" height="7" fill="#fff"/><rect x="18" y="38" width="7" height="7" fill="#fff"/><rect x="39" y="38" width="7" height="7" fill="#fff"/><rect x="28" y="42" width="8" height="12" fill="#fff"/><rect x="26" y="8" width="12" height="12" rx="2" fill="#fff" stroke="#5b7fa6" stroke-width="2"/><path d="M32 10.5v7M28.5 14h7" stroke="#c0504d" stroke-width="2.4"/>',
  memory: '<path d="M8 32 32 12l24 20v22H8z" fill="#c9822b"/><rect x="27" y="40" width="10" height="14" fill="#fff"/><path d="M32 33c-2.5-4-9-2-6 3l6 5 6-5c3-5-3.5-7-6-3z" fill="#fff"/>',
  assisted_memory: '<path d="M6 34 24 18l18 16v20H6z" fill="#4f8f63"/><path d="M28 30 42 18l16 14v22H28z" fill="#6aa67c"/><rect x="18" y="42" width="8" height="12" fill="#fff"/><rect x="44" y="40" width="7" height="7" fill="#fff"/>',
  medical: '<circle cx="32" cy="22" r="9" fill="#5b7fa6"/><path d="M14 54c0-11 8-18 18-18s18 7 18 18z" fill="#5b7fa6"/><path d="M32 40v10M27 45h10" stroke="#fff" stroke-width="3"/>',
  'non-medical': '<circle cx="26" cy="22" r="8" fill="#9a5b8e"/><path d="M10 54c0-10 7-16 16-16s16 6 16 16z" fill="#9a5b8e"/><path d="M46 30c-2.5-4-9-2-6 3l6 5 6-5c3-5-3.5-7-6-3z" fill="#d0574f"/>'
};
const ICON_BG = { nursing: '#e6eef6', memory: '#f6ece0', assisted_memory: '#e8f2ea', 'non-medical': '#f3e8f1', medical: '#e6eef6' };

/** Simple illustrated icon for a care type (stands in for photos). */
export function icon(type, size = 64) {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><rect width="64" height="64" rx="12" fill="${ICON_BG[type] || '#eee'}"/>${ICON_ART[type] || ICON_ART['non-medical']}</svg>`;
}

export function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

export function openModal(html, onMount) {
  closeModal();
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  bd.addEventListener('click', e => { if (e.target === bd || e.target.closest('[data-close]')) closeModal(); });
  document.body.appendChild(bd);
  const f = bd.querySelector('input, select, textarea, button:not(.close-x)');
  if (f) f.focus();
  if (onMount) onMount(bd.querySelector('.modal'));
  return bd;
}
export function closeModal() { document.querySelectorAll('.modal-backdrop').forEach(m => m.remove()); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
