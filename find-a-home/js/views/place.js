/**
 * Detail page for a facility or home care agency.
 * Fetches the full record (GET /api/places/:id), then renders cards for:
 * room, price breakdown, fit, rating, safety, insurance, dementia care, about, reviews.
 * Nursing homes get extra Medicare sections (components/nursing-home-sections.js).
 * Every card ends with a "Source" line so families can see where each fact comes from.
 */
import { S } from '../core/state.js';
import { esc, fmt, stars, telHref } from '../core/util.js';
import { TYPE_LABEL, PAY_LABEL, lovedOne, reviewsFor, avgReview } from '../core/labels.js';
import { dist, mapsUrl, fromLabel } from '../core/geo.js';
import { match, recentSerious } from '../core/matching.js';
import { feeGuide, baseLine, FEE_QUESTIONS } from '../core/fees.js';
import { data, getPlace } from '../core/data.js';
import { app } from '../router.js';
import { compareBar } from './results.js';
import { staffingCard, ownerCard, inspectionCard, qualityCard, bindInspectionCard } from '../components/nursing-home-sections.js';

const src = t => `<p class="src">Source: ${t}</p>`;
const cmsDate = () => data.dataDate ? `, data processed ${new Date(data.dataDate + 'T12:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : '';

function payList(p) {
  const order = ['private', 'medicaid', 'medicare', 'va', 'ltc'];
  const sym = { yes: '✓', no: '✕', ask: '?', short: '½' };
  const word = { yes: 'Yes', no: 'No', ask: 'Ask', short: 'Short stays' };
  const note = (k, v) => {
    if (v === 'yes') return k === 'medicare' && p.kind === 'homecare' ? 'When a doctor orders skilled care' : '';
    if (v === 'no') return k === 'medicare' ? 'Medicare does not pay for long-term care' : '';
    if (v === 'short') return 'Rehab for up to 100 days after a hospital stay';
    if (k === 'medicaid' && p.kind === 'facility') return 'Some assisted living accepts the Medicaid waiver';
    return 'Not public yet';
  };
  const mine = S.intake.payment;
  return `<ul class="pay-list">${order.map(k => `<li><span class="pay-icon ${p.payment[k]}" aria-hidden="true">${sym[p.payment[k]]}</span><span><b>${PAY_LABEL[k]}</b>: ${word[p.payment[k]]}${mine.includes(k) ? ' <span class="tag info">yours</span>' : ''}${note(k, p.payment[k]) ? `<br><span class="small muted">${note(k, p.payment[k])}</span>` : ''}</span></li>`).join('')}</ul>`;
}

function paySource(p) {
  if (p.cms) return src(`Medicare and Medicaid from the home's federal certification (Medicare Care Compare${cmsDate()}). VA from ${p.vaSource ? esc(p.vaSource) : 'county VA contract lists: not listed, so ask'}. Long-term care insurance depends on your policy.`);
  if (p.kind === 'facility') return src('Private pay from the City of Lincoln Aging Partners licensed assisted living list. Medicaid waiver, VA and insurance are not published, so ask.');
  return src('The agency\'s website and the Aging Partners home care list. Call to confirm what they bill.');
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

function roomCard(p) {
  const isFac = p.kind === 'facility';
  if (p.cms) {
    const est = p.openings.est, pct = p.beds ? Math.round(est / p.beds * 100) : 0;
    return `<div class="card beds-card"><h2>Open beds</h2>
      <p class="beds-figure"><b>${est}</b> of ${p.beds} beds may be open</p>
      <div class="meter" role="img" aria-label="${est} of ${p.beds} beds may be open"><i style="width:${Math.max(2, pct)}%"></i></div>
      <p class="small">${est >= 3 ? 'Room is likely. Call to confirm before you tour.' : est >= 1 ? 'Nearly full. Ask about the waitlist when you call.' : 'Likely full. Ask about the waitlist.'}</p>
      ${src('Medicare: certified beds minus the average number of residents each day. Certified beds can be more than the beds staffed, so call to confirm.')}</div>`;
  }
  if (isFac) return `<div class="card beds-card"><h2>Open beds</h2>
      <p class="beds-figure">${p.beds ? `<b>${p.beds}</b> apartments${p.memoryUnits && p.memoryUnits !== p.beds ? `, ${p.memoryUnits} for memory care` : ''}` : 'A small, home-like house'}</p>
      <p class="small">Openings are not published. The tour request asks about room and the waitlist for you.</p>
      ${src('City of Lincoln Aging Partners licensed assisted living list.')}</div>`;
  return `<div class="card beds-card"><h2>Availability</h2>
      <p class="beds-figure">Caregivers come to you</p>
      <p class="small">Serves ${esc(p.serviceArea)}. Ask how soon a caregiver can start and whether the same person will come each visit.</p>
      ${src('Aging Partners home care list and the agency\'s website.')}</div>`;
}

