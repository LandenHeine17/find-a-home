import { Router } from 'express';

const CENSUS = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const geoCache = new Map();

/**
 * Turns a street address into map coordinates with the free US Census geocoder.
 * The address is only forwarded to the Census Bureau and kept in this server's memory
 * cache; it is never written to disk or logged.
 */
async function geocode(address) {
  const key = address.toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key);
  const u = new URL(CENSUS);
  u.searchParams.set('address', address);
  u.searchParams.set('benchmark', 'Public_AR_Current');
  u.searchParams.set('format', 'json');
  const res = await fetch(u, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Census geocoder returned ${res.status}`);
  const m = (await res.json()).result?.addressMatches?.[0];
  const out = m ? { lat: m.coordinates.y, lon: m.coordinates.x, label: m.matchedAddress, zip: m.addressComponents?.zip || '', state: m.addressComponents?.state || '' } : null;
  if (geoCache.size > 500) geoCache.clear();
  geoCache.set(key, out);
  return out;
}

/** JSON API used by the front end (js/core/data.js). */
export function apiRouter(store) {
  const r = Router();
  r.get('/facilities', (req, res) => res.json(store.listFacilities()));
  r.get('/homecare', (req, res) => res.json(store.listHomecare()));
  r.get('/places/:id', (req, res) => {
    const place = store.get(req.params.id);
    if (!place) return res.status(404).json({ error: 'Not found' });
    res.json(place);
  });
  r.get('/reference', (req, res) => res.json(store.reference()));
  r.get('/geocode', async (req, res) => {
    const address = String(req.query.address || '').trim();
    if (address.length < 5 || address.length > 200) return res.status(400).json({ error: 'Enter a street address, town and state.' });
    try {
      const hit = await geocode(address);
      if (!hit) return res.status(404).json({ error: 'We could not find that address.' });
      res.set('Cache-Control', 'no-store').json(hit);
    } catch (e) {
      res.status(502).json({ error: 'The address lookup is not answering right now.' });
    }
  });
  r.use((req, res) => res.status(404).json({ error: 'Unknown API route' }));
  return r;
}
