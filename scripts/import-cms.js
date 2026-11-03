#!/usr/bin/env node
/**
 * Import nursing homes from Medicare (CMS Care Compare provider data).
 *
 *   npm run import                          # counties listed in data/import-config.json
 *   npm run import -- --county Hall         # also pull Hall County this run
 *   npm run import -- --county Hall --save  # ...and add it to the config permanently
 *   npm run import -- --prune               # delete nh-*.json files no longer in the selection
 *
 * Each nursing home is written to data/facilities/nh-<CCN>.json.
 * Hand-researched facts (dementia units, websites, notes) come from
 * data/curated/nursing-homes.json and are merged in. Edit that file, not the output.
 */
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const API = 'https://data.cms.gov/provider-data/api/1/datastore/query';
const DS = {
  provider: '4pq5-n9py', deficiencies: 'r5ix-sfxw', penalties: 'g6vv-u9sr',
  ownership: 'y2hd-n93e', quality: 'djen-97ju', averages: 'xcdc-v8bm'
};
// Dementia-relevant long-stay quality measures and their column in the "State US Averages" dataset
const QUALITY_MEASURES = [
  ['481', 'Antipsychotic drugs (long-stay)', 'percentage_of_long_stay_residents_who_received_an_antipsych_9fac'],
  ['410', 'Falls with major injury', 'percentage_of_long_stay_residents_experiencing_one_or_more__1b06'],
  ['479', 'Pressure ulcers (bed sores)', 'percentage_of_long_stay_residents_with_pressure_ulcers'],
  ['401', 'Needing more help with daily activities', 'percentage_of_long_stay_residents_whose_need_for_help_with__628c'],
  ['404', 'Lost too much weight', 'percentage_of_long_stay_residents_who_lose_too_much_weight'],
  ['408', 'Depressive symptoms', 'percentage_of_long_stay_residents_who_have_depressive_symptoms'],
  ['452', 'Anti-anxiety or sleep drugs', 'percentage_of_long_stay_residents_who_received_an_antianxie_aa41']
];
const SEVERITY_LEVEL = { A: 1, B: 1, C: 1, D: 2, E: 2, F: 2, G: 3, H: 3, I: 3, J: 4, K: 4, L: 4 };
const SCOPE = { A: 'one resident', D: 'one resident', G: 'one resident', J: 'one resident', B: 'several residents', E: 'several residents', H: 'several residents', K: 'several residents', C: 'many residents', F: 'many residents', I: 'many residents', L: 'many residents' };

/* ----------------------------------------------------------------- helpers */
const readJson = async f => JSON.parse(await readFile(f, 'utf8'));
const writeJson = (f, obj) => writeFile(f, JSON.stringify(obj, null, 2) + '\n');
const num = v => (v === '' || v == null || isNaN(+v) ? null : +v);
const int = v => (num(v) == null ? null : Math.round(+v));
const round = (v, d = 1) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const phone = p => { const d = String(p).replace(/\D/g, ''); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p; };
const titleCase = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  .replace(/\b(Of|And|At|The|For)\b/g, w => w.toLowerCase()).replace(/^\w/, c => c.toUpperCase())
  .replace(/\bLlc\b/g, 'LLC').replace(/\bInc\b/g, 'Inc').trim();
const cleanName = s => s.replace(/,?\s*(LLC|llc|Inc\.?)$/i, '').replace(/,\s*$/, '').replace(/Rehabilitati$/, 'Rehabilitation').trim();
const miles = (a, b) => Math.hypot((a.lat - b.lat) * 69, (a.lon - b.lon) * 52.4);

function args() {
  const a = process.argv.slice(2), out = { counties: [], save: false, prune: false };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--county') out.counties.push(a[++i]);
    else if (a[i] === '--save') out.save = true;
    else if (a[i] === '--prune') out.prune = true;
    else if (a[i] === '--state') out.state = a[++i];
  }
  return out;
}