function priceCard(p) {
  const g = feeGuide(p), b = baseLine(p), isHourly = p.kind === 'homecare' && p.type !== 'medical';
  const calc = isHourly ? `
      <div class="calc" id="hcCalc">
        <div class="row">
          <div class="field"><label for="c-hours">Hours a day <span class="range-val" id="c-hours-v">4</span></label><input id="c-hours" type="range" min="2" max="12" step="1" value="4"></div>
          <div class="field"><label for="c-days">Days a week <span class="range-val" id="c-days-v">5</span></label><input id="c-days" type="range" min="1" max="7" step="1" value="5"></div>
        </div>
        <p class="calc-out" aria-live="polite">About <b id="c-out"></b> a month</p>
      </div>` : '';
  const budget = p.kind === 'facility' && S.intake.budget ? `<p class="small">Your budget: <b>$${fmt(S.intake.budget)} a month</b>${!p.priceEstimated || p.type === 'nursing' ? (p.priceLow <= S.intake.budget ? '. The base price fits, before extras.' : '. The base price is above it.') : ''}</p>` : '';
  return `
    <div class="card full price-card"><h2>Price breakdown</h2>
      <div class="price-top">
        <div><p class="price-big">${b.big}</p><p class="small muted">${b.small}</p>${budget}</div>
        ${calc}
      </div>
      <div class="price-cols">
        <div><h3>Usually included</h3><ul class="ticks">${g.included.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
        <div><h3>Often billed on top</h3><ul class="fee-list">${g.extra.map(([n, how]) => `<li><b>${esc(n)}</b><span class="small muted">${esc(how)}</span></li>`).join('')}</ul></div>
        <div>${g.oneTime.length ? `<h3>One-time fees</h3><ul class="fee-list">${g.oneTime.map(t => `<li><b>${esc(t)}</b></li>`).join('')}</ul>` : ''}
          <h3>Who pays</h3><ul class="plain">${g.payers.map(t => `<li>${t}</li>`).join('')}</ul></div>
      </div>
      <div class="ask-box"><b>Ask for these before you sign</b><ul>${FEE_QUESTIONS.map(q => `<li>${esc(q)}</li>`).join('')}</ul></div>
      ${src(g.confirmed ? esc(g.source) : `${esc(p.priceNote)} The included and extra lists show what ${p.kind === 'homecare' ? 'agencies' : 'places'} of this type commonly charge. ${esc(p.name)} has not confirmed its own fee list.`)}
    </div>`;
}

function bindCalc(p) {
  const h = document.getElementById('c-hours'), d = document.getElementById('c-days');
  if (!h) return;
  const paint = () => {
    document.getElementById('c-hours-v').textContent = h.value;
    document.getElementById('c-days-v').textContent = d.value;
    const hrs = +h.value * +d.value * 52 / 12;
    document.getElementById('c-out').textContent = `$${fmt(hrs * p.priceLow)}–$${fmt(hrs * p.priceHigh)}`;
  };
  h.addEventListener('input', paint); d.addEventListener('input', paint); paint();
}

