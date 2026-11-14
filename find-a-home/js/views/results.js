/**
 * Screens 2 & 3 of the sketch: matches for Home care | Facilities, with faceted filters.
 * Clicking a match opens its detail page; "Map" opens it in Google Maps (new tab).
 */
import { S, save } from '../core/state.js';
import { esc, stars } from '../core/util.js';
import { lovedOne, TYPE_LABEL, PAY_LABEL, priceText, reviewsFor, avgReview } from '../core/labels.js';
import { zipKnown, mapsUrl, fromLabel } from '../core/geo.js';
import { filtered } from '../core/matching.js';
import { data } from '../core/data.js';

/** Regions in the data, Lincoln and Omaha first. */
const areaList = () => [...new Set(data.facilities.map(p => p.area).filter(Boolean))]
  .sort((a, b) => (/Lincoln/.test(b) - /Lincoln/.test(a)) || (/Omaha/.test(b) - /Omaha/.test(a)) || a.localeCompare(b));
import { app } from '../router.js';

export function renderResults() {
  const I = S.intake, F = S.filters, mode = S.mode;
  const res = filtered(mode);
  const miles = F.miles || I.maxMiles || 20;
  const isFac = mode === 'facility';
  const chk = (k, label) => `<label class="check"><input type="checkbox" data-filter="${k}" ${F[k] ? 'checked' : ''}> ${label}</label>`;
  const arr = (k, v, label) => `<label class="check"><input type="checkbox" data-filter-arr="${k}" value="${v}" ${F[k].includes(v) ? 'checked' : ''}> ${label}</label>`;
  const rad = (k, v, label) => `<label class="check"><input type="radio" name="${k}" data-filter-radio="${k}" value="${v}" ${String(F[k] ?? '') === String(v) ? 'checked' : ''}> ${label}</label>`;

  const facFilters = `
    <h3>Search by name</h3>
    <input type="text" id="qInput" placeholder="e.g. Brookestone" value="${esc(F.q)}" aria-label="Search by name" style="min-height:42px;padding:.4rem .6rem">
    <h3>Type of care</h3>
    ${arr('types', 'memory', 'Memory care only')}
    ${arr('types', 'assisted_memory', 'Assisted living + memory care')}
    ${arr('types', 'nursing', 'Nursing home')}
    <h3>Distance from ${fromLabel()}</h3>
    ${[5, 10, 20, 40, 60, 100].map(n => `<label class="check"><input type="radio" name="miles" data-filter-radio="miles" value="${n}" ${String(miles) === String(n) ? 'checked' : ''}> Within ${n} miles</label>`).join('')}
    ${rad('miles', 'any', 'Any distance')}
    <h3>Region</h3>
    ${areaList().map(a => `<label class="check"><input type="checkbox" data-area value="${esc(a)}" ${F.hideAreas.includes(a) ? '' : 'checked'}> ${esc(a)}</label>`).join('')}
    <h3>Dementia care</h3>
    ${chk('memoryUnitOnly', 'Only places with a memory / dementia unit')}
    <h3>Price per month</h3>
    ${rad('price', 'any', 'Any price')}${rad('price', 'u5', 'Under $5,000')}${rad('price', '5to8', '$5,000 – $8,000')}${rad('price', 'o8', 'Over $8,000')}
    ${chk('includeUnpriced', 'Include places that don\'t list a price')}
    <h3>Payment</h3>
    ${chk('noMedicaidNo', 'Hide places that don\'t take Medicaid')}
    <h3>Safety</h3>
    ${chk('hideWatch', 'Hide places on Medicare\'s watch list')}
    ${chk('hideLow', 'Hide nursing homes rated 1–2★')}
    ${chk('noSerious', 'Hide nursing homes cited for harming a resident (last 3 yrs)')}
    <h3>Open beds</h3>
    ${chk('openOnly', 'Only places with open beds')}
    <p class="hint" style="margin-top:.25rem">Nursing homes report this to Medicare. Ask everyone else when you request a tour.</p>`;
  const hcFilters = `
    <h3>Type of help</h3>
    ${arr('hcTypes', 'non-medical', 'Non-medical (daily living help)')}
    ${arr('hcTypes', 'medical', 'Medical home health (nurses)')}
    <h3>Experience</h3>
    ${chk('dementiaOnly', 'Advertises dementia / Alzheimer\'s care')}
    <h3>Payment</h3>
    ${chk('vaOnly', 'Works with VA benefits')}
    <h3>Price</h3>
    <p class="hint">Lincoln agencies charge about $30–$40 an hour, usually with a 3–4 hour minimum. Call for exact quotes.</p>`;

  const toggle = `
    <div class="mode-toggle" role="tablist" aria-label="Type of care">
      <button class="mode-btn ${isFac ? 'active' : ''}" data-action="mode" data-mode="facility" role="tab" aria-selected="${isFac}"><b>Facilities</b><span>Memory care, assisted living and nursing homes</span><em>${data.facilities.length} places</em></button>
      <button class="mode-btn ${!isFac ? 'active' : ''}" data-action="mode" data-mode="homecare" role="tab" aria-selected="${!isFac}"><b>Home care</b><span>Caregivers who come to the house</span><em>${data.homecare.length} agencies</em></button>
    </div>`;

  const forLine = S.intakeDone
    ? `<div class="for-line"><span>Matches for <b>${lovedOne()}</b>${zipKnown() ? `, measured from <b>${fromLabel()}</b>` : ''}${I.payment.length ? ` · ${I.payment.filter(x => PAY_LABEL[x]).map(x => PAY_LABEL[x]).join(', ')}` : ''}</span><button class="linkbtn" data-action="edit-intake">Change answers</button></div>`
    : `<div class="for-line"><span>Answer 3 short questions to rank these by what ${lovedOne()} needs and how far you are.</span><a class="btn small" href="#/welcome">Get my matches</a></div>`;
  const canCompare = S.saved.filter(id => data.byId.get(id)?.kind === mode).length;
  const comparePrompt = canCompare >= 2 && S.compare.length < 2
    ? `<div class="for-line prompt"><span>You saved ${canCompare} ${isFac ? 'places' : 'agencies'}. See them side by side.</span><button class="btn small" data-action="compare-saved">Compare saved</button></div>` : '';

  const cards = res.length ? res.map(({ p, m, d }) => card(p, m, d)).join('') :
    `<div class="card empty"><h3>No matches with these filters</h3><p>Try a longer distance or more regions.</p><button class="btn secondary" data-action="reset-filters">Reset filters</button></div>`;

  const scope = isFac
    ? `Nursing homes cover all of Nebraska. Assisted living and memory care cover Lincoln for now.`
    : `Every agency listed is based in Lincoln and serves Lancaster County.`;

  // Keep the filter panel's own scroll position when it re-renders.
  const filterScroll = app.querySelector('.filters')?.scrollTop || 0;
  app.innerHTML = `
    <div class="results-head">
      <div class="results-title"><h1>${isFac ? 'Dementia care facilities in Nebraska' : 'Home care in Lincoln'}</h1>
        <p class="muted" style="margin:0">${scope}</p></div>
      ${toggle}
    </div>
    <div class="results-layout">
      <aside class="card filters" aria-label="Filters">
        <div style="display:flex;justify-content:space-between;align-items:center"><b>Filter</b><button class="linkbtn small" data-action="reset-filters">Reset</button></div>
        ${isFac ? facFilters : hcFilters}
      </aside>
      <section>
        ${forLine}${comparePrompt}
        <div class="sort-row"><h2 style="margin:0">Matches <span class="muted" style="font-weight:400;font-size:1rem">(${res.length})</span></h2>
          <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">
          <label class="small" style="display:flex;gap:.5rem;align-items:center;margin:0">Sort by
            <select id="sortSel">${[['match', 'Best match'], ['distance', 'Closest'], ['beds', 'Most open beds'], ['rating', 'Highest rated'], ['price', 'Lowest price']].map(([v, t]) => `<option value="${v}" ${S.sort === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div></div>
        <div class="match-list">${cards}</div>
      </section>
    </div>
    ${compareBar()}`;
  app.querySelector('.filters').scrollTop = filterScroll;

  app.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('change', () => { F[el.dataset.filter] = el.checked; save(); renderResults(); }));
  app.querySelectorAll('[data-filter-arr]').forEach(el => el.addEventListener('change', () => {
    const k = el.dataset.filterArr; F[k] = el.checked ? [...new Set([...F[k], el.value])] : F[k].filter(x => x !== el.value); save(); renderResults();
  }));
  app.querySelectorAll('[data-area]').forEach(el => el.addEventListener('change', () => {
    F.hideAreas = el.checked ? F.hideAreas.filter(x => x !== el.value) : [...new Set([...F.hideAreas, el.value])]; save(); renderResults();
  }));
  app.querySelectorAll('[data-filter-radio]').forEach(el => el.addEventListener('change', () => {
    const k = el.dataset.filterRadio; F[k] = (k === 'miles' && el.value !== 'any') ? +el.value : el.value; save(); renderResults();
  }));
  document.getElementById('sortSel').addEventListener('change', e => { S.sort = e.target.value; save(); renderResults(); });
  const q = document.getElementById('qInput');
  if (q) {
    let t;
    q.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        F.q = q.value; save(); const pos = q.selectionStart; renderResults();
        const nq = document.getElementById('qInput'); nq.focus(); nq.setSelectionRange(pos, pos);
      }, 250);
    });
  }
}


/** How many beds may be open, in words. */
export function bedsLine(p) {
  if (p.kind !== 'facility') return '<span class="beds na">Caregivers come to you</span>';
  const e = p.openings?.est;
  if (e == null) return '<span class="beds na">Open beds: ask</span>';
  return `<span class="beds ${e >= 3 ? 'ok' : 'low'}"><b>${e}</b> of ${p.beds} beds may be open</span>`;
}

export function card(p, m, d) {
  const saved = S.saved.includes(p.id), cmp = S.compare.includes(p.id);
  const where = p.kind === 'facility'
    ? `${esc(p.city || 'Lincoln')} · ${d.toFixed(1)} mi · <a href="${mapsUrl(p)}" target="_blank" rel="noopener" aria-label="${esc(p.name)} on Google Maps (opens a new tab)">Map</a>`
    : 'Serves Lincoln area';
  const ratingLine = p.kind === 'facility'
    ? `${stars(p.rating.value)} <span class="small muted">${p.rating.value != null ? (p.cms ? 'Medicare' : `${p.rating.count} review${p.rating.count === 1 ? '' : 's'}`) : ''}</span>`
    : `${reviewsFor(p.id).length ? stars(avgReview(p.id)) + ` <span class="small muted">${reviewsFor(p.id).length} review(s)</span>` : '<span class="small muted">No reviews yet</span>'}`;
  return `
    <article class="card match" data-place="${p.id}" aria-label="${esc(p.name)}: see details" tabindex="0">
      <div class="match-main">
        <span class="type-label" data-type="${p.type}">${TYPE_LABEL[p.type]}</span>
        <h3><a href="#/place/${p.id}">${esc(p.name)}</a></h3>
        <div class="sub">${where} · ${priceText(p)}</div>
        <div class="facts">${bedsLine(p)}<span>${ratingLine}</span></div>
        <div class="tags">${m.good.filter(t => !/ mi away$/.test(t)).slice(0, 3).map(t => `<span class="tag good">✓ ${esc(t)}</span>`).join('')}${m.warn.slice(0, 2).map(t => `<span class="tag ${/watch|abuse|not take|Low|danger|harmed/.test(t) ? 'bad' : 'warn'}">! ${esc(t)}</span>`).join('')}</div>
      </div>
      <div class="side">
        ${S.intakeDone ? `<div class="match-score"><b>${m.score}%</b><span>match</span></div>` : ''}
        <div class="side-actions">
          <button class="btn small ${cmp ? '' : 'secondary'}" data-action="compare-toggle" data-id="${p.id}" aria-pressed="${cmp}">${cmp ? '✓ Comparing' : 'Compare'}</button>
          <button class="heart ${saved ? 'on' : ''}" data-action="save-toggle" data-id="${p.id}" aria-label="${saved ? 'Remove ' + esc(p.name) + ' from' : 'Save ' + esc(p.name) + ' to'} my list" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button>
        </div>
      </div>
    </article>`;
}

export function compareBar() {
  if (!S.compare.length) return '';
  return `<div class="compare-bar no-print"><span>${S.compare.length} selected to compare</span>
    <button class="btn small secondary" data-action="compare-clear">Clear</button>
    <a class="btn small" href="#/compare" ${S.compare.length < 2 ? 'aria-disabled="true"' : ''}>${S.compare.length < 2 ? 'Pick one more' : 'Compare now'}</a></div>`;
}

