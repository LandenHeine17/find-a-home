/* Matching: the loved one's profile -> a 0-100 score for each home, plus plain-language reasons.
   Built around the five questions families asked in our interviews:
   Is it safe? Can we pay? Can they handle dementia? Is it close? Is there room? */
function match(h) {
  const P = S.person, C = S.care, pay = C.payment, beh = P.behaviors, med = P.medical.filter(m => m !== 'none');
  const good = [], warn = [];
  let s = 55;
  const needsMedical = med.length > 0 || P.stage === 'late' || P.mobility === 'bed';
  const needsSecure = beh.includes('wander') || beh.includes('exit');
  const medicaidOnly = pay.includes('medicaid') && !pay.includes('private') && !pay.includes('ltc');

  /* ---- Is it close? ---- */
  const d = dist(h), max = C.maxMiles || 25;
  let close;
  if (d <= max * 0.5) { s += 12 * (1 - d / max); close = 'yes'; good.push(`Only ${d.toFixed(1)} mi from family`); }
  else if (d <= max) { s += 12 * (1 - d / max); close = 'yes'; }
  else { s -= 15; close = 'no'; warn.push(`${d.toFixed(0)} mi away, past your ${max} mi limit`); }

  /* ---- Can they handle dementia? ---- */
  let dementia;
  if (h.memoryCare === 'dedicated') { s += needsSecure ? 16 : 10; dementia = 'yes'; good.push('Dementia care is all they do'); }
  else if (h.memoryCare === 'unit') { s += needsSecure ? 12 : 7; dementia = 'yes'; good.push('Secured memory care unit'); }
  else { dementia = 'maybe'; if (needsSecure) { s -= 8; warn.push('No known locked memory unit (ask)'); } }

  if (needsMedical) {
    if (h.type === 'nursing') { s += 14; good.push('24-hour nurses for medical needs'); }
    else { s -= 10; warn.push('May not handle heavy medical needs'); if (dementia === 'yes' && P.stage === 'late') dementia = 'maybe'; }
  } else if (h.type === 'nursing' && (P.stage === 'early' || P.stage === 'middle')) {
    s -= P.stage === 'early' ? 10 : 5; warn.push('More medical care than needed right now');
  } else if (P.stage === 'early' && h.type !== 'nursing') { s += 5; good.push('Good fit for early stage'); }
  if (P.mobility === 'wheelchair' && h.type === 'nursing') s += 3;
  if (h.behavioral && beh.includes('aggression')) { s += 6; good.push('Accepts residents with behavior needs'); }

  /* ---- Can we pay? ---- */
  let payOk = 'maybe';
  const hits = pay.filter(k => h.payment[k] === 'yes' || (k === 'medicare' && h.payment.medicare === 'short'));
  if (pay.includes('medicaid')) {
    if (h.payment.medicaid === 'yes') { s += 10; good.push('Accepts Medicaid'); }
    else if (h.payment.medicaid === 'no') { s -= medicaidOnly ? 30 : 8; warn.push('Does not take Medicaid'); }
    else { s -= medicaidOnly ? 6 : 2; warn.push('Medicaid: call and ask'); }
  }
  if (pay.includes('va') && h.payment.va === 'yes') { s += 6; good.push('Works with VA benefits'); }
  let overBudget = false;
  if (C.budget && !medicaidOnly && h.priceLow) {
    if (h.priceLow <= C.budget) { s += 6; good.push(`Fits your $${fmt(C.budget)}/mo budget`); }
    else { overBudget = true; s -= h.priceLow > C.budget * 1.3 ? 10 : 5; warn.push(`About $${fmt(h.priceLow)}/mo, over budget`); }
  }
  if (medicaidOnly) payOk = h.payment.medicaid === 'yes' ? 'yes' : h.payment.medicaid === 'no' ? 'no' : 'maybe';
  else if (pay.includes('medicaid') && h.payment.medicaid === 'yes') payOk = 'yes';
  else if (pay.length && hits.length && !overBudget) payOk = 'yes';
  else if (pay.length && pay.every(k => h.payment[k] === 'no')) payOk = 'no';
  else if (overBudget && h.priceLow > C.budget * 1.3) payOk = 'no';

  /* ---- Is it safe? ---- */
  let safe = 'maybe';
  if (h.cms) {
    const c = h.cms;
    if (c.overall) {
      s += (c.overall - 3) * 5;
      if (c.overall >= 4) good.push(`${c.overall}★ Medicare rating`);
      if (c.overall <= 2) warn.push(`Low Medicare rating (${c.overall}★)`);
      safe = c.overall >= 4 ? 'yes' : c.overall <= 2 ? 'no' : 'maybe';
    }
    if (c.sff) { s -= 25; safe = 'no'; warn.push("On Medicare's watch list"); }
    else if (c.sffCandidate) { s -= 12; safe = 'no'; warn.push("Candidate for Medicare's watch list"); }
    if (h.recentJeopardy) { s -= 12; safe = 'no'; warn.push('Recent citation: residents in serious danger'); }
    else if (h.recentHarm) { s -= 6; if (safe === 'yes') safe = 'maybe'; warn.push('Recent citation: a resident was harmed'); }
    const ap = h.quality.find(q => q.code === '481');
    if (ap && ap.value != null && ap.value > ap.ne * 1.3) { s -= 5; warn.push(`High antipsychotic use (${ap.value}%)`); }
    if (beh.includes('falls')) {
      const fl = h.quality.find(q => q.code === '410');
      if (fl && fl.value != null && fl.value > fl.ne * 1.3) { s -= 4; warn.push(`More falls with injury (${fl.value}%)`); }
    }
    if (c.abuse) { s -= 15; safe = 'no'; warn.push('Cited for abuse'); }
  } else if (h.rating && h.rating.value && h.rating.count >= 3) {
    s += (h.rating.value - 4) * 6;
    if (h.rating.value >= 4.5) { good.push(`${h.rating.value}★ from ${h.rating.count} family reviews`); safe = 'yes'; }
  }

  /* ---- Is there room? ---- */
  let room = 'maybe';
  if (h.openings && h.openings.est != null) {
    if (h.openings.est >= 3) { s += C.timeline === 'now' ? 6 : 3; room = 'yes'; good.push(`~${h.openings.est} beds may be open`); }
    else { s -= C.timeline === 'now' ? 8 : 3; room = 'no'; warn.push('May be nearly full'); }
  }

  const score = Math.max(5, Math.min(98, Math.round(s)));
  const five = [
    { k: 'safe', q: 'Is it safe?', v: safe },
    { k: 'pay', q: 'Can we pay?', v: payOk },
    { k: 'dementia', q: 'Dementia care?', v: dementia },
    { k: 'close', q: 'Is it close?', v: close },
    { k: 'room', q: 'Is there room?', v: room }
  ];
  return { score, good, warn, d, five };
}

