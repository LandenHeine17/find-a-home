/**
 * Screens 4 & 5 of the sketch: detail page for a facility or home care agency.
 * Fetches the full record (GET /api/places/:id), then renders cards for:
 * rating, about, safety, insurance, dementia care, price, room, contact, reviews.
 * Nursing homes get extra Medicare sections (components/nursing-home-sections.js).
 */
import { S } from '../core/state.js';
import { esc, fmt, stars, icon, telHref } from '../core/util.js';
import { TYPE_LABEL, PAY_LABEL, lovedOne, priceText, reviewsFor, avgReview } from '../core/labels.js';
import { dist, mapsUrl, zipKnown } from '../core/geo.js';
import { match, recentSerious } from '../core/matching.js';
import { data, getPlace } from '../core/data.js';
import { app } from '../router.js';
import { compareBar } from './results.js';
import { staffingCard, ownerCard, inspectionCard, qualityCard, bindInspectionCard } from '../components/nursing-home-sections.js';


function payList(p) {
  const order = ['private', 'medicaid', 'medicare', 'va', 'ltc'];
  const sym = { yes: '✓', no: '✕', ask: '?', short: '½' };
  const note = (k, v) => {
    if (v === 'yes') return k === 'medicare' && p.kind === 'homecare' ? 'Yes, when a doctor orders skilled care' : 'Yes';
    if (v === 'no') return k === 'medicare' ? 'No. Medicare does not pay for long-term custodial care.' : 'No';
    if (v === 'short') return 'Short-term rehab only (up to 100 days after a hospital stay)';
    if (k === 'medicaid' && p.kind === 'facility') return 'Ask. Some assisted living accepts the Medicaid waiver.';
    return 'Ask. This information isn\'t public yet.';
  };
  const mine = S.intake.payment;
  return `<ul class="pay-list">${order.map(k => `<li><span class="pay-icon ${p.payment[k]}">${sym[p.payment[k]]}</span><span><b>${PAY_LABEL[k]}</b>${mine.includes(k) ? ' <span class="tag info">yours</span>' : ''}<br><span class="small muted">${note(k, p.payment[k])}</span></span></li>`).join('')}</ul>`;
}

export async function renderPlace(id) {
  const notFound = '<div class="card empty"><h2>We couldn\'t find that place</h2><a class="btn" href="#/results">Back to matches</a></div>';
  if (!data.byId.has(id)) { app.innerHTML = notFound; return; }
  app.innerHTML = '<div class="card empty">Loading…</div>';
  let p;
  try { p = await getPlace(id); } catch (e) { app.innerHTML = '<div class="card empty"><h2>Couldn\'t load this place</h2><p>Check your connection and try again.</p></div>'; return; }
  if (decodeURIComponent(location.hash.replace('#/place/', '')) !== id) return; // user already navigated away
  renderPlaceDetail(p);
}