function renderPlaceDetail(p) {
  const m = match(p), d = dist(p), saved = S.saved.includes(p.id), cmp = S.compare.includes(p.id);
  const isFac = p.kind === 'facility';

  const why = S.intakeDone ? `
    <div class="card full">
      <h2>How it fits ${lovedOne()} <span class="tag info">${m.score}% match</span></h2>
      <div class="row">
        <div><h3>Good fit</h3><ul class="ticks">${m.good.map(t => `<li>${esc(t)}</li>`).join('') || '<li class="muted">Nothing stands out yet</li>'}</ul></div>
        <div><h3>Ask about</h3><ul class="flags">${m.warn.map(t => `<li>${esc(t)}</li>`).join('') || '<li class="muted">No concerns from your answers</li>'}</ul></div>
      </div>
      <p class="small muted" style="margin:0">Built from your answers about ${lovedOne()}: stage, wandering, medical needs, payment, budget and distance. <button class="linkbtn" data-action="edit-intake">Change answers</button></p>
    </div>` : '';

  let ratingCard, safetyCard = '', dementiaCard = '', extraCards = '';
  if (isFac && p.cms) {
    const c = p.cms;
    const barRow = (label, v) => `<div class="bar-row"><span>${label}</span><div class="bar"><i style="width:${(v || 0) * 20}%"></i></div><b>${v ?? '–'}/5</b></div>`;
    const vs = (v, avg, lowerBetter, unit) => {
      if (v == null) return '<span class="muted">Not reported</span>';
      const better = lowerBetter ? v < avg : v > avg;
      return `${v}${unit} <span class="small ${better ? 'good-txt' : 'warn-txt'}">(${better ? 'better than' : 'worse than'} NE avg ${avg}${unit})</span>`;
    };
    ratingCard = `
      <div class="card"><h2>Medicare rating</h2>
        <div class="rating-big">${c.overall != null ? stars(c.overall) : ''}<span><b>${c.overall ?? 'Not rated'}${c.overall ? ' out of 5' : ''}</b></span></div>
        <div class="bars">${barRow('Health inspections', c.inspection)}${barRow('Staffing', c.staffing)}${barRow('Quality of care', c.quality)}</div>
        ${c.overall == null ? '<p class="small muted" style="margin-top:.5rem">Medicare does not give star ratings to homes on its watch list.</p>' : ''}
        <p style="margin:.75rem 0 0"><a href="${p.careCompare}" target="_blank" rel="noopener">Read the full Medicare report</a></p>
        ${src(`Medicare Care Compare${cmsDate()}`)}
      </div>`;
    const alerts = [];
    const rs = recentSerious(p);
    if (c.sff) alerts.push('<div class="alert bad"><b>On Medicare\'s watch list (Special Focus Facility).</b> Medicare picked this home for extra inspections because of a history of serious quality problems.</div>');
    else if (c.sffCandidate) alerts.push('<div class="alert bad"><b>Candidate for Medicare\'s watch list.</b> Its inspection history is among the worst in the state.</div>');
    if (c.abuse) alerts.push('<div class="alert bad"><b>Cited for abuse</b> in a recent inspection.</div>');
    if (rs.jeopardy) alerts.push('<div class="alert bad"><b>Recent "immediate jeopardy" citation:</b> inspectors found residents in serious danger. See the inspection details below.</div>');
    else if (rs.harm) alerts.push('<div class="alert warn"><b>Recent citation where a resident was harmed.</b> See the inspection details below.</div>');
    if (c.fines > 0) alerts.push(`<div class="alert warn"><b>${c.fines} federal fine${c.fines > 1 ? 's' : ''}</b> totaling $${fmt(c.fineDollars)} in the last 3 years.</div>`);
    if (!alerts.length) alerts.push('<div class="alert good">No federal fines, abuse citations, recent harm citations or watch list status on record.</div>');
    safetyCard = `
      <div class="card"><h2>Safety record</h2>${alerts.join('')}
        <dl class="kv">
          <dt>Last inspection</dt><dd>${new Date(c.inspectionDate + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</dd>
          <dt>Problems found</dt><dd>${vs(c.deficiencies, data.averages.neDeficiencies, true, '')}</dd>
          <dt>From complaints</dt><dd>${c.complaintDeficiencies ?? '–'}</dd>
        </dl>
        <p style="margin:.75rem 0 0"><a href="#inspections">See every inspection citation</a></p>
        ${src(`state inspections reported to Medicare (Care Compare${cmsDate()})`)}</div>`;
    const ap = p.quality.find(q => q.code === '481'), fl = p.quality.find(q => q.code === '410');
    dementiaCard = `<div class="card"><h2>Dementia care</h2>
      ${p.memoryCare === 'unit'
        ? '<div class="alert good"><b>Has a dementia or memory support unit.</b></div>'
        : '<div class="alert info">Not listed as having a dedicated memory unit. Most nursing homes still care for residents with dementia.</div>'}
      ${p.behavioral ? '<div class="alert good">Listed as able to <b>accommodate behavioral needs</b> (agitation, aggression).</div>' : ''}
      <dl class="kv">
        <dt>Antipsychotic use</dt><dd>${ap && ap.value != null ? vs(ap.value, ap.ne, true, '%') : 'Not reported'}</dd>
        <dt>Falls with injury</dt><dd>${fl && fl.value != null ? vs(fl.value, fl.ne, true, '%') : 'Not reported'}</dd>
      </dl>
      <p class="small muted" style="margin-top:.5rem">Ask: "Is the unit secured? How are staff trained in dementia care?"</p>
      ${src(`${p.memorySource ? esc(p.memorySource) + ' (memory unit); ' : 'memory unit not on the county lists; '}Medicare quality measures${cmsDate()}`)}</div>`;
    extraCards = staffingCard(p, vs) + ownerCard(p) + inspectionCard(p) + qualityCard(p);
  } else if (isFac) {
    ratingCard = `
      <div class="card"><h2>Family rating</h2>
        <div class="rating-big">${p.rating.value != null ? stars(p.rating.value) : ''}<span><b>${p.rating.value != null ? p.rating.value + ' out of 5' : 'No reviews yet'}</b>${p.rating.count ? `<br><span class="small muted">${p.rating.count} review${p.rating.count > 1 ? 's' : ''}</span>` : ''}</span></div>
        <p class="small muted">Assisted living and memory care are licensed by the state, not Medicare, so there are no federal star ratings. Nebraska DHHS inspects them, and their reports are available on request.</p>
        ${src(esc(p.rating.source || 'Caring.com family reviews'))}
      </div>`;
    safetyCard = `<div class="card"><h2>Safety record</h2><div class="alert info">Nebraska's inspection reports for assisted living are not published online in a form we can read yet. Ask for the latest one on your tour.</div>
      <ul class="small" style="margin:0"><li>What did your last state inspection find?</li><li>How many staff are on the memory care floor at night?</li><li>How do you prevent and respond to falls?</li></ul>
      ${src('Nebraska DHHS licenses assisted living; reports are available on request.')}</div>`;
    dementiaCard = `<div class="card"><h2>Dementia care</h2>${p.memoryCare === 'dedicated'
      ? '<div class="alert good"><b>Memory care only.</b> Every resident has dementia, and the building and staff are set up for it.</div>'
      : `<div class="alert good"><b>Has a memory care area</b>${p.memoryUnits ? ` with ${p.memoryUnits} apartments` : ''}, separate from regular assisted living.</div>`}
      <p class="small muted">Ask whether exits are secured, which matters if ${lovedOne()} wanders.</p>
      ${src('City of Lincoln Aging Partners licensed assisted living list and the community\'s website.')}</div>`;
  } else {
    const avg = avgReview(p.id);
    ratingCard = `<div class="card"><h2>Family rating</h2><div class="rating-big">${avg != null ? stars(avg) : ''}<span><b>${avg ? avg.toFixed(1) + ' out of 5' : 'No reviews yet'}</b></span></div>
      <p class="small muted">Medicare does not star-rate home care agencies. Reviews from families on Find-A-Home show here.</p></div>`;
    dementiaCard = `<div class="card"><h2>Services</h2>
      ${p.dementia ? '<div class="alert good">Advertises <b>Alzheimer\'s and dementia care</b> on its website.</div>' : p.type === 'medical' ? '<div class="alert info">Medical home health: nurses and therapists visit for care a doctor has ordered.</div>' : '<div class="alert warn">Ask whether caregivers have <b>dementia training</b>.</div>'}
      <ul class="ticks">${p.services.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      ${src('The agency\'s website.')}</div>`;
    safetyCard = `<div class="card"><h2>Questions to ask</h2><ul class="small" style="margin:0"><li>Are caregivers background-checked and bonded?</li><li>Will we have the same caregiver each visit?</li><li>What is the minimum number of hours per visit?</li><li>Is there a charge for the first in-home assessment?</li><li>What happens if a caregiver calls in sick?</li></ul></div>`;
  }

  const payCard = `<div class="card"><h2>Insurance and payment</h2>${payList(p)}${paySource(p)}</div>`;
  const bioCard = `<div class="card"><h2>About</h2><p>${esc(p.bio)}</p>${p.sources ? src(p.sources.map(esc).join('; ')) : ''}</div>`;
  const website = p.website
    ? `<a class="btn small secondary" href="${esc(p.website)}" target="_blank" rel="noopener">Visit website</a>`
    : `<a class="btn small secondary" href="https://www.google.com/search?q=${encodeURIComponent(p.name + ' ' + (p.city || 'Lincoln') + ' NE')}" target="_blank" rel="noopener">Search for website</a>`;
  const reviews = reviewsFor(p.id);
  const reviewCard = `
    <div class="card full"><h2>Family reviews</h2>
      ${reviews.length ? reviews.map(r => `<div class="review">${stars(r.stars)} <b>${esc(r.name || 'A family member')}</b> <span class="small muted">· ${esc(r.date)}</span><p style="margin:.25rem 0 0">${esc(r.text)}</p></div>`).join('') : '<p class="muted">No reviews on Find-A-Home yet. Families who have used this place can say what it is really like.</p>'}
      <div class="contact-row"><button class="btn secondary small" data-action="review" data-id="${p.id}">Write a review</button><a class="btn small secondary" href="${mapsUrl(p)}" target="_blank" rel="noopener">Read Google reviews</a></div>
    </div>`;

  app.innerHTML = `
    <div class="back"><a href="#/results" class="linkbtn">← Back to matches</a></div>
    <div class="detail-head">
      <div class="detail-title">
        <span class="type-label" data-type="${p.type}">${TYPE_LABEL[p.type]}</span>
        <h1>${esc(p.name)}</h1>
        ${p.aka ? `<div class="small muted">Also known as ${esc(p.aka)}</div>` : ''}
        <div class="detail-meta">${isFac ? `<span>${esc(p.address)}</span><span>${d.toFixed(1)} miles from ${fromLabel()}</span>` : `<span>Serves ${esc(p.serviceArea)}</span>`}
          <a href="${telHref(p.phone)}">${esc(p.phone)}</a></div>
        <div class="contact-row">${website}<a class="btn small secondary" href="${mapsUrl(p)}" target="_blank" rel="noopener">Photos and map</a></div>
      </div>
      <div class="actions">
        <button class="btn" data-action="tour" data-id="${p.id}">${isFac ? 'Request a tour' : 'Request a free consult'}</button>
        <button class="btn secondary" data-action="save-toggle" data-id="${p.id}" aria-pressed="${saved}">${saved ? '♥ Saved' : '♡ Save'}</button>
        <button class="btn secondary" data-action="compare-toggle-btn" data-id="${p.id}" aria-pressed="${cmp}">${cmp ? '✓ In compare' : 'Add to compare'}</button>
      </div>
    </div>
    <div class="detail-grid">
      ${roomCard(p)}${payCard}
      ${priceCard(p)}
      ${why}
      ${ratingCard}${safetyCard}
      ${dementiaCard}${bioCard}
      ${extraCards}
      ${reviewCard}
    </div>
    <p class="small muted" style="margin-top:1.5rem">Phone numbers and details can change, so please call to confirm. <button class="linkbtn" data-action="sources">How we get this information</button></p>
    ${compareBar()}`;
  bindInspectionCard(app);
  bindCalc(p);
}
