import { Router } from 'express';

/** JSON API used by the front end (js/core/api.js). */
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
  r.use((req, res) => res.status(404).json({ error: 'Unknown API route' }));
  return r;
}