async function query(dataset, conditions = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const u = new URL(`${API}/${dataset}/0`);
    Object.entries(conditions).forEach(([k, v], i) => {
      u.searchParams.set(`conditions[${i}][property]`, k);
      u.searchParams.set(`conditions[${i}][value]`, v);
      u.searchParams.set(`conditions[${i}][operator]`, '=');
    });
    u.searchParams.set('limit', '500');
    u.searchParams.set('offset', String(offset));
    const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (find-a-home data import; +https://github.com/LandenHeine17/find-a-home)' } });
    if (!res.ok) throw new Error(`CMS ${dataset} returned ${res.status}`);
    const page = (await res.json()).results || [];
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
const groupByCcn = rows => rows.reduce((m, r) => ((m[r.cms_certification_number_ccn] ||= []).push(r), m), {});

/* -------------------------------------------------------------- transform */
function buildFacility(x, { defs, pens, owns, mds, avg, cur, curSources, titles, dementiaTags, config }) {
  const ccn = x.cms_certification_number_ccn;
  const c = cur[ccn] || {};
  const beds = int(x.number_of_certified_beds) || 0;
  const avgResidents = num(x.average_number_of_residents_per_day) ?? beds;
  const city = titleCase(x.citytown);
  const lat = num(x.latitude), lon = num(x.longitude);
  const area = config.areas.reduce((best, a) => (!best || miles({ lat, lon }, a) < miles({ lat, lon }, best) ? a : best), null).name;
  const ownership = x.ownership_type.includes('Non profit') ? 'Non-profit' : x.ownership_type.includes('Government') ? 'Government' : 'For-profit';
  const chain = x.chain_name ? titleCase(x.chain_name) : '';
  const medicaid = x.provider_type.includes('Medicaid') ? 'yes' : 'no';
  const sff = x.special_focus_status;

  let bio = `${ownership} nursing home in ${city} with ${beds} certified beds${chain ? `, part of ${chain}` : ''}. Provides 24-hour skilled nursing care, long-term care, and short-term rehab.`;
  if (x.continuing_care_retirement_community === 'Y') bio += ' Part of a continuing care retirement community, so residents can move between levels of care on one campus.';
  if (c.note) bio += ' ' + c.note;

  const inspections = (defs[ccn] || []).map(d => ({
    date: d.survey_date, cycle: int(d.inspection_cycle), tag: d.deficiency_tag_number,
    title: titles[d.deficiency_tag_number] || d.deficiency_description.replace(/\.$/, ''),
    detail: d.deficiency_description, category: d.deficiency_category.replace(' Deficiencies', ''),
    sev: d.scope_severity_code, level: SEVERITY_LEVEL[d.scope_severity_code] || 1, scope: SCOPE[d.scope_severity_code] || '',
    complaint: d.complaint_deficiency === 'Y', corrected: d.deficiency_corrected.startsWith('Deficient, Provider has date'),
    dementia: dementiaTags.has(d.deficiency_tag_number)
  })).sort((a, b) => b.date.localeCompare(a.date) || b.level - a.level);

  const penalties = (pens[ccn] || []).map(p => ({
    date: p.penalty_date, type: p.penalty_type, amount: num(p.fine_amount), days: int(p.payment_denial_length_in_days)
  })).sort((a, b) => b.date.localeCompare(a.date));

  const o = owns[ccn] || [];
  const orgs = (pred) => [...new Map(o.filter(r => r.owner_type === 'Organization' && pred(r.role_played_by_owner_or_manager_in_facility)).map(r => [r.owner_name, r])).values()];
  const owners = {
    type: x.ownership_type, legalName: titleCase(x.legal_business_name),
    changed12m: x.provider_changed_ownership_in_last_12_months === 'Y',
    direct: orgs(role => role.includes('DIRECT OWNERSHIP') && !role.includes('INDIRECT')).slice(0, 4)
      .map(r => ({ name: titleCase(r.owner_name), pct: r.ownership_percentage.includes('%') ? r.ownership_percentage : '', since: r.association_date.replace('since ', '') })),
    indirect: orgs(role => role.includes('INDIRECT')).map(r => titleCase(r.owner_name)).sort().slice(0, 6),
    indirectCount: orgs(role => role.includes('INDIRECT')).length,
    operators: orgs(role => role === 'OPERATIONAL/MANAGERIAL CONTROL' || role === 'MANAGING CONTROL - GOVERNING BODY').slice(0, 4).map(r => titleCase(r.owner_name))
  };

  const m = Object.fromEntries((mds[ccn] || []).map(q => [q.measure_code, q]));
  const quality = QUALITY_MEASURES.map(([code, label, col]) => ({
    code, label, value: round(num(m[code]?.four_quarter_average_score)), ne: round(num(avg.NE?.[col])), us: round(num(avg.NATION?.[col])), lowerBetter: true
  }));

  const src = k => curSources[k] || k;
  return {
    id: `nh-${ccn}`, kind: 'facility', type: 'nursing',
    name: cleanName(x.provider_name), aka: c.aka || null,
    city, county: x.countyparish, area,
    address: `${x.provider_address}, ${city}, ${x.state} ${x.zip_code}`, zip: x.zip_code, phone: phone(x.telephone_number),
    lat, lon,
    website: c.website?.url || null, websiteLabel: c.website?.label || null,
    careCompare: `https://www.medicare.gov/care-compare/details/nursing-home/${ccn}`,
    priceLow: config.priceEstimate.low, priceHigh: config.priceEstimate.high, priceEstimated: true, priceNote: config.priceEstimate.note,
    rating: { value: int(x.overall_rating), source: 'Medicare (CMS) overall star rating', count: null },
    cms: {
      ccn, overall: int(x.overall_rating), inspection: int(x.health_inspection_rating), staffing: int(x.staffing_rating), quality: int(x.qm_rating),
      nurseHours: round(num(x.reported_total_nurse_staffing_hours_per_resident_per_day)),
      rnHours: round(num(x.reported_rn_staffing_hours_per_resident_per_day), 2),
      weekendHours: round(num(x.total_number_of_nurse_staff_hours_per_resident_per_day_on_t_4a14)),
      turnover: num(x.total_nursing_staff_turnover), rnTurnover: num(x.registered_nurse_turnover),
      adminLeft: int(x.number_of_administrators_who_have_left_the_nursing_home),
      deficiencies: int(x.rating_cycle_1_total_number_of_health_deficiencies) || 0,
      complaintDeficiencies: int(x.rating_cycle_1_number_of_complaint_health_deficiencies),
      inspectionDate: x.rating_cycle_1_standard_survey_health_date,
      fines: int(x.number_of_fines) || 0, fineDollars: num(x.total_amount_of_fines_in_dollars) || 0, paymentDenials: int(x.number_of_payment_denials) || 0,
      abuse: x.abuse_icon === 'Y', sff: sff === 'SFF', sffCandidate: sff === 'SFF Candidate', ownership,
      familyCouncil: ['Both', 'Family'].includes(x.with_a_resident_and_family_council)
    },
    inspections, penalties, owners, quality,
    memoryCare: c.memoryUnit ? 'unit' : 'ask', memorySource: c.memoryUnit ? src(c.memoryUnit) : null,
    behavioral: !!c.behavioral, memoryUnits: null, beds,
    openings: { est: Math.max(0, Math.round(beds - avgResidents)), note: 'Estimate: certified beds minus average daily residents (CMS). Certified beds are often more than the beds actually staffed. Call to confirm.' },
    payment: { private: 'yes', medicaid, medicare: x.provider_type.includes('Medicare') ? 'short' : 'no', va: c.vaContract ? 'yes' : 'ask', ltc: 'ask' },
    vaSource: c.vaContract ? src(c.vaContract) : null,
    bio,
    sources: [
      `Medicare / CMS Provider Data: provider info, health inspections, penalties, ownership, quality measures (processed ${x.processing_date})`,
      'Dementia units & VA contracts: ' + Object.values(curSources).join('; '),
      `Price: ${config.priceEstimate.source}`
    ]
  };
}

/* ------------------------------------------------------------------- main */
async function main() {
  const opt = args();
  const configFile = path.join(DATA, 'import-config.json');
  const config = await readJson(configFile);
  const state = opt.state || config.state;
  const counties = [...new Set([...config.counties, ...opt.counties])];
  const curated = await readJson(path.join(DATA, 'curated', 'nursing-homes.json'));
  const titleRef = await readJson(path.join(DATA, 'reference', 'citation-titles.json'));
  const { _sources: curSources = {}, ...cur } = curated;

  console.log(`Fetching ${state} nursing homes from Medicare for: ${counties.join(', ')}`);
  const providers = (await query(DS.provider, { state })).filter(p => counties.some(c => c.toLowerCase() === p.countyparish.toLowerCase()));
  if (!providers.length) throw new Error('No nursing homes matched. Check the county spelling (e.g. "Douglas", "Scott Bluff").');
  const keep = new Set(providers.map(p => p.cms_certification_number_ccn));
  const only = rows => rows.filter(r => keep.has(r.cms_certification_number_ccn));
  console.log(`  ${providers.length} nursing homes. Downloading inspections, penalties, ownership and quality data…`);
  const [defs, pens, owns, mds, avgRows] = await Promise.all([
    query(DS.deficiencies, { state }).then(only), query(DS.penalties, { state }).then(only),
    query(DS.ownership, { state }).then(only), query(DS.quality, { state }).then(only), query(DS.averages)
  ]);
  const avg = Object.fromEntries(avgRows.map(r => [r.state_or_nation, r]));
  const ctx = {
    defs: groupByCcn(defs.filter(d => d.survey_type === 'Health')), pens: groupByCcn(pens), owns: groupByCcn(owns), mds: groupByCcn(mds),
    avg, cur, curSources, titles: titleRef.titles, dementiaTags: new Set(titleRef.dementiaRelated), config
  };

  const dir = path.join(DATA, 'facilities');
  for (const p of providers) await writeJson(path.join(dir, `nh-${p.cms_certification_number_ccn}.json`), buildFacility(p, ctx));

  const ne = avg[state] || {}, us = avg.NATION || {};
  await writeJson(path.join(DATA, 'reference', 'averages.json'), {
    _about: `${state} and national nursing home averages from Medicare (State US Averages dataset).`,
    neDeficiencies: num(ne.cycle_1_total_number_of_health_deficiencies), usDeficiencies: num(us.cycle_1_total_number_of_health_deficiencies),
    neNurseHours: round(num(ne.reported_total_nurse_staffing_hours_per_resident_per_day)), usNurseHours: round(num(us.reported_total_nurse_staffing_hours_per_resident_per_day)),
    neTurnover: num(ne.total_nursing_staff_turnover), usTurnover: num(us.total_nursing_staff_turnover),
    processingDate: ne.processing_date || null
  });

  if (opt.prune) {
    for (const f of await readdir(dir)) {
      const ccn = f.match(/^nh-(.+)\.json$/)?.[1];
      if (ccn && !keep.has(ccn)) { await unlink(path.join(dir, f)); console.log(`  removed ${f}`); }
    }
  }
  if (opt.save && opt.counties.length) { config.counties = counties; await writeJson(configFile, config); console.log('  saved counties to data/import-config.json'); }

  const missing = providers.filter(p => !cur[p.cms_certification_number_ccn]).map(p => `${p.cms_certification_number_ccn} ${p.provider_name}`);
  console.log(`Done. Wrote ${providers.length} files to data/facilities/.`);
  if (missing.length) console.log(`  ${missing.length} have no curated facts yet (dementia unit, website). Add them to data/curated/nursing-homes.json:\n    ` + missing.slice(0, 15).join('\n    ') + (missing.length > 15 ? '\n    …' : ''));
}

main().catch(e => { console.error('Import failed:', e.message); process.exit(1); });
