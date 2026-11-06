# IP Group 14 Prototypes

Three prototypes that help families find **dementia care** near **Lincoln and Omaha, Nebraska**, built by IP Group 14 (Landen Heine, Ammi Meyer, Kellan Nash).
One server hosts all three, with a home page that links to each.

| URL | Prototype | Folder |
|---|---|---|
| `/` | Home page: pick a prototype | `index.html` |
| `/find-a-home/` | **Find-A-Home** (sketch #1): search with filters, details, compare | [`find-a-home/`](find-a-home/README.md) |
| `/map-a-home/` | **Map-A-Home** (sketch #2): map of match-colored pins + Care Guide chat | [`map-a-home/`](map-a-home/README.md) |
| `/tind-a-home/` | **Tind-A-Home** (sketch #3): swipe through homes like a dating app | [`tind-a-home/`](tind-a-home/README.md) |

## Run it locally

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm start          # http://localhost:3000
```

## Deploy on Render

[`render.yaml`](render.yaml) is a Render Blueprint for one web service that serves everything. Every push to `main` redeploys it.

## How it fits together

```
index.html          home page
server/             Express server: serves the home page, the three prototypes and /api
package.json        npm start, npm run validate, npm run import, npm run build:map, npm run build:tind
render.yaml         Render deploy settings
find-a-home/        loads its data from the server's /api
  data/             the shared facility data (one JSON file per place)
map-a-home/         static; its data is built into js/data.js
tind-a-home/        static; its data is built into js/data.js
```

All three use the same data in `find-a-home/data`. After changing it, run `npm run validate`, then `npm run build:map` and `npm run build:tind` so the other two pick up the changes.
Each prototype saves your answers in the browser under its own key, so they don't affect each other.
