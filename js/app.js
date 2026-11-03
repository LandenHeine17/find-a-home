/* Find-A-Home – low-fidelity, clickable prototype.
   Plain JavaScript with no build step, so it opens straight from the file system.
   Screens follow our "Find-A-Home" napkin sketch:
     1 Welcome  ->  2/3 Matches (Home care | Facility toggle + faceted filters)
     4 Facility detail  /  5 Home care detail
   plus Solution Concept features: dementia-needs intake, compare, tour request, next-steps guide. */
(function () {
  'use strict';

  const D = window.FAH_DATA;
  const ALL = [...D.facilities, ...D.homecare];
  const byId = Object.fromEntries(ALL.map(p => [p.id, p]));
  const LINCOLN = [40.8136, -96.7026];
  const STORE = 'fah-state-v1';
  const app = document.getElementById('app');
  const NH = D.facilities.filter(p => p.cms);
  const AVG_DEF = D.averages.neDeficiencies;
  // Two test versions share this code (see index.html and index-map.html):
  //   'maplink' – clicking a match opens it in Google Maps in a new tab
  //   'mapview' – results have a List / Map toggle with pins
  const VARIANT = window.FAH_VARIANT || 'maplink';
  const mapsUrl = p => 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(p.kind === 'facility' ? `${p.name}, ${p.address}` : `${p.name} ${p.city || 'Lincoln'} NE`);
  function openMaps(p) {
    const w = window.open(mapsUrl(p), '_blank', 'noopener');
    if (w) w.focus();
  }

  /* ------------------------------------------------------------------ state */
  const defaultIntake = () => ({
    name: '', lovedOne: '', zip: '', insuranceFile: '', doctor: '',
    stage: '', behaviors: [], livingPref: '', payment: [], budget: 6000, maxMiles: 20, timing: ''
  });
  const defaultFilters = () => ({
    types: ['memory', 'assisted_memory', 'nursing'], price: 'any', includeUnpriced: true, miles: null,
    noMedicaidNo: false, hideLow: false, hideWatch: false, openOnly: false, memoryUnitOnly: false, noSerious: false,
    areas: ['Lincoln area', 'Omaha area'], q: '',
    hcTypes: ['non-medical', 'medical'], dementiaOnly: false, vaOnly: false
  });
  const defaults = () => ({
    intake: defaultIntake(), intakeDone: false, step: 1, mode: 'facility', filters: defaultFilters(),
    sort: 'match', view: 'list', saved: [], compare: [], tours: [], guide: {}, reviews: {}, appRating: null, chosen: null
  });

  let S = load();
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE));
      if (s) return Object.assign(defaults(), s, {
        intake: Object.assign(defaultIntake(), s.intake),
        filters: Object.assign(defaultFilters(), s.filters)
      });
    } catch (e) { /* ignore */ }
    return defaults();
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* ignore */ }
    updateCounts();
  }

  /* ---------------------------------------------------------------- helpers */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const lovedOne = () => esc(S.intake.lovedOne.trim() || 'your loved one');
  const LovedOne = () => { const l = S.intake.lovedOne.trim(); return l ? esc(l) : 'Your loved one'; };

  function home() { return D.zips[S.intake.zip] || LINCOLN; }
  function dist(p) {
    if (p.lat == null) return 0;
    const [la1, lo1] = home(), R = 3958.8, r = Math.PI / 180;
    const dLa = (p.lat - la1) * r, dLo = (p.lon - lo1) * r;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(p.lat * r) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function stars(v, max = 5) {
    if (v == null) return '<span class="muted small">No rating yet</span>';
    const full = Math.round(v);
    return `<span class="stars" aria-label="${v} out of ${max} stars">${'★'.repeat(full)}<span class="off">${'★'.repeat(max - full)}</span></span>`;
  }
  const TYPE_LABEL = {
    nursing: 'Nursing home', memory: 'Memory care community', assisted_memory: 'Assisted living + memory care',
    'non-medical': 'In-home care (non-medical)', medical: 'Home health (medical)'
  };
  const PAY_LABEL = { private: 'Private pay / savings', medicaid: 'Medicaid', medicare: 'Medicare', va: 'VA benefits', ltc: 'Long-term care insurance' };

  function priceText(p, long) {
    if (p.kind === 'homecare') {
      if (p.type === 'medical') return 'Billed per visit';
      return `Est. $${p.priceLow}–$${p.priceHigh}/hr`;
    }
    if (p.type === 'nursing') return `Est. $${fmt(p.priceLow)}–$${fmt(p.priceHigh)}/mo`;
    if (p.priceEstimated) return long ? `Not published (Lincoln avg. ≈ $${fmt(p.priceLow)}/mo)` : 'Price not published';
    return `From $${fmt(p.priceLow)}/mo`;
  }
  function knownPrice(p) {
    if (p.kind !== 'facility') return null;
    if (p.type === 'nursing') return p.priceLow;
    return p.priceEstimated ? null : p.priceLow;
  }

  function icon(type, size) {
    const s = size || 64;
    const bg = { nursing: '#e6eef6', memory: '#f6ece0', assisted_memory: '#e8f2ea', 'non-medical': '#f3e8f1', medical: '#e6eef6' }[type] || '#eee';
    let art;
    if (type === 'nursing') art = '<rect x="12" y="20" width="40" height="34" rx="2" fill="#5b7fa6"/><rect x="18" y="26" width="7" height="7" fill="#fff"/><rect x="39" y="26" width="7" height="7" fill="#fff"/><rect x="18" y="38" width="7" height="7" fill="#fff"/><rect x="39" y="38" width="7" height="7" fill="#fff"/><rect x="28" y="42" width="8" height="12" fill="#fff"/><rect x="26" y="8" width="12" height="12" rx="2" fill="#fff" stroke="#5b7fa6" stroke-width="2"/><path d="M32 10.5v7M28.5 14h7" stroke="#c0504d" stroke-width="2.4"/>';
    else if (type === 'memory') art = '<path d="M8 32 32 12l24 20v22H8z" fill="#c9822b"/><rect x="27" y="40" width="10" height="14" fill="#fff"/><path d="M32 33c-2.5-4-9-2-6 3l6 5 6-5c3-5-3.5-7-6-3z" fill="#fff"/>';
    else if (type === 'assisted_memory') art = '<path d="M6 34 24 18l18 16v20H6z" fill="#4f8f63"/><path d="M28 30 42 18l16 14v22H28z" fill="#6aa67c"/><rect x="18" y="42" width="8" height="12" fill="#fff"/><rect x="44" y="40" width="7" height="7" fill="#fff"/>';
    else if (type === 'medical') art = '<circle cx="32" cy="22" r="9" fill="#5b7fa6"/><path d="M14 54c0-11 8-18 18-18s18 7 18 18z" fill="#5b7fa6"/><path d="M32 40v10M27 45h10" stroke="#fff" stroke-width="3"/>';
    else art = '<circle cx="26" cy="22" r="8" fill="#9a5b8e"/><path d="M10 54c0-10 7-16 16-16s16 6 16 16z" fill="#9a5b8e"/><path d="M46 30c-2.5-4-9-2-6 3l6 5 6-5c3-5-3.5-7-6-3z" fill="#d0574f"/>';
    return `<svg viewBox="0 0 64 64" width="${s}" height="${s}" aria-hidden="true"><rect width="64" height="64" rx="12" fill="${bg}"/>${art}</svg>`;
  }

  function toast(msg) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  function openModal(html, onMount) {
    closeModal();
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    bd.addEventListener('click', e => { if (e.target === bd || e.target.closest('[data-close]')) closeModal(); });
    document.body.appendChild(bd);
    const f = bd.querySelector('input, select, textarea, button:not(.close-x)');
    if (f) f.focus();
    if (onMount) onMount(bd.querySelector('.modal'));
    return bd;
  }
  function closeModal() { document.querySelectorAll('.modal-backdrop').forEach(m => m.remove()); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  function updateCounts() {
    document.getElementById('compareCount').textContent = S.compare.length;
    document.getElementById('savedCount').textContent = S.saved.length;
  }

  /* --------------------------------------------------------------- matching */
  // Turns the intake answers into a 0–100 "fit" score plus plain-language reasons.
  function match(p) {
    const I = S.intake, pay = I.payment || [], beh = I.behaviors || [];
    const good = [], warn = [];
    let s = 55;
    const needsMedical = beh.includes('medical') || I.stage === 'late';
    const wanders = beh.includes('wander') || beh.includes('aggression');
    const medicaidOnly = pay.includes('medicaid') && !pay.includes('private') && !pay.includes('ltc');

    if (p.kind === 'facility') {
      const d = dist(p), max = I.maxMiles || 20;
      if (d <= max) { s += 12 * (1 - d / max); good.push(`${d.toFixed(1)} mi away`); }
      else { s -= 15; warn.push(`${d.toFixed(1)} mi away (past your ${max} mi limit)`); }

      if (p.memoryCare === 'dedicated') { s += wanders ? 16 : 10; good.push('Dementia care is all they do'); }
      else if (p.memoryCare === 'unit') { s += wanders ? 12 : 7; good.push(p.type === 'nursing' ? 'Has a dementia / memory unit' : `Memory care area${p.memoryUnits ? ` (${p.memoryUnits} units)` : ''}`); }
      else if (wanders) { s -= 6; warn.push('Ask about a secured memory unit'); }

      if (needsMedical) {
        if (p.type === 'nursing') { s += 14; good.push('24-hour nursing care'); }
        else { s -= 10; warn.push('May not cover heavy medical needs'); }
      } else if (p.type === 'nursing' && (I.stage === 'early' || I.stage === 'middle')) {
        s -= I.stage === 'early' ? 10 : 6; warn.push('More medical care than needed yet');
      } else if (I.stage === 'early') { s += 4; }

      if (pay.includes('medicaid')) {
        if (p.payment.medicaid === 'yes') { s += 10; good.push('Accepts Medicaid'); }
        else if (p.payment.medicaid === 'no') { s -= medicaidOnly ? 30 : 8; warn.push('Does not take Medicaid'); }
        else { s -= medicaidOnly ? 6 : 2; warn.push('Medicaid waiver: ask'); }
      }
      if (I.budget) {
        if (!p.priceEstimated) {
          if (p.priceLow <= I.budget) { s += 6; good.push('Starts within budget'); }
          else { s -= 8; warn.push(`Starts above $${fmt(I.budget)}/mo budget`); }
        } else if (p.type === 'nursing' && !pay.includes('medicaid') && p.priceLow > I.budget) {
          s -= 4; warn.push('Typical cost is over budget');
        }
      }
      if (p.cms) {
        const c = p.cms;
        if (c.overall) {
          s += (c.overall - 3) * 5;
          if (c.overall >= 4) good.push(`${c.overall}★ Medicare rating`);
          if (c.overall <= 2) warn.push(`Low Medicare rating (${c.overall}★)`);
        }
        if (c.sff) { s -= 25; warn.push("On Medicare's watch list"); }
        else if (c.sffCandidate) { s -= 12; warn.push("Candidate for Medicare's watch list"); }
        const recent = recentSerious(p);
        if (recent.jeopardy) { s -= 12; warn.push('Recent citation: residents in serious danger'); }
        else if (recent.harm) { s -= 6; warn.push('Recent citation: a resident was harmed'); }
        const ap = (p.quality || []).find(q => q.code === '481');
        if (ap && ap.value != null && ap.value > ap.ne * 1.3) { s -= ap.value > ap.ne * 2 ? 10 : 4; warn.push(`High antipsychotic use (${ap.value}%)`); }
        const fl = (p.quality || []).find(q => q.code === '410');
        if (fl && fl.value != null && fl.value > fl.ne * 1.5) { s -= 3; warn.push(`More falls with injury (${fl.value}%)`); }
        if (p.behavioral && beh.includes('aggression')) { s += 6; good.push('Accommodates behavioral needs'); }
        if (c.abuse) { s -= 15; warn.push('Cited for abuse'); }
        if (c.fines > 0) { s -= 3; warn.push(`${c.fines} federal fine${c.fines > 1 ? 's' : ''}`); }
      } else if (p.rating.value && p.rating.count >= 3) {
        s += (p.rating.value - 4) * 6;
        if (p.rating.value >= 4.5) good.push(`${p.rating.value}★ family reviews`);
      }
      if (p.openings.est != null) {
        if (p.openings.est >= 3) { s += 3; good.push(`~${p.openings.est} beds may be open`); }
        else { s -= 3; warn.push('May be nearly full'); }
      }
      if (I.livingPref === 'home') s -= 5;
    } else {
      if (p.dementia) { s += 12; good.push('Advertises dementia care'); }
      else if (p.type !== 'medical') warn.push('Ask about dementia training');
      if (p.type === 'medical') {
        if (needsMedical) { s += 12; good.push('Nurses for medical needs'); }
        else { s -= 10; warn.push('For doctor-ordered medical care'); }
        if (pay.includes('medicare')) { s += 6; good.push('Medicare may cover'); }
      } else {
        if (needsMedical) { s -= 4; warn.push('Non-medical: no nursing tasks'); }
        if (I.stage === 'late') s -= 4;
        if (I.budget && p.priceLow) {
          const lo = p.priceLow * 4 * 30;
          if (lo > I.budget) warn.push(`4 hrs/day ≈ $${fmt(lo)}+/mo`);
          else good.push(`4 hrs/day ≈ $${fmt(lo)}–$${fmt(p.priceHigh * 120)}/mo`);
        }
      }
      if (pay.includes('va') && p.payment.va === 'yes') { s += 8; good.push('Works with VA benefits'); }
      if (medicaidOnly) warn.push('Medicaid waiver: ask');
      if (I.livingPref === 'home') s += 10;
    }
    return { score: Math.max(5, Math.min(98, Math.round(s))), good, warn };
  }

  // Serious citations (actual harm or immediate jeopardy) in the most recent ~15 months
  function recentSerious(p) {
    const cutoff = new Date(Date.now() - 456 * 864e5).toISOString().slice(0, 10);
    const r = (p.inspections || []).filter(i => i.date >= cutoff);
    return { harm: r.some(i => i.level === 3), jeopardy: r.some(i => i.level === 4) };
  }
  const seriousCount = p => (p.inspections || []).filter(i => i.level >= 3).length;

  function filtered(mode) {
    const F = S.filters;
    const miles = F.miles === 'any' ? Infinity : (F.miles || S.intake.maxMiles || 20);
    let list;
    if (mode === 'facility') {
      list = D.facilities.filter(p => {
        if (!F.types.includes(p.type)) return false;
        if (p.area && !F.areas.includes(p.area)) return false;
        if (F.q && !(p.name + ' ' + (p.aka || '') + ' ' + p.address).toLowerCase().includes(F.q.toLowerCase())) return false;
        if (dist(p) > miles) return false;
        const kp = knownPrice(p);
        if (kp == null) { if (!F.includeUnpriced) return false; }
        else if (F.price === 'u5' && kp >= 5000) return false;
        else if (F.price === '5to8' && (kp < 5000 || kp > 8000)) return false;
        else if (F.price === 'o8' && kp <= 8000) return false;
        if (F.noMedicaidNo && p.payment.medicaid === 'no') return false;
        if (F.hideWatch && p.cms && (p.cms.sff || p.cms.abuse)) return false;
        if (F.hideLow && p.cms && (p.cms.overall == null || p.cms.overall <= 2)) return false;
        if (F.openOnly && !(p.openings.est >= 1)) return false;
        if (F.memoryUnitOnly && p.memoryCare === 'ask') return false;
        if (F.noSerious && p.cms && seriousCount(p) > 0) return false;
        return true;
      });
    } else {
      list = D.homecare.filter(p => {
        if (!F.hcTypes.includes(p.type)) return false;
        if (F.dementiaOnly && !p.dementia) return false;
        if (F.vaOnly && p.payment.va !== 'yes') return false;
        return true;
      });
    }
    const scored = list.map(p => ({ p, m: match(p), d: dist(p) }));
    const sorters = {
      match: (a, b) => b.m.score - a.m.score,
      distance: (a, b) => a.d - b.d,
      rating: (a, b) => (b.p.rating?.value ?? -1) - (a.p.rating?.value ?? -1),
      price: (a, b) => (knownPrice(a.p) ?? a.p.priceLow ?? 1e9) - (knownPrice(b.p) ?? b.p.priceLow ?? 1e9)
    };
    return scored.sort(sorters[S.sort] || sorters.match);
  }

  /* ----------------------------------------------------------------- router */
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [view, arg] = h.split('/');
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active',
      a.dataset.nav === view || (a.dataset.nav === 'results' && view === 'place')));
    closeModal();
    switch (view) {
      case 'results': renderResults(); break;
      case 'place': renderPlace(decodeURIComponent(arg || '')); break;
      case 'compare': renderCompare(); break;
      case 'list': renderList(); break;
      case 'next-steps': renderGuide(); break;
      default: renderWelcome();
    }
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
    if (window.FAH_ASSISTANT) window.FAH_ASSISTANT.onRoute();
  }
  window.addEventListener('hashchange', route);
  const go = h => { if (location.hash === h) route(); else location.hash = h; };

  /* ---------------------------------------------------------------- welcome */
  function renderWelcome() {
    const I = S.intake, st = S.step;
    const steps = ['Welcome', `About ${I.lovedOne ? esc(I.lovedOne) : 'them'}`, 'Cost & distance'];
    const bar = `<div class="steps">${steps.map((t, i) => `<div class="${i + 1 < st ? 'done' : i + 1 === st ? 'current' : ''}">${i + 1}. ${t}</div>`).join('')}</div>`;
    let body = '';
    if (st === 1) {
      body = `
      <div class="field"><label for="f-name">Please enter your name</label>
        <input id="f-name" type="text" autocomplete="given-name" value="${esc(I.name)}" placeholder="Your first name"></div>
      <div class="row">
        <div class="field"><label for="f-loved">Who are you finding care for?<span class="hint">What you call them, like "Mom" or "Grandpa Joe"</span></label>
          <input id="f-loved" type="text" value="${esc(I.lovedOne)}" placeholder="e.g. Dad"></div>
        <div class="field"><label for="f-zip">Your ZIP code<span class="hint">So we can find places close to family</span></label>
          <input id="f-zip" type="text" inputmode="numeric" maxlength="5" value="${esc(I.zip)}" placeholder="e.g. 68516"></div>
      </div>
      <div class="field"><label>Upload insurance card <span class="hint">Optional. We use it to show places that take your insurance.</span></label>
        <label class="upload" for="f-card" style="font-weight:400">
          <span class="plus">+</span>
          <span id="cardText">${I.insuranceFile ? `✓ <b>${esc(I.insuranceFile)}</b> added. <span class="hint">Prototype: the card isn't read or stored. Please also choose your payment type in step 3.</span>` : 'Tap to add a photo of the front of the card'}</span>
        </label>
        <input id="f-card" type="file" accept="image/*,.pdf" class="hidden"></div>
      <div class="field"><label for="f-doc">Connect to doctors <span class="hint">Optional. With your permission, their diagnosis notes can fill in step 2 for you.</span></label>
        <select id="f-doc">
          ${['', 'Bryan Health', 'CHI Health St. Elizabeth', 'Nebraska Medicine', 'Lincoln VA Clinic', 'Other / not listed'].map(o =>
            `<option value="${o}" ${I.doctor === o ? 'selected' : ''}>${o || 'Not right now'}</option>`).join('')}
        </select>
        <div id="docNote" class="hint" style="margin-top:.35rem">${I.doctor ? 'Prototype: nothing is shared. In the full app you would sign in to your patient portal here.' : ''}</div></div>`;
    } else if (st === 2) {
      const stage = [['early', 'Early', 'Mostly independent, with some forgetfulness'], ['middle', 'Middle', 'Needs daily help and someone nearby'], ['late', 'Late', 'Needs help with almost everything'], ['unsure', 'Not sure', "That's okay, we'll explain"]];
      const beh = [['wander', 'Wanders or gets lost', 'Usually needs a secured (locked) memory unit'], ['aggression', 'Agitation or aggression', ''], ['falls', 'Falls or is unsteady', ''], ['adl', 'Needs help bathing or dressing', ''], ['medical', 'Needs medical care', 'e.g. wounds, injections, feeding tube, oxygen'], ['diagnosis', 'Has a written diagnosis from a doctor', 'Most memory care and Medicaid require one']];
      const pref = [['facility', 'A care facility', 'Memory care, assisted living or nursing home'], ['home', 'Stay at home with help', 'In-home caregivers'], ['unsure', 'Not sure yet', 'Show me both']];
      body = `
      <div class="field"><label>How far along is ${lovedOne()}'s memory loss?</label>
        <div class="choice-grid">${stage.map(([v, t, h]) => `<label class="choice"><input type="radio" name="stage" value="${v}" ${I.stage === v ? 'checked' : ''}><span>${t}<small>${h}</small></span></label>`).join('')}</div></div>
      <div class="field"><label>Check anything that applies <span class="hint">This helps us find places that can safely care for them</span></label>
        <div class="choice-grid">${beh.map(([v, t, h]) => `<label class="choice"><input type="checkbox" name="beh" value="${v}" ${I.behaviors.includes(v) ? 'checked' : ''}><span>${t}${h ? `<small>${h}</small>` : ''}</span></label>`).join('')}</div></div>
      <div class="field"><label>Where are you hoping ${lovedOne()} will live?</label>
        <div class="choice-grid">${pref.map(([v, t, h]) => `<label class="choice"><input type="radio" name="pref" value="${v}" ${I.livingPref === v ? 'checked' : ''}><span>${t}<small>${h}</small></span></label>`).join('')}</div></div>`;
    } else {
      const pays = [['private', 'Private pay / savings', ''], ['medicaid', 'Medicaid', 'Or applying for it'], ['medicare', 'Medicare', 'Covers short stays after a hospital visit'], ['va', 'VA benefits', ''], ['ltc', 'Long-term care insurance', ''], ['unsure', 'Not sure', 'Our guide can help']];
      const when = [['now', 'Right away', 'A crisis or hospital discharge'], ['soon', 'In 1–3 months', ''], ['exploring', 'Just exploring', '']];
      body = `
      <div class="field"><label>How will you pay? <span class="hint">Pick all that apply</span></label>
        <div class="choice-grid">${pays.map(([v, t, h]) => `<label class="choice"><input type="checkbox" name="pay" value="${v}" ${I.payment.includes(v) ? 'checked' : ''}><span>${t}${h ? `<small>${h}</small>` : ''}</span></label>`).join('')}</div></div>
      <div class="row">
        <div class="field"><label for="f-budget">Monthly budget: <span class="range-val" id="budgetVal">$${fmt(I.budget)}${I.budget >= 12000 ? '+' : ''}</span></label>
          <input id="f-budget" type="range" min="2000" max="12000" step="250" value="${I.budget}"></div>
        <div class="field"><label for="f-miles">How far will family drive? <span class="range-val" id="milesVal">${I.maxMiles} miles</span></label>
          <input id="f-miles" type="range" min="5" max="60" step="5" value="${I.maxMiles}"></div>
      </div>
      <div class="field"><label>How soon do you need care?</label>
        <div class="choice-grid">${when.map(([v, t, h]) => `<label class="choice"><input type="radio" name="when" value="${v}" ${I.timing === v ? 'checked' : ''}><span>${t}${h ? `<small>${h}</small>` : ''}</span></label>`).join('')}</div></div>`;
    }
    app.innerHTML = `
    <div class="welcome-wrap">
      <div class="welcome-hero">
        <h1>${st === 1 ? 'Welcome!' : st === 2 ? `Tell us about ${lovedOne()}` : 'Cost & distance'}</h1>
        <p>${st === 1 ? 'Find safe, affordable dementia care near Lincoln in about 2 minutes. No account needed.' : st === 2 ? 'There are no wrong answers. You can change these any time.' : 'Almost done. This keeps your matches realistic.'}</p>
      </div>
      ${bar}
      <form class="card" id="intakeForm" novalidate>
        ${body}
        <div class="intake-actions">
          ${st > 1 ? '<button type="button" class="btn secondary" data-action="intake-back">← Back</button>' : '<button type="button" class="btn ghost" data-action="skip-intake">Skip and just browse</button>'}
          <button type="submit" class="btn big">${st < 3 ? 'Next →' : '🔍 Find Homes'}</button>
        </div>
      </form>
      <div class="reassure"><span>Free for families</span><span>Facilities can't pay for a higher ranking</span><span>Nothing is shared without your OK</span></div>
    </div>`;

    const form = document.getElementById('intakeForm');
    form.addEventListener('submit', e => { e.preventDefault(); readIntake(); if (S.step < 3) { S.step++; save(); renderWelcome(); window.scrollTo(0, 0); } else finishIntake(); });
    const card = document.getElementById('f-card');
    if (card) card.addEventListener('change', () => { readIntake(); if (card.files[0]) { S.intake.insuranceFile = card.files[0].name; save(); renderWelcome(); toast('Insurance card added'); } });
    const doc = document.getElementById('f-doc');
    if (doc) doc.addEventListener('change', () => { document.getElementById('docNote').textContent = doc.value ? 'Prototype: nothing is shared. In the full app you would sign in to your patient portal here.' : ''; });
    const b = document.getElementById('f-budget');
    if (b) b.addEventListener('input', () => { document.getElementById('budgetVal').textContent = '$' + fmt(+b.value) + (+b.value >= 12000 ? '+' : ''); });
    const m = document.getElementById('f-miles');
    if (m) m.addEventListener('input', () => { document.getElementById('milesVal').textContent = m.value + ' miles'; });
  }

  function readIntake() {
    const I = S.intake, v = id => document.getElementById(id);
    if (S.step === 1) {
      I.name = v('f-name').value.trim(); I.lovedOne = v('f-loved').value.trim();
      I.zip = v('f-zip').value.replace(/\D/g, '').slice(0, 5); I.doctor = v('f-doc').value;
    } else if (S.step === 2) {
      I.stage = (document.querySelector('[name=stage]:checked') || {}).value || '';
      I.behaviors = [...document.querySelectorAll('[name=beh]:checked')].map(x => x.value);
      I.livingPref = (document.querySelector('[name=pref]:checked') || {}).value || '';
    } else {
      I.payment = [...document.querySelectorAll('[name=pay]:checked')].map(x => x.value);
      I.budget = +v('f-budget').value; I.maxMiles = +v('f-miles').value;
      I.timing = (document.querySelector('[name=when]:checked') || {}).value || '';
    }
    save();
  }
  function finishIntake() {
    S.intakeDone = true; S.step = 1;
    S.mode = S.intake.livingPref === 'home' ? 'homecare' : 'facility';
    S.filters = defaultFilters();
    if (S.intake.payment.includes('medicaid') && !S.intake.payment.includes('private')) S.filters.noMedicaidNo = true;
    save();
    go('#/results');
  }

  /* ---------------------------------------------------------------- results */
  function renderResults() {
    const I = S.intake, F = S.filters, mode = S.mode;
    const res = filtered(mode);
    const miles = F.miles || I.maxMiles || 20;
    const zipKnown = !!D.zips[I.zip];
    const isFac = mode === 'facility';
    const showMap = VARIANT === 'mapview' && S.view === 'map';
    const chk = (k, label) => `<label class="check"><input type="checkbox" data-filter="${k}" ${F[k] ? 'checked' : ''}> ${label}</label>`;
    const arr = (k, v, label) => `<label class="check"><input type="checkbox" data-filter-arr="${k}" value="${v}" ${F[k].includes(v) ? 'checked' : ''}> ${label}</label>`;
    const rad = (k, v, label) => `<label class="check"><input type="radio" name="${k}" data-filter-radio="${k}" value="${v}" ${String(F[k] ?? '') === String(v) ? 'checked' : ''}> ${label}</label>`;

    const facFilters = `
      <h3>Search by name</h3>
      <input type="text" id="qInput" placeholder="e.g. Brookestone" value="${esc(F.q)}" aria-label="Search by name" style="min-height:42px;padding:.4rem .6rem">
      <h3>Type of care</h3>
      ${arr('types', 'memory', 'Memory care only')}
      ${arr('types', 'assisted_memory', 'Assisted living + memory care')}
      ${arr('types', 'nursing', 'Nursing home')}
      <h3>Area</h3>
      ${arr('areas', 'Lincoln area', 'Lincoln area')}
      ${arr('areas', 'Omaha area', 'Omaha area')}
      <h3>Distance</h3>
      ${[5, 10, 20, 40, 60].map(n => `<label class="check"><input type="radio" name="miles" data-filter-radio="miles" value="${n}" ${String(miles) === String(n) ? 'checked' : ''}> Within ${n} miles</label>`).join('')}
      ${rad('miles', 'any', 'Any distance')}
      <h3>Dementia care</h3>
      ${chk('memoryUnitOnly', 'Only places with a memory / dementia unit')}
      <h3>Price per month</h3>
      ${rad('price', 'any', 'Any price')}${rad('price', 'u5', 'Under $5,000')}${rad('price', '5to8', '$5,000 – $8,000')}${rad('price', 'o8', 'Over $8,000')}
      ${chk('includeUnpriced', 'Include places that don\'t list a price')}
      <h3>Payment</h3>
      ${chk('noMedicaidNo', 'Hide places that don\'t take Medicaid')}
      <h3>Safety</h3>
      ${chk('hideWatch', 'Hide places on Medicare\'s watch list')}
      ${chk('hideLow', 'Hide nursing homes rated 1–2★')}
      ${chk('noSerious', 'Hide nursing homes cited for harming a resident (last 3 yrs)')}
      <h3>Availability</h3>
      ${chk('openOnly', 'Only show estimated open beds')}
      <p class="hint" style="margin-top:.25rem">Only nursing homes report this. Ask everyone else when you request a tour.</p>`;
    const hcFilters = `
      <h3>Type of help</h3>
      ${arr('hcTypes', 'non-medical', 'Non-medical (daily living help)')}
      ${arr('hcTypes', 'medical', 'Medical home health (nurses)')}
      <h3>Experience</h3>
      ${chk('dementiaOnly', 'Advertises dementia / Alzheimer\'s care')}
      <h3>Payment</h3>
      ${chk('vaOnly', 'Works with VA benefits')}
      <h3>Price</h3>
      <p class="hint">Lincoln agencies charge about $30–$40 an hour, usually with a 3–4 hour minimum. Call for exact quotes.</p>`;

    const toggle = `
      <div class="mode-toggle" role="tablist" aria-label="Type of care">
        <button class="mode-btn ${!isFac ? 'active' : ''}" data-action="mode" data-mode="homecare" role="tab" aria-selected="${!isFac}">${icon('non-medical', 54)}Home care</button>
        <button class="mode-btn ${isFac ? 'active' : ''}" data-action="mode" data-mode="facility" role="tab" aria-selected="${isFac}">${icon('nursing', 54)}Facilities</button>
      </div>`;

    const forLine = S.intakeDone
      ? `<div class="for-line"><span>Matches for <b>${lovedOne()}</b>${zipKnown ? ` near <b>${esc(I.zip)}</b>` : ''}${I.payment.length ? ` · ${I.payment.filter(x => PAY_LABEL[x]).map(x => PAY_LABEL[x]).join(', ')}` : ''}</span><button class="linkbtn" data-action="edit-intake">Change answers</button></div>`
      : `<div class="for-line"><span>👋 Answer 3 quick questions so we can rank these by what ${lovedOne()} needs.</span><a class="btn small" href="#/welcome">Get my matches</a></div>`;

    const cards = res.length ? res.map(({ p, m, d }) => card(p, m, d)).join('') :
      `<div class="card empty"><h3>No matches with these filters</h3><p>Try widening the distance or area.</p><button class="btn secondary" data-action="reset-filters">Reset filters</button></div>`;

    const viewToggle = VARIANT === 'mapview' ? `
      <div class="view-toggle" role="tablist" aria-label="View">
        <button class="${!showMap ? 'active' : ''}" data-action="view" data-view="list" role="tab" aria-selected="${!showMap}">☰ List</button>
        <button class="${showMap ? 'active' : ''}" data-action="view" data-view="map" role="tab" aria-selected="${showMap}">🗺️ Map</button>
      </div>` : '';
    const hint = VARIANT === 'maplink'
      ? '<p class="hint" style="margin:-.25rem 0 .75rem">📍 Click a place to see it on Google Maps (opens a new tab). Use <b>Details</b> for ratings, inspections and tours.</p>'
      : '';

    app.innerHTML = `
      <div class="results-head">
        <div class="results-title"><span class="selected-label">Selected</span><h1>${isFac ? 'Facilities' : 'Home care'}</h1>
          <p class="muted" style="margin:0">${isFac ? 'Memory care, assisted living and nursing homes in the Lincoln and Omaha areas' : 'Caregivers who come to your home in Lincoln and Lancaster County'}</p></div>
        ${toggle}
      </div>
      <div class="results-layout">
        <aside class="card filters" aria-label="Filters">
          <div style="display:flex;justify-content:space-between;align-items:center"><b>Filter</b><button class="linkbtn small" data-action="reset-filters">Reset</button></div>
          ${isFac ? facFilters : hcFilters}
        </aside>
        <section>
          ${forLine}
          <div class="sort-row"><h2 style="margin:0">Matches <span class="muted" style="font-weight:400;font-size:1rem">(${res.length})</span></h2>
            <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">${viewToggle}
            <label class="small" style="display:flex;gap:.5rem;align-items:center;margin:0">Sort by
              <select id="sortSel">${[['match', 'Best match'], ['distance', 'Closest'], ['rating', 'Highest rated'], ['price', 'Lowest price']].map(([v, t]) => `<option value="${v}" ${S.sort === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div></div>
          ${hint}
          ${showMap ? '<div id="resultsMap" class="results-map card" role="region" aria-label="Map of matches"></div><p class="hint" style="margin-top:.5rem">Numbers match the list order (1 = best match). The map starts zoomed on your top 10, so zoom out to see more. Click a pin to open it in Google Maps or see details.</p>' : `<div class="match-list">${cards}</div>`}
        </section>
      </div>
      ${compareBar()}`;

    app.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('change', () => { F[el.dataset.filter] = el.checked; save(); renderResults(); }));
    app.querySelectorAll('[data-filter-arr]').forEach(el => el.addEventListener('change', () => {
      const k = el.dataset.filterArr; F[k] = el.checked ? [...new Set([...F[k], el.value])] : F[k].filter(x => x !== el.value); save(); renderResults();
    }));
    app.querySelectorAll('[data-filter-radio]').forEach(el => el.addEventListener('change', () => {
      const k = el.dataset.filterRadio; F[k] = (k === 'miles' && el.value !== 'any') ? +el.value : el.value; save(); renderResults();
    }));
    document.getElementById('sortSel').addEventListener('change', e => { S.sort = e.target.value; save(); renderResults(); });
    const q = document.getElementById('qInput');
    if (q) {
      let t;
      q.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          F.q = q.value; save(); const pos = q.selectionStart; renderResults();
          const nq = document.getElementById('qInput'); nq.focus(); nq.setSelectionRange(pos, pos);
        }, 250);
      });
    }
    if (showMap) drawMap(res);
  }

  /* --------------------------------------------------------------- map view */
  let mapObj = null;
  const PIN_COLOR = { nursing: '#4a6f99', memory: '#c9822b', assisted_memory: '#4f8f63', 'non-medical': '#9a5b8e', medical: '#4a6f99' };
  function drawMap(res) {
    const el = document.getElementById('resultsMap');
    if (mapObj) { mapObj.remove(); mapObj = null; }
    if (!window.L) { el.innerHTML = '<div class="empty">The map couldn\'t load. Check your internet connection.</div>'; return; }
    const pts = res.filter(r => r.p.lat != null);
    mapObj = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapObj);
    const bounds = [];
    const h = home();
    L.marker(h, { icon: L.divIcon({ className: '', html: '<div class="home-pin" title="You">🏠</div>', iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 1000 })
      .addTo(mapObj).bindTooltip(D.zips[S.intake.zip] ? `You (${esc(S.intake.zip)})` : 'Downtown Lincoln');
    bounds.push(h);
    pts.forEach(({ p, m }, i) => {
      const icon = L.divIcon({ className: '', html: `<div class="pin" style="--c:${PIN_COLOR[p.type]}"><span>${i + 1}</span></div>`, iconSize: [30, 40], iconAnchor: [15, 38], popupAnchor: [0, -34] });
      const mk = L.marker([p.lat, p.lon], { icon, title: p.name, riseOnHover: true }).addTo(mapObj);
      mk.bindPopup(`
        <div class="pop">
          <b>${i + 1}. ${esc(p.name)}</b>
          <div class="small muted">${TYPE_LABEL[p.type]} · ${dist(p).toFixed(1)} mi</div>
          <div>${p.rating.value != null ? stars(p.rating.value) : '<span class="small muted">No rating yet</span>'}${S.intakeDone ? ` <b style="color:var(--primary-dark)">${m.score}% match</b>` : ''}</div>
          ${p.cms && (p.cms.sff || p.cms.sffCandidate) ? '<div class="tag bad" style="margin-top:.3rem">Medicare watch list</div>' : ''}
          ${p.memoryCare !== 'ask' ? '<div class="tag good" style="margin-top:.3rem">✓ Memory / dementia unit</div>' : ''}
          <div class="pop-actions">
            <a class="btn small" href="${mapsUrl(p)}" target="_blank" rel="noopener">📍 Open in Google Maps</a>
            <a class="btn small secondary" href="#/place/${p.id}">Details</a>
          </div>
        </div>`, { minWidth: 230 });
      bounds.push([p.lat, p.lon]);
    });
    const focus = [h, ...pts.slice(0, 10).map(r => [r.p.lat, r.p.lon])];
    if (focus.length > 1) mapObj.fitBounds(focus, { padding: [40, 40], maxZoom: 13 }); else mapObj.setView(h, 11);
    if (!pts.length) el.insertAdjacentHTML('beforeend', '<div class="map-empty">No matches with these filters</div>');
  }

  function card(p, m, d) {
    const saved = S.saved.includes(p.id), cmp = S.compare.includes(p.id);
    const sub = p.kind === 'facility'
      ? `${TYPE_LABEL[p.type]} · ${esc(p.city || 'Lincoln')} · ${d.toFixed(1)} mi · ${priceText(p)}`
      : `${TYPE_LABEL[p.type]} · Serves Lincoln area · ${priceText(p)}`;
    const ratingLine = p.kind === 'facility'
      ? `${stars(p.rating.value)} <span class="small muted">${p.rating.value != null ? (p.cms ? 'Medicare rating' : `${p.rating.count} review${p.rating.count === 1 ? '' : 's'}`) : ''}</span>`
      : `${reviewsFor(p.id).length ? stars(avgReview(p.id)) + ` <span class="small muted">${reviewsFor(p.id).length} Find-A-Home review(s)</span>` : '<span class="small muted">No reviews yet</span>'}`;
    const openAttr = VARIANT === 'maplink' ? `data-maps="${p.id}" title="Open in Google Maps" aria-label="${esc(p.name)}: open in Google Maps"` : `data-open="${p.id}" aria-label="${esc(p.name)}"`;
    return `
      <article class="card match" ${openAttr} tabindex="0">
        <div class="thumb">${icon(p.type, 96)}</div>
        <div>
          <h3>${esc(p.name)}${VARIANT === 'maplink' ? ' <span class="maps-cue" aria-hidden="true">📍↗</span>' : ''}</h3>
          <div class="sub">${sub}</div>
          <div style="margin-bottom:.4rem">${ratingLine}</div>
          <div class="tags">${m.good.slice(0, 4).map(t => `<span class="tag good">✓ ${esc(t)}</span>`).join('')}${m.warn.slice(0, 2).map(t => `<span class="tag ${/watch|abuse|not take|Low|danger|harmed/.test(t) ? 'bad' : 'warn'}">! ${esc(t)}</span>`).join('')}</div>
        </div>
        <div class="side">
          ${S.intakeDone ? `<div class="match-score"><b>${m.score}%</b><span>match</span></div>` : ''}
          ${VARIANT === 'maplink' ? `<a class="btn small secondary" href="#/place/${p.id}">Details</a>` : ''}
          <div style="display:flex;align-items:center;gap:.4rem">
            <label class="compare-check" data-stop><input type="checkbox" data-action="compare-toggle" data-id="${p.id}" ${cmp ? 'checked' : ''}> Compare</label>
            <button class="heart ${saved ? 'on' : ''}" data-action="save-toggle" data-id="${p.id}" aria-label="${saved ? 'Remove from' : 'Save to'} my list" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button>
          </div>
        </div>
      </article>`;
  }

  function compareBar() {
    if (!S.compare.length) return '';
    return `<div class="compare-bar no-print"><span>${S.compare.length} selected to compare</span>
      <button class="btn small secondary" data-action="compare-clear">Clear</button>
      <a class="btn small" href="#/compare" ${S.compare.length < 2 ? 'aria-disabled="true"' : ''}>Compare${S.compare.length < 2 ? ' (pick 2+)' : ' now'} →</a></div>`;
  }

  /* ----------------------------------------------------------------- detail */
  const reviewsFor = id => S.reviews[id] || [];
  const avgReview = id => { const r = reviewsFor(id); return r.length ? r.reduce((a, b) => a + b.stars, 0) / r.length : null; };

  function payList(p) {
    const order = ['private', 'medicaid', 'medicare', 'va', 'ltc'];
    const sym = { yes: '✓', no: '✕', ask: '?', short: '½' };
    const note = (k, v) => {
      if (v === 'yes') return k === 'medicare' && p.kind === 'homecare' ? 'Yes, when a doctor orders skilled care' : 'Yes';
      if (v === 'no') return k === 'medicare' ? 'No. Medicare does not pay for long-term custodial care.' : 'No';
      if (v === 'short') return 'Short-term rehab only (up to 100 days after a hospital stay)';
      if (k === 'medicaid' && p.kind === 'facility') return 'Ask. Some assisted living accepts the Medicaid waiver.';
      return 'Ask. This information isn\'t public yet.';
    };
    const mine = S.intake.payment;
    return `<ul class="pay-list">${order.map(k => `<li><span class="pay-icon ${p.payment[k]}">${sym[p.payment[k]]}</span><span><b>${PAY_LABEL[k]}</b>${mine.includes(k) ? ' <span class="tag info">yours</span>' : ''}<br><span class="small muted">${note(k, p.payment[k])}</span></span></li>`).join('')}</ul>`;
  }

  function renderPlace(id) {
    const p = byId[id];
    if (!p) { app.innerHTML = '<div class="card empty"><h2>We couldn\'t find that place</h2><a class="btn" href="#/results">Back to matches</a></div>'; return; }
    const m = match(p), d = dist(p), saved = S.saved.includes(p.id), cmp = S.compare.includes(p.id);
    const isFac = p.kind === 'facility';

    const why = S.intakeDone ? `
      <div class="card full">
        <h2>Why this could fit ${lovedOne()} <span class="tag info" style="font-size:.9rem">${m.score}% match</span></h2>
        <div class="row">
          <div><b class="small">Good fit</b><ul style="margin:.25rem 0">${m.good.map(t => `<li>${esc(t)}</li>`).join('') || '<li class="muted">Nothing stands out yet</li>'}</ul></div>
          <div><b class="small">Things to ask about</b><ul style="margin:.25rem 0">${m.warn.map(t => `<li>${esc(t)}</li>`).join('') || '<li class="muted">No concerns from your answers</li>'}</ul></div>
        </div>
      </div>` : '';

    let ratingCard, safetyCard = '', dementiaCard = '', roomCard = '', extraCards = '';
    if (isFac && p.cms) {
      const c = p.cms, A = D.averages;
      const barRow = (label, v) => `<div class="bar-row"><span>${label}</span><div class="bar"><i style="width:${(v || 0) * 20}%"></i></div><b>${v ?? '–'}/5</b></div>`;
      const vs = (v, avg, lowerBetter, unit) => {
        if (v == null) return '<span class="muted">Not reported</span>';
        const better = lowerBetter ? v < avg : v > avg;
        return `${v}${unit} <span class="small ${better ? 'good-txt' : 'warn-txt'}">(${better ? 'better than' : 'worse than'} NE avg ${avg}${unit})</span>`;
      };
      ratingCard = `
        <div class="card"><h2>⭐ Rating</h2>
          <div class="rating-big">${c.overall != null ? stars(c.overall) : ''}<span><b>${c.overall ?? 'Not rated'}${c.overall ? ' out of 5' : ''}</b><br><span class="small muted">Medicare overall rating</span></span></div>
          <div class="bars">${barRow('Health inspections', c.inspection)}${barRow('Staffing', c.staffing)}${barRow('Quality of care', c.quality)}</div>
          ${c.overall == null ? '<p class="small muted" style="margin-top:.5rem">Medicare does not give star ratings to facilities on its watch list.</p>' : ''}
          <a class="small" href="${p.careCompare}" target="_blank" rel="noopener">See the full Medicare report ↗</a>
        </div>`;
      const alerts = [];
      const rs = recentSerious(p);
      if (c.sff) alerts.push('<div class="alert bad"><b>On Medicare\'s watch list (Special Focus Facility).</b> Medicare picked this nursing home for extra inspections because of a history of serious quality problems.</div>');
      else if (c.sffCandidate) alerts.push('<div class="alert bad"><b>Candidate for Medicare\'s watch list.</b> Its inspection history is among the worst in the state.</div>');
      if (c.abuse) alerts.push('<div class="alert bad"><b>Cited for abuse</b> in a recent inspection.</div>');
      if (rs.jeopardy) alerts.push('<div class="alert bad"><b>Recent "immediate jeopardy" citation:</b> inspectors found residents in serious danger. See inspection details below.</div>');
      else if (rs.harm) alerts.push('<div class="alert warn"><b>Recent citation where a resident was harmed.</b> See inspection details below.</div>');
      if (c.fines > 0) alerts.push(`<div class="alert warn"><b>${c.fines} federal fine${c.fines > 1 ? 's' : ''}</b> totaling $${fmt(c.fineDollars)} in the last 3 years.</div>`);
      if (!alerts.length) alerts.push('<div class="alert good">No federal fines, abuse citations, recent harm citations or watch list status on record.</div>');
      safetyCard = `
        <div class="card"><h2>🛡️ Is it safe?</h2>${alerts.join('')}
          <dl class="kv">
            <dt>Last inspection</dt><dd>${new Date(c.inspectionDate + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</dd>
            <dt>Problems found</dt><dd>${vs(c.deficiencies, AVG_DEF, true, '')}</dd>
            <dt>From complaints</dt><dd>${c.complaintDeficiencies ?? '–'}</dd>
          </dl>
          <a class="small" href="#inspections">Jump to inspection details ↓</a></div>`;
      const ap = p.quality.find(q => q.code === '481'), fl = p.quality.find(q => q.code === '410');
      dementiaCard = `<div class="card"><h2>🧠 Dementia care</h2>
        ${p.memoryCare === 'unit'
          ? `<div class="alert good"><b>Has a dementia / memory support unit.</b><br><span class="small">Source: ${esc(p.memorySource)}</span></div>`
          : '<div class="alert info">Not listed as having a dedicated memory unit. Most nursing homes still care for residents with dementia.</div>'}
        ${p.behavioral ? '<div class="alert good">Listed as able to <b>accommodate behavioral needs</b> (agitation, aggression).</div>' : ''}
        <dl class="kv">
          <dt>Antipsychotic use</dt><dd>${ap && ap.value != null ? vs(ap.value, ap.ne, true, '%') : 'Not reported'}</dd>
          <dt>Falls with injury</dt><dd>${fl && fl.value != null ? vs(fl.value, fl.ne, true, '%') : 'Not reported'}</dd>
        </dl>
        <p class="small muted" style="margin-top:.5rem">Ask: "Is the unit secured? How are staff trained in dementia care?"</p></div>`;
      roomCard = `<div class="card"><h2>🛏️ Is there room?</h2><p class="price-big">~${p.openings.est} of ${p.beds} beds</p><p class="small muted">${esc(p.openings.note)}</p></div>`;
      extraCards = staffingCard(p, vs) + ownerCard(p) + inspectionCard(p) + qualityCard(p);
    } else if (isFac) {
      ratingCard = `
        <div class="card"><h2>⭐ Rating</h2>
          <div class="rating-big">${p.rating.value != null ? stars(p.rating.value) : ''}<span><b>${p.rating.value != null ? p.rating.value + ' out of 5' : 'No reviews yet'}</b><br><span class="small muted">${p.rating.count ? `${p.rating.count} family review${p.rating.count > 1 ? 's' : ''} on Caring.com` : 'Caring.com'}</span></span></div>
          <p class="small muted">Assisted living and memory care are licensed by the state, not Medicare, so there are no federal star ratings. Nebraska DHHS inspects them, and their reports are available on request.</p>
        </div>`;
      safetyCard = `<div class="card"><h2>🛡️ Is it safe?</h2><div class="alert info">State inspection reports for assisted living aren't online in an easy format yet. In the full app we'd show them here.</div>
        <p class="small">Ask on your tour:</p><ul class="small" style="margin:0"><li>What did your last state inspection find?</li><li>How many staff are on the memory care floor at night?</li><li>How do you prevent and respond to falls?</li></ul></div>`;
      dementiaCard = `<div class="card"><h2>🧠 Dementia care</h2>${p.memoryCare === 'dedicated'
        ? '<div class="alert good"><b>Memory care only.</b> Every resident has dementia, and the building and staff are set up for it.</div>'
        : `<div class="alert good"><b>Has a memory care area</b>${p.memoryUnits ? ` with ${p.memoryUnits} apartments` : ''}, separate from regular assisted living.</div>`}
        <p class="small muted">Ask whether exits are secured, which matters if ${lovedOne()} wanders.</p></div>`;
      roomCard = `<div class="card"><h2>🛏️ Is there room?</h2><p><b>${p.beds ? `${p.beds} apartments total${p.memoryUnits && p.memoryUnits !== p.beds ? `, ${p.memoryUnits} for memory care` : ''}` : 'Small, home-like house'}.</b></p><p class="small muted">${esc(p.openings.note)}</p></div>`;
    } else {
      const avg = avgReview(p.id);
      ratingCard = `<div class="card"><h2>⭐ Rating</h2><div class="rating-big">${avg != null ? stars(avg) : ''}<span><b>${avg ? avg.toFixed(1) + ' out of 5' : 'No reviews yet'}</b><br><span class="small muted">From Find-A-Home families</span></span></div>
        <p class="small muted">Home care agencies aren't star-rated by Medicare. Reviews from families like you will appear here.</p></div>`;
      dementiaCard = `<div class="card"><h2>🧠 Specialties</h2>
        ${p.dementia ? '<div class="alert good">Advertises <b>Alzheimer\'s and dementia care</b> on its website.</div>' : p.type === 'medical' ? '<div class="alert info">Medical home health: nurses and therapists visit for care a doctor has ordered.</div>' : '<div class="alert warn">Ask whether caregivers have <b>dementia training</b>.</div>'}
        <ul style="margin:0">${p.services.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
      safetyCard = `<div class="card"><h2>🛡️ Questions to ask</h2><ul class="small" style="margin:0"><li>Are caregivers background-checked and bonded?</li><li>Will we have the same caregiver each visit?</li><li>What is the minimum number of hours per visit?</li><li>Is there a charge for the first in-home assessment?</li><li>What happens if a caregiver calls in sick?</li></ul></div>`;
    }

    const priceCard = `
      <div class="card"><h2>💲 Base price</h2>
        <p class="price-big">${priceText(p, true)}</p>
        <p class="small muted">${esc(p.priceNote)} Prices are subject to change.</p>
        ${isFac && S.intake.budget ? `<p class="small">Your budget: <b>$${fmt(S.intake.budget)}/mo</b></p>` : ''}
      </div>`;
    const payCard = `<div class="card"><h2>🧾 Insurance taken</h2>${payList(p)}</div>`;
    const bioCard = `<div class="card"><h2>📝 About</h2><p>${esc(p.bio)}</p></div>`;
    const contactCard = `
      <div class="card"><h2>📞 Contact</h2>
        <dl class="kv">
          ${isFac ? `<dt>Address</dt><dd>${esc(p.address)}</dd><dt>Distance</dt><dd>${d.toFixed(1)} miles from ${D.zips[S.intake.zip] ? esc(S.intake.zip) : 'downtown Lincoln'}</dd>` : `<dt>Serves</dt><dd>${esc(p.serviceArea)}</dd>`}
          <dt>Phone</dt><dd><a href="tel:${p.phone.replace(/\D/g, '')}">${esc(p.phone)}</a></dd>
          <dt>Website</dt><dd>${p.website ? `<a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.websiteLabel || p.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))} ↗</a>` : `<a href="https://www.google.com/search?q=${encodeURIComponent(p.name + ' ' + (p.city || 'Lincoln') + ' NE')}" target="_blank" rel="noopener">Find their website ↗</a> <span class="small muted">(not verified)</span>`}</dd>
        </dl>
        <div class="contact-row"><a class="btn small secondary" href="tel:${p.phone.replace(/\D/g, '')}">Call</a><a class="btn small secondary" href="${mapsUrl(p)}" target="_blank" rel="noopener">📍 Google Maps & photos</a></div>
      </div>`;
    const reviews = reviewsFor(p.id);
    const reviewCard = `
      <div class="card full"><h2>💬 Family reviews on Find-A-Home</h2>
        ${reviews.length ? reviews.map(r => `<div class="review">${stars(r.stars)} <b>${esc(r.name || 'A family member')}</b> <span class="small muted">· ${esc(r.date)}</span><p style="margin:.25rem 0 0">${esc(r.text)}</p></div>`).join('') : '<p class="muted">No reviews yet. Families who have used this place can share what it\'s really like.</p>'}
        <button class="btn secondary small" data-action="review" data-id="${p.id}">Write a review</button>
      </div>`;

    app.innerHTML = `
      <div class="back"><a href="#/results" class="btn ghost">← Back to matches</a></div>
      <div class="card detail-head">
        <div class="thumb">${icon(p.type, 120)}</div>
        <div><span class="tag info">${TYPE_LABEL[p.type]}</span><h1>${esc(p.name)}</h1>
          ${p.aka ? `<div class="small muted">Also known as ${esc(p.aka)}</div>` : ''}
          <div class="muted">${isFac ? `<a href="${mapsUrl(p)}" target="_blank" rel="noopener" title="Open in Google Maps">📍 ${esc(p.address)}</a> · ${d.toFixed(1)} mi` : esc(p.serviceArea)}</div></div>
        <div class="actions">
          <button class="btn" data-action="tour" data-id="${p.id}">${isFac ? '📅 Request a tour' : '📅 Request a free consult'}</button>
          <button class="btn secondary" data-action="save-toggle" data-id="${p.id}" aria-pressed="${saved}">${saved ? '♥ Saved' : '♡ Save'}</button>
          <button class="btn secondary" data-action="compare-toggle-btn" data-id="${p.id}" aria-pressed="${cmp}">${cmp ? '✓ Comparing' : '+ Compare'}</button>
        </div>
      </div>
      <div class="detail-grid">
        ${why}
        ${ratingCard}${bioCard}
        ${safetyCard}${payCard}
        ${dementiaCard}${priceCard}
        ${roomCard}${contactCard}
        ${extraCards}
        ${reviewCard}
      </div>
      <div class="sources"><b>Where this information comes from:</b><ul>${p.sources.map(s => `<li>${esc(s)}</li>`).join('')}</ul>Phone numbers and details can change, so please call to confirm.</div>
      ${compareBar()}`;
    const list = document.getElementById('insList');
    if (list) {
      const more = document.getElementById('insMore');
      if (more) more.addEventListener('click', () => { list.classList.remove('collapsed'); more.remove(); });
      app.querySelectorAll('[data-insfilter]').forEach(b => b.addEventListener('click', () => {
        app.querySelectorAll('[data-insfilter]').forEach(x => x.classList.toggle('active', x === b));
        const f = b.dataset.insfilter;
        if (f !== 'all') { list.classList.remove('collapsed'); if (more) more.remove(); }
        list.querySelectorAll('.ins').forEach(li => {
          const show = f === 'all' || (f === 'serious' && +li.dataset.level >= 3) || (f === 'dementia' && li.dataset.dementia === 'true') || (f === 'complaint' && li.dataset.complaint === 'true');
          li.hidden = !show;
        });
      }));
    }
    const jump = app.querySelector('a[href="#inspections"]');
    if (jump) jump.addEventListener('click', e => { e.preventDefault(); document.getElementById('inspections').scrollIntoView({ behavior: 'smooth' }); });
  }

  /* ------------------------------------------- nursing home detail sections */
  const SEV = { 1: ['sev1', 'Low risk'], 2: ['sev2', 'Could cause harm'], 3: ['sev3', 'Resident harmed'], 4: ['sev4', 'Serious danger'] };
  function staffingCard(p, vs) {
    const c = p.cms, A = D.averages;
    return `<div class="card"><h2>👩‍⚕️ Staffing</h2>
      <dl class="kv">
        <dt>Nurse time</dt><dd>${c.nurseHours != null ? vs(c.nurseHours, A.neNurseHours, false, ' hrs') : 'Not reported'}<br><span class="small muted">per resident, per day</span></dd>
        <dt>Registered nurse time</dt><dd>${c.rnHours != null ? Math.round(c.rnHours * 60) + ' min per resident, per day' : 'Not reported'}</dd>
        <dt>Weekend nurse time</dt><dd>${c.weekendHours != null ? c.weekendHours + ' hrs per resident' : 'Not reported'}</dd>
        <dt>Staff turnover</dt><dd>${c.turnover != null ? vs(c.turnover, A.neTurnover, true, '%') : 'Not reported'}<br><span class="small muted">of nursing staff leave each year</span></dd>
        <dt>Administrators who left</dt><dd>${c.adminLeft != null ? c.adminLeft + ' in the last year' : 'Not reported'}</dd>
        <dt>Family council</dt><dd>${c.familyCouncil ? 'Yes' : 'Not reported'}</dd>
      </dl>
      <p class="small muted" style="margin-top:.5rem">Low turnover often means residents see the same caregivers, which matters a lot with dementia.</p></div>`;
  }
  function ownerCard(p) {
    const o = p.owners, c = p.cms;
    const direct = o.direct.length ? o.direct.map(d => `<li><b>${esc(d.name)}</b>${d.pct ? ` (${esc(d.pct)})` : ''} <span class="small muted">since ${esc(d.since)}</span></li>`).join('') : `<li><b>${esc(o.legalName)}</b> <span class="small muted">(no separate owner listed)</span></li>`;
    const pens = p.penalties.length ? `<table class="mini"><thead><tr><th>Date</th><th>Penalty</th></tr></thead><tbody>${p.penalties.map(x => `<tr><td>${fmtDate(x.date)}</td><td>${x.type === 'Fine' ? `Fine: <b>$${fmt(x.amount || 0)}</b>` : `Medicare payments stopped${x.days ? ` for ${x.days} days` : ''}`}</td></tr>`).join('')}</tbody></table>`
      : '<div class="alert good" style="margin:0">No federal fines or payment denials in the last 3 years.</div>';
    return `<div class="card"><h2>🏢 Ownership & penalties</h2>
      ${o.changed12m ? '<div class="alert warn"><b>Changed owners in the last 12 months.</b> Ask what has changed for staff and residents.</div>' : ''}
      <dl class="kv">
        <dt>Type</dt><dd>${esc(o.type)}</dd>
        <dt>Legal name</dt><dd>${esc(o.legalName)}</dd>
      </dl>
      <p style="margin:.6rem 0 .2rem"><b class="small">Owned by</b></p><ul style="margin:0;padding-left:1.2rem" class="small">${direct}</ul>
      ${o.indirectCount ? `<p class="small muted" style="margin:.3rem 0 0">Plus ${o.indirectCount} parent compan${o.indirectCount > 1 ? 'ies or trusts' : 'y or trust'}${o.indirect.length ? ` (e.g. ${o.indirect.slice(0, 3).map(esc).join(', ')})` : ''}.</p>` : ''}
      ${o.operators.length ? `<p style="margin:.6rem 0 .2rem"><b class="small">Managed by</b></p><p class="small" style="margin:0">${o.operators.map(esc).join(', ')}</p>` : ''}
      <p style="margin:.8rem 0 .3rem"><b class="small">Penalties (last 3 years)</b></p>${pens}
    </div>`;
  }
  function inspectionCard(p) {
    const ins = p.inspections;
    if (!ins.length) return `<div class="card full" id="inspections"><h2>🔎 Inspection details</h2><div class="alert good">No problems cited in the last three inspections.</div></div>`;
    const dates = [...new Set(ins.map(i => i.date))];
    const serious = ins.filter(i => i.level >= 3).length, comp = ins.filter(i => i.complaint).length, dem = ins.filter(i => i.dementia).length;
    const rows = ins.map((i, n) => {
      const [cls, lbl] = SEV[i.level];
      return `<li class="ins ${n >= 10 ? 'more' : ''}" data-level="${i.level}" data-dementia="${i.dementia}" data-complaint="${i.complaint}">
        <span class="sev ${cls}" title="Severity code ${i.sev}">${lbl}</span>
        <div><b>${esc(i.title)}</b>
          <div class="small muted">${fmtDate(i.date)} · ${esc(i.category)} · affected ${esc(i.scope)}${i.complaint ? ' · <span class="tag warn">From a complaint</span>' : ''}${i.dementia ? ' <span class="tag info">Dementia-related</span>' : ''}${i.corrected ? ' · ✓ corrected' : ''}</div>
          <details><summary class="small">What the rule says</summary><p class="small" style="margin:.25rem 0 0">${esc(i.detail)} <span class="muted">(F${esc(i.tag)})</span></p></details>
        </div></li>`;
    }).join('');
    return `<div class="card full" id="inspections"><h2>🔎 Inspection details</h2>
      <p class="muted small" style="margin-top:-.25rem">Every problem state inspectors cited in the last ${dates.length > 1 ? 'three' : ''} inspection${dates.length > 1 ? 's' : ''} (${fmtDate(ins[ins.length - 1].date)} – ${fmtDate(ins[0].date)}), including complaint visits. The Nebraska average is about ${AVG_DEF} problems per inspection.</p>
      <div class="stat-row">
        <div class="stat"><b>${ins.length}</b><span>problems cited</span></div>
        <div class="stat ${serious ? 'bad' : 'good'}"><b>${serious}</b><span>resident harmed or in danger</span></div>
        <div class="stat"><b>${comp}</b><span>from complaints</span></div>
        <div class="stat"><b>${dem}</b><span>dementia-related</span></div>
      </div>
      <div class="chips-row" role="group" aria-label="Filter citations">
        <button class="chip active" data-insfilter="all">All</button>
        <button class="chip" data-insfilter="serious">Harm or danger (${serious})</button>
        <button class="chip" data-insfilter="dementia">Dementia-related (${dem})</button>
        <button class="chip" data-insfilter="complaint">From complaints (${comp})</button>
      </div>
      <ul class="ins-list collapsed" id="insList">${rows}</ul>
      ${ins.length > 10 ? `<button class="btn small secondary" id="insMore">Show all ${ins.length}</button>` : ''}
      <p class="small muted" style="margin-top:.75rem">"Dementia-related" covers falls and supervision, sedating drugs, dementia training and abuse or neglect.</p>
    </div>`;
  }
  function qualityCard(p) {
    const rows = p.quality.map(q => {
      if (q.value == null) return `<div class="qm-row"><span>${esc(q.label)}</span><span class="muted small">Not enough residents to report</span></div>`;
      const max = Math.max(q.value, q.ne, q.us, 1) * 1.15;
      const better = q.value <= q.ne;
      return `<div class="qm-row"><span>${esc(q.label)}</span>
        <div class="qm-bar" aria-label="${q.value}% here, Nebraska average ${q.ne}%">
          <i class="${better ? 'ok' : 'hi'}" style="width:${q.value / max * 100}%"></i>
          <em style="left:${q.ne / max * 100}%" title="Nebraska average ${q.ne}%"></em>
        </div>
        <b class="${better ? 'good-txt' : 'warn-txt'}">${q.value}%</b></div>`;
    }).join('');
    return `<div class="card full"><h2>📊 Quality of care for long-stay residents</h2>
      <p class="muted small" style="margin-top:-.25rem">Share of long-term residents affected over the past year. <b>Lower is better.</b> The black line marks the Nebraska average. Antipsychotic drugs are often overused to sedate people with dementia.</p>
      <div class="qm">${rows}</div>
      <p class="small muted">Source: Medicare Minimum Data Set quality measures.</p></div>`;
  }
  const fmtDate = d => new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  /* ---------------------------------------------------------------- compare */
  function renderCompare() {
    const items = S.compare.map(id => byId[id]).filter(Boolean);
    if (items.length < 2) {
      app.innerHTML = `<h1>Compare side by side</h1><div class="card empty"><p style="font-size:1.1rem">Pick 2 or 3 places to compare.<br>Tick <b>Compare</b> on any match.</p>
        ${items.length ? `<p>Selected so far: <b>${esc(items[0].name)}</b></p>` : ''}<a class="btn" href="#/results">Go to matches</a></div>`;
      return;
    }
    const rows = [
      ['Match for ' + LovedOne(), p => match(p).score, v => v + '%', 'max'],
      ['Type', p => TYPE_LABEL[p.type]],
      ['Distance', p => p.kind === 'facility' ? dist(p) : null, v => v == null ? 'Comes to you' : v.toFixed(1) + ' mi', 'min'],
      ['Rating', p => p.kind === 'facility' ? p.rating.value : avgReview(p.id), (v, p) => v == null ? '<span class="muted">No rating</span>' : `${stars(v)}<br><span class="small muted">${p.cms ? 'Medicare' : p.kind === 'facility' ? p.rating.count + ' reviews' : 'Find-A-Home'}</span>`, 'max'],
      ['Health inspection', p => p.cms ? p.cms.inspection : null, v => v == null ? '<span class="muted">Not federally rated</span>' : v + ' / 5', 'max'],
      ['Staffing', p => p.cms ? p.cms.staffing : null, v => v == null ? '<span class="muted">–</span>' : v + ' / 5', 'max'],
      ['Fines / warnings', p => p.cms ? p.cms.fines + (p.cms.sff ? 10 : 0) : null, (v, p) => !p.cms ? '<span class="muted">–</span>' : (p.cms.sff ? '<span class="tag bad">Watch list</span> ' : '') + (p.cms.fines ? `${p.cms.fines} fine(s), $${fmt(p.cms.fineDollars)}` : 'None'), 'min'],
      ['Dementia care', p => p.kind === 'facility' ? { dedicated: 'Memory care only', unit: p.type === 'nursing' ? '✓ Has dementia unit' : `Memory care area${p.memoryUnits ? ` (${p.memoryUnits})` : ''}`, ask: 'No dementia unit listed' }[p.memoryCare] : (p.dementia ? 'Advertises dementia care' : 'Ask')],
      ['Serious citations (3 yrs)', p => p.cms ? seriousCount(p) : null, v => v == null ? '<span class="muted">Not federally inspected</span>' : (v ? `<span class="tag bad">${v}</span> resident harmed or in danger` : 'None'), 'min'],
      ['Antipsychotic use', p => { const q = (p.quality || []).find(q => q.code === '481'); return q && q.value != null ? q.value : null; }, (v, p) => v == null ? '<span class="muted">' + (p.cms ? 'Not reported' : 'Not federally reported') + '</span>' : v + '%', 'min'],
      ['Falls with injury', p => { const q = (p.quality || []).find(q => q.code === '410'); return q && q.value != null ? q.value : null; }, (v, p) => v == null ? '<span class="muted">' + (p.cms ? 'Not reported' : 'Not federally reported') + '</span>' : v + '%', 'min'],
      ['Staff turnover', p => p.cms ? p.cms.turnover : null, v => v == null ? '<span class="muted">–</span>' : v + '% / yr', 'min'],
      ['Owner type', p => p.cms ? p.cms.ownership + (p.owners.changed12m ? ' <span class="tag warn">new owner</span>' : '') : '<span class="muted">–</span>'],
      ['Medicaid', p => ({ yes: '✓ Accepts', no: '✕ No', ask: '? Ask' })[p.payment.medicaid]],
      ['Price', p => knownPrice(p) ?? (p.kind === 'homecare' ? p.priceLow * 120 : null), (v, p) => priceText(p, true), 'min'],
      ['Open beds (est.)', p => p.openings ? p.openings.est : null, v => v == null ? '<span class="muted">Ask</span>' : '~' + v, 'max'],
      ['Phone', p => `<a href="tel:${p.phone.replace(/\D/g, '')}">${esc(p.phone)}</a>`],
      ['Map', p => `<a href="${mapsUrl(p)}" target="_blank" rel="noopener">📍 Google Maps ↗</a>`]
    ];
    const body = rows.map(([label, get, show, best]) => {
      const vals = items.map(get);
      let bestIdx = -1;
      if (best) {
        const nums = vals.map((v, i) => [v, i]).filter(([v]) => typeof v === 'number');
        if (nums.length > 1) {
          const target = best === 'max' ? Math.max(...nums.map(n => n[0])) : Math.min(...nums.map(n => n[0]));
          const winners = nums.filter(n => n[0] === target);
          if (winners.length === 1) bestIdx = winners[0][1];
        }
      }
      return `<tr><th scope="row">${label}</th>${vals.map((v, i) => `<td class="${i === bestIdx ? 'best' : ''}">${show ? show(v, items[i]) : v}</td>`).join('')}</tr>`;
    }).join('');
    app.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin-bottom:1rem">
        <div><h1 style="margin:0">Compare side by side</h1><p class="muted" style="margin:0">Green marks the best value in each row.</p></div>
        <div class="no-print" style="display:flex;gap:.5rem"><button class="btn secondary" onclick="window.print()">🖨️ Print</button><a class="btn secondary" href="#/results">+ Add another</a></div>
      </div>
      <div class="compare-wrap"><table class="compare">
        <thead><tr><th></th>${items.map(p => `<th scope="col">${icon(p.type, 44)}<br><a href="#/place/${p.id}">${esc(p.name)}</a></th>`).join('')}</tr></thead>
        <tbody>${body}
          <tr class="no-print"><th></th>${items.map(p => `<td><button class="btn small" data-action="tour" data-id="${p.id}">Request ${p.kind === 'facility' ? 'tour' : 'consult'}</button><br><button class="linkbtn small" data-action="compare-remove" data-id="${p.id}" style="margin-top:.4rem">Remove</button></td>`).join('')}</tr>
        </tbody></table></div>
      ${tourChecklistBox()}`;
  }

  /* ------------------------------------------------------------ tour / list */
  const TOUR_QS = [
    'Do you have a secured (locked) memory care unit?', 'How many staff are on duty during the day? At night?',
    'What dementia training do caregivers get?', 'What did your last state inspection find?',
    'Do you accept our payment type? What happens if we run out of savings?', 'What is included in the base price, and what costs extra?',
    'Is there a waitlist? How long is it?', 'How do you handle wandering, falls and agitation?',
    'Can we visit any time? Can family join meals?', 'What activities are there for people with memory loss?',
    'When would residents need to move to a higher level of care?', 'Watch: are residents engaged, clean and calm? Do staff know them by name?'
  ];
  function tourChecklistBox() {
    return `<details class="card" style="margin-top:1.25rem"><summary style="cursor:pointer;font-weight:700">📋 Tour checklist: questions to ask</summary>
      <ul class="checklist" style="margin-top:.75rem">${TOUR_QS.map((q, i) => `<li><label><input type="checkbox"> ${esc(q)}</label></li>`).join('')}</ul></details>`;
  }

  function openTour(id) {
    const p = byId[id]; if (!p) return;
    const isFac = p.kind === 'facility';
    const pays = S.intake.payment.filter(x => PAY_LABEL[x]);
    const today = new Date().toISOString().slice(0, 10);
    openModal(`
      <div class="modal-head"><div><h2 style="margin:0">${isFac ? 'Request a tour' : 'Request a free consultation'}</h2><p class="muted" style="margin:0">${esc(p.name)}</p></div><button class="close-x" data-close aria-label="Close">×</button></div>
      <form id="tourForm">
        <div class="row">
          <div class="field"><label for="t-d1">Preferred day</label><input id="t-d1" type="date" min="${today}" required></div>
          <div class="field"><label for="t-time">Time of day</label><select id="t-time"><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div>
        </div>
        ${isFac ? `<div class="field"><label>Will ${lovedOne()} come along?<span class="hint">Many families told us seeing how their loved one reacts helped them decide.</span></label>
          <div class="choice-grid">${[['yes', 'Yes'], ['no', 'No, family only'], ['unsure', 'Not sure yet']].map(([v, t], i) => `<label class="choice"><input type="radio" name="t-with" value="${v}" ${i === 2 ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>` : ''}
        <div class="field"><label for="t-contact">Best phone or email to reach you</label><input id="t-contact" type="text" placeholder="(402) 555-0123" required></div>
        <div class="field"><label class="choice" style="font-weight:500"><input type="checkbox" id="t-pay" checked><span>Ask them to confirm they accept ${pays.length ? '<b>' + pays.map(x => PAY_LABEL[x]).join(', ') + '</b>' : 'our payment type'} before the tour</span></label></div>
        ${isFac ? `<div class="field"><label class="choice" style="font-weight:500"><input type="checkbox" id="t-wait" checked><span>If they're full, add us to the waitlist and show me my next best match</span></label></div>` : ''}
        <div class="field"><label for="t-notes">Anything they should know? <span class="hint">Optional</span></label><textarea id="t-notes" rows="2" placeholder="e.g. Dad uses a walker and gets anxious in the evenings"></textarea></div>
        <p class="small muted">Prototype: nothing is sent to the facility.</p>
        <div style="display:flex;justify-content:flex-end;gap:.5rem"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn" type="submit">Send request</button></div>
      </form>`, modal => {
      modal.querySelector('#tourForm').addEventListener('submit', e => {
        e.preventDefault();
        const t = {
          id, date: modal.querySelector('#t-d1').value, time: modal.querySelector('#t-time').value,
          withLoved: (modal.querySelector('[name=t-with]:checked') || {}).value || '',
          waitlist: !!(modal.querySelector('#t-wait') || {}).checked, status: 'pending', created: Date.now()
        };
        S.tours = S.tours.filter(x => x.id !== id).concat(t);
        if (!S.saved.includes(id)) S.saved.push(id);
        save();
        openModal(`
          <div class="modal-head"><h2 style="margin:0">✅ Request sent</h2><button class="close-x" data-close aria-label="Close">×</button></div>
          <p><b>${esc(p.name)}</b> will be asked to confirm <b>${new Date(t.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</b> (${t.time.toLowerCase()}). You can follow it in <a href="#/list">My list</a>.</p>
          ${isFac ? `<h3>Bring this checklist</h3><ul class="checklist">${TOUR_QS.slice(0, 8).map(q => `<li><label><input type="checkbox"> ${esc(q)}</label></li>`).join('')}</ul>` : ''}
          <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><a class="btn secondary" href="#/next-steps">See next steps</a><a class="btn" href="#/list">Go to my list</a></div>`);
      });
    });
  }

  function nextBest(excludeId) {
    const p = byId[excludeId];
    const pool = (p.kind === 'facility' ? D.facilities : D.homecare).filter(x => x.id !== excludeId && !S.tours.some(t => t.id === x.id));
    return pool.map(x => ({ x, s: match(x).score })).sort((a, b) => b.s - a.s)[0]?.x;
  }

  function renderList() {
    const saved = S.saved.map(id => byId[id]).filter(Boolean);
    const STATUS = {
      pending: ['warn', 'Waiting for them to confirm'], confirmed: ['good', 'Tour confirmed'],
      waitlist: ['warn', 'Full: on waitlist'], declined: ['bad', 'Full: declined'], chosen: ['good', 'Chosen! 🎉'], notfit: ['', 'Not a fit']
    };
    const tours = S.tours.map(t => {
      const p = byId[t.id]; if (!p) return '';
      const [cls, label] = STATUS[t.status];
      let actions = '';
      if (t.status === 'pending') actions = `<span class="small muted">Demo: simulate the facility's reply →</span>
        <button class="btn small secondary" data-action="tour-status" data-id="${t.id}" data-status="confirmed">Confirmed</button>
        <button class="btn small secondary" data-action="tour-status" data-id="${t.id}" data-status="${t.waitlist ? 'waitlist' : 'declined'}">No openings</button>`;
      else if (t.status === 'confirmed') actions = `<span class="small muted">After the tour:</span>
        <button class="btn small" data-action="choose" data-id="${t.id}">It's a good fit, choose it</button>
        <button class="btn small secondary" data-action="tour-status" data-id="${t.id}" data-status="notfit">Not a fit</button>`;
      else if (t.status === 'waitlist' || t.status === 'declined' || t.status === 'notfit') {
        const nb = nextBest(t.id);
        actions = nb ? `<span class="small">Next best match: <a href="#/place/${nb.id}"><b>${esc(nb.name)}</b></a> (${match(nb).score}%)</span> <button class="btn small" data-action="tour" data-id="${nb.id}">Request ${nb.kind === 'facility' ? 'tour' : 'consult'}</button>` : '';
      } else if (t.status === 'chosen') actions = `<span class="small">We'll remind you to review ${esc(p.name)} after 30 days. <button class="linkbtn" data-action="review" data-id="${p.id}">Write a review now</button></span>`;
      return `<div class="card" style="margin-bottom:.75rem"><div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
        ${icon(p.type, 52)}<div style="flex:1;min-width:200px"><b><a href="#/place/${p.id}">${esc(p.name)}</a></b><br><span class="small muted">${t.date ? new Date(t.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + t.time.toLowerCase() : ''}${t.withLoved === 'yes' ? ' · with ' + lovedOne() : ''}</span></div>
        <span class="tag ${cls}">${label}</span></div>
        ${actions ? `<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-top:.75rem">${actions}</div>` : ''}</div>`;
    }).join('');
    app.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin-bottom:1rem">
        <div><h1 style="margin:0">My list</h1><p class="muted" style="margin:0">Places you saved and tours you requested.</p></div>
        ${saved.length ? '<button class="btn" data-action="share">👪 Share with family</button>' : ''}
      </div>
      ${S.chosen ? `<div class="alert good" style="font-size:1.05rem">🎉 You chose <b>${esc(byId[S.chosen]?.name || '')}</b> for ${lovedOne()}. See <a href="#/next-steps">next steps</a> for moving in.</div>` : ''}
      <h2>Tours & consultations</h2>
      ${tours || '<div class="card empty" style="padding:1.25rem">No requests yet. Open a match and tap <b>Request a tour</b>.</div>'}
      <h2 style="margin-top:1.5rem">Saved places</h2>
      ${saved.length ? `<div class="match-list">${saved.map(p => card(p, match(p), dist(p))).join('')}</div>` : '<div class="card empty" style="padding:1.25rem">Tap ♡ on any match to save it here.</div>'}
      ${compareBar()}`;
  }

  function shareList() {
    const saved = S.saved.map(id => byId[id]).filter(Boolean);
    const text = `Care options for ${S.intake.lovedOne || 'our loved one'} (from Find-A-Home):\n\n` + saved.map(p =>
      `• ${p.name}: ${TYPE_LABEL[p.type]}, ${priceText(p, true)}${p.kind === 'facility' ? ', ' + p.address : ''}, ${p.phone}`).join('\n') +
      `\n\nWhat do you think? ${S.intake.name ? '– ' + S.intake.name : ''}`;
    openModal(`
      <div class="modal-head"><h2 style="margin:0">Share with family</h2><button class="close-x" data-close aria-label="Close">×</button></div>
      <p class="muted">Many families we talked to make this decision together. Send your list to siblings, a spouse or a social worker.</p>
      <textarea id="shareText" rows="9" style="font-size:.9rem">${esc(text)}</textarea>
      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem;flex-wrap:wrap">
        <a class="btn secondary" href="mailto:?subject=${encodeURIComponent('Care options for ' + (S.intake.lovedOne || 'our loved one'))}&body=${encodeURIComponent(text)}">✉️ Email</a>
        <a class="btn secondary" href="sms:?&body=${encodeURIComponent(text)}">💬 Text</a>
        <button class="btn" id="copyBtn">📋 Copy</button></div>`, modal => {
      modal.querySelector('#copyBtn').addEventListener('click', () => {
        const ta = modal.querySelector('#shareText'); ta.select();
        (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => toast('Copied! Paste it into a text or email.'), () => { document.execCommand('copy'); toast('Copied!'); });
      });
    });
  }

  function openReview(id) {
    const p = byId[id];
    openModal(`
      <div class="modal-head"><div><h2 style="margin:0">Write a review</h2><p class="muted" style="margin:0">${esc(p.name)}</p></div><button class="close-x" data-close aria-label="Close">×</button></div>
      <form id="revForm">
        <div class="field"><label>Your rating</label><div id="starPick" style="font-size:2.2rem;cursor:pointer" class="stars" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map(n => `<span data-star="${n}" role="radio" tabindex="0" aria-label="${n} stars" class="off">★</span>`).join('')}</div></div>
        <div class="field"><label for="r-name">Your first name <span class="hint">Optional</span></label><input id="r-name" type="text" value="${esc(S.intake.name)}"></div>
        <div class="field"><label for="r-text">What should other families know?</label><textarea id="r-text" rows="4" required placeholder="Staff, safety, communication, how your loved one is doing…"></textarea></div>
        <div style="display:flex;justify-content:flex-end;gap:.5rem"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn" type="submit">Post review</button></div>
      </form>`, modal => {
      let val = 0;
      const paint = n => modal.querySelectorAll('[data-star]').forEach(s => s.classList.toggle('off', +s.dataset.star > n));
      modal.querySelectorAll('[data-star]').forEach(s => {
        s.addEventListener('click', () => { val = +s.dataset.star; paint(val); });
        s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); val = +s.dataset.star; paint(val); } });
      });
      modal.querySelector('#revForm').addEventListener('submit', e => {
        e.preventDefault();
        if (!val) { toast('Please choose a star rating'); return; }
        (S.reviews[id] = S.reviews[id] || []).unshift({ stars: val, name: modal.querySelector('#r-name').value.trim(), text: modal.querySelector('#r-text').value.trim(), date: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) });
        save(); closeModal(); toast('Thanks! Your review helps other families.'); route();
      });
    });
  }

  function openRateApp() {
    openModal(`
      <div class="modal-head"><h2 style="margin:0">🎉 Congratulations!</h2><button class="close-x" data-close aria-label="Close">×</button></div>
      <p>Finding the right place is a big step. How did Find-A-Home do?</p>
      <div style="font-size:2.4rem;text-align:center" class="stars" id="appStars">${[1, 2, 3, 4, 5].map(n => `<span data-s="${n}" class="off" style="cursor:pointer" role="button" tabindex="0" aria-label="${n} stars">★</span>`).join('')}</div>
      <div class="field" style="margin-top:1rem"><label for="appFb">What would have made this easier? <span class="hint">Optional</span></label><textarea id="appFb" rows="3"></textarea></div>
      <div style="display:flex;justify-content:flex-end;gap:.5rem"><button class="btn secondary" data-close>Skip</button><button class="btn" id="appRateSend">Send</button></div>`, modal => {
      let v = 0;
      modal.querySelectorAll('[data-s]').forEach(s => s.addEventListener('click', () => { v = +s.dataset.s; modal.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('off', +x.dataset.s > v)); }));
      modal.querySelector('#appRateSend').addEventListener('click', () => { S.appRating = { stars: v, text: modal.querySelector('#appFb').value }; save(); closeModal(); toast('Thank you for the feedback!'); });
    });
  }

  /* ------------------------------------------------------------------ guide */
  const GUIDE = [
    { t: 'Get the diagnosis in writing', b: `Ask ${'{lo}'}'s doctor for a written diagnosis and a short summary of daily care needs. Memory care communities and Medicaid usually ask for it.`,
      more: ['Ask the doctor: "What stage is this, and what level of care do you recommend?"', 'Request a copy of the medication list.', 'If you\'re not the decision-maker yet, ask about power of attorney (healthcare and financial).'] },
    { t: 'Figure out how you\'ll pay', b: 'Most long-term dementia care is paid privately until savings run low. Then Medicaid may help.',
      more: ['<b>Medicare</b> pays only for short-term skilled nursing or rehab (up to 100 days after a qualifying hospital stay). It does not pay for long-term memory care. <a href="https://www.medicare.gov/coverage/skilled-nursing-facility-snf-care" target="_blank" rel="noopener">Medicare SNF coverage</a>',
        '<b>Nebraska Medicaid</b> covers nursing homes once assets are spent down. Its Aged & Disabled waiver can help with assisted living or in-home care. Apply through <a href="https://iserve.nebraska.gov" target="_blank" rel="noopener">iServe Nebraska</a>. Approval can take a month or more, so start early.',
        '<b>VA:</b> veterans and surviving spouses may qualify for <a href="https://www.va.gov/pension/aid-attendance-housebound/" target="_blank" rel="noopener">Aid & Attendance</a>.',
        '<b>Long-term care insurance:</b> call the insurer to start a claim and ask about the waiting period.'] },
    { t: 'Choose the type of care', b: 'Match the level of care to what your loved one needs now, and soon.',
      more: ['<b>In-home care:</b> caregivers come to the house for a few hours a day up to 24/7. Best in early stages, or when family lives nearby.', '<b>Assisted living:</b> an apartment with meals and help with daily tasks. Not always secured.', '<b>Memory care:</b> a secured, dementia-focused setting with trained staff. Good for wandering or confusion.', '<b>Nursing home:</b> 24-hour nursing for heavy medical needs. Rated by Medicare.'],
      link: ['#/results', 'See matches'] },
    { t: 'Shortlist and compare 2–3 places', b: 'Check safety first, then cost, distance and openings.', more: ['Use Compare to see places side by side.', 'Check Medicare inspection results for nursing homes.', 'Call to ask about openings and waitlists before you tour.'], link: ['#/compare', 'Open compare'] },
    { t: 'Tour, and bring your loved one if you can', b: 'Visit at a mealtime if possible. Watch how staff treat residents.', more: ['Bring the tour checklist.', 'Visit twice: once scheduled, once drop-in.', 'Ask for their latest state inspection report.'], checklist: true },
    { t: 'Apply and complete the assessments', b: 'The facility will do its own care assessment before move-in.', more: ['Nursing homes that take Medicaid must do a pre-admission screening (PASRR).', 'Medicaid also needs a level-of-care assessment.', 'Gather: photo ID, insurance and Medicare cards, power of attorney, medication list and doctor\'s orders.'] },
    { t: 'Plan the move', b: 'Familiar things help a lot with the change.', more: ['Bring photos, a favorite chair and blanket, and label clothing.', 'Share their routines, likes and triggers with staff.', 'Ask staff about the best visiting schedule for the first few weeks.'] },
    { t: 'After the move: check in', b: 'Dementia changes over time. Needs may change too.', more: ['Attend care plan meetings (usually every 3 months).', 'If things aren\'t right, contact the Long-Term Care Ombudsman through Aging Partners (402-441-7070).', 'Leave a review after about 30 days to help other families.', 'If needs change (for example, wandering starts), come back and update your answers.'] }
  ];
  function renderGuide() {
    const done = GUIDE.filter((_, i) => S.guide[i]).length;
    app.innerHTML = `
      <div style="max-width:860px;margin:0 auto">
        <h1>What to do next</h1>
        <p class="muted" style="font-size:1.05rem">A step-by-step plan for placing ${lovedOne()} in care. Check off steps as you go. Your progress is saved on this device.</p>
        <div class="progress" aria-label="${done} of ${GUIDE.length} steps done"><i style="width:${done / GUIDE.length * 100}%"></i></div>
        ${GUIDE.map((g, i) => `
          <div class="card guide-step ${S.guide[i] ? 'done' : ''}">
            <div class="num">${S.guide[i] ? '✓' : i + 1}</div>
            <div>
              <h3>${esc(g.t)}</h3><p style="margin-bottom:.4rem">${g.b.replace('{lo}', lovedOne())}</p>
              <details><summary>Show details</summary><ul>${g.more.map(m => `<li>${m}</li>`).join('')}</ul>
                ${g.checklist ? `<ul class="checklist">${TOUR_QS.map(q => `<li><label><input type="checkbox"> ${esc(q)}</label></li>`).join('')}</ul>` : ''}
              </details>
              <div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap">
                <button class="btn small ${S.guide[i] ? 'secondary' : ''}" data-action="guide-toggle" data-i="${i}">${S.guide[i] ? 'Undo' : 'Mark done'}</button>
                ${g.link ? `<a class="btn small secondary" href="${g.link[0]}">${g.link[1]}</a>` : ''}
              </div>
            </div>
          </div>`).join('')}
        <h2 style="margin-top:2rem">Local help (free)</h2>
        <div class="help-grid">
          <div class="card"><h3>Aging Partners</h3><p class="small">Lincoln's Area Agency on Aging: care management, Medicaid help and caregiver support.</p><a href="tel:4024417070">402-441-7070</a></div>
          <div class="card"><h3>Alzheimer's Association</h3><p class="small">24/7 helpline with dementia care consultants, plus support groups in Lincoln.</p><a href="tel:18002723900">1-800-272-3900</a></div>
          <div class="card"><h3>Medicare Care Compare</h3><p class="small">Official ratings and inspection reports for every nursing home.</p><a href="https://www.medicare.gov/care-compare/" target="_blank" rel="noopener">medicare.gov/care-compare</a></div>
        </div>
      </div>`;
  }

  /* --------------------------------------------------------------- sources */
  function showSources() {
    openModal(`
      <div class="modal-head"><h2 style="margin:0">About the data</h2><button class="close-x" data-close aria-label="Close">×</button></div>
      <p>This prototype uses <b>real Lincoln, NE providers</b> and public data collected in ${esc(D.dataDate)}:</p>
      <ul>
        <li><b>Nursing homes (52, Lincoln + Omaha metro):</b> Medicare / CMS Care Compare Provider Data (processed Oct 1, 2026). Includes star ratings, every inspection citation from the last 3 inspections, fines and payment denials, owners, staffing and dementia-related quality measures, compared with Nebraska averages.</li>
        <li><b>Dementia units, behavioral care & VA contracts:</b> official county lists from Lincoln Aging Partners (Mar 2024) and the Eastern Nebraska Office on Aging (Sep 2025).</li>
        <li><b>Websites:</b> checked one by one. If we couldn't confirm a site, the app shows a search link instead.</li>
        <li><b>Assisted living & memory care (17):</b> City of Lincoln Aging Partners licensed assisted living list (Apr 2020), with starting prices and family review ratings from Caring.com and Seniorly.</li>
        <li><b>Home care (10):</b> Aging Partners Community Home Health Care list (updated Jul 2026) and agency websites.</li>
        <li><b>Estimated prices:</b> nursing home costs use the 2024 CareScout Nebraska average. Home care uses published Lincoln agency rates.</li>
        <li><b>Estimated open beds:</b> certified beds minus average daily residents (CMS). This is a rough guide, not a guarantee.</li>
        <li><b>Distances:</b> straight-line miles from the center of your ZIP code (US Census).</li>
      </ul>
      <p class="small muted">"Ask" means the information isn't public. In the real product, facilities would claim their listing and keep openings and prices current. Facilities can't pay for placement, so rankings are based only on fit.</p>
      <div style="text-align:right"><button class="btn" data-close>Got it</button></div>`);
  }

  /* --------------------------------------------------------- global clicks */
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-action]');
    if (a) {
      const id = a.dataset.id, act = a.dataset.action;
      switch (act) {
        case 'mode': S.mode = a.dataset.mode; save(); renderResults(); return;
        case 'view': S.view = a.dataset.view; save(); renderResults(); return;
        case 'reset-filters': S.filters = defaultFilters(); save(); renderResults(); return;
        case 'edit-intake': S.step = 1; save(); go('#/welcome'); return;
        case 'skip-intake': S.intakeDone = false; save(); go('#/results'); return;
        case 'intake-back': readIntake(); S.step--; save(); renderWelcome(); return;
        case 'save-toggle': {
          e.stopPropagation();
          const on = !S.saved.includes(id);
          S.saved = on ? [...S.saved, id] : S.saved.filter(x => x !== id);
          save(); toast(on ? 'Saved to My list' : 'Removed from My list'); route(); return;
        }
        case 'compare-toggle': case 'compare-toggle-btn': {
          e.stopPropagation();
          const on = !S.compare.includes(id);
          if (on && S.compare.length >= 3) { toast('You can compare up to 3 at a time'); if (a.type === 'checkbox') a.checked = false; return; }
          S.compare = on ? [...S.compare, id] : S.compare.filter(x => x !== id);
          save(); route(); return;
        }
        case 'compare-remove': S.compare = S.compare.filter(x => x !== id); save(); route(); return;
        case 'compare-clear': S.compare = []; save(); route(); return;
        case 'tour': openTour(id); return;
        case 'tour-status': {
          const t = S.tours.find(x => x.id === id); if (t) t.status = a.dataset.status; save(); renderList(); return;
        }
        case 'choose': {
          const t = S.tours.find(x => x.id === id); if (t) t.status = 'chosen';
          S.chosen = id; save(); renderList(); openRateApp(); return;
        }
        case 'share': shareList(); return;
        case 'review': openReview(id); return;
        case 'guide-toggle': S.guide[a.dataset.i] = !S.guide[a.dataset.i]; save(); renderGuide(); return;
        case 'sources': showSources(); return;
        case 'reset':
          if (confirm('Clear your answers, saved places and tours, and start over?')) { localStorage.removeItem(STORE); S = defaults(); updateCounts(); go('#/welcome'); }
          return;
      }
    }
    if (e.target.closest('[data-stop]')) return;
    if (e.target.closest('a,button,input,label')) return;
    const mc = e.target.closest('[data-maps]');
    if (mc) { openMaps(byId[mc.dataset.maps]); return; }
    const c = e.target.closest('[data-open]');
    if (c) go('#/place/' + c.dataset.open);
  });
  document.addEventListener('keydown', e => {
    const c = e.target.closest && e.target.closest('[data-open],[data-maps]');
    if (c && e.target === c && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (c.dataset.maps) openMaps(byId[c.dataset.maps]); else go('#/place/' + c.dataset.open);
    }
  });

  /* ------------------------------------------------- expose for assistant */
  window.FAH = {
    get state() { return S; }, byId, match, dist, priceText, TYPE_LABEL, lovedOne: () => S.intake.lovedOne.trim(),
    currentPlace() { const m = location.hash.match(/^#\/place\/(.+)$/); return m ? byId[decodeURIComponent(m[1])] : null; },
    topMatches(n) { return filtered(S.mode).slice(0, n); }, go
  };

  updateCounts();
  route();
})();
