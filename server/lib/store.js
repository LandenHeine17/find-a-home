/**
 * Data store: loads every facility / home care JSON file from data/ into memory.
 *
 * Each place is one JSON file, so adding a nursing home means adding a file
 * (or running `npm run import`). Nothing else needs to change.
 *
 * The list endpoints send a lightweight "summary" of each place; the detail
 * endpoint sends the full object (every inspection citation, owners, penalties).
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const HEAVY_FIELDS = ['inspections', 'penalties', 'owners'];
const RECENT_DAYS = 456; // ~15 months: "recent" serious citations

export function summarizeInspections(inspections = [], now = Date.now()) {
  const cutoff = new Date(now - RECENT_DAYS * 864e5).toISOString().slice(0, 10);
  const recent = inspections.filter(i => i.date >= cutoff);
  return {
    total: inspections.length,
    serious: inspections.filter(i => i.level >= 3).length,
    complaint: inspections.filter(i => i.complaint).length,
    dementia: inspections.filter(i => i.dementia).length,
    recentHarm: recent.some(i => i.level === 3),
    recentJeopardy: recent.some(i => i.level === 4)
  };
}

function toSummary(place) {
  const summary = { ...place };
  for (const f of HEAVY_FIELDS) delete summary[f];
  if (place.owners) summary.owners = { changed12m: place.owners.changed12m, type: place.owners.type };
  return summary;
}

async function readDir(dir) {
  const files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort();
  return Promise.all(files.map(async f => {
    try {
      return JSON.parse(await readFile(path.join(dir, f), 'utf8'));
    } catch (e) {
      throw new Error(`Could not read ${path.join(dir, f)}: ${e.message}`);
    }
  }));
}

export async function createStore(dataDir) {
  const [facilities, homecare, zips, averages] = await Promise.all([
    readDir(path.join(dataDir, 'facilities')),
    readDir(path.join(dataDir, 'homecare')),
    readFile(path.join(dataDir, 'reference', 'zips.json'), 'utf8').then(JSON.parse),
    readFile(path.join(dataDir, 'reference', 'averages.json'), 'utf8').then(JSON.parse)
  ]);
  for (const f of facilities) if (f.inspections) f.inspectionSummary = summarizeInspections(f.inspections);

  const byId = new Map([...facilities, ...homecare].map(p => [p.id, p]));
  const facilitySummaries = facilities.map(toSummary);
  const homecareSummaries = homecare.map(toSummary);
  const { _about, ...avg } = averages;

  return {
    counts: { facilities: facilities.length, nursingHomes: facilities.filter(f => f.type === 'nursing').length, homecare: homecare.length },
    listFacilities: () => facilitySummaries,
    listHomecare: () => homecareSummaries,
    get: id => byId.get(id) || null,
    reference: () => ({ zips, averages: avg, dataDate: averages.processingDate })
  };
}
