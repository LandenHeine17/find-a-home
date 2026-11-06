/** "My list": saved places, tour requests (with simulated facility replies) and sharing. */
import { S } from '../core/state.js';
import { esc, icon, toast, openModal } from '../core/util.js';
import { TYPE_LABEL, lovedOne, priceText } from '../core/labels.js';
import { dist } from '../core/geo.js';
import { match } from '../core/matching.js';
import { data, summary } from '../core/data.js';
import { app } from '../router.js';
import { card, compareBar } from './results.js';

function nextBest(excludeId) {
  const p = summary(excludeId);
  const pool = (p.kind === 'facility' ? data.facilities : data.homecare).filter(x => x.id !== excludeId && !S.tours.some(t => t.id === x.id));
  return pool.map(x => ({ x, s: match(x).score })).sort((a, b) => b.s - a.s)[0]?.x;
}

export function renderList() {
  const saved = S.saved.map(summary).filter(Boolean);
  const STATUS = {
    pending: ['warn', 'Waiting for them to confirm'], confirmed: ['good', 'Tour confirmed'],
    waitlist: ['warn', 'Full: on waitlist'], declined: ['bad', 'Full: declined'], chosen: ['good', 'Chosen! 🎉'], notfit: ['', 'Not a fit']
  };
  const tours = S.tours.map(t => {
    const p = summary(t.id); if (!p) return '';
    const [cls, label] = STATUS[t.status];
    let actions = '';
    if (t.status === 'pending') actions = `<span class="small muted">Demo: simulate the facility's reply →</span>
      <button class="btn small secondary" data-action="tour-status" data-id="${t.id}" data-status="confirmed">Confirmed</button>
      <button class="btn small secondary" data-action="tour-status" data-id="${t.id}" data-status="${t.waitlist ? 'waitlist' : 'declined'}">No openings</button>`;
    else if (t.status === 'confirmed') actions = `<span class="small muted">After the tour:</span>
      <button class="btn small" data-action="choose" data-id="${t.id}">It's a good fit, choose it</button>
      <button class="btn small secondary" data-action="tour-status" data-id="${t.id}" data-status="notfit">Not a fit</button>`;
    else if (t.status === 'waitlist' || t.status === 'declined' || t.status === 'notfit') {
      const nb = nextBest(t.id);
      actions = nb ? `<span class="small">Next best match: <a href="#/place/${nb.id}"><b>${esc(nb.name)}</b></a> (${match(nb).score}%)</span> <button class="btn small" data-action="tour" data-id="${nb.id}">Request ${nb.kind === 'facility' ? 'tour' : 'consult'}</button>` : '';
    } else if (t.status === 'chosen') actions = `<span class="small">We'll remind you to review ${esc(p.name)} after 30 days. <button class="linkbtn" data-action="review" data-id="${p.id}">Write a review now</button></span>`;
    return `<div class="card" style="margin-bottom:.75rem"><div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
      ${icon(p.type, 52)}<div style="flex:1;min-width:200px"><b><a href="#/place/${p.id}">${esc(p.name)}</a></b><br><span class="small muted">${t.date ? new Date(t.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + t.time.toLowerCase() : ''}${t.withLoved === 'yes' ? ' · with ' + lovedOne() : ''}</span></div>
      <span class="tag ${cls}">${label}</span></div>
      ${actions ? `<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-top:.75rem">${actions}</div>` : ''}</div>`;
  }).join('');
  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin-bottom:1rem">
      <div><h1 style="margin:0">My list</h1><p class="muted" style="margin:0">Places you saved and tours you requested.</p></div>
      ${saved.length ? '<button class="btn" data-action="share">👪 Share with family</button>' : ''}
    </div>
    ${S.chosen ? `<div class="alert good" style="font-size:1.05rem">🎉 You chose <b>${esc(summary(S.chosen)?.name || '')}</b> for ${lovedOne()}. See <a href="#/next-steps">next steps</a> for moving in.</div>` : ''}
    <h2>Tours & consultations</h2>
    ${tours || '<div class="card empty" style="padding:1.25rem">No requests yet. Open a match and tap <b>Request a tour</b>.</div>'}
    <h2 style="margin-top:1.5rem">Saved places</h2>
    ${saved.length ? `<div class="match-list">${saved.map(p => card(p, match(p), dist(p))).join('')}</div>` : '<div class="card empty" style="padding:1.25rem">Tap ♡ on any match to save it here.</div>'}
    ${compareBar()}`;
}

export function shareList() {
  const saved = S.saved.map(summary).filter(Boolean);
  const text = `Care options for ${S.intake.lovedOne || 'our loved one'} (from Find-A-Home):\n\n` + saved.map(p =>
    `• ${p.name}: ${TYPE_LABEL[p.type]}, ${priceText(p, true)}${p.kind === 'facility' ? ', ' + p.address : ''}, ${p.phone}`).join('\n') +
    `\n\nWhat do you think? ${S.intake.name ? '– ' + S.intake.name : ''}`;
  openModal(`
    <div class="modal-head"><h2 style="margin:0">Share with family</h2><button class="close-x" data-close aria-label="Close">×</button></div>
    <p class="muted">Many families we talked to make this decision together. Send your list to siblings, a spouse or a social worker.</p>
    <textarea id="shareText" rows="9" style="font-size:.9rem">${esc(text)}</textarea>
    <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem;flex-wrap:wrap">
      <a class="btn secondary" href="mailto:?subject=${encodeURIComponent('Care options for ' + (S.intake.lovedOne || 'our loved one'))}&body=${encodeURIComponent(text)}">✉️ Email</a>
      <a class="btn secondary" href="sms:?&body=${encodeURIComponent(text)}">💬 Text</a>
      <button class="btn" id="copyBtn">📋 Copy</button></div>`, modal => {
    modal.querySelector('#copyBtn').addEventListener('click', () => {
      const ta = modal.querySelector('#shareText'); ta.select();
      (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => toast('Copied! Paste it into a text or email.'), () => { document.execCommand('copy'); toast('Copied!'); });
    });
  });
}

