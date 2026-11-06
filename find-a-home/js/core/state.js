/**
 * App state (the user's answers, filters, saved places, tours…), kept in localStorage.
 * `S` is a single shared object. Modules read and change it, then call save().
 */
const STORE = 'fah-state-v1';

export const defaultIntake = () => ({
  name: '', lovedOne: '', zip: '', insuranceFile: '', doctor: '',
  stage: '', behaviors: [], livingPref: '', payment: [], budget: 6000, maxMiles: 20, timing: ''
});
export const defaultFilters = () => ({
  types: ['memory', 'assisted_memory', 'nursing'], price: 'any', includeUnpriced: true, miles: null,
  noMedicaidNo: false, hideLow: false, hideWatch: false, openOnly: false, memoryUnitOnly: false, noSerious: false,
  areas: ['Lincoln area', 'Omaha area'], q: '',
  hcTypes: ['non-medical', 'medical'], dementiaOnly: false, vaOnly: false
});
const defaults = () => ({
  intake: defaultIntake(), intakeDone: false, step: 1, mode: 'facility', filters: defaultFilters(),
  sort: 'match', saved: [], compare: [], tours: [], guide: {}, reviews: {}, appRating: null, chosen: null
});

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s) return Object.assign(defaults(), s, {
      intake: Object.assign(defaultIntake(), s.intake),
      filters: Object.assign(defaultFilters(), s.filters)
    });
  } catch (e) { /* corrupted or unavailable storage: start fresh */ }
  return defaults();
}

export const S = load();

export function save() {
  try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* private mode etc. */ }
  updateCounts();
}

/** Clear everything (the "Start over" button). */
export function resetState() {
  localStorage.removeItem(STORE);
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, defaults());
  updateCounts();
}

export function updateCounts() {
  const c = document.getElementById('compareCount'), s = document.getElementById('savedCount');
  if (c) c.textContent = S.compare.length;
  if (s) s.textContent = S.saved.length;
}
