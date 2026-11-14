/**
 * Where the family is, distances from there, and Google Maps links.
 * The starting point is, in order: the address the user entered (or their device location),
 * the center of their ZIP code, or downtown Lincoln.
 */
import { S } from './state.js';
import { data } from './data.js';

const LINCOLN = [40.8136, -96.7026];

/** [lat, lon] the distances are measured from. */
export function home() {
  const L = S.intake.loc;
  if (L && L.lat != null) return [L.lat, L.lon];
  return data.zips[S.intake.zip] || LINCOLN;
}
/** True when we know where the family is (address, device location or a known ZIP). */
export const zipKnown = () => !!(S.intake.loc && S.intake.loc.lat != null) || !!data.zips[S.intake.zip];

/** Short words for the starting point: "your address", "ZIP 68516" or "downtown Lincoln". */
export function fromLabel() {
  const L = S.intake.loc;
  if (L && L.lat != null) return L.source === 'device' ? 'your location' : 'your address';
  if (data.zips[S.intake.zip]) return 'ZIP ' + S.intake.zip;
  return 'downtown Lincoln';
}

/** Straight-line miles between two [lat, lon] points. */
export function milesBetween([la1, lo1], [la2, lo2]) {
  const R = 3958.8, r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Straight-line miles from the family to a place. */
export function dist(p) {
  if (p.lat == null) return 0;
  return milesBetween(home(), [p.lat, p.lon]);
}

/** Look up a typed address with the US Census geocoder (through our server). */
export async function geocodeAddress(address) {
  const res = await fetch('/api/geocode?address=' + encodeURIComponent(address));
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'We could not look up that address.');
  return body;
}

export const mapsUrl = p => 'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent(p.kind === 'facility' ? `${p.name}, ${p.address}` : `${p.name} ${p.city || 'Lincoln'} NE`);
