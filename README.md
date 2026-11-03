# Find-A-Home: Low-Fidelity Prototype

Clickable browser prototype of our top napkin sketch ("Find-A-Home"), built from `Solution Concept.txt`.

## How to run
There are **two versions to compare with your group**. They share saved data, and each has a link at the top to switch to the other.

| File | What's different |
|---|---|
| `index.html`, **Version A** | Clicking a place in the results opens it in **Google Maps in a new tab**. A **Details** button opens our detail page. |
| `index-map.html`, **Version B** | Results have a **List / Map** toggle. The map shows numbered pins (1 = best match) and your home 🏠. Click a pin for "Open in Google Maps" or "Details". Clicking a list card opens the detail page. |

Double-click either file, or open it in any browser (Chrome, Edge, Firefox or Safari).
No install is needed. Internet is only needed for the Version B map tiles and outside links such as Google Maps and Medicare pages.
Progress is saved in the browser. Use **Start over** in the yellow banner to reset between testers.

## Screens (sketch → prototype)
| Sketch | Prototype |
|---|---|
| 1 Welcome (name, insurance card, connect to doctors, Find Homes) | `#/welcome`, step 1 of a 3-step intake. Steps 2–3 add the dementia-needs, payment, budget and distance questions from the Solution Concept. |
| 2 Selected: HOME CARE + faceted search | `#/results` with the **Home care** toggle |
| 3 Selected: FACILITY + price / location / availability filters | `#/results` with the **Facilities** toggle |
| 4 Facility page (rating, insurance taken, base price, bio, contact) | `#/place/<id>`, plus "Is it safe?", "Dementia care" and "Is there room?" sections |
| 5 Home care page (rating, specialties, base price, bio, contact) | `#/place/hc-<id>` |
| *(new)* Compare side by side | `#/compare` |
| *(new)* Request a tour, waitlist, next best match | Tour button → **My list** (`#/list`) |
| *(new)* What to do next guide | `#/next-steps` |
| *(new)* AI assistant from our sketch writeup | "Ask Care Guide" button (scripted answers, no real AI) |

## What's real vs. simulated
**Real (public data, Nov 2026)**
- **52 nursing homes in the Lincoln + Omaha metro** (Lancaster, Seward, Saunders, Douglas, Sarpy, Cass and Washington counties) from Medicare / CMS Care Compare. For each one:
  - star ratings and watch-list status
  - **every inspection citation** from the last 3 inspections (1,228 total), with plain-language titles, severity and a dementia-related flag
  - **dementia-related quality measures**: antipsychotic use, falls with injury, pressure sores and more, compared with Nebraska averages
  - **ownership**: owner companies, managers and recent ownership changes
  - **penalties**: fines and payment denials
  - staffing and turnover
- **Dementia / memory units, behavioral care and VA contracts** from official county lists: Lincoln Aging Partners (Mar 2024) and the Eastern Nebraska Office on Aging (Sep 2025).
- **Websites** were checked one by one (33 of 52). The rest show a "Find their website" search link. For photos, the app links to each place's Google Maps listing rather than copying images.
- 17 Lincoln assisted living / memory care communities from the City of Lincoln Aging Partners licensed list (Apr 2020). Starting prices and review ratings come from Caring.com and Seniorly.
- 10 home care agencies from the Aging Partners home care list (Jul 2026).
- Distances from US Census ZIP code centers. Lincoln and Omaha ZIP codes both work.
- Map tiles come from © OpenStreetMap contributors (Version B needs internet for the map).

**Estimated**
- Nursing home prices use the Nebraska average (CareScout 2024).
- Home care rates use typical Lincoln agency rates.
- Nursing home open beds are calculated as certified beds minus average residents.

**Simulated**
- Insurance card upload, the doctor connection, sending tour requests, and facility replies. On **My list**, testers click "Confirmed" or "No openings" to see both outcomes.
- Reviews are stored only in the browser.
- The Care Guide chat uses keyword-matched scripted answers.

"Ask" means the information isn't public. Facilities would fill it in when they claim their listing.

## Suggested user-testing tasks
0. Before or after testing: show testers **both versions** and ask which way of seeing locations they prefer.
1. "Your dad has middle-stage dementia and wanders. You live in 68516 and will use savings, then Medicaid. Find two places worth touring."
2. "Compare those two places. Which one would you pick, and why?"
3. "Request a tour. The facility says it's full. What do you do next?"
4. "Find out whether Medicare will pay for memory care." (Try both the guide and the Care Guide chat.)
5. "Send your list to your sister."

Watch where testers hesitate, which wording confuses them, and whether they trust the ratings.

## Files
- `index.html` / `index-map.html`: Version A / Version B page shells
- `vendor/leaflet/`: map library (stored locally)
- `css/style.css`: styles (large text, calm colors)
- `js/data.js`: facility and agency data, generated from the sources above
- `js/app.js`: screens, matching and filters
- `js/assistant.js`: scripted Care Guide
