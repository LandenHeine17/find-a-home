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
