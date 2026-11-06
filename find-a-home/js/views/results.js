/**
 * Screens 2 & 3 of the sketch: matches for Home care | Facilities, with faceted filters.
 * Clicking a match opens its detail page; "Map" opens it in Google Maps (new tab).
 */
import { S, save } from '../core/state.js';
import { esc, stars, icon } from '../core/util.js';
import { lovedOne, TYPE_LABEL, PAY_LABEL, priceText, reviewsFor, avgReview } from '../core/labels.js';
import { zipKnown, mapsUrl } from '../core/geo.js';
import { filtered } from '../core/matching.js';
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
    <h3>Area</h3>
    ${arr('areas', 'Lincoln area', 'Lincoln area')}
    ${arr('areas', 'Omaha area', 'Omaha area')}
    <h3>Distance</h3>
    ${[5, 10, 20, 40, 60].map(n => `<label class="check"><input type="radio" name="miles" data-filter-radio="miles" value="${n}" ${String(miles) === String(n) ? 'checked' : ''}> Within ${n} miles</label>`).join('')}
    ${rad('miles', 'any', 'Any distance')}
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
    <h3>Availability</h3>
    ${chk('openOnly', 'Only show estimated open beds')}
    <p class="hint" style="margin-top:.25rem">Only nursing homes report this. Ask everyone else when you request a tour.</p>`;
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
      <button class="mode-btn ${!isFac ? 'active' : ''}" data-action="mode" data-mode="homecare" role="tab" aria-selected="${!isFac}">${icon('non-medical', 54)}Home care</button>
      <button class="mode-btn ${isFac ? 'active' : ''}" data-action="mode" data-mode="facility" role="tab" aria-selected="${isFac}">${icon('nursing', 54)}Facilities</button>
    </div>`;

  const forLine = S.intakeDone
    ? `<div class="for-line"><span>Matches for <b>${lovedOne()}</b>${zipKnown() ? ` near <b>${esc(I.zip)}</b>` : ''}${I.payment.length ? ` · ${I.payment.filter(x => PAY_LABEL[x]).map(x => PAY_LABEL[x]).join(', ')}` : ''}</span><button class="linkbtn" data-action="edit-intake">Change answers</button></div>`
    : `<div class="for-line"><span>👋 Answer 3 quick questions so we can rank these by what ${lovedOne()} needs.</span><a class="btn small" href="#/welcome">Get my matches</a></div>`;

  const cards = res.length ? res.map(({ p, m, d }) => card(p, m, d)).join('') :
    `<div class="card empty"><h3>No matches with these filters</h3><p>Try widening the distance or area.</p><button class="btn secondary" data-action="reset-filters">Reset filters</button></div>`;

  const hint = '<p class="hint" style="margin:-.25rem 0 .75rem">Click a place for ratings, inspections and tours. Use <b>Map</b> to see it on Google Maps (opens a new tab).</p>';

  // Keep the filter panel's own scroll position when it re-renders.
  const filterScroll = app.querySelector('.filters')?.scrollTop || 0;
  app.innerHTML = `
    <div class="results-head">
      <div class="results-title"><span class="selected-label">Selected</span><h1>${isFac ? 'Facilities' : 'Home care'}</h1>
        <p class="muted" style="margin:0">${isFac ? 'Memory care, assisted living and nursing homes in the Lincoln and Omaha areas' : 'Caregivers who come to your home in Lincoln and Lancaster County'}</p></div>
      ${toggle}
    </div>
    <div class="results-layout">
      <aside class="card filters" aria-label="Filters">
        <div style="display:flex;justify-content:space-between;align-items:center"><b>Filter</b><button class="linkbtn small" data-action="reset-filters">Reset</button></div>
        ${isFac ? facFilters : hcFilters}
      </aside>
      <section>
        ${forLine}
        <div class="sort-row"><h2 style="margin:0">Matches <span class="muted" style="font-weight:400;font-size:1rem">(${res.length})</span></h2>
          <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">
          <label class="small" style="display:flex;gap:.5rem;align-items:center;margin:0">Sort by
            <select id="sortSel">${[['match', 'Best match'], ['distance', 'Closest'], ['rating', 'Highest rated'], ['price', 'Lowest price']].map(([v, t]) => `<option value="${v}" ${S.sort === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div></div>
        ${hint}
        <div class="match-list">${cards}</div>
      </section>
    </div>
    ${compareBar()}`;
  app.querySelector('.filters').scrollTop = filterScroll;

  app.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('change', () => { F[el.dataset.filter] = el.checked; save(); renderResults(); }));
  app.querySelectorAll('[data-filter-arr]').forEach(el => el.addEventListener('change', () => {
    const k = el.dataset.filterArr; F[k] = el.checked ? [...new Set([...F[k], el.value])] : F[k].filter(x => x !== el.value); save(); renderResults();
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


export function card(p, m, d) {
  const saved = S.saved.includes(p.id), cmp = S.compare.includes(p.id);
  const sub = p.kind === 'facility'
    ? `${TYPE_LABEL[p.type]} · ${esc(p.city || 'Lincoln')} · ${d.toFixed(1)} mi · ${priceText(p)}`
    : `${TYPE_LABEL[p.type]} · Serves Lincoln area · ${priceText(p)}`;
  const ratingLine = p.kind === 'facility'
    ? `${stars(p.rating.value)} <span class="small muted">${p.rating.value != null ? (p.cms ? 'Medicare rating' : `${p.rating.count} review${p.rating.count === 1 ? '' : 's'}`) : ''}</span>`
    : `${reviewsFor(p.id).length ? stars(avgReview(p.id)) + ` <span class="small muted">${reviewsFor(p.id).length} Find-A-Home review(s)</span>` : '<span class="small muted">No reviews yet</span>'}`;
  const openAttr = `data-place="${p.id}" aria-label="${esc(p.name)}: see details"`;
  return `
    <article class="card match" ${openAttr} tabindex="0">
      <div class="thumb">${icon(p.type, 96)}</div>
      <div>
        <h3>${esc(p.name)}</h3>
        <div class="sub">${sub}</div>
        <div style="margin-bottom:.4rem">${ratingLine}</div>
        <div class="tags">${m.good.slice(0, 4).map(t => `<span class="tag good">✓ ${esc(t)}</span>`).join('')}${m.warn.slice(0, 2).map(t => `<span class="tag ${/watch|abuse|not take|Low|danger|harmed/.test(t) ? 'bad' : 'warn'}">! ${esc(t)}</span>`).join('')}</div>
      </div>
      <div class="side">
        ${S.intakeDone ? `<div class="match-score"><b>${m.score}%</b><span>match</span></div>` : ''}
        <a class="btn small secondary" href="#/place/${p.id}">Details</a>
        <a class="btn small secondary" href="${mapsUrl(p)}" target="_blank" rel="noopener" aria-label="${esc(p.name)} on Google Maps (opens a new tab)">📍 Map</a>
        <div style="display:flex;align-items:center;gap:.4rem">
          <label class="compare-check" data-stop><input type="checkbox" data-action="compare-toggle" data-id="${p.id}" ${cmp ? 'checked' : ''}> Compare</label>
          <button class="heart ${saved ? 'on' : ''}" data-action="save-toggle" data-id="${p.id}" aria-label="${saved ? 'Remove from' : 'Save to'} my list" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button>
        </div>
      </div>
    </article>`;
}

export function compareBar() {
  if (!S.compare.length) return '';
  return `<div class="compare-bar no-print"><span>${S.compare.length} selected to compare</span>
    <button class="btn small secondary" data-action="compare-clear">Clear</button>
    <a class="btn small" href="#/compare" ${S.compare.length < 2 ? 'aria-disabled="true"' : ''}>Compare${S.compare.length < 2 ? ' (pick 2+)' : ' now'} →</a></div>`;
}

