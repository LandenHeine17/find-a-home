/**
 * Loads place data from the server API (see server/routes/api.js).
 *   data.facilities / data.homecare : summaries of every place (for lists and matching)
 *   getPlace(id)                    : full details for one place (inspections, owners…), cached
 */
const cache = new Map();

export const data = {
  facilities: [], homecare: [], zips: {}, averages: {}, dataDate: null,
  byId: new Map()
};

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

export async function loadData() {
  const [facilities, homecare, ref] = await Promise.all([getJson('/api/facilities'), getJson('/api/homecare'), getJson('/api/reference')]);
  Object.assign(data, { facilities, homecare, zips: ref.zips, averages: ref.averages, dataDate: ref.dataDate });
  data.byId = new Map([...facilities, ...homecare].map(p => [p.id, p]));
}

/** Summary of a place (always available after loadData). */
export const summary = id => data.byId.get(id) || null;

/** Full details of a place, fetched once and cached. */
export async function getPlace(id) {
  if (!cache.has(id)) cache.set(id, getJson(`/api/places/${encodeURIComponent(id)}`).catch(e => { cache.delete(id); throw e; }));
  return cache.get(id);
}
