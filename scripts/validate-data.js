#!/usr/bin/env node
/**
 * Checks every file in data/facilities and data/homecare for required fields.
 * Run with `npm run validate` after adding or editing a place by hand.
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAY = ['yes', 'no', 'ask', 'short'];
const TYPES = { facility: ['nursing', 'memory', 'assisted_memory'], homecare: ['non-medical', 'medical'] };
const REQUIRED = {
  common: ['id', 'kind', 'type', 'name', 'phone', 'payment', 'bio', 'sources', 'priceNote'],
  facility: ['address', 'zip', 'lat', 'lon', 'city', 'area', 'rating', 'memoryCare', 'openings'],
  homecare: ['services', 'serviceArea', 'dementia']
};

const errors = [];
const seen = new Set();
const err = (file, msg) => errors.push(`${file}: ${msg}`);

for (const folder of ['facilities', 'homecare']) {
  const dir = path.join(ROOT, 'data', folder);
  for (const f of (await readdir(dir)).filter(f => f.endsWith('.json'))) {
    let p;
    try { p = JSON.parse(await readFile(path.join(dir, f), 'utf8')); } catch (e) { err(f, `invalid JSON (${e.message})`); continue; }
    for (const k of [...REQUIRED.common, ...(REQUIRED[p.kind] || [])]) if (p[k] === undefined || p[k] === '') err(f, `missing "${k}"`);
    if (`${p.id}.json` !== f) err(f, `id "${p.id}" should match the file name`);
    if (seen.has(p.id)) err(f, `duplicate id "${p.id}"`); seen.add(p.id);
    if (!TYPES[p.kind]) err(f, `kind must be "facility" or "homecare"`);
    else if (!TYPES[p.kind].includes(p.type)) err(f, `type "${p.type}" must be one of ${TYPES[p.kind].join(', ')}`);
    if (p.payment) for (const [k, v] of Object.entries(p.payment)) if (!PAY.includes(v)) err(f, `payment.${k} "${v}" must be one of ${PAY.join(', ')}`);
    if (p.kind === 'facility' && (Math.abs(p.lat - 41) > 3 || Math.abs(p.lon + 98) > 7)) err(f, 'lat/lon look outside Nebraska');
    if (p.kind === 'facility' && !['dedicated', 'unit', 'ask'].includes(p.memoryCare)) err(f, 'memoryCare must be dedicated, unit or ask');
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`✓ ${seen.size} places look good.`);
