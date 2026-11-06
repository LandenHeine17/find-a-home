/**
 * Matching: turns the user's intake answers into a 0–100 "fit" score for each
 * place, plus plain-language reasons ("good" and "warn"). Also filtering + sorting.
 * Works on place summaries (see server/lib/store.js), so it needs no extra requests.
 */
import { S } from './state.js';
import { fmt } from './util.js';
import { knownPrice } from './labels.js';
import { dist } from './geo.js';
import { data } from './data.js';

export function match(p) {
  const I = S.intake, pay = I.payment || [], beh = I.behaviors || [];
  const good = [], warn = [];
  let s = 55;
  const needsMedical = beh.includes('medical') || I.stage === 'late';
  const wanders = beh.includes('wander') || beh.includes('aggression');
  const medicaidOnly = pay.includes('medicaid') && !pay.includes('private') && !pay.includes('ltc');

  if (p.kind === 'facility') {
    const d = dist(p), max = I.maxMiles || 20;
    if (d <= max) { s += 12 * (1 - d / max); good.push(`${d.toFixed(1)} mi away`); }
    else { s -= 15; warn.push(`${d.toFixed(1)} mi away (past your ${max} mi limit)`); }

    if (p.memoryCare === 'dedicated') { s += wanders ? 16 : 10; good.push('Dementia care is all they do'); }
    else if (p.memoryCare === 'unit') { s += wanders ? 12 : 7; good.push(p.type === 'nursing' ? 'Has a dementia / memory unit' : `Memory care area${p.memoryUnits ? ` (${p.memoryUnits} units)` : ''}`); }
    else if (wanders) { s -= 6; warn.push('Ask about a secured memory unit'); }

    if (needsMedical) {
      if (p.type === 'nursing') { s += 14; good.push('24-hour nursing care'); }
      else { s -= 10; warn.push('May not cover heavy medical needs'); }
    } else if (p.type === 'nursing' && (I.stage === 'early' || I.stage === 'middle')) {
      s -= I.stage === 'early' ? 10 : 6; warn.push('More medical care than needed yet');
    } else if (I.stage === 'early') { s += 4; }

    if (pay.includes('medicaid')) {
      if (p.payment.medicaid === 'yes') { s += 10; good.push('Accepts Medicaid'); }
      else if (p.payment.medicaid === 'no') { s -= medicaidOnly ? 30 : 8; warn.push('Does not take Medicaid'); }
      else { s -= medicaidOnly ? 6 : 2; warn.push('Medicaid waiver: ask'); }
    }
    if (I.budget) {
      if (!p.priceEstimated) {
        if (p.priceLow <= I.budget) { s += 6; good.push('Starts within budget'); }
        else { s -= 8; warn.push(`Starts above $${fmt(I.budget)}/mo budget`); }
      } else if (p.type === 'nursing' && !pay.includes('medicaid') && p.priceLow > I.budget) {
        s -= 4; warn.push('Typical cost is over budget');
      }
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
      const recent = recentSerious(p);
      if (recent.jeopardy) { s -= 12; warn.push('Recent citation: residents in serious danger'); }
      else if (recent.harm) { s -= 6; warn.push('Recent citation: a resident was harmed'); }
      const ap = (p.quality || []).find(q => q.code === '481');
      if (ap && ap.value != null && ap.value > ap.ne * 1.3) { s -= ap.value > ap.ne * 2 ? 10 : 4; warn.push(`High antipsychotic use (${ap.value}%)`); }
      const fl = (p.quality || []).find(q => q.code === '410');
      if (fl && fl.value != null && fl.value > fl.ne * 1.5) { s -= 3; warn.push(`More falls with injury (${fl.value}%)`); }
      if (p.behavioral && beh.includes('aggression')) { s += 6; good.push('Accommodates behavioral needs'); }
      if (c.abuse) { s -= 15; warn.push('Cited for abuse'); }
      if (c.fines > 0) { s -= 3; warn.push(`${c.fines} federal fine${c.fines > 1 ? 's' : ''}`); }
    } else if (p.rating.value && p.rating.count >= 3) {
      s += (p.rating.value - 4) * 6;
      if (p.rating.value >= 4.5) good.push(`${p.rating.value}★ family reviews`);
    }
    if (p.openings.est != null) {
      if (p.openings.est >= 3) { s += 3; good.push(`~${p.openings.est} beds may be open`); }
      else { s -= 3; warn.push('May be nearly full'); }
    }
    if (I.livingPref === 'home') s -= 5;
  } else {
    if (p.dementia) { s += 12; good.push('Advertises dementia care'); }
    else if (p.type !== 'medical') warn.push('Ask about dementia training');
    if (p.type === 'medical') {
      if (needsMedical) { s += 12; good.push('Nurses for medical needs'); }
      else { s -= 10; warn.push('For doctor-ordered medical care'); }
      if (pay.includes('medicare')) { s += 6; good.push('Medicare may cover'); }
    } else {
      if (needsMedical) { s -= 4; warn.push('Non-medical: no nursing tasks'); }
      if (I.stage === 'late') s -= 4;
      if (I.budget && p.priceLow) {
        const lo = p.priceLow * 4 * 30;
        if (lo > I.budget) warn.push(`4 hrs/day ≈ $${fmt(lo)}+/mo`);
        else good.push(`4 hrs/day ≈ $${fmt(lo)}–$${fmt(p.priceHigh * 120)}/mo`);
      }
    }
    if (pay.includes('va') && p.payment.va === 'yes') { s += 8; good.push('Works with VA benefits'); }
    if (medicaidOnly) warn.push('Medicaid waiver: ask');
    if (I.livingPref === 'home') s += 10;
  }
  return { score: Math.max(5, Math.min(98, Math.round(s))), good, warn };
}

