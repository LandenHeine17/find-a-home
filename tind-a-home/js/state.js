/* Tind-A-Home: state (saved in this browser's localStorage), labels and small helpers. */
const KEY = 'tind-a-home-v1';
const DATA = window.TAH_DATA;
const LINCOLN = [40.8136, -96.7026];

const DEFAULT_STATE = () => ({
  onboarded: false,
  step: 0,
  you: { name: '', relation: '' },
  person: {
    name: '', avatar: '👵', age: '',
    stage: '',          // early | middle | late | unsure
    diagnosis: '',      // alz | vascular | lewy | ftd | mixed | unsure
    behaviors: [],      // wander | exit | aggression | sundowning | falls | none
    mobility: '',       // walks | walker | wheelchair | bed
    medical: [],        // diabetes | oxygen | feeding | wounds | meds | incontinence | none
    likes: [],
    about: ''
  },
  care: { payment: [], budget: 6500, zip: '', maxMiles: 25, timeline: '' },
  settings: { types: ['nursing', 'memory', 'assisted_memory'], hidePayNo: true, hideWatchList: false },
  matches: [],        // [{id, at, status, seen}]
  saved: [],          // [id]
  passed: [],         // [id]
  history: [],        // [{id, action}] for rewind
  tours: {},          // id -> {date, time, withLO, contact, sent}
  notes: {},          // id -> text
  checks: {},         // id -> [indexes of checked tour questions]
  guide: {},          // step index -> true
  compare: []
});

let S = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) {
      const d = DEFAULT_STATE();
      return {
        ...d, ...s,
        you: { ...d.you, ...s.you }, person: { ...d.person, ...s.person },
        care: { ...d.care, ...s.care }, settings: { ...d.settings, ...s.settings }
      };
    }
  } catch (e) { /* ignore broken storage */ }
  return DEFAULT_STATE();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
function resetAll() { S = DEFAULT_STATE(); save(); }

/* ---------- labels ---------- */
const LBL = {
  type: { nursing: 'Nursing home', memory: 'Memory care', assisted_memory: 'Assisted living + memory care' },
  typeShort: { nursing: 'Nursing home', memory: 'Memory care', assisted_memory: 'Assisted + memory' },
  typeIcon: { nursing: '🏥', memory: '🧠', assisted_memory: '🏡' },
  stage: { early: 'Early stage', middle: 'Middle stage', late: 'Late stage', unsure: 'Not sure yet' },
  stageHint: {
    early: 'Mostly independent. Forgets recent things, repeats questions, may get lost driving.',
    middle: 'Needs help with dressing, bathing or meals. May wander, get confused or agitated.',
    late: 'Needs help with almost everything. May not walk, speak much or recognize family.',
    unsure: "That's okay. We'll match on the needs you tell us about next."
  },
  diagnosis: { alz: "Alzheimer's", vascular: 'Vascular dementia', lewy: 'Lewy body dementia', ftd: 'Frontotemporal (FTD)', mixed: 'Mixed / other', unsure: 'Not diagnosed yet' },
  behaviors: {
    wander: 'Wanders or gets lost', exit: 'Tries to leave the house', aggression: 'Agitation or aggression',
    sundowning: 'Sundowning (worse in evening)', falls: 'Falls often', none: 'None of these'
  },
  behaviorIcon: { wander: '🚶', exit: '🚪', aggression: '😤', sundowning: '🌇', falls: '🤕', none: '🙂' },
  mobility: { walks: 'Walks on own', walker: 'Uses a walker or cane', wheelchair: 'Uses a wheelchair', bed: 'Mostly in bed' },
  mobilityIcon: { walks: '🚶', walker: '🦯', wheelchair: '🦽', bed: '🛏️' },
  medical: {
    diabetes: 'Diabetes / insulin', oxygen: 'Oxygen', feeding: 'Help eating / feeding tube',
    wounds: 'Wound care', meds: 'Many medications', incontinence: 'Incontinence care', none: 'None of these'
  },
  payment: { private: 'Private pay / savings', medicaid: 'Medicaid', medicare: 'Medicare (short-term)', va: 'VA benefits', ltc: 'Long-term care insurance' },
  paymentIcon: { private: '💵', medicaid: '🏛️', medicare: '🩺', va: '🎖️', ltc: '📄' },
  timeline: { now: 'Needs a bed now', soon: 'In 1–3 months', later: 'In 3+ months', exploring: 'Just exploring' },
  pay: { yes: 'Yes', no: 'No', ask: 'Call to ask', short: 'Short-term only' },
  status: { matched: 'Matched', requested: 'Tour requested', toured: 'Toured', top: 'Top choice ⭐' },
  likes: [
    ['music', '🎵 Music'], ['faith', '⛪ Faith & worship'], ['garden', '🌷 Gardening'], ['pets', '🐶 Pets & animals'],
    ['outdoors', '🌳 Being outdoors'], ['games', '🃏 Cards & games'], ['crafts', '🧶 Crafts'], ['sports', '⚾ Sports on TV'],
    ['cooking', '🍪 Cooking & baking'], ['dance', '💃 Dancing'], ['reading', '📚 Reading'], ['family', '👨‍👩‍👧 Family visits'],
    ['quiet', '🤫 Quiet spaces'], ['social', '🗣️ Chatting with people'], ['farm', '🚜 Farm life'], ['cars', '🚗 Cars']
  ]
};
const LIKE_LABEL = Object.fromEntries(LBL.likes);
const AVATARS = ['👵', '👴', '🧓', '👩‍🦳', '👨‍🦳', '👱‍♀️', '👱‍♂️', '🙂'];
const RELATIONS = ['Mom', 'Dad', 'Spouse', 'Grandparent', 'Sibling', 'Aunt / Uncle', 'Friend', 'Client / patient'];

