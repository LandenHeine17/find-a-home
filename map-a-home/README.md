# Map-A-Home

Prototype for our second napkin sketch (IP Group 14). Families see every dementia-care home around Lincoln and Omaha on a map. Each home is colored by how well it matches their loved one. An AI Care Guide fills in the profile by chatting with them.

## Open it

Run `npm start` from the repo root and open http://localhost:3000/map-a-home/, or just double-click `index.html`. You don't need to install anything or run a server for this one. You do need an internet connection for the map tiles, the fonts and Leaflet.
Everything you enter is saved in the browser (localStorage). Press **Start over** on the Home tab to clear it.

## The three tabs (bottom bar, game-style; swipe or tap)

| Tab | What it does |
|---|---|
| 🤖 **Care Guide** (left) | A chat that asks about Grandma or Grandpa: stage, wandering, mobility, medical needs, payment, budget, ZIP, timeline and hobbies. It **fills in the profile** as you answer. It also answers questions like "Tell me about Sumner Place", "How does Medicaid work?", "What do I ask on a tour?" and "Top matches". You can mention new facts at any time ("she's started falling") and it updates the profile. |
| 🏡 **Home** (middle) | A profile card with % complete, quests, the top 3 matches, saved ❤️ homes, scheduled tours and the full profile. Edit the profile with ✏️. |
| 🗺️ **Map** (right) | Every home is a pin showing its match %, colored from red to green. Tap a pin to open a card with ❤️ Heart, ℹ️ full info (Medicare stars, inspections, payment), 📞 Call, 📅 Schedule tour and directions. Filters run along the top. |

## Notes

- **The "AI" is scripted.** It uses keyword rules in `js/chat.js` and no real model, so it works offline and costs nothing. To use a real LLM later, change `Chat.reply()`; that is the only place you need to change.
- **Match colors:** red and green are hard to tell apart for color-blind users, so every pin also shows its number.
- **Data:** the 69 real facilities come from the Find-A-Home prototype (`../find-a-home/data`). The sources are Medicare Care Compare, Nebraska licensure lists and Caring.com. After you change that data, run `npm run build:map` from the repo root (or `node scripts/build-data.js` here) to rebuild `js/data.js`.
- Tour requests are not actually sent anywhere.

## Files

```
index.html          page shell + tab bar
css/style.css       all styling
js/data.js          generated facility + ZIP data
js/state.js         saved state, labels, helpers
js/match.js         profile -> match score + reasons, color scale
js/home.js          Home tab + edit profile
js/map.js           Map tab, pop-up card, info, tour booking (Leaflet)
js/chat.js          Care Guide chat
js/app.js           tab switching, swipe, click handling
scripts/build-data.js
```
