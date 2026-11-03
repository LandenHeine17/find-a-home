/**
 * Find-A-Home web server.
 *   - serves the front end (index.html, css/, js/)
 *   - serves facility data as JSON under /api
 * Render runs this with `npm start`. Locally: `npm install`, then `npm start`, then open http://localhost:3000
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './lib/store.js';
import { apiRouter } from './routes/api.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 3000;

const store = await createStore(path.join(ROOT, 'data'));
const app = express();
app.disable('x-powered-by');

app.get('/healthz', (req, res) => res.json({ ok: true, ...store.counts }));
app.use('/api', apiRouter(store));

// Only the front-end folders are public (not server/, scripts/ or node_modules/).
const assets = { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 };
app.use('/css', express.static(path.join(ROOT, 'css'), assets));
app.use('/js', express.static(path.join(ROOT, 'js'), assets));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.use((req, res) => res.status(404).sendFile(path.join(ROOT, 'index.html')));

app.listen(PORT, () => {
  console.log(`Find-A-Home running at http://localhost:${PORT}`);
  console.log(`  ${store.counts.nursingHomes} nursing homes, ${store.counts.facilities - store.counts.nursingHomes} memory care / assisted living, ${store.counts.homecare} home care agencies`);
});
