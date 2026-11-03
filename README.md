# Find-A-Home

A prototype that helps families find **dementia care** (memory care, nursing homes and in-home care) near **Lincoln and Omaha, Nebraska**.
Built by IP Group 14 (Landen Heine, Ammi Meyer, Kellan Nash) from our customer-discovery interviews and our top napkin sketch, "Find-A-Home".

A family answers about 2 minutes of questions (stage, wandering, payment, budget, distance). The app then ranks real facilities on what our interviews said matters most: **Is it safe? Can we pay? Can they handle dementia? Is it close? Is there room?**

## Run it locally

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm start          # http://localhost:3000
```

`npm run dev` restarts the server automatically when you edit server files. Front-end changes only need a browser refresh.

> Opening `index.html` directly (file://) won't work. The page loads its data from the server's `/api`.

## Deploy on Render

This repo includes a [Render Blueprint](render.yaml).

1. Sign in at [render.com](https://render.com) with GitHub.
2. Click **New + → Blueprint**, pick this repository, then **Apply**.
3. Render runs `npm ci && npm run validate`, starts `npm start`, and checks `/healthz`.

Every push to `main` redeploys automatically. On the free plan the app sleeps after 15 idle minutes, so the first visit after that takes about 30–50 seconds. Open the link a minute before a testing session.

## How the code is organized

```
index.html              page shell
css/style.css           all styles (large text, calm colors)
js/                     front end (plain ES modules, no build step)
  main.js               entry point: loads data, registers screens, starts the router
  router.js             hash routes: #/welcome, #/results, #/place/<id>, #/compare, #/list, #/next-steps
  actions.js            one click handler; buttons use data-action="..."
  assistant.js          "Care Guide" chat (scripted answers, no real AI)
  core/                 state (localStorage), data loading, matching/scoring, labels, helpers
  views/                one file per screen
  components/           dialogs and the nursing-home-only detail sections
server/
  index.js              Express app: serves the front end + /api
  routes/api.js         GET /api/facilities, /api/homecare, /api/places/:id, /api/reference
  lib/store.js          loads every JSON file in data/ into memory and builds list summaries
data/
  facilities/           one JSON file per facility: nh-<CMS number>.json (nursing homes), al-*.json (memory care)
  homecare/             one JSON file per home care agency
  curated/nursing-homes.json   hand-researched facts Medicare doesn't have (dementia units, websites, notes)
  reference/            ZIP code centers, state averages, plain-language citation titles
  import-config.json    which counties `npm run import` pulls
scripts/
  import-cms.js         pulls nursing homes from Medicare and writes data/facilities/nh-*.json
  validate-data.js      checks every data file for required fields
```

Each place is one object in one file. The server reads them all at startup, so adding a place never requires a code change.

## Adding more places

### Nursing homes (automatic, from Medicare)

```bash
npm run import -- --county Hall            # pull Hall County once
npm run import -- --county Hall --save     # ...and keep it in data/import-config.json
npm run import                             # refresh everything with the latest Medicare data
```

The import downloads ratings, every inspection citation, penalties, owners, staffing and dementia-related quality measures. It then lists any homes that have no curated facts yet.

### Facts Medicare doesn't have

Edit `data/curated/nursing-homes.json`, keyed by the CMS certification number (the digits in `nh-<number>.json`):

```json
"285019": {
  "aka": "Another name families might know",
  "memoryUnit": "enoa-2025",
  "behavioral": true,
  "vaContract": "aging-partners-2024",
  "website": { "url": "https://example.org", "label": "Official website" },
  "note": "Shown at the end of the About section."
}
```

`memoryUnit` and `vaContract` point to a source listed under `_sources` at the top of the file. Re-run `npm run import` afterwards.

### Memory care, assisted living or home care (by hand)

Copy an existing file in `data/facilities/al-*.json` or `data/homecare/hc-*.json`, give it a new `id` that matches the file name, and fill it in. Then run:

```bash
npm run validate
```

## Data sources

| What | Source |
|---|---|
| 52 nursing homes (Lincoln + Omaha metro): ratings, inspections, penalties, ownership, staffing, quality | Medicare / CMS Care Compare Provider Data |
| Dementia units, behavioral care, VA contracts | Lincoln Aging Partners nursing facility list (Mar 2024), Eastern Nebraska Office on Aging (Sep 2025) |
| 17 Lincoln memory care / assisted living communities | Lincoln Aging Partners licensed assisted living list (2020), with prices and ratings from Caring.com / Seniorly |
| 10 home care agencies | Lincoln Aging Partners home care list (Jul 2026) and agency websites |
| Nursing home cost estimate | CareScout Cost of Care Survey 2024 (Nebraska averages) |
| Distances | US Census ZIP code centers |

**Estimated:** nursing home prices (state average) and open beds (certified beds minus average residents).
**Simulated:** insurance card upload, doctor connection, sending tour requests and facility replies, reviews (saved in the browser only) and the Care Guide chat.
"Ask" in the app means the information isn't public. Facilities would fill it in when they claim their listing.

This is a student prototype. It is not medical advice and doesn't take payment from facilities.

## Suggested user-testing tasks

1. "Your dad has middle-stage dementia and wanders. You live in 68516 and will use savings, then Medicaid. Find two places worth touring."
2. "Compare those two places. Which would you pick, and why?"
3. "Request a tour. The facility says it's full. What do you do next?"
4. "Find out whether Medicare will pay for memory care."
5. "Send your list to your sister."
