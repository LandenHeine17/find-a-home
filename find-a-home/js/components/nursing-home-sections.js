/**
 * Detail sections that only nursing homes have (Medicare data):
 * staffing, ownership & penalties, every inspection citation, and quality measures.
 */
import { esc, fmt, fmtDate } from '../core/util.js';
import { data } from '../core/data.js';

export const SEV = { 1: ['sev1', 'Low risk'], 2: ['sev2', 'Could cause harm'], 3: ['sev3', 'Resident harmed'], 4: ['sev4', 'Serious danger'] };
export function staffingCard(p, vs) {
  const c = p.cms, A = data.averages;
  return `<div class="card"><h2>👩‍⚕️ Staffing</h2>
    <dl class="kv">
      <dt>Nurse time</dt><dd>${c.nurseHours != null ? vs(c.nurseHours, A.neNurseHours, false, ' hrs') : 'Not reported'}<br><span class="small muted">per resident, per day</span></dd>
      <dt>Registered nurse time</dt><dd>${c.rnHours != null ? Math.round(c.rnHours * 60) + ' min per resident, per day' : 'Not reported'}</dd>
      <dt>Weekend nurse time</dt><dd>${c.weekendHours != null ? c.weekendHours + ' hrs per resident' : 'Not reported'}</dd>
      <dt>Staff turnover</dt><dd>${c.turnover != null ? vs(c.turnover, A.neTurnover, true, '%') : 'Not reported'}<br><span class="small muted">of nursing staff leave each year</span></dd>
      <dt>Administrators who left</dt><dd>${c.adminLeft != null ? c.adminLeft + ' in the last year' : 'Not reported'}</dd>
      <dt>Family council</dt><dd>${c.familyCouncil ? 'Yes' : 'Not reported'}</dd>
    </dl>
    <p class="small muted" style="margin-top:.5rem">Low turnover often means residents see the same caregivers, which matters a lot with dementia.</p></div>`;
}
export function ownerCard(p) {
  const o = p.owners, c = p.cms;
  const direct = o.direct.length ? o.direct.map(d => `<li><b>${esc(d.name)}</b>${d.pct ? ` (${esc(d.pct)})` : ''} <span class="small muted">since ${esc(d.since)}</span></li>`).join('') : `<li><b>${esc(o.legalName)}</b> <span class="small muted">(no separate owner listed)</span></li>`;
  const pens = p.penalties.length ? `<table class="mini"><thead><tr><th>Date</th><th>Penalty</th></tr></thead><tbody>${p.penalties.map(x => `<tr><td>${fmtDate(x.date)}</td><td>${x.type === 'Fine' ? `Fine: <b>$${fmt(x.amount || 0)}</b>` : `Medicare payments stopped${x.days ? ` for ${x.days} days` : ''}`}</td></tr>`).join('')}</tbody></table>`
    : '<div class="alert good" style="margin:0">No federal fines or payment denials in the last 3 years.</div>';
  return `<div class="card"><h2>🏢 Ownership & penalties</h2>
    ${o.changed12m ? '<div class="alert warn"><b>Changed owners in the last 12 months.</b> Ask what has changed for staff and residents.</div>' : ''}
    <dl class="kv">
      <dt>Type</dt><dd>${esc(o.type)}</dd>
      <dt>Legal name</dt><dd>${esc(o.legalName)}</dd>
    </dl>
    <p style="margin:.6rem 0 .2rem"><b class="small">Owned by</b></p><ul style="margin:0;padding-left:1.2rem" class="small">${direct}</ul>
    ${o.indirectCount ? `<p class="small muted" style="margin:.3rem 0 0">Plus ${o.indirectCount} parent compan${o.indirectCount > 1 ? 'ies or trusts' : 'y or trust'}${o.indirect.length ? ` (e.g. ${o.indirect.slice(0, 3).map(esc).join(', ')})` : ''}.</p>` : ''}
    ${o.operators.length ? `<p style="margin:.6rem 0 .2rem"><b class="small">Managed by</b></p><p class="small" style="margin:0">${o.operators.map(esc).join(', ')}</p>` : ''}
    <p style="margin:.8rem 0 .3rem"><b class="small">Penalties (last 3 years)</b></p>${pens}
  </div>`;
}
export function inspectionCard(p) {
  const ins = p.inspections;
  if (!ins.length) return `<div class="card full" id="inspections"><h2>🔎 Inspection details</h2><div class="alert good">No problems cited in the last three inspections.</div></div>`;
  const dates = [...new Set(ins.map(i => i.date))];
  const serious = ins.filter(i => i.level >= 3).length, comp = ins.filter(i => i.complaint).length, dem = ins.filter(i => i.dementia).length;
  const rows = ins.map((i, n) => {
    const [cls, lbl] = SEV[i.level];
    return `<li class="ins ${n >= 10 ? 'more' : ''}" data-level="${i.level}" data-dementia="${i.dementia}" data-complaint="${i.complaint}">
      <span class="sev ${cls}" title="Severity code ${i.sev}">${lbl}</span>
      <div><b>${esc(i.title)}</b>
        <div class="small muted">${fmtDate(i.date)} · ${esc(i.category)} · affected ${esc(i.scope)}${i.complaint ? ' · <span class="tag warn">From a complaint</span>' : ''}${i.dementia ? ' <span class="tag info">Dementia-related</span>' : ''}${i.corrected ? ' · ✓ corrected' : ''}</div>
        <details><summary class="small">What the rule says</summary><p class="small" style="margin:.25rem 0 0">${esc(i.detail)} <span class="muted">(F${esc(i.tag)})</span></p></details>
      </div></li>`;
  }).join('');
  return `<div class="card full" id="inspections"><h2>🔎 Inspection details</h2>
    <p class="muted small" style="margin-top:-.25rem">Every problem state inspectors cited in the last ${dates.length > 1 ? 'three' : ''} inspection${dates.length > 1 ? 's' : ''} (${fmtDate(ins[ins.length - 1].date)} – ${fmtDate(ins[0].date)}), including complaint visits. The Nebraska average is about ${data.averages.neDeficiencies} problems per inspection.</p>
    <div class="stat-row">
      <div class="stat"><b>${ins.length}</b><span>problems cited</span></div>
      <div class="stat ${serious ? 'bad' : 'good'}"><b>${serious}</b><span>resident harmed or in danger</span></div>
      <div class="stat"><b>${comp}</b><span>from complaints</span></div>
      <div class="stat"><b>${dem}</b><span>dementia-related</span></div>
    </div>
    <div class="chips-row" role="group" aria-label="Filter citations">
      <button class="chip active" data-insfilter="all">All</button>
      <button class="chip" data-insfilter="serious">Harm or danger (${serious})</button>
      <button class="chip" data-insfilter="dementia">Dementia-related (${dem})</button>
      <button class="chip" data-insfilter="complaint">From complaints (${comp})</button>
    </div>
    <ul class="ins-list collapsed" id="insList">${rows}</ul>
    ${ins.length > 10 ? `<button class="btn small secondary" id="insMore">Show all ${ins.length}</button>` : ''}
    <p class="small muted" style="margin-top:.75rem">"Dementia-related" covers falls and supervision, sedating drugs, dementia training and abuse or neglect.</p>
  </div>`;
}
export function qualityCard(p) {
  const rows = p.quality.map(q => {
    if (q.value == null) return `<div class="qm-row"><span>${esc(q.label)}</span><span class="muted small">Not enough residents to report</span></div>`;
    const max = Math.max(q.value, q.ne, q.us, 1) * 1.15;
    const better = q.value <= q.ne;
    return `<div class="qm-row"><span>${esc(q.label)}</span>
      <div class="qm-bar" aria-label="${q.value}% here, Nebraska average ${q.ne}%">
        <i class="${better ? 'ok' : 'hi'}" style="width:${q.value / max * 100}%"></i>
        <em style="left:${q.ne / max * 100}%" title="Nebraska average ${q.ne}%"></em>
      </div>
      <b class="${better ? 'good-txt' : 'warn-txt'}">${q.value}%</b></div>`;
  }).join('');
  return `<div class="card full"><h2>📊 Quality of care for long-stay residents</h2>
    <p class="muted small" style="margin-top:-.25rem">Share of long-term residents affected over the past year. <b>Lower is better.</b> The black line marks the Nebraska average. Antipsychotic drugs are often overused to sedate people with dementia.</p>
    <div class="qm">${rows}</div>
    <p class="small muted">Source: Medicare Minimum Data Set quality measures.</p></div>`;
}

/** Hook up the inspection filter chips and "Show all" button after the page renders. */
export function bindInspectionCard(root) {
  const list = root.querySelector('#insList');
  if (!list) return;
  const more = root.querySelector('#insMore');
  if (more) more.addEventListener('click', () => { list.classList.remove('collapsed'); more.remove(); });
  root.querySelectorAll('[data-insfilter]').forEach(b => b.addEventListener('click', () => {
    root.querySelectorAll('[data-insfilter]').forEach(x => x.classList.toggle('active', x === b));
    const f = b.dataset.insfilter;
    if (f !== 'all') { list.classList.remove('collapsed'); if (more) more.remove(); }
    list.querySelectorAll('.ins').forEach(li => {
      const show = f === 'all' || (f === 'serious' && +li.dataset.level >= 3) || (f === 'dementia' && li.dataset.dementia === 'true') || (f === 'complaint' && li.dataset.complaint === 'true');
      li.hidden = !show;
    });
  }));
  const jump = root.querySelector('a[href="#inspections"]');
  if (jump) jump.addEventListener('click', e => { e.preventDefault(); root.querySelector('#inspections').scrollIntoView({ behavior: 'smooth' }); });
}