/* Cache scores per render pass so big lists stay fast. */
let _mc = new Map();
function m(h) { if (!_mc.has(h.id)) _mc.set(h.id, match(h)); return _mc.get(h.id); }
function clearMatchCache() { _mc = new Map(); }

/* The deck: homes the family hasn't swiped on yet, filtered by discovery settings, best fit first. */
function deck() {
  const seen = new Set([...S.matches.map(x => x.id), ...S.saved, ...S.passed]);
  const st = S.settings, pay = S.care.payment;
  return DATA.homes
    .filter(h => !seen.has(h.id))
    .filter(h => st.types.includes(h.type))
    .filter(h => m(h).d <= (S.care.maxMiles || 25))
    .filter(h => !st.hidePayNo || !pay.length || !pay.every(k => h.payment[k] === 'no'))
    .filter(h => !st.hideWatchList || !(h.cms && (h.cms.sff || h.cms.sffCandidate)))
    .sort((a, b) => m(b).score - m(a).score);
}
/* How many homes are hidden only by distance (used for the "widen your search" prompt). */
function hiddenByDistance() {
  const seen = new Set([...S.matches.map(x => x.id), ...S.saved, ...S.passed]);
  return DATA.homes.filter(h => !seen.has(h.id) && S.settings.types.includes(h.type) && m(h).d > (S.care.maxMiles || 25)).length;
}

function scoreWord(score) {
  return score >= 85 ? 'Great fit' : score >= 72 ? 'Good fit' : score >= 60 ? 'Okay fit' : score >= 45 ? 'Weak fit' : 'Poor fit';
}
function scoreClass(score) {
  return score >= 72 ? 'hi' : score >= 55 ? 'mid' : 'lo';
}
const FIVE_ICON = { yes: '✓', maybe: '?', no: '✕' };

/* Turn the loved one's interests into specific things to ask on a tour.
   (Homes don't publish activity calendars, so we never claim a home offers them.) */
const LIKE_QS = {
  music: 'Is there live music or music therapy? Many people with dementia respond to familiar songs.',
  faith: 'Are there worship services or visits from clergy on site?',
  garden: 'Is there a secured garden or courtyard residents can use on their own?',
  pets: 'Do you have a resident pet or pet-therapy visits? Can family bring a pet to visit?',
  outdoors: 'How often do residents get outside? Is the outdoor area secured?',
  games: 'Are there daily small-group games like cards, bingo or puzzles?',
  crafts: 'Do you run hands-on activities like crafts, folding laundry or sorting?',
  sports: 'Can residents watch games together in a common room?',
  cooking: 'Can residents help with simple baking or kitchen activities?',
  dance: 'Do you have movement, chair exercise or dance activities?',
  reading: 'Is there a quiet reading area, large-print books or reading aloud?',
  family: 'What are visiting hours? Can family join meals or stay late?',
  quiet: 'Is there a calm, low-noise space for when things get overwhelming?',
  social: 'How do staff help new residents make friends?',
  farm: 'Do you have activities around farm life, animals or plants?',
  cars: 'Are there outings or activities for residents who loved cars or tinkering?'
};