function renderPlaceDetail(p) {
  const m = match(p), d = dist(p), saved = S.saved.includes(p.id), cmp = S.compare.includes(p.id);
  const isFac = p.kind === 'facility';

  const why = S.intakeDone ? `
    <div class="card full">
      <h2>Why this could fit ${lovedOne()} <span class="tag info" style="font-size:.9rem">${m.score}% match</span></h2>
      <div class="row">
        <div><b class="small">Good fit</b><ul style="margin:.25rem 0">${m.good.map(t => `<li>${esc(t)}</li>`).join('') || '<li class="muted">Nothing stands out yet</li>'}</ul></div>
        <div><b class="small">Things to ask about</b><ul style="margin:.25rem 0">${m.warn.map(t => `<li>${esc(t)}</li>`).join('') || '<li class="muted">No concerns from your answers</li>'}</ul></div>
      </div>
    </div>` : '';

  let ratingCard, safetyCard = '', dementiaCard = '', roomCard = '', extraCards = '';
  if (isFac && p.cms) {
    const c = p.cms;
    const barRow = (label, v) => `<div class="bar-row"><span>${label}</span><div class="bar"><i style="width:${(v || 0) * 20}%"></i></div><b>${v ?? '–'}/5</b></div>`;
    const vs = (v, avg, lowerBetter, unit) => {
      if (v == null) return '<span class="muted">Not reported</span>';
      const better = lowerBetter ? v < avg : v > avg;
      return `${v}${unit} <span class="small ${better ? 'good-txt' : 'warn-txt'}">(${better ? 'better than' : 'worse than'} NE avg ${avg}${unit})</span>`;
    };
    ratingCard = `
      <div class="card"><h2>⭐ Rating</h2>
        <div class="rating-big">${c.overall != null ? stars(c.overall) : ''}<span><b>${c.overall ?? 'Not rated'}${c.overall ? ' out of 5' : ''}</b><br><span class="small muted">Medicare overall rating</span></span></div>
        <div class="bars">${barRow('Health inspections', c.inspection)}${barRow('Staffing', c.staffing)}${barRow('Quality of care', c.quality)}</div>
        ${c.overall == null ? '<p class="small muted" style="margin-top:.5rem">Medicare does not give star ratings to facilities on its watch list.</p>' : ''}
        <a class="small" href="${p.careCompare}" target="_blank" rel="noopener">See the full Medicare report ↗</a>
      </div>`;
    const alerts = [];
    const rs = recentSerious(p);
    if (c.sff) alerts.push('<div class="alert bad"><b>On Medicare\'s watch list (Special Focus Facility).</b> Medicare picked this nursing home for extra inspections because of a history of serious quality problems.</div>');
    else if (c.sffCandidate) alerts.push('<div class="alert bad"><b>Candidate for Medicare\'s watch list.</b> Its inspection history is among the worst in the state.</div>');
    if (c.abuse) alerts.push('<div class="alert bad"><b>Cited for abuse</b> in a recent inspection.</div>');
    if (rs.jeopardy) alerts.push('<div class="alert bad"><b>Recent "immediate jeopardy" citation:</b> inspectors found residents in serious danger. See inspection details below.</div>');
    else if (rs.harm) alerts.push('<div class="alert warn"><b>Recent citation where a resident was harmed.</b> See inspection details below.</div>');
    if (c.fines > 0) alerts.push(`<div class="alert warn"><b>${c.fines} federal fine${c.fines > 1 ? 's' : ''}</b> totaling $${fmt(c.fineDollars)} in the last 3 years.</div>`);
    if (!alerts.length) alerts.push('<div class="alert good">No federal fines, abuse citations, recent harm citations or watch list status on record.</div>');
    safetyCard = `
      <div class="card"><h2>🛡️ Is it safe?</h2>${alerts.join('')}
        <dl class="kv">
          <dt>Last inspection</dt><dd>${new Date(c.inspectionDate + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</dd>
          <dt>Problems found</dt><dd>${vs(c.deficiencies, data.averages.neDeficiencies, true, '')}</dd>
          <dt>From complaints</dt><dd>${c.complaintDeficiencies ?? '–'}</dd>
        </dl>
        <a class="small" href="#inspections">Jump to inspection details ↓</a></div>`;
    const ap = p.quality.find(q => q.code === '481'), fl = p.quality.find(q => q.code === '410');
    dementiaCard = `<div class="card"><h2>🧠 Dementia care</h2>
      ${p.memoryCare === 'unit'
        ? `<div class="alert good"><b>Has a dementia / memory support unit.</b><br><span class="small">Source: ${esc(p.memorySource)}</span></div>`
        : '<div class="alert info">Not listed as having a dedicated memory unit. Most nursing homes still care for residents with dementia.</div>'}
      ${p.behavioral ? '<div class="alert good">Listed as able to <b>accommodate behavioral needs</b> (agitation, aggression).</div>' : ''}
      <dl class="kv">
        <dt>Antipsychotic use</dt><dd>${ap && ap.value != null ? vs(ap.value, ap.ne, true, '%') : 'Not reported'}</dd>
        <dt>Falls with injury</dt><dd>${fl && fl.value != null ? vs(fl.value, fl.ne, true, '%') : 'Not reported'}</dd>
      </dl>
      <p class="small muted" style="margin-top:.5rem">Ask: "Is the unit secured? How are staff trained in dementia care?"</p></div>`;
    roomCard = `<div class="card"><h2>🛏️ Is there room?</h2><p class="price-big">~${p.openings.est} of ${p.beds} beds</p><p class="small muted">${esc(p.openings.note)}</p></div>`;
    extraCards = staffingCard(p, vs) + ownerCard(p) + inspectionCard(p) + qualityCard(p);
  } else if (isFac) {
    ratingCard = `
      <div class="card"><h2>⭐ Rating</h2>
        <div class="rating-big">${p.rating.value != null ? stars(p.rating.value) : ''}<span><b>${p.rating.value != null ? p.rating.value + ' out of 5' : 'No reviews yet'}</b><br><span class="small muted">${p.rating.count ? `${p.rating.count} family review${p.rating.count > 1 ? 's' : ''} on Caring.com` : 'Caring.com'}</span></span></div>
        <p class="small muted">Assisted living and memory care are licensed by the state, not Medicare, so there are no federal star ratings. Nebraska DHHS inspects them, and their reports are available on request.</p>
      </div>`;
    safetyCard = `<div class="card"><h2>🛡️ Is it safe?</h2><div class="alert info">State inspection reports for assisted living aren't online in an easy format yet. In the full app we'd show them here.</div>
      <p class="small">Ask on your tour:</p><ul class="small" style="margin:0"><li>What did your last state inspection find?</li><li>How many staff are on the memory care floor at night?</li><li>How do you prevent and respond to falls?</li></ul></div>`;
    dementiaCard = `<div class="card"><h2>🧠 Dementia care</h2>${p.memoryCare === 'dedicated'
      ? '<div class="alert good"><b>Memory care only.</b> Every resident has dementia, and the building and staff are set up for it.</div>'
      : `<div class="alert good"><b>Has a memory care area</b>${p.memoryUnits ? ` with ${p.memoryUnits} apartments` : ''}, separate from regular assisted living.</div>`}
      <p class="small muted">Ask whether exits are secured, which matters if ${lovedOne()} wanders.</p></div>`;
    roomCard = `<div class="card"><h2>🛏️ Is there room?</h2><p><b>${p.beds ? `${p.beds} apartments total${p.memoryUnits && p.memoryUnits !== p.beds ? `, ${p.memoryUnits} for memory care` : ''}` : 'Small, home-like house'}.</b></p><p class="small muted">${esc(p.openings.note)}</p></div>`;
  } else {
    const avg = avgReview(p.id);
    ratingCard = `<div class="card"><h2>⭐ Rating</h2><div class="rating-big">${avg != null ? stars(avg) : ''}<span><b>${avg ? avg.toFixed(1) + ' out of 5' : 'No reviews yet'}</b><br><span class="small muted">From Find-A-Home families</span></span></div>
      <p class="small muted">Home care agencies aren't star-rated by Medicare. Reviews from families like you will appear here.</p></div>`;
    dementiaCard = `<div class="card"><h2>🧠 Specialties</h2>
      ${p.dementia ? '<div class="alert good">Advertises <b>Alzheimer\'s and dementia care</b> on its website.</div>' : p.type === 'medical' ? '<div class="alert info">Medical home health: nurses and therapists visit for care a doctor has ordered.</div>' : '<div class="alert warn">Ask whether caregivers have <b>dementia training</b>.</div>'}
      <ul style="margin:0">${p.services.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
    safetyCard = `<div class="card"><h2>🛡️ Questions to ask</h2><ul class="small" style="margin:0"><li>Are caregivers background-checked and bonded?</li><li>Will we have the same caregiver each visit?</li><li>What is the minimum number of hours per visit?</li><li>Is there a charge for the first in-home assessment?</li><li>What happens if a caregiver calls in sick?</li></ul></div>`;
  }

  const priceCard = `
    <div class="card"><h2>💲 Base price</h2>
      <p class="price-big">${priceText(p, true)}</p>
      <p class="small muted">${esc(p.priceNote)} Prices are subject to change.</p>
      ${isFac && S.intake.budget ? `<p class="small">Your budget: <b>$${fmt(S.intake.budget)}/mo</b></p>` : ''}
    </div>`;
  const payCard = `<div class="card"><h2>🧾 Insurance taken</h2>${payList(p)}</div>`;
  const bioCard = `<div class="card"><h2>📝 About</h2><p>${esc(p.bio)}</p></div>`;
  const contactCard = `
    <div class="card"><h2>📞 Contact</h2>
      <dl class="kv">
        ${isFac ? `<dt>Address</dt><dd>${esc(p.address)}</dd><dt>Distance</dt><dd>${d.toFixed(1)} miles from ${zipKnown() ? esc(S.intake.zip) : 'downtown Lincoln'}</dd>` : `<dt>Serves</dt><dd>${esc(p.serviceArea)}</dd>`}
        <dt>Phone</dt><dd><a href="${telHref(p.phone)}">${esc(p.phone)}</a></dd>
        <dt>Website</dt><dd>${p.website ? `<a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.websiteLabel || p.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))} ↗</a>` : `<a href="https://www.google.com/search?q=${encodeURIComponent(p.name + ' ' + (p.city || 'Lincoln') + ' NE')}" target="_blank" rel="noopener">Find their website ↗</a> <span class="small muted">(not verified)</span>`}</dd>
      </dl>
      <div class="contact-row"><a class="btn small secondary" href="${telHref(p.phone)}">Call</a><a class="btn small secondary" href="${mapsUrl(p)}" target="_blank" rel="noopener">📍 Google Maps & photos</a></div>
    </div>`;
  const reviews = reviewsFor(p.id);
  const reviewCard = `
    <div class="card full"><h2>💬 Family reviews on Find-A-Home</h2>
      ${reviews.length ? reviews.map(r => `<div class="review">${stars(r.stars)} <b>${esc(r.name || 'A family member')}</b> <span class="small muted">· ${esc(r.date)}</span><p style="margin:.25rem 0 0">${esc(r.text)}</p></div>`).join('') : '<p class="muted">No reviews yet. Families who have used this place can share what it\'s really like.</p>'}
      <button class="btn secondary small" data-action="review" data-id="${p.id}">Write a review</button>
    </div>`;

  app.innerHTML = `
    <div class="back"><a href="#/results" class="btn ghost">← Back to matches</a></div>
    <div class="card detail-head">
      <div class="thumb">${icon(p.type, 120)}</div>
      <div><span class="tag info">${TYPE_LABEL[p.type]}</span><h1>${esc(p.name)}</h1>
        ${p.aka ? `<div class="small muted">Also known as ${esc(p.aka)}</div>` : ''}
        <div class="muted">${isFac ? `<a href="${mapsUrl(p)}" target="_blank" rel="noopener" title="Open in Google Maps">📍 ${esc(p.address)}</a> · ${d.toFixed(1)} mi` : esc(p.serviceArea)}</div></div>
      <div class="actions">
        <button class="btn" data-action="tour" data-id="${p.id}">${isFac ? '📅 Request a tour' : '📅 Request a free consult'}</button>
        <button class="btn secondary" data-action="save-toggle" data-id="${p.id}" aria-pressed="${saved}">${saved ? '♥ Saved' : '♡ Save'}</button>
        <button class="btn secondary" data-action="compare-toggle-btn" data-id="${p.id}" aria-pressed="${cmp}">${cmp ? '✓ Comparing' : '+ Compare'}</button>
      </div>
    </div>
    <div class="detail-grid">
      ${why}
      ${ratingCard}${bioCard}
      ${safetyCard}${payCard}
      ${dementiaCard}${priceCard}
      ${roomCard}${contactCard}
      ${extraCards}
      ${reviewCard}
    </div>
    <div class="sources"><b>Where this information comes from:</b><ul>${p.sources.map(s => `<li>${esc(s)}</li>`).join('')}</ul>Phone numbers and details can change, so please call to confirm.</div>
    ${compareBar()}`;
  bindInspectionCard(app);
}

