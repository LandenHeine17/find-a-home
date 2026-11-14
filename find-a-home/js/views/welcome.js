/** Screen 1 of the sketch: the short intake (about you and where you live, about them, cost & distance). */
import { S, save, defaultFilters } from '../core/state.js';
import { esc, fmt, toast } from '../core/util.js';
import { lovedOne } from '../core/labels.js';
import { geocodeAddress } from '../core/geo.js';
import { data } from '../core/data.js';
import { app, go } from '../router.js';

const locNote = L => L && L.lat != null
  ? (L.source === 'device' ? 'Using your current location.' : `Found: ${esc(L.label)}`) : '';

export function renderWelcome() {
  const I = S.intake, st = S.step;
  const steps = ['About you', `About ${I.lovedOne ? esc(I.lovedOne) : 'them'}`, 'Cost and distance'];
  const bar = `<div class="steps">${steps.map((t, i) => `<div class="${i + 1 < st ? 'done' : i + 1 === st ? 'current' : ''}">${i + 1}. ${t}</div>`).join('')}</div>`;
  let body = '';
  if (st === 1) {
    body = `
    <div class="row">
      <div class="field"><label for="f-name">Your first name</label>
        <input id="f-name" type="text" autocomplete="given-name" value="${esc(I.name)}"></div>
      <div class="field"><label for="f-loved">Who you are finding care for<span class="hint">What you call them, like "Mom" or "Grandpa Joe"</span></label>
        <input id="f-loved" type="text" value="${esc(I.lovedOne)}" placeholder="e.g. Dad"></div>
    </div>
    <div class="field"><label for="f-addr">Home address<span class="hint">Street, town and ZIP, or just a ZIP code. Distances are measured from here. It stays on this device and is only sent to the US Census address lookup.</span></label>
      <div class="addr-row">
        <input id="f-addr" type="text" autocomplete="street-address" value="${esc(I.address || I.zip)}" placeholder="e.g. 410 Main St, Seward, NE 68434" aria-describedby="addrNote">
        <button type="button" class="btn secondary" id="useLoc">Use my location</button>
      </div>
      <div id="addrNote" class="field-note" role="status">${locNote(I.loc)}</div></div>
    <div class="field"><label>Upload insurance card <span class="hint">Optional. We use it to show places that take your insurance.</span></label>
      <label class="upload" for="f-card" style="font-weight:400">
        <span class="plus">+</span>
        <span id="cardText">${I.insuranceFile ? `✓ <b>${esc(I.insuranceFile)}</b> added. <span class="hint">Prototype: the card isn't read or stored. Please also choose your payment type in step 3.</span>` : 'Tap to add a photo of the front of the card'}</span>
      </label>
      <input id="f-card" type="file" accept="image/*,.pdf" class="hidden"></div>
    <div class="field"><label for="f-doc">Connect to doctors <span class="hint">Optional. With your permission, their diagnosis notes can fill in step 2 for you.</span></label>
      <select id="f-doc">
        ${['', 'Bryan Health', 'CHI Health St. Elizabeth', 'Nebraska Medicine', 'Lincoln VA Clinic', 'Other / not listed'].map(o =>
          `<option value="${o}" ${I.doctor === o ? 'selected' : ''}>${o || 'Not right now'}</option>`).join('')}
      </select>
      <div id="docNote" class="hint" style="margin-top:.35rem">${I.doctor ? 'Prototype: nothing is shared. In the full app you would sign in to your patient portal here.' : ''}</div></div>`;
  } else if (st === 2) {
    const stage = [['early', 'Early', 'Mostly independent, with some forgetfulness'], ['middle', 'Middle', 'Needs daily help and someone nearby'], ['late', 'Late', 'Needs help with almost everything'], ['unsure', 'Not sure', "That's okay, we'll explain"]];
    const beh = [['wander', 'Wanders or gets lost', 'Usually needs a secured (locked) memory unit'], ['aggression', 'Agitation or aggression', ''], ['falls', 'Falls or is unsteady', ''], ['adl', 'Needs help bathing or dressing', ''], ['medical', 'Needs medical care', 'e.g. wounds, injections, feeding tube, oxygen'], ['diagnosis', 'Has a written diagnosis from a doctor', 'Most memory care and Medicaid require one']];
    const pref = [['facility', 'A care facility', 'Memory care, assisted living or nursing home'], ['home', 'Stay at home with help', 'In-home caregivers'], ['unsure', 'Not sure yet', 'Show me both']];
    body = `
    <div class="field"><label>How far along is ${lovedOne()}'s memory loss?</label>
      <div class="choice-grid">${stage.map(([v, t, h]) => `<label class="choice"><input type="radio" name="stage" value="${v}" ${I.stage === v ? 'checked' : ''}><span>${t}<small>${h}</small></span></label>`).join('')}</div></div>
    <div class="field"><label>Check anything that applies <span class="hint">This helps us find places that can safely care for them</span></label>
      <div class="choice-grid">${beh.map(([v, t, h]) => `<label class="choice"><input type="checkbox" name="beh" value="${v}" ${I.behaviors.includes(v) ? 'checked' : ''}><span>${t}${h ? `<small>${h}</small>` : ''}</span></label>`).join('')}</div></div>
    <div class="field"><label>Where are you hoping ${lovedOne()} will live?</label>
      <div class="choice-grid">${pref.map(([v, t, h]) => `<label class="choice"><input type="radio" name="pref" value="${v}" ${I.livingPref === v ? 'checked' : ''}><span>${t}<small>${h}</small></span></label>`).join('')}</div></div>`;
  } else {
    const pays = [['private', 'Private pay / savings', ''], ['medicaid', 'Medicaid', 'Or applying for it'], ['medicare', 'Medicare', 'Covers short stays after a hospital visit'], ['va', 'VA benefits', ''], ['ltc', 'Long-term care insurance', ''], ['unsure', 'Not sure', 'Our guide can help']];
    const when = [['now', 'Right away', 'A crisis or hospital discharge'], ['soon', 'In 1–3 months', ''], ['exploring', 'Just exploring', '']];
    body = `
    <div class="field"><label>How will you pay? <span class="hint">Pick all that apply</span></label>
      <div class="choice-grid">${pays.map(([v, t, h]) => `<label class="choice"><input type="checkbox" name="pay" value="${v}" ${I.payment.includes(v) ? 'checked' : ''}><span>${t}${h ? `<small>${h}</small>` : ''}</span></label>`).join('')}</div></div>
    <div class="row">
      <div class="field"><label for="f-budget">Monthly budget: <span class="range-val" id="budgetVal">$${fmt(I.budget)}${I.budget >= 12000 ? '+' : ''}</span></label>
        <input id="f-budget" type="range" min="2000" max="12000" step="250" value="${I.budget}"></div>
      <div class="field"><label for="f-miles">How far will family drive? <span class="range-val" id="milesVal">${I.maxMiles} miles</span></label>
        <input id="f-miles" type="range" min="5" max="100" step="5" value="${I.maxMiles}"></div>
    </div>
    <div class="field"><label>How soon do you need care?</label>
      <div class="choice-grid">${when.map(([v, t, h]) => `<label class="choice"><input type="radio" name="when" value="${v}" ${I.timing === v ? 'checked' : ''}><span>${t}${h ? `<small>${h}</small>` : ''}</span></label>`).join('')}</div></div>`;
  }
  app.innerHTML = `
  <div class="welcome-wrap">
    <div class="welcome-hero">
      <h1>${st === 1 ? 'Find dementia care in Nebraska' : st === 2 ? `About ${lovedOne()}` : 'Cost and distance'}</h1>
      <p>${st === 1 ? `Compare ${data.facilities.filter(p => p.type === 'nursing').length} Nebraska nursing homes, ${data.facilities.filter(p => p.type !== 'nursing').length} Lincoln memory care communities and ${data.homecare.length} home care agencies. Three short questions, no account.` : st === 2 ? 'There are no wrong answers. You can change these any time.' : 'Last step. This keeps prices and distances realistic.'}</p>
    </div>
    ${bar}
    <form class="card" id="intakeForm" novalidate>
      ${body}
      <div class="intake-actions">
        ${st > 1 ? '<button type="button" class="btn secondary" data-action="intake-back">Back</button>' : '<button type="button" class="btn ghost" data-action="skip-intake">Skip and browse</button>'}
        <button type="submit" class="btn big">${st < 3 ? 'Next' : 'See matches'}</button>
      </div>
    </form>
    <div class="reassure"><span>Free for families</span><span>Facilities can't pay for a higher ranking</span><span>Nothing is shared without your OK</span></div>
  </div>`;

  const form = document.getElementById('intakeForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (S.step === 1 && !(await resolveAddress())) return;
    readIntake();
    if (S.step < 3) { S.step++; save(); renderWelcome(); window.scrollTo(0, 0); } else finishIntake();
  });
  const useLoc = document.getElementById('useLoc');
  if (useLoc) useLoc.addEventListener('click', () => {
    const note = document.getElementById('addrNote');
    if (!navigator.geolocation) { note.textContent = 'This browser cannot share its location. Type your address instead.'; return; }
    note.textContent = 'Finding your location…';
    navigator.geolocation.getCurrentPosition(pos => {
      S.intake.loc = { lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4), source: 'device' };
      S.intake.address = ''; save();
      document.getElementById('f-addr').value = '';
      note.textContent = locNote(S.intake.loc);
    }, () => { note.textContent = 'Location was not shared. Type your address instead.'; }, { timeout: 10000 });
  });
  const card = document.getElementById('f-card');
  if (card) card.addEventListener('change', () => {
    readIntake();
    if (card.files[0]) {
      const typed = document.getElementById('f-addr').value;
      S.intake.insuranceFile = card.files[0].name; save(); renderWelcome();
      document.getElementById('f-addr').value = typed; toast('Insurance card added');
    }
  });
  const doc = document.getElementById('f-doc');
  if (doc) doc.addEventListener('change', () => { document.getElementById('docNote').textContent = doc.value ? 'Prototype: nothing is shared. In the full app you would sign in to your patient portal here.' : ''; });
  const b = document.getElementById('f-budget');
  if (b) b.addEventListener('input', () => { document.getElementById('budgetVal').textContent = '$' + fmt(+b.value) + (+b.value >= 12000 ? '+' : ''); });
  const m = document.getElementById('f-miles');
  if (m) m.addEventListener('input', () => { document.getElementById('milesVal').textContent = m.value + ' miles'; });
}

export function readIntake() {
  const I = S.intake, v = id => document.getElementById(id);
  if (S.step === 1) {
    I.name = v('f-name').value.trim(); I.lovedOne = v('f-loved').value.trim();
    I.doctor = v('f-doc').value;
  } else if (S.step === 2) {
    I.stage = (document.querySelector('[name=stage]:checked') || {}).value || '';
    I.behaviors = [...document.querySelectorAll('[name=beh]:checked')].map(x => x.value);
    I.livingPref = (document.querySelector('[name=pref]:checked') || {}).value || '';
  } else {
    I.payment = [...document.querySelectorAll('[name=pay]:checked')].map(x => x.value);
    I.budget = +v('f-budget').value; I.maxMiles = +v('f-miles').value;
    I.timing = (document.querySelector('[name=when]:checked') || {}).value || '';
  }
  save();
}
/**
 * Step 1: turn what was typed into a starting point. A bare ZIP uses the ZIP center;
 * a street address is looked up with the US Census geocoder. Returns false to stay on the step.
 */
async function resolveAddress() {
  const input = document.getElementById('f-addr'), note = document.getElementById('addrNote');
  const typed = input.value.trim(), I = S.intake;
  const fail = msg => { note.textContent = msg; note.classList.add('error'); input.setAttribute('aria-invalid', 'true'); input.focus(); return false; };
  note.classList.remove('error'); input.removeAttribute('aria-invalid');
  if (!typed) { if (!(I.loc && I.loc.source === 'device')) { I.address = ''; I.zip = ''; I.loc = null; } return true; }
  if (typed === I.address && I.loc) return true;
  if (/^\d{5}$/.test(typed)) {
    if (!data.zips[typed]) return fail(`We don't have ZIP ${typed}. Write a Nebraska ZIP code or your full address.`);
    Object.assign(I, { zip: typed, address: '', loc: null }); return true;
  }
  note.textContent = 'Looking up your address…';
  try {
    const hit = await geocodeAddress(typed);
    Object.assign(I, { address: typed, zip: hit.zip || I.zip, loc: { lat: hit.lat, lon: hit.lon, label: hit.label, source: 'address' } });
    note.textContent = locNote(I.loc); save();
    if (hit.state && hit.state !== 'NE') toast('That address is outside Nebraska. Distances may be long.');
    return true;
  } catch (e) {
    const zip = (typed.match(/\b(\d{5})\b/) || [])[1];
    if (zip && data.zips[zip]) { Object.assign(I, { zip, address: '', loc: null }); toast(`Street not found. Using the center of ZIP ${zip}.`); return true; }
    return fail(`${e.message} Write the street, town and state, like "410 Main St, Seward, NE", or a ZIP code.`);
  }
}

function finishIntake() {
  S.intakeDone = true; S.step = 1;
  S.mode = S.intake.livingPref === 'home' ? 'homecare' : 'facility';
  S.filters = defaultFilters();
  if (S.intake.payment.includes('medicaid') && !S.intake.payment.includes('private')) S.filters.noMedicaidNo = true;
  save();
  go('#/results');
}

