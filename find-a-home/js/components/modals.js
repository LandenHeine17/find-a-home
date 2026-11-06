/** Pop-up dialogs: tour request, tour checklist, reviews, rating the app, and "About the data". */
import { S, save } from '../core/state.js';
import { esc, stars, toast, openModal, closeModal } from '../core/util.js';
import { lovedOne, PAY_LABEL } from '../core/labels.js';
import { data, summary } from '../core/data.js';
import { refresh } from '../router.js';

export const TOUR_QS = [
  'Do you have a secured (locked) memory care unit?', 'How many staff are on duty during the day? At night?',
  'What dementia training do caregivers get?', 'What did your last state inspection find?',
  'Do you accept our payment type? What happens if we run out of savings?', 'What is included in the base price, and what costs extra?',
  'Is there a waitlist? How long is it?', 'How do you handle wandering, falls and agitation?',
  'Can we visit any time? Can family join meals?', 'What activities are there for people with memory loss?',
  'When would residents need to move to a higher level of care?', 'Watch: are residents engaged, clean and calm? Do staff know them by name?'
];
export function tourChecklistBox() {
  return `<details class="card" style="margin-top:1.25rem"><summary style="cursor:pointer;font-weight:700">📋 Tour checklist: questions to ask</summary>
    <ul class="checklist" style="margin-top:.75rem">${TOUR_QS.map((q, i) => `<li><label><input type="checkbox"> ${esc(q)}</label></li>`).join('')}</ul></details>`;
}