// Serious citations = a resident was harmed (level 3) or in immediate jeopardy (level 4).
// The server pre-computes these in `inspectionSummary`.
export function recentSerious(p) {
  const i = p.inspectionSummary || {};
  return { harm: !!i.recentHarm, jeopardy: !!i.recentJeopardy };
}
export const seriousCount = p => (p.inspectionSummary ? p.inspectionSummary.serious : 0);

export function filtered(mode) {
  const F = S.filters;
  const miles = F.miles === 'any' ? Infinity : (F.miles || S.intake.maxMiles || 20);
  let list;
  if (mode === 'facility') {
    list = data.facilities.filter(p => {
      if (!F.types.includes(p.type)) return false;
      if (p.area && !F.areas.includes(p.area)) return false;
      if (F.q && !(p.name + ' ' + (p.aka || '') + ' ' + p.address).toLowerCase().includes(F.q.toLowerCase())) return false;
      if (dist(p) > miles) return false;
      const kp = knownPrice(p);
      if (kp == null) { if (!F.includeUnpriced) return false; }
      else if (F.price === 'u5' && kp >= 5000) return false;
      else if (F.price === '5to8' && (kp < 5000 || kp > 8000)) return false;
      else if (F.price === 'o8' && kp <= 8000) return false;
      if (F.noMedicaidNo && p.payment.medicaid === 'no') return false;
      if (F.hideWatch && p.cms && (p.cms.sff || p.cms.abuse)) return false;
      if (F.hideLow && p.cms && (p.cms.overall == null || p.cms.overall <= 2)) return false;
      if (F.openOnly && !(p.openings.est >= 1)) return false;
      if (F.memoryUnitOnly && p.memoryCare === 'ask') return false;
      if (F.noSerious && p.cms && seriousCount(p) > 0) return false;
      return true;
    });
  } else {
    list = data.homecare.filter(p => {
      if (!F.hcTypes.includes(p.type)) return false;
      if (F.dementiaOnly && !p.dementia) return false;
      if (F.vaOnly && p.payment.va !== 'yes') return false;
      return true;
    });
  }
  const scored = list.map(p => ({ p, m: match(p), d: dist(p) }));
  const sorters = {
    match: (a, b) => b.m.score - a.m.score,
    distance: (a, b) => a.d - b.d,
    rating: (a, b) => (b.p.rating?.value ?? -1) - (a.p.rating?.value ?? -1),
    price: (a, b) => (knownPrice(a.p) ?? a.p.priceLow ?? 1e9) - (knownPrice(b.p) ?? b.p.priceLow ?? 1e9)
  };
  return scored.sort(sorters[S.sort] || sorters.match);
}

