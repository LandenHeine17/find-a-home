/* Care Guide – a SCRIPTED demo assistant (no AI service is called).
   It matches keywords to pre-written answers so testers can react to the idea of
   a built-in helper. It also uses the page you're on and your intake answers. */
(function () {
  'use strict';
  const fab = document.getElementById('assistantFab');
  const panel = document.getElementById('assistantPanel');
  const F = () => window.FAH;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lo = () => (F().lovedOne() || 'your loved one');
  let opened = false;

  panel.innerHTML = `
    <div class="assistant-head"><div><b>Care Guide</b><small>Demo assistant · scripted answers</small></div>
      <button class="close-x" id="asstClose" aria-label="Close assistant">×</button></div>
    <div class="assistant-log" id="asstLog" aria-live="polite"></div>
    <div class="chips" id="asstChips"></div>
    <form class="assistant-form" id="asstForm"><input id="asstInput" type="text" placeholder="Ask a question…" aria-label="Ask a question" autocomplete="off"><button class="btn" type="submit">Send</button></form>`;
  const log = panel.querySelector('#asstLog');
  const chips = panel.querySelector('#asstChips');
  const input = panel.querySelector('#asstInput');

  function add(text, who) {
    const d = document.createElement('div');
    d.className = 'msg ' + who;
    if (who === 'bot') d.innerHTML = text; else d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  function botSay(html) {
    const t = document.createElement('div');
    t.className = 'msg bot typing'; t.textContent = 'Care Guide is typing…';
    log.appendChild(t); log.scrollTop = log.scrollHeight;
    setTimeout(() => { t.remove(); add(html, 'bot'); }, 550);
  }

  function suggestions() {
    const p = F().currentPlace();
    const base = p
      ? ['Tell me about this place', 'What should I ask on the tour?', 'Will Medicaid pay?']
      : ['Which places fit best?', 'Assisted living vs memory care?', 'Will Medicaid pay?', 'How do I know a place is safe?'];
    const extra = ['They don\'t want to move', 'I\'m overwhelmed'];
    chips.innerHTML = [...base, ...extra].map(s => `<button type="button" class="chip">${esc(s)}</button>`).join('');
  }
  chips.addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) ask(c.textContent); });

  function placeSummary(p) {
    const m = F().match(p);
    let s = `<b>${esc(p.name)}</b> is a ${F().TYPE_LABEL[p.type].toLowerCase()}`;
    if (p.kind === 'facility') s += ` about ${F().dist(p).toFixed(1)} miles away`;
    s += '.\n\n';
    if (p.cms) {
      const c = p.cms;
      s += c.overall ? `Medicare rates it <b>${c.overall} of 5 stars</b> (inspections ${c.inspection}, staffing ${c.staffing}, quality ${c.quality}). ` : 'Medicare does not star-rate it right now. ';
      if (c.sff) s += '⚠️ It is on Medicare\'s <b>watch list</b> for serious quality problems. ';
      if (c.fines) s += `It has had ${c.fines} federal fine(s) in the last 3 years. `;
      if (c.sffCandidate) s += '⚠️ It is a <b>candidate</b> for Medicare\'s watch list. ';
      const serious = (p.inspections || []).filter(i => i.level >= 3).length;
      s += serious ? `Inspectors cited <b>${serious}</b> problem(s) where a resident was harmed or in danger in the last 3 inspections. ` : 'No citations for harming residents in the last 3 inspections. ';
      if (p.memoryCare === 'unit') s += 'It has a <b>dementia / memory support unit</b>. ';
      const ap = (p.quality || []).find(q => q.code === '481');
      if (ap && ap.value != null) s += `About ${ap.value}% of long-stay residents get antipsychotic drugs (Nebraska average ${ap.ne}%). `;
      s += '\n\n';
    } else if (p.rating && p.rating.value) {
      s += `Families rate it <b>${p.rating.value}★</b> (${p.rating.count} reviews on Caring.com).\n\n`;
    }
    if (F().state.intakeDone) {
      s += `For ${esc(lo())}, it's a <b>${m.score}% match</b>.`;
      if (m.good.length) s += ` Pluses: ${m.good.slice(0, 3).map(esc).join('; ')}.`;
      if (m.warn.length) s += ` Ask about: ${m.warn.slice(0, 2).map(esc).join('; ')}.`;
    }
    s += `\n\n<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ', ' + (p.address || 'Lincoln NE'))}" target="_blank" rel="noopener">📍 See it on Google Maps</a>`;
    return s;
  }

  const INTENTS = [
    { k: /(this place|about (this|it)|tell me about|is (this|it) (good|any good)|should (we|i) pick)/, a: () => {
      const p = F().currentPlace();
      return p ? placeSummary(p) : 'Open any match and ask me again. I\'ll summarize its ratings, safety record and how well it fits.';
    } },
    { k: /(don.t want|doesn.t want|refuse|won.t go|angry|thinks? (they|she|he).*(fine|ok)|guilt|guilty)/, a: () =>
      'That\'s very common. People with dementia often don\'t realize how much help they need, and it\'s normal to feel guilty.\n\nThings that help:\n• Talk about safety and support, not "losing independence."\n• Try respite care or adult day care first. Several CountryHouse and Independence House locations offer short stays.\n• Ask their doctor to recommend it. It sometimes lands better coming from them.\n\nThe Alzheimer\'s Association helpline (1-800-272-3900) has counselors for exactly this, 24/7.' },
    { k: /(overwhelm|stress|scared|sad|tired|hard|help me|don.t know where)/, a: () =>
      'I\'m sorry. This is a lot to carry, and you\'re doing a good thing by looking into it.\n\nOne step at a time: the <a href="#/next-steps">Next steps</a> page breaks this into 8 small steps.\n\nYou can also talk to a person for free:\n• Alzheimer\'s Association 24/7 Helpline: 1-800-272-3900\n• Aging Partners (Lincoln): 402-441-7070' },
    { k: /\b(best|recommend|fits?|top|which (places?|ones?)|where should)\b/, a: () => {
      const top = F().topMatches(3);
      if (!top.length) return 'No matches fit your current filters. Try widening the distance or price on the left.';
      const intro = F().state.intakeDone ? `Based on your answers, the top matches for ${esc(lo())} are:` : 'Here are the top places right now (answer the 3 quick questions for better matches):';
      return intro + '\n' + top.map(({ p, m }, i) => `${i + 1}. <a href="#/place/${p.id}">${esc(p.name)}</a>${F().state.intakeDone ? ` (${m.score}%)` : ''}`).join('\n') + '\n\nTip: tick "Compare" on two or three of them to see them side by side.';
    } },
    { k: /(difference|vs|versus|assisted living|memory care|nursing home|skilled nursing|level of care|what type)/, a: () =>
      '<b>Assisted living:</b> a private apartment, meals, and help with bathing, dressing and medications. Doors usually aren\'t locked.\n\n<b>Memory care:</b> a secured, dementia-focused setting with specially trained staff and structured activities. Best if someone wanders or gets confused and anxious.\n\n<b>Nursing home:</b> 24-hour nursing for medical needs like wounds, feeding or heavy lifting. Medicare inspects and star-rates them.\n\n<b>In-home care:</b> caregivers come to the house. Great early on, but 24/7 home care often costs more than a facility.' },
    { k: /(medicaid|kancare|afford|pay for|can.t pay|run out of money|assets|spend down)/, a: () =>
      'Nebraska Medicaid pays for <b>nursing home</b> care once savings and assets are mostly used up ("spend down"). Every nursing home here that\'s Medicaid-certified is marked ✓.\n\nFor <b>assisted living or memory care</b>, Medicaid\'s Aged & Disabled waiver can help, but only some communities accept it, so it shows as "Ask."\n\nApplying can take a month or more, so start early through iServe Nebraska. Aging Partners (402-441-7070) can help with the paperwork for free.' },
    { k: /(medicare)/, a: () =>
      'Medicare covers <b>short-term</b> skilled nursing or rehab, up to 100 days after a qualifying 3-day hospital stay. It does <b>not</b> pay for long-term memory care or assisted living. That surprises a lot of families.' },
    { k: /(\bva\b|veteran|aid (and|&) attendance)/, a: () =>
      'Veterans and surviving spouses may qualify for the VA <b>Aid & Attendance</b> pension, which can help pay for assisted living, memory care or home care. Visiting Angels – Lincoln says on its website that it works with VA benefits. A county Veterans Service Officer can help you apply for free.' },
    { k: /(cost|price|expensive|how much)/, a: () =>
      'Rough Lincoln numbers:\n• Memory care: about $4,800–$10,500 a month (starting prices)\n• Nursing home: about $8,400–$10,000 a month (Nebraska average)\n• In-home care: about $30–$40 an hour, often with a 3–4 hour minimum\n\nAlways ask what\'s included. Many places charge more as care needs go up.' },
    { k: /\b(safe|safety|inspections?|stars?|ratings?|citations?|abuse|fines?|trust)\b/, a: () =>
      'For nursing homes, I show Medicare\'s official data: star ratings, how many problems inspectors found, fines, and whether the home is on Medicare\'s <b>watch list</b>.\n\nAssisted living and memory care are licensed by Nebraska, not Medicare, so ask each place for its latest state inspection report on your tour.\n\nYou can turn on "Hide places on Medicare\'s watch list" in the filters.' },
    { k: /(tour|visit|ask them|questions? to ask|checklist)/, a: () =>
      'Good questions for a tour:\n• Is the memory care unit secured?\n• How many staff are on duty at night?\n• What dementia training do caregivers get?\n• Do you take our payment, and what happens if savings run out?\n• Is there a waitlist?\n\nIf you can, visit at mealtime and bring ' + esc(lo()) + '. How they react can tell you a lot. The full checklist is on the Compare and Next steps pages.' },
    { k: /(wander|lost|escape|locked|secure|elope)/, a: () =>
      'If ' + esc(lo()) + ' wanders, look for <b>memory care</b> with a secured unit. I rank "memory care only" communities higher when you check "Wanders or gets lost." Still ask on the tour how exits are secured and what happens if someone tries to leave.' },
    { k: /(antipsychotic|sedat|drug|medicat)/, a: () =>
      'Antipsychotic drugs are sometimes overused in nursing homes to calm people with dementia, and they carry real risks. Medicare tracks how often each home uses them. Open any nursing home\'s <b>Quality of care</b> section to compare it with the Nebraska average. Ask on tours: "How do you handle agitation without medication?"' },
    { k: /(omaha|council bluffs|papillion|bellevue|elkhorn)/, a: () =>
      'Find-A-Home now includes 52 nursing homes across the Lincoln and Omaha areas. Use the <b>Area</b> filter, or enter an Omaha ZIP code in your answers, so distances are measured from you. Assisted living and home care are still Lincoln only in this prototype.' },
    { k: /(wait ?list|opening|bed|room|full|how (long|soon))/, a: () =>
      'Openings change daily and most places don\'t publish them. For nursing homes I show an <b>estimate</b> from Medicare data (beds minus average residents). For everyone else, use "Request a tour." The form can add you to a waitlist and show your next best match if they\'re full.' },
    { k: /(home care|stay home|at home|in-home|keep (her|him|them) home)/, a: () =>
      'Tap <b>Home care</b> at the top of the matches page to see Lincoln agencies. Non-medical caregivers help with bathing, meals and companionship. Medical home health sends nurses when a doctor orders it, and Medicare can cover that. Many families start with home care and move to memory care later.' },
    { k: /(diagnos|doctor|stage)/, a: () =>
      'Most memory care communities, and Medicaid, ask for a <b>written diagnosis</b>. Ask ' + esc(lo()) + '\'s doctor for the diagnosis, the current stage, and a short summary of daily care needs. That summary makes intake forms and tours much easier.' },
    { k: /^(hi|hello|hey|help)\b/, a: () => 'Hi! I can explain care types, costs, Medicaid and Medicare, safety ratings, and what to ask on tours. I can also summarize any place you\'re looking at. What\'s on your mind?' }
  ];

  function answer(q) {
    const s = q.toLowerCase();
    for (const it of INTENTS) if (it.k.test(s)) return it.a();
    return 'I\'m a demo with pre-written answers, so I don\'t have a good answer for that yet. In the full app, a real assistant would answer here.\n\nFor now, try one of the suggestions below, or call Aging Partners at 402-441-7070. They help Lincoln families for free.';
  }
  function ask(q) {
    q = q.trim(); if (!q) return;
    add(q, 'user');
    botSay(answer(q));
  }
  panel.querySelector('#asstForm').addEventListener('submit', e => { e.preventDefault(); ask(input.value); input.value = ''; });

  function open() {
    panel.classList.remove('hidden'); fab.setAttribute('aria-expanded', 'true');
    if (!opened) {
      opened = true;
      const name = F().state.intake.name;
      add(`Hi${name ? ' ' + esc(name) : ''}! I'm Care Guide. I can answer common questions about dementia care in Lincoln. <i>(This is a scripted demo for testing.)</i>`, 'bot');
    }
    suggestions(); input.focus();
  }
  function close() { panel.classList.add('hidden'); fab.setAttribute('aria-expanded', 'false'); fab.focus(); }
  fab.addEventListener('click', () => panel.classList.contains('hidden') ? open() : close());
  panel.querySelector('#asstClose').addEventListener('click', close);
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  window.FAH_ASSISTANT = { onRoute() { if (!panel.classList.contains('hidden')) suggestions(); } };
})();