/* ---------- helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n).toLocaleString('en-US');
const byId = id => DATA.homes.find(h => h.id === id);
const lovedName = () => S.person.name || 'your loved one';
const LovedName = () => { const n = lovedName(); return n[0].toUpperCase() + n.slice(1); };
const isMatched = id => S.matches.some(m => m.id === id);
const isSaved = id => S.saved.includes(id);
const getMatch = id => S.matches.find(m => m.id === id);

function homePoint() { return DATA.zips[S.care.zip] || LINCOLN; }
function dist(h) {
  const [la1, lo1] = homePoint(), R = 3958.8, r = Math.PI / 180;
  const dLa = (h.lat - la1) * r, dLo = (h.lon - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(h.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const mapsUrl = h => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(`${h.name}, ${h.address}`);
const telUrl = h => 'tel:' + String(h.phone || '').replace(/[^\d+]/g, '');
function priceText(h) {
  if (!h.priceLow) return 'Price: call';
  return `$${fmt(h.priceLow)}${h.priceHigh ? '–' + fmt(h.priceHigh) : ''}/mo`;
}

/* Profile completeness. Each item is something that sharpens the matches. */
function profileChecks() {
  const p = S.person, c = S.care;
  return [
    ['Their name', !!p.name], ['Age', !!p.age], ['Dementia stage', !!p.stage],
    ['Behaviors', p.behaviors.length > 0], ['Mobility', !!p.mobility], ['Medical needs', p.medical.length > 0],
    ['How you will pay', c.payment.length > 0], ['ZIP code', !!DATA.zips[c.zip]], ['Timeline', !!c.timeline],
    ['Things they love', p.likes.length > 0]
  ];
}
function completeness() {
  const c = profileChecks();
  return Math.round(100 * c.filter(x => x[1]).length / c.length);
}

function toast(html, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.innerHTML = html;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 2400);
  setTimeout(() => t.remove(), 2900);
}

/* ---------- list actions (shared by swipe deck, detail page and lists) ---------- */
function addMatch(id) {
  if (!isMatched(id)) S.matches.unshift({ id, at: Date.now(), status: 'matched', seen: false });
  S.passed = S.passed.filter(x => x !== id);
  save();
}
function unmatch(id) {
  S.matches = S.matches.filter(m => m.id !== id);
  S.compare = S.compare.filter(x => x !== id);
  save();
}
function toggleSave(id) {
  if (isSaved(id)) S.saved = S.saved.filter(x => x !== id);
  else { S.saved.unshift(id); S.passed = S.passed.filter(x => x !== id); }
  save();
  return isSaved(id);
}