export function openTour(id) {
  const p = summary(id); if (!p) return;
  const isFac = p.kind === 'facility';
  const pays = S.intake.payment.filter(x => PAY_LABEL[x]);
  const today = new Date().toISOString().slice(0, 10);
  openModal(`
    <div class="modal-head"><div><h2 style="margin:0">${isFac ? 'Request a tour' : 'Request a free consultation'}</h2><p class="muted" style="margin:0">${esc(p.name)}</p></div><button class="close-x" data-close aria-label="Close">×</button></div>
    <form id="tourForm">
      <div class="row">
        <div class="field"><label for="t-d1">Preferred day</label><input id="t-d1" type="date" min="${today}" required></div>
        <div class="field"><label for="t-time">Time of day</label><select id="t-time"><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div>
      </div>
      ${isFac ? `<div class="field"><label>Will ${lovedOne()} come along?<span class="hint">Many families told us seeing how their loved one reacts helped them decide.</span></label>
        <div class="choice-grid">${[['yes', 'Yes'], ['no', 'No, family only'], ['unsure', 'Not sure yet']].map(([v, t], i) => `<label class="choice"><input type="radio" name="t-with" value="${v}" ${i === 2 ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>` : ''}
      <div class="field"><label for="t-contact">Best phone or email to reach you</label><input id="t-contact" type="text" placeholder="(402) 555-0123" required></div>
      <div class="field"><label class="choice" style="font-weight:500"><input type="checkbox" id="t-pay" checked><span>Ask them to confirm they accept ${pays.length ? '<b>' + pays.map(x => PAY_LABEL[x]).join(', ') + '</b>' : 'our payment type'} before the tour</span></label></div>
      ${isFac ? `<div class="field"><label class="choice" style="font-weight:500"><input type="checkbox" id="t-wait" checked><span>If they're full, add us to the waitlist and show me my next best match</span></label></div>` : ''}
      <div class="field"><label for="t-notes">Anything they should know? <span class="hint">Optional</span></label><textarea id="t-notes" rows="2" placeholder="e.g. Dad uses a walker and gets anxious in the evenings"></textarea></div>
      <p class="small muted">Prototype: nothing is sent to the facility.</p>
      <div style="display:flex;justify-content:flex-end;gap:.5rem"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn" type="submit">Send request</button></div>
    </form>`, modal => {
    modal.querySelector('#tourForm').addEventListener('submit', e => {
      e.preventDefault();
      const t = {
        id, date: modal.querySelector('#t-d1').value, time: modal.querySelector('#t-time').value,
        withLoved: (modal.querySelector('[name=t-with]:checked') || {}).value || '',
        waitlist: !!(modal.querySelector('#t-wait') || {}).checked, status: 'pending', created: Date.now()
      };
      S.tours = S.tours.filter(x => x.id !== id).concat(t);
      if (!S.saved.includes(id)) S.saved.push(id);
      save();
      openModal(`
        <div class="modal-head"><h2 style="margin:0">✅ Request sent</h2><button class="close-x" data-close aria-label="Close">×</button></div>
        <p><b>${esc(p.name)}</b> will be asked to confirm <b>${new Date(t.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</b> (${t.time.toLowerCase()}). You can follow it in <a href="#/list">My list</a>.</p>
        ${isFac ? `<h3>Bring this checklist</h3><ul class="checklist">${TOUR_QS.slice(0, 8).map(q => `<li><label><input type="checkbox"> ${esc(q)}</label></li>`).join('')}</ul>` : ''}
        <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><a class="btn secondary" href="#/next-steps">See next steps</a><a class="btn" href="#/list">Go to my list</a></div>`);
    });
  });
}


export function openReview(id) {
  const p = summary(id);
  openModal(`
    <div class="modal-head"><div><h2 style="margin:0">Write a review</h2><p class="muted" style="margin:0">${esc(p.name)}</p></div><button class="close-x" data-close aria-label="Close">×</button></div>
    <form id="revForm">
      <div class="field"><label>Your rating</label><div id="starPick" style="font-size:2.2rem;cursor:pointer" class="stars" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map(n => `<span data-star="${n}" role="radio" tabindex="0" aria-label="${n} stars" class="off">★</span>`).join('')}</div></div>
      <div class="field"><label for="r-name">Your first name <span class="hint">Optional</span></label><input id="r-name" type="text" value="${esc(S.intake.name)}"></div>
      <div class="field"><label for="r-text">What should other families know?</label><textarea id="r-text" rows="4" required placeholder="Staff, safety, communication, how your loved one is doing…"></textarea></div>
      <div style="display:flex;justify-content:flex-end;gap:.5rem"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn" type="submit">Post review</button></div>
    </form>`, modal => {
    let val = 0;
    const paint = n => modal.querySelectorAll('[data-star]').forEach(s => s.classList.toggle('off', +s.dataset.star > n));
    modal.querySelectorAll('[data-star]').forEach(s => {
      s.addEventListener('click', () => { val = +s.dataset.star; paint(val); });
      s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); val = +s.dataset.star; paint(val); } });
    });
    modal.querySelector('#revForm').addEventListener('submit', e => {
      e.preventDefault();
      if (!val) { toast('Please choose a star rating'); return; }
      (S.reviews[id] = S.reviews[id] || []).unshift({ stars: val, name: modal.querySelector('#r-name').value.trim(), text: modal.querySelector('#r-text').value.trim(), date: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) });
      save(); closeModal(); toast('Thanks! Your review helps other families.'); refresh();
    });
  });
}

export function openRateApp() {
  openModal(`
    <div class="modal-head"><h2 style="margin:0">🎉 Congratulations!</h2><button class="close-x" data-close aria-label="Close">×</button></div>
    <p>Finding the right place is a big step. How did Find-A-Home do?</p>
    <div style="font-size:2.4rem;text-align:center" class="stars" id="appStars">${[1, 2, 3, 4, 5].map(n => `<span data-s="${n}" class="off" style="cursor:pointer" role="button" tabindex="0" aria-label="${n} stars">★</span>`).join('')}</div>
    <div class="field" style="margin-top:1rem"><label for="appFb">What would have made this easier? <span class="hint">Optional</span></label><textarea id="appFb" rows="3"></textarea></div>
    <div style="display:flex;justify-content:flex-end;gap:.5rem"><button class="btn secondary" data-close>Skip</button><button class="btn" id="appRateSend">Send</button></div>`, modal => {
    let v = 0;
    modal.querySelectorAll('[data-s]').forEach(s => s.addEventListener('click', () => { v = +s.dataset.s; modal.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('off', +x.dataset.s > v)); }));
    modal.querySelector('#appRateSend').addEventListener('click', () => { S.appRating = { stars: v, text: modal.querySelector('#appFb').value }; save(); closeModal(); toast('Thank you for the feedback!'); });
  });
}


export function showSources() {
  openModal(`
    <div class="modal-head"><h2 style="margin:0">About the data</h2><button class="close-x" data-close aria-label="Close">×</button></div>
    <p>This prototype uses <b>real Lincoln, NE providers</b> and public data collected in November 2026 (Medicare data processed ${esc(data.dataDate || '')}):</p>
    <ul>
      <li><b>Nursing homes (52, Lincoln + Omaha metro):</b> Medicare / CMS Care Compare Provider Data (processed Oct 1, 2026). Includes star ratings, every inspection citation from the last 3 inspections, fines and payment denials, owners, staffing and dementia-related quality measures, compared with Nebraska averages.</li>
      <li><b>Dementia units, behavioral care & VA contracts:</b> official county lists from Lincoln Aging Partners (Mar 2024) and the Eastern Nebraska Office on Aging (Sep 2025).</li>
      <li><b>Websites:</b> checked one by one. If we couldn't confirm a site, the app shows a search link instead.</li>
      <li><b>Assisted living & memory care (17):</b> City of Lincoln Aging Partners licensed assisted living list (Apr 2020), with starting prices and family review ratings from Caring.com and Seniorly.</li>
      <li><b>Home care (10):</b> Aging Partners Community Home Health Care list (updated Jul 2026) and agency websites.</li>
      <li><b>Estimated prices:</b> nursing home costs use the 2024 CareScout Nebraska average. Home care uses published Lincoln agency rates.</li>
      <li><b>Estimated open beds:</b> certified beds minus average daily residents (CMS). This is a rough guide, not a guarantee.</li>
      <li><b>Distances:</b> straight-line miles from the center of your ZIP code (US Census).</li>
    </ul>
    <p class="small muted">"Ask" means the information isn't public. In the real product, facilities would claim their listing and keep openings and prices current. Facilities can't pay for placement, so rankings are based only on fit.</p>
    <div style="text-align:right"><button class="btn" data-close>Got it</button></div>`);
}

