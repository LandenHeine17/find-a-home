/**
 * IP Group 14 prototypes: one web server for all three designs.
 *   /                 home page (index.html) that links to each prototype
 *   /find-a-home/     Find-A-Home (list + filters); loads its data from /api
 *   /map-a-home/      Map-A-Home (map + Care Guide chat); static, data built into js/data.js
 *   /tind-a-home/     Tind-A-Home (swipe cards); static, data built into js/data.js
 *   /api/...          facility data for Find-A-Home (read from find-a-home/data)
 * Render runs this with `npm start`. Locally: `npm install`, then `npm start`, then open http://localhost:3000
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './lib/store.js';
import { apiRouter } from './routes/api.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 3000;
const PROTOTYPES = ['find-a-home', 'map-a-home', 'tind-a-home'];

const store = await createStore(path.join(ROOT, 'find-a-home', 'data'));
const app = express();
app.disable('x-powered-by');
app.set('strict routing', true); // so /find-a-home and /find-a-home/ are different routes

app.get('/healthz', (req, res) => res.json({ ok: true, ...store.counts }));
app.use('/api', apiRouter(store));

// Only each prototype's front-end files are public (not data/, scripts/, server/ or node_modules/).
const assets = { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 };
for (const name of PROTOTYPES) {
  const dir = path.join(ROOT, name);
  const page = (req, res) => res.sendFile(path.join(dir, 'index.html'));
  // Relative links (css/style.css) need the trailing slash, so /find-a-home -> /find-a-home/
  app.get(`/${name}`, (req, res) => res.redirect(301, `/${name}/`));
  app.get([`/${name}/`, `/${name}/index.html`], page);
  app.use(`/${name}/css`, express.static(path.join(dir, 'css'), assets));
  app.use(`/${name}/js`, express.static(path.join(dir, 'js'), assets));
}

app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.use((req, res) => res.status(404).sendFile(path.join(ROOT, 'index.html')));

app.listen(PORT, () => {
  console.log(`IP Group 14 prototypes running at http://localhost:${PORT}`);
  for (const name of PROTOTYPES) console.log(`  http://localhost:${PORT}/${name}/`);
  console.log(`  ${store.counts.nursingHomes} nursing homes, ${store.counts.facilities - store.counts.nursingHomes} memory care / assisted living, ${store.counts.homecare} home care agencies`);
});
