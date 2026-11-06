/* Matching: profile -> 0-100 score per home, with plain-language reasons.
   Adapted from the Find-A-Home prototype's scoring. */
function match(p) {
  const P = S.person, C = S.care, pay = C.payment, beh = P.behaviors, med = P.medical;
  const good = [], warn = [];
  let s = 55;
  const needsMedical = med.length > 0 || P.stage === 'late' || P.mobility === 'bed';
  const wanders = beh.includes('wander') || beh.includes('aggression');
  const medicaidOnly = pay.includes('medicaid') && !pay.includes('private') && !pay.includes('ltc');

  const d = dist(p), max = C.maxMiles || 20;
  if (d <= max) { s += 12 * (1 - d / max); good.push(`${d.toFixed(1)} mi away`); }
  else { s -= 15; warn.push(`${d.toFixed(1)} mi away (past your ${max} mi limit)`); }

  if (p.memoryCare === 'dedicated') { s += wanders ? 16 : 10; good.push('Dementia care is all they do'); }
  else if (p.memoryCare === 'unit') { s += wanders ? 12 : 7; good.push('Has a secured memory care unit'); }
  else if (wanders) { s -= 8; warn.push('No known secured memory unit (ask)'); }

  if (needsMedical) {
    if (p.type === 'nursing') { s += 14; good.push('24-hour nursing for medical needs'); }
    else { s -= 10; warn.push('May not handle heavy medical needs'); }
  } else if (p.type === 'nursing' && (P.stage === 'early' || P.stage === 'middle')) {
    s -= P.stage === 'early' ? 10 : 5; warn.push('More medical care than needed right now');
  } else if (P.stage === 'early' && p.type !== 'nursing') { s += 5; good.push('Good fit for early stage'); }

  if (P.mobility === 'wheelchair' && p.type === 'nursing') s += 3;

  if (pay.includes('medicaid')) {
    if (p.payment.medicaid === 'yes') { s += 10; good.push('Accepts Medicaid'); }
    else if (p.payment.medicaid === 'no') { s -= medicaidOnly ? 30 : 8; warn.push('Does not take Medicaid'); }
    else { s -= medicaidOnly ? 6 : 2; warn.push('Medicaid: call and ask'); }
  }
  if (pay.includes('va') && p.payment.va === 'yes') { s += 6; good.push('Works with VA benefits'); }

  if (C.budget && !medicaidOnly) {
    if (p.priceLow <= C.budget) { s += 6; good.push(`Within $${fmt(C.budget)}/mo budget`); }
    else { s -= p.priceLow > C.budget * 1.3 ? 10 : 5; warn.push(`About $${fmt(p.priceLow)}/mo: over budget`); }
  }

  if (p.cms) {
    const c = p.cms;
    if (c.overall) {
      s += (c.overall - 3) * 5;
      if (c.overall >= 4) good.push(`${c.overall}★ Medicare rating`);
      if (c.overall <= 2) warn.push(`Low Medicare rating (${c.overall}★)`);
    }
    if (c.sff) { s -= 25; warn.push("On Medicare's watch list"); }
    else if (c.sffCandidate) { s -= 12; warn.push("Candidate for Medicare's watch list"); }
    if (p.recentJeopardy) { s -= 12; warn.push('Recent citation: residents in serious danger'); }
    else if (p.recentHarm) { s -= 6; warn.push('Recent citation: a resident was harmed'); }
    const ap = p.quality.find(q => q.code === '481');
    if (ap && ap.value != null && ap.value > ap.ne * 1.3) { s -= 5; warn.push(`High antipsychotic use (${ap.value}%)`); }
    if (beh.includes('falls')) {
      const fl = p.quality.find(q => q.code === '410');
      if (fl && fl.value != null && fl.value > fl.ne * 1.3) { s -= 4; warn.push(`More falls with injury (${fl.value}%)`); }
    }
    if (p.behavioral && beh.includes('aggression')) { s += 6; good.push('Accepts residents with behavior needs'); }
    if (c.abuse) { s -= 15; warn.push('Cited for abuse'); }
  } else if (p.rating && p.rating.value && p.rating.count >= 3) {
    s += (p.rating.value - 4) * 6;
    if (p.rating.value >= 4.5) good.push(`${p.rating.value}★ family reviews`);
  }

  if (p.openings && p.openings.est != null) {
    if (p.openings.est >= 3) { s += C.timeline === 'now' ? 6 : 3; good.push(`~${p.openings.est} beds may be open`); }
    else { s -= C.timeline === 'now' ? 8 : 3; warn.push('May be nearly full'); }
  }
  return { score: Math.max(5, Math.min(98, Math.round(s))), good, warn, d };
}

function ranked(list = DATA.facilities) {
  return list.map(p => ({ p, m: match(p) })).sort((a, b) => b.m.score - a.m.score);
}

/* Color scale for match %. Red -> orange -> yellow -> green.
   Colour is never the only cue: every pin also shows its number. */
const SCALE = [
  [0, '#e5383b'], [45, '#f3722c'], [60, '#f9c74f'], [72, '#90be6d'], [85, '#2fb344']
];
function scoreColor(score) {
  for (let i = SCALE.length - 1; i >= 0; i--) if (score >= SCALE[i][0]) return SCALE[i][1];
  return SCALE[0][1];
}
function scoreWord(score) {
  return score >= 85 ? 'Great match' : score >= 72 ? 'Good match' : score >= 60 ? 'Okay match' : score >= 45 ? 'Weak match' : 'Poor match';
}
