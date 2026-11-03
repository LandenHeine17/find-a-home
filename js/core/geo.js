/** Distances from the user's ZIP code, and Google Maps links. */
import { S } from './state.js';
import { data } from './data.js';

const LINCOLN = [40.8136, -96.7026];

/** [lat, lon] of the user's ZIP code center, or downtown Lincoln. */
export function home() { return data.zips[S.intake.zip] || LINCOLN; }
export const zipKnown = () => !!data.zips[S.intake.zip];

/** Straight-line miles from the user to a place. */
export function dist(p) {
  if (p.lat == null) return 0;
  const [la1, lo1] = home(), R = 3958.8, r = Math.PI / 180;
  const dLa = (p.lat - la1) * r, dLo = (p.lon - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(p.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const mapsUrl = p => 'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent(p.kind === 'facility' ? `${p.name}, ${p.address}` : `${p.name} ${p.city || 'Lincoln'} NE`);

/** Open a place in Google Maps in a new tab and switch to it. */
export function openMaps(p) {
  const w = window.open(mapsUrl(p), '_blank', 'noopener');
  if (w) w.focus();
}
