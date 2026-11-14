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
/** The tour questions as a checklist. Ticks are saved, so families can come back to it. */
export const checklistHtml = (qs = TOUR_QS) => `<ul class="checklist">${qs.map(q => { const i = TOUR_QS.indexOf(q); return `<li><label><input type="checkbox" data-action="check" data-q="${i}" ${S.checklist[i] ? 'checked' : ''}> ${esc(q)}</label></li>`; }).join('')}</ul>`;
export function tourChecklistBox() {
  const done = TOUR_QS.filter((_, i) => S.checklist[i]).length;
  return `<details class="card" style="margin-top:1.25rem"><summary style="cursor:pointer;font-weight:600">Tour checklist <span class="muted" style="font-weight:400">(${done} of ${TOUR_QS.length} asked)</span></summary>
    <div style="margin-top:.75rem">${checklistHtml()}</div></details>`;
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
      <div class="field"><label class="choice" style="font-weight:500"><input type="checkbox" id="t-fees" checked><span>Ask them to send every fee in writing${isFac ? ', including care levels and move-in fees' : ', including weekend rates and minimum hours'}</span></label></div>
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
        <div class="modal-head"><h2 style="margin:0">Tour request saved</h2><button class="close-x" data-close aria-label="Close">×</button></div>
        <p><b>${esc(p.name)}</b> will be asked to confirm <b>${new Date(t.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</b> (${t.time.toLowerCase()}). You can follow it in <a href="#/list">My list</a>.</p>
        ${isFac ? `<h3>Bring this checklist</h3>${checklistHtml(TOUR_QS.slice(0, 8))}` : ''}
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
      save(); closeModal(); toast('Review posted. Other families will see it on this page.'); refresh();
    });
  });
}

export function openRateApp() {
  openModal(`
    <div class="modal-head"><h2 style="margin:0">You chose a place</h2><button class="close-x" data-close aria-label="Close">×</button></div>
    <p>That is a big step. How did Find-A-Home do?</p>
    <div style="font-size:2.4rem;text-align:center" class="stars" id="appStars">${[1, 2, 3, 4, 5].map(n => `<span data-s="${n}" class="off" style="cursor:pointer" role="button" tabindex="0" aria-label="${n} stars">★</span>`).join('')}</div>
    <div class="field" style="margin-top:1rem"><label for="appFb">What would have made this easier? <span class="hint">Optional</span></label><textarea id="appFb" rows="3"></textarea></div>
    <div style="display:flex;justify-content:flex-end;gap:.5rem"><button class="btn secondary" data-close>Skip</button><button class="btn" id="appRateSend">Send</button></div>`, modal => {
    let v = 0;
    modal.querySelectorAll('[data-s]').forEach(s => s.addEventListener('click', () => { v = +s.dataset.s; modal.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('off', +x.dataset.s > v)); }));
    modal.querySelector('#appRateSend').addEventListener('click', () => { S.appRating = { stars: v, text: modal.querySelector('#appFb').value }; save(); closeModal(); toast('Feedback saved. Thank you.'); });
  });
}


export function showSources() {
  const nh = data.facilities.filter(p => p.type === 'nursing').length, al = data.facilities.length - nh, hc = data.homecare.length;
  const date = data.dataDate ? new Date(data.dataDate + 'T12:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  openModal(`
    <div class="modal-head"><h2 style="margin:0">Where our information comes from</h2><button class="close-x" data-close aria-label="Close">×</button></div>
    <p>Every place is real. Each fact comes from a public source, and every card on a place's page names its source.</p>
    <h3>Places</h3>
    <ul>
      <li><b>${nh} nursing homes, all of Nebraska:</b> Medicare Care Compare provider data${date ? ` (processed ${esc(date)})` : ''}. It includes star ratings, every citation from the last three inspections, fines, owners, staffing and dementia-related quality measures.</li>
      <li><b>${al} assisted living and memory care communities, Lincoln:</b> the City of Lincoln Aging Partners licensed assisted living list (April 2020), with starting prices and family ratings from Caring.com.</li>
      <li><b>${hc} home care agencies, Lincoln:</b> the Aging Partners home care list (July 2026) and each agency's website.</li>
      <li><b>Dementia units, behavioral care and VA contracts:</b> county lists from Lincoln Aging Partners (March 2024) and the Eastern Nebraska Office on Aging (September 2025).</li>
    </ul>
    <h3>Insurance and payment</h3>
    <ul>
      <li><b>Nursing homes:</b> Medicare and Medicaid come from the home's federal certification, which Medicare publishes. A home certified for Medicaid takes it.</li>
      <li><b>Assisted living and home care:</b> no public list says who takes the Medicaid waiver, VA or long-term care insurance, so we show "Ask" and the tour request asks for you.</li>
      <li>The insurance card upload in the questions does not read the card yet.</li>
    </ul>
    <h3>Prices and open beds</h3>
    <ul>
      <li><b>Nursing home prices:</b> the 2024 CareScout Nebraska average, because homes do not publish rates. Assisted living uses each community's published starting price, or the Lincoln average. Home care uses published Lincoln agency rates.</li>
      <li><b>Fee lists</b> show what each type of care usually charges on top of the base price. A place's own fee sheet replaces them once it sends one.</li>
      <li><b>Open beds:</b> Medicare certified beds minus average daily residents. It is a guide, not a promise.</li>
    </ul>
    <h3>Reviews and distances</h3>
    <ul>
      <li><b>Reviews:</b> Medicare stars for nursing homes, Caring.com for assisted living, and reviews families leave on Find-A-Home. Google does not allow its reviews to be copied into other sites, so each place links to its Google reviews instead.</li>
      <li><b>Distances:</b> straight-line miles from your street address (found with the US Census geocoder), your device location, or the center of your ZIP code.</li>
    </ul>
    <p class="small muted">"Ask" means the information is not public. Facilities cannot pay for placement, so the ranking is based only on fit.</p>
    <div style="text-align:right"><button class="btn" data-close>Close</button></div>`);
}
