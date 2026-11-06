/* State: everything the family enters, saved in localStorage. Plus small shared helpers. */
const KEY = 'map-a-home-v1';
const DATA = window.MAH_DATA;
const LINCOLN = [40.8136, -96.7026];

const DEFAULT_STATE = () => ({
  caregiver: { name: '', relation: '' },
  person: {
    name: '', relation: '', avatar: '👵', age: null,
    stage: '',            // early | middle | late
    behaviors: [],        // wander, aggression, sundowning, falls
    mobility: '',         // walks | walker | wheelchair | bed
    medical: [],          // diabetes, oxygen, feeding, wounds, insulin...
    likes: [], faith: '', personality: '', notes: ''
  },
  care: {
    payment: [],          // private, medicaid, medicare, va, ltc
    budget: null, zip: '', maxMiles: 20, timeline: '', careType: ''
  },
  hearts: [],
  tours: [],
  chat: [],
  chatStep: 0,
  tab: 'home',
  mapFilter: 'all'
});

let S = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) {
      const d = DEFAULT_STATE();
      return { ...d, ...s, person: { ...d.person, ...s.person }, care: { ...d.care, ...s.care }, caregiver: { ...d.caregiver, ...s.caregiver } };
    }
  } catch (e) { /* ignore */ }
  return DEFAULT_STATE();
}
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
function resetAll() { S = DEFAULT_STATE(); save(); }

/* ---------- labels ---------- */
const LBL = {
  type: { nursing: 'Nursing home', memory: 'Memory care', assisted_memory: 'Assisted living + memory care' },
  typeShort: { nursing: 'Nursing', memory: 'Memory care', assisted_memory: 'Assisted + memory' },
  stage: { early: 'Early stage', middle: 'Middle stage', late: 'Late stage' },
  behaviors: { wander: 'Wanders / tries to leave', aggression: 'Agitation or aggression', sundowning: 'Sundowning', falls: 'Falls often' },
  mobility: { walks: 'Walks on own', walker: 'Uses a walker or cane', wheelchair: 'Uses a wheelchair', bed: 'Mostly in bed' },
  medical: { diabetes: 'Diabetes / insulin', oxygen: 'Oxygen', feeding: 'Help eating / feeding tube', wounds: 'Wound care', meds: 'Many medications', incontinence: 'Incontinence care' },
  payment: { private: 'Private pay / savings', medicaid: 'Medicaid', medicare: 'Medicare (short-term)', va: 'VA benefits', ltc: 'Long-term care insurance' },
  timeline: { now: 'Needs a bed now', soon: 'In 1–3 months', exploring: 'Just exploring' },
  pay: { yes: 'Yes', no: 'No', ask: 'Ask', short: 'Short-term only' }
};

/* ---------- helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n).toLocaleString('en-US');
const byId = id => DATA.facilities.find(f => f.id === id);
const lovedName = () => S.person.name || (S.person.relation ? `your ${S.person.relation.toLowerCase()}` : 'your loved one');
const LovedName = () => { const n = lovedName(); return n[0].toUpperCase() + n.slice(1); };

function home() { return DATA.zips[S.care.zip] || LINCOLN; }
function dist(p) {
  const [la1, lo1] = home(), R = 3958.8, r = Math.PI / 180;
  const dLa = (p.lat - la1) * r, dLo = (p.lon - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(p.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const mapsUrl = p => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(`${p.name}, ${p.address}`);
const telUrl = p => 'tel:' + p.phone.replace(/[^\d+]/g, '');

/* Profile completeness = the "XP bar". Each item is one thing that improves matching. */
function profileChecks() {
  const p = S.person, c = S.care;
  return [
    ['Name', !!p.name], ['Relationship', !!p.relation], ['Age', !!p.age], ['Dementia stage', !!p.stage],
    ['Behaviors', p.behaviors.length > 0 || p._noBehaviors], ['Mobility', !!p.mobility],
    ['Medical needs', p.medical.length > 0 || p._noMedical], ['Payment', c.payment.length > 0],
    ['Budget', !!c.budget], ['ZIP code', !!DATA.zips[c.zip]], ['Timeline', !!c.timeline],
    ['Likes & hobbies', p.likes.length > 0]
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
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

function toggleHeart(id) {
  const i = S.hearts.indexOf(id);
  if (i >= 0) { S.hearts.splice(i, 1); toast('💔 Removed from saved homes'); }
  else { S.hearts.push(id); toast(`❤️ Saved <b>${esc(byId(id).name)}</b>`, 'good'); }
  save();
  App.refresh();
}
