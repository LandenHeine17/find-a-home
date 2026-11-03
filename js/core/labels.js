/** Display labels and wording that depend on the place or the user's answers. */
import { S } from './state.js';
import { esc, fmt } from './util.js';

export const TYPE_LABEL = {
  nursing: 'Nursing home', memory: 'Memory care community', assisted_memory: 'Assisted living + memory care',
  'non-medical': 'In-home care (non-medical)', medical: 'Home health (medical)'
};
export const PAY_LABEL = { private: 'Private pay / savings', medicaid: 'Medicaid', medicare: 'Medicare', va: 'VA benefits', ltc: 'Long-term care insurance' };

/** "your loved one" or the name the user gave (HTML-escaped). */
export const lovedOne = () => esc(S.intake.lovedOne.trim() || 'your loved one');
export const LovedOne = () => { const l = S.intake.lovedOne.trim(); return l ? esc(l) : 'Your loved one'; };

export function priceText(p, long) {
  if (p.kind === 'homecare') {
    if (p.type === 'medical') return 'Billed per visit';
    return `Est. $${p.priceLow}–$${p.priceHigh}/hr`;
  }
  if (p.type === 'nursing') return `Est. $${fmt(p.priceLow)}–$${fmt(p.priceHigh)}/mo`;
  if (p.priceEstimated) return long ? `Not published (Lincoln avg. ≈ $${fmt(p.priceLow)}/mo)` : 'Price not published';
  return `From $${fmt(p.priceLow)}/mo`;
}

/** Monthly price we can filter/sort on, or null when the place doesn't publish one. */
export function knownPrice(p) {
  if (p.kind !== 'facility') return null;
  if (p.type === 'nursing') return p.priceLow;
  return p.priceEstimated ? null : p.priceLow;
}

/** Reviews families leave in this prototype (stored in the browser only). */
export const reviewsFor = id => S.reviews[id] || [];
export const avgReview = id => { const r = reviewsFor(id); return r.length ? r.reduce((a, b) => a + b.stars, 0) / r.length : null; };
