/** Side-by-side comparison of 2–3 places, with the best value in each row highlighted. */
import { S } from '../core/state.js';
import { esc, fmt, stars, icon, telHref } from '../core/util.js';
import { TYPE_LABEL, LovedOne, priceText, knownPrice, avgReview } from '../core/labels.js';
import { dist, mapsUrl } from '../core/geo.js';
import { match, seriousCount } from '../core/matching.js';
import { summary } from '../core/data.js';
import { app } from '../router.js';
import { tourChecklistBox } from '../components/modals.js';

const heart = p => {
  const on = S.saved.includes(p.id);
  return `<button class="heart no-print ${on ? 'on' : ''}" data-action="save-toggle" data-id="${p.id}" aria-label="${on ? 'Remove' : 'Save'} ${esc(p.name)} ${on ? 'from' : 'to'} my list" aria-pressed="${on}">${on ? '♥' : '♡'}</button>`;
};

export function renderCompare() {
  const items = S.compare.map(summary).filter(Boolean);
  if (items.length < 2) {
    app.innerHTML = `<h1>Compare side by side</h1><div class="card empty"><p style="font-size:1.1rem">Pick 2 or 3 places to compare.<br>Tick <b>Compare</b> on any match.</p>
      ${items.length ? `<p>Selected so far: <b>${esc(items[0].name)}</b></p>` : ''}<a class="btn" href="#/results">Go to matches</a></div>`;
    return;
  }
  const rows = [
    ['Match for ' + LovedOne(), p => match(p).score, v => v + '%', 'max'],
    ['Type', p => TYPE_LABEL[p.type]],
    ['Distance', p => p.kind === 'facility' ? dist(p) : null, v => v == null ? 'Comes to you' : v.toFixed(1) + ' mi', 'min'],
    ['Rating', p => p.kind === 'facility' ? p.rating.value : avgReview(p.id), (v, p) => v == null ? '<span class="muted">No rating</span>' : `${stars(v)}<br><span class="small muted">${p.cms ? 'Medicare' : p.kind === 'facility' ? p.rating.count + ' reviews' : 'Find-A-Home'}</span>`, 'max'],
    ['Health inspection', p => p.cms ? p.cms.inspection : null, v => v == null ? '<span class="muted">Not federally rated</span>' : v + ' / 5', 'max'],
    ['Staffing', p => p.cms ? p.cms.staffing : null, v => v == null ? '<span class="muted">–</span>' : v + ' / 5', 'max'],
    ['Fines / warnings', p => p.cms ? p.cms.fines + (p.cms.sff ? 10 : 0) : null, (v, p) => !p.cms ? '<span class="muted">–</span>' : (p.cms.sff ? '<span class="tag bad">Watch list</span> ' : '') + (p.cms.fines ? `${p.cms.fines} fine(s), $${fmt(p.cms.fineDollars)}` : 'None'), 'min'],
    ['Dementia care', p => p.kind === 'facility' ? { dedicated: 'Memory care only', unit: p.type === 'nursing' ? '✓ Has dementia unit' : `Memory care area${p.memoryUnits ? ` (${p.memoryUnits})` : ''}`, ask: 'No dementia unit listed' }[p.memoryCare] : (p.dementia ? 'Advertises dementia care' : 'Ask')],
    ['Serious citations (3 yrs)', p => p.cms ? seriousCount(p) : null, v => v == null ? '<span class="muted">Not federally inspected</span>' : (v ? `<span class="tag bad">${v}</span> resident harmed or in danger` : 'None'), 'min'],
    ['Antipsychotic use', p => { const q = (p.quality || []).find(q => q.code === '481'); return q && q.value != null ? q.value : null; }, (v, p) => v == null ? '<span class="muted">' + (p.cms ? 'Not reported' : 'Not federally reported') + '</span>' : v + '%', 'min'],
    ['Falls with injury', p => { const q = (p.quality || []).find(q => q.code === '410'); return q && q.value != null ? q.value : null; }, (v, p) => v == null ? '<span class="muted">' + (p.cms ? 'Not reported' : 'Not federally reported') + '</span>' : v + '%', 'min'],
    ['Staff turnover', p => p.cms ? p.cms.turnover : null, v => v == null ? '<span class="muted">–</span>' : v + '% / yr', 'min'],
    ['Owner type', p => p.cms ? p.cms.ownership + (p.owners.changed12m ? ' <span class="tag warn">new owner</span>' : '') : '<span class="muted">–</span>'],
    ['Medicaid', p => ({ yes: '✓ Accepts', no: '✕ No', ask: '? Ask' })[p.payment.medicaid]],
    ['Price', p => knownPrice(p) ?? (p.kind === 'homecare' ? p.priceLow * 120 : null), (v, p) => priceText(p, true), 'min'],
    ['Open beds (est.)', p => p.openings ? p.openings.est : null, v => v == null ? '<span class="muted">Ask</span>' : '~' + v, 'max'],
    ['Phone', p => `<a href="tel:${p.phone.replace(/\D/g, '')}">${esc(p.phone)}</a>`],
    ['Map', p => `<a href="${mapsUrl(p)}" target="_blank" rel="noopener">📍 Google Maps ↗</a>`]
  ];
  const body = rows.map(([label, get, show, best]) => {
    const vals = items.map(get);
    let bestIdx = -1;
    if (best) {
      const nums = vals.map((v, i) => [v, i]).filter(([v]) => typeof v === 'number');
      if (nums.length > 1) {
        const target = best === 'max' ? Math.max(...nums.map(n => n[0])) : Math.min(...nums.map(n => n[0]));
        const winners = nums.filter(n => n[0] === target);
        if (winners.length === 1) bestIdx = winners[0][1];
      }
    }
    return `<tr><th scope="row">${label}</th>${vals.map((v, i) => `<td class="${i === bestIdx ? 'best' : ''}">${show ? show(v, items[i]) : v}</td>`).join('')}</tr>`;
  }).join('');
  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin-bottom:1rem">
      <div><h1 style="margin:0">Compare side by side</h1><p class="muted" style="margin:0">Green marks the best value in each row. Tap ♡ to save a place to My list.</p></div>
      <div class="no-print" style="display:flex;gap:.5rem"><button class="btn secondary" onclick="window.print()">🖨️ Print</button><a class="btn secondary" href="#/results">+ Add another</a></div>
    </div>
    <div class="compare-wrap"><table class="compare">
      <thead><tr><th></th>${items.map(p => `<th scope="col">${icon(p.type, 44)}<br><span class="compare-name"><a href="#/place/${p.id}">${esc(p.name)}</a>${heart(p)}</span></th>`).join('')}</tr></thead>
      <tbody>${body}
        <tr class="no-print"><th></th>${items.map(p => `<td><button class="btn small" data-action="tour" data-id="${p.id}">Request ${p.kind === 'facility' ? 'tour' : 'consult'}</button><br><button class="linkbtn small" data-action="compare-remove" data-id="${p.id}" style="margin-top:.4rem">Remove</button></td>`).join('')}</tr>
      </tbody></table></div>
    ${tourChecklistBox()}`;
}

