/* AI Care Guide (left tab).
   Prototype: a scripted assistant, no real AI model. It interviews the family about their
   loved one, fills in the profile from their answers, and answers common questions using
   the real facility data. Swap Chat.reply() for an LLM call later. */

const she = () => {
  const r = (S.person.relation || '').toLowerCase();
  if (/grandma|grandmother|mom|mother|wife|aunt|nana|granny|mamaw|sister/.test(r)) return { s: 'she', o: 'her', p: 'her' };
  if (/grandpa|grandfather|dad|father|husband|uncle|papa|grandad|brother/.test(r)) return { s: 'he', o: 'him', p: 'his' };
  return { s: 'they', o: 'them', p: 'their' };
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const has = (t, re) => re.test(t);
const fLink = (p, m = match(p)) =>
  `<button class="flink" data-action="open-home" data-id="${p.id}" style="--c:${scoreColor(m.score)}"><span>${m.score}%</span>${esc(p.name)}</button>`;
const CITY_ZIPS = { lincoln: '68508', omaha: '68102', 'council bluffs': '51501', bellevue: '68005', papillion: '68046', 'la vista': '68128', fremont: '68025', seward: '68434', crete: '68333', beatrice: '68310', york: '68467', ashland: '68003', waverly: '68462', hickman: '68372', gretna: '68028', elkhorn: '68022', wahoo: '68066', blair: '68008', plattsmouth: '68048' };

/* ---------- extractors: pull profile facts out of free text ---------- */
const X = {
  behaviors(t) {
    const out = [];
    if (has(t, /wander|leav(e|es|ing) the house|gets lost|got lost|walk(s|ed)? off|elop/)) out.push('wander');
    if (has(t, /aggress|angry|anger|hit(s|ting)?|yell|combative|agitat|violent|lash/)) out.push('aggression');
    if (has(t, /sundown|confused (at|in the) (night|evening)|worse at night|evening/)) out.push('sundowning');
    if (has(t, /\bfall|\bfell|falls/)) out.push('falls');
    return out;
  },
  medical(t) {
    const out = [];
    if (has(t, /diabet|insulin|sugar/)) out.push('diabetes');
    if (has(t, /oxygen|o2|copd|breath/)) out.push('oxygen');
    if (has(t, /feed|tube|swallow|eating/)) out.push('feeding');
    if (has(t, /wound|ulcer|bed ?sore/)) out.push('wounds');
    if (has(t, /medication|meds|pills|prescription/)) out.push('meds');
    if (has(t, /incontin|diaper|depend|bladder|toilet/)) out.push('incontinence');
    return out;
  },
  payment(t) {
    const out = [];
    if (has(t, /private|savings|pocket|cash|own money|we pay|pay ourselves|house sale|sell (the|her|his) house|pension|social security/)) out.push('private');
    if (has(t, /medicaid|kancare|title 19|title xix/)) out.push('medicaid');
    if (has(t, /medicare/)) out.push('medicare');
    if (has(t, /\bva\b|veteran|military|tricare/)) out.push('va');
    if (has(t, /long[- ]term care insurance|ltc|insurance polic/)) out.push('ltc');
    return out;
  },
  stage(t) {
    if (has(t, /early|mild|beginning|just diagnosed|mostly independent|some forgetting/)) return 'early';
    if (has(t, /late|severe|advanced|end stage|doesn'?t recogni[sz]e|help with (almost )?everything|bedridden|can'?t (talk|walk)/)) return 'late';
    if (has(t, /middle|moderate|daily help|gets confused|needs help/)) return 'middle';
    return '';
  },
  mobility(t) {
    if (has(t, /wheel ?chair/)) return 'wheelchair';
    if (has(t, /walker|cane/)) return 'walker';
    if (has(t, /bed ?ridden|in bed|can'?t walk/)) return 'bed';
    if (has(t, /walks?|on (her|his|their) own|fine|steady|gets around/)) return 'walks';
    return '';
  },
  money(t) {
    const m = t.replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d+)?)\s*(k|thousand)?/i);
    if (!m) return null;
    let n = parseFloat(m[1]);
    if (m[2]) n *= 1000;
    if (n < 100) n *= 1000;          // "5" -> $5,000 when talking about a budget
    return n >= 500 && n <= 50000 ? Math.round(n) : null;
  },
  zip(t) {
    const m = t.match(/\b(\d{5})\b/);
    if (m) return m[1];
    const c = Object.keys(CITY_ZIPS).find(k => t.includes(k));
    return c ? CITY_ZIPS[c] : '';
  },
  age(t) {
    const m = t.match(/\b(\d{2,3})\b/);
    const n = m ? +m[1] : 0;
    return n >= 40 && n <= 115 ? n : null;
  },
  relation(t) {
    const words = [['grandma', /grandma|grandmother|granny|nana|mamaw|grammy/], ['grandpa', /grandpa|grandfather|papa|grandad|granddad|pop-?pop/],
      ['mom', /\bmom|mother|mum\b/], ['dad', /\bdad|father/], ['wife', /\bwife/], ['husband', /husband/],
      ['aunt', /\baunt/], ['uncle', /\buncle/]];
    const f = words.find(([, re]) => re.test(t));
    return f ? f[0] : '';
  }
};

/* ---------- intake script ---------- */
const STEPS = [
  {
    key: 'relation',
    ask: () => `Hi! I'm your <b>Care Guide</b> 🤖. I'll ask a few quick questions about your loved one. Each answer fills in the profile and makes the map matches better.<br><br>First, who are we finding a home for?`,
    chips: ['My grandma', 'My grandpa', 'My mom', 'My dad', 'My spouse'],
    take(t) {
      const r = X.relation(t) || (has(t, /spouse/) ? 'spouse' : '');
      if (!r) return false;
      S.person.relation = cap(r);
      S.person.avatar = /grandpa|dad|husband|uncle/.test(r) ? '👴' : /grandma|mom|wife|aunt/.test(r) ? '👵' : '🧓';
      return [`Relationship: ${cap(r)}`];
    }
  },
  {
    key: 'name',
    ask: () => `What's ${she().p} name? (Whatever you call ${she().o} is perfect, like "Grandma Rose".)`,
    take(t, raw) {
      let n = raw.replace(/^(her|his|their)?\s*(name is|name's|it's|its|we call (her|him|them)|she'?s|he'?s|call (her|him))\s*/i, '').replace(/[.!]$/, '').trim();
      if (!n || n.length > 40) return false;
      n = n.split(' ').map(cap).join(' ');
      S.person.name = n;
      return [`Name: ${n}`];
    }
  },
  {
    key: 'age',
    ask: () => `Nice to meet ${S.person.name}. How old is ${she().s}?`,
    take(t) { const a = X.age(t); if (!a) return false; S.person.age = a; return [`Age: ${a}`]; }
  },
  {
    key: 'stage',
    ask: () => `Which of these sounds most like ${S.person.name} right now?`,
    chips: ['Mostly independent, some forgetting', 'Needs daily help, gets confused', 'Needs help with almost everything'],
    take(t) {
      const s = X.stage(t);
      if (!s) return false;
      S.person.stage = s;
      return [`Stage: ${LBL.stage[s]}`];
    },
    after: () => S.person.stage === 'late' ? `That usually means a <b>nursing home</b> with a memory unit, since they have nurses 24 hours a day.`
      : S.person.stage === 'early' ? `Good to know. At this stage <b>assisted living with memory care</b> is often a better fit than a full nursing home.` : ''
  },
  {
    key: 'behaviors',
    ask: () => `Does ${she().s} do any of these? Pick all that apply.`,
    chips: ['Wanders or tries to leave', 'Gets agitated or angry', 'Sundowning (worse in evening)', 'Falls', 'None of these'],
    multi: true,
    take(t) {
      const b = X.behaviors(t);
      if (!b.length && !has(t, /none|no\b|nope|not really/)) return false;
      S.person.behaviors = [...new Set([...S.person.behaviors, ...b])];
      S.person._noBehaviors = !b.length;
      return b.length ? b.map(x => `Behavior: ${LBL.behaviors[x]}`) : ['Behaviors: none'];
    },
    after: () => S.person.behaviors.includes('wander') ? `Wandering is really common. I'll rank homes with a <b>locked / secured memory unit</b> higher.` : ''
  },
  {
    key: 'mobility',
    ask: () => `How does ${she().s} get around?`,
    chips: ['Walks on own', 'Walker or cane', 'Wheelchair', 'Mostly in bed'],
    take(t) { const m = X.mobility(t); if (!m) return false; S.person.mobility = m; return [`Mobility: ${LBL.mobility[m]}`]; }
  },
  {
    key: 'medical',
    ask: () => `Any medical needs a nurse would help with?`,
    chips: ['Diabetes / insulin', 'Oxygen', 'Wound care', 'Lots of medications', 'Incontinence', 'None'],
    multi: true,
    take(t) {
      const m = X.medical(t);
      if (!m.length && !has(t, /none|no\b|nope|not really/)) return false;
      S.person.medical = [...new Set([...S.person.medical, ...m])];
      S.person._noMedical = !m.length;
      return m.length ? m.map(x => `Medical: ${LBL.medical[x]}`) : ['Medical needs: none'];
    }
  },
  {
    key: 'payment',
    ask: () => `How will the family pay for care? Pick all that apply.`,
    chips: ['Savings / private pay', 'Medicaid', 'Medicare', 'VA benefits', 'Long-term care insurance', 'Not sure'],
    multi: true,
    take(t) {
      const p = X.payment(t);
      if (!p.length) {
        if (!has(t, /not sure|don'?t know|idk|no idea/)) return false;
        return { msg: `No problem. Most families start with <b>savings</b>, then switch to <b>Medicaid</b> once money runs low. Medicare only pays for a short rehab stay. I'll keep both options open.`, updates: [] };
      }
      S.care.payment = [...new Set([...S.care.payment, ...p])];
      return p.map(x => `Paying with: ${LBL.payment[x]}`);
    },
    after: () => S.care.payment.includes('medicaid') ? `I'll favor homes that accept Medicaid. Not every home does.` : ''
  },
  {
    key: 'budget',
    ask: () => S.care.payment.length === 1 && S.care.payment[0] === 'medicaid'
      ? `If Medicaid covers it, you may not need a budget. Is there a monthly amount the family could pay on its own? (Or say "skip".)`
      : `About how much could the family spend per month? Nursing homes around Lincoln average about <b>$8,400–$10,000</b>; memory care about <b>$5,900</b>.`,
    chips: ['$4,000', '$6,000', '$8,000', '$10,000+'],
    take(t) { const b = X.money(t); if (!b) return false; S.care.budget = b; return [`Budget: $${fmt(b)}/mo`]; }
  },
  {
    key: 'zip',
    ask: () => `Where should the home be close to? Type a ZIP code or a town (like Lincoln or Omaha).`,
    take(t) {
      const z = X.zip(t);
      if (!z) return false;
      if (!DATA.zips[z]) return { msg: `I don't have ${z} on my map yet. This prototype covers Lincoln and Omaha. Try a ZIP there?`, updates: [], retry: true };
      S.care.zip = z;
      return [`ZIP code: ${z}`];
    }
  },
  {
    key: 'maxMiles',
    ask: () => `How far would you be willing to drive to visit?`,
    chips: ['5 miles', '10 miles', '20 miles', '40 miles'],
    take(t) {
      const m = t.match(/(\d+)/);
      if (!m) return false;
      S.care.maxMiles = Math.min(200, +m[1]);
      return [`Max drive: ${S.care.maxMiles} mi`];
    }
  },
  {
    key: 'timeline',
    ask: () => `How soon does ${S.person.name} need to move?`,
    chips: ['Right away', 'In 1–3 months', 'Just exploring'],
    take(t) {
      const v = has(t, /now|asap|right away|urgent|immediately|this week|hospital/) ? 'now' : has(t, /month|soon|weeks/) ? 'soon' : has(t, /explor|look|planning|future|not yet|later/) ? 'exploring' : '';
      if (!v) return false;
      S.care.timeline = v;
      return [`Timeline: ${LBL.timeline[v]}`];
    },
    after: () => S.care.timeline === 'now' ? `Since it's urgent, I'll push homes that may have open beds to the top. Call to confirm openings.` : ''
  },
  {
    key: 'likes',
    ask: () => `Last one, and my favorite: what does ${S.person.name} love? Hobbies, music, faith, food… It helps you pick a home where ${she().s}'ll feel at home.`,
    take(t, raw) {
      if (has(t, /^(skip|none|nothing|idk|not sure)$/)) return ['Likes: skipped'];
      const faith = raw.match(/\b(catholic|lutheran|methodist|baptist|christian|jewish|muslim|church|mass)\b/i);
      if (faith) S.person.faith = cap(faith[1].toLowerCase() === 'mass' ? 'Catholic' : faith[1].toLowerCase());
      const likes = raw.replace(/^(she|he|they) (loves?|likes?|enjoys?)\s*/i, '').split(/,|\band\b|;/).map(s => s.trim().replace(/[.!]$/, '')).filter(s => s && s.length < 40 && !/catholic|lutheran|methodist|baptist|christian|jewish|muslim|church|mass\b/i.test(s));
      S.person.likes = [...new Set([...S.person.likes, ...likes])];
      return [`Likes: ${likes.join(', ')}`].concat(faith ? [`Faith: ${S.person.faith}`] : []);
    }
  }
];

const Chat = {
  multiSel: new Set(),

  render() {
    const step = S.chatStep < STEPS.length ? STEPS[S.chatStep] : null;
    const last = S.chat[S.chat.length - 1];
    const chips = last && last.from === 'bot' ? (last.chips || []) : [];
    const multi = step && step.multi && last && last.step === S.chatStep;
    $('#panel-ai').innerHTML = `
      <div class="chat">
        <div class="chat-head">
          <div class="bot-face">🤖</div>
          <div><b>Care Guide</b><small>${step ? `Getting to know ${esc(lovedName())} · ${S.chatStep + 1}/${STEPS.length}` : 'Ask me anything about homes or care'}</small></div>
          <button class="btn btn-gray small" data-action="chat-restart" title="Ask the profile questions again">↺ Restart</button>
        </div>
        ${step ? `<div class="chat-prog"><div style="width:${100 * S.chatStep / STEPS.length}%"></div></div>` : ''}
        <div class="chat-log" id="chat-log">
          ${S.chat.map(m => `
            <div class="msg ${m.from}">
              ${m.from === 'bot' ? '<span class="msg-face">🤖</span>' : ''}
              <div class="bubble">${m.html}${m.updates && m.updates.length ? `<div class="updates">${m.updates.map(u => `<span>✅ ${esc(u)}</span>`).join('')}</div>` : ''}</div>
            </div>`).join('')}
          <div class="msg bot typing" id="typing" hidden><span class="msg-face">🤖</span><div class="bubble"><i></i><i></i><i></i></div></div>
        </div>
        <div class="chat-chips">
          ${chips.map(c => `<button class="chip ${multi && this.multiSel.has(c) ? 'on' : ''}" data-action="${multi ? 'chat-toggle' : 'chat-chip'}" data-t="${esc(c)}">${esc(c)}</button>`).join('')}
          ${multi ? `<button class="chip send" data-action="chat-multi-send" ${this.multiSel.size ? '' : 'disabled'}>Send ✓</button>` : ''}
          ${step && S.chatStep > 0 ? `<button class="chip ghost" data-action="chat-chip" data-t="skip">Skip</button>` : ''}
        </div>
        <form class="chat-input" id="chat-form">
          <input id="chat-text" autocomplete="off" placeholder="${step ? 'Type an answer, or ask a question…' : `Ask about homes, Medicaid, tours, ${esc(lovedName())}…`}">
          <button class="btn btn-gold" type="submit">Send</button>
        </form>
      </div>`;
    const log = $('#chat-log');
    log.scrollTop = log.scrollHeight;
    $('#chat-form').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#chat-text').value.trim();
      if (v) this.send(v);
    });
  },

  start() {
    if (S.chat.length) return;
    this.bot(STEPS[0].ask(), { chips: STEPS[0].chips, step: 0 });
  },

  restart() {
    S.chat = []; S.chatStep = 0; S.chatRedo = true; this.multiSel.clear(); save();
    this.start(); this.render();
  },

  bot(html, extra = {}) { S.chat.push({ from: 'bot', html, ...extra }); save(); },

  send(text) {
    this.multiSel.clear();
    S.chat.push({ from: 'me', html: esc(text) });
    save(); this.render();
    $('#typing').hidden = false;
    $('#chat-log').scrollTop = 1e6;
    setTimeout(() => { this.reply(text); this.render(); App.refresh({ skipChat: true }); }, 450 + Math.random() * 400);
  },

  /* ---------- the "brain" ---------- */
  reply(raw) {
    const t = raw.toLowerCase().trim();
    const step = S.chatStep < STEPS.length ? STEPS[S.chatStep] : null;

    if (/^(restart|start over)$/.test(t)) return this.restart();

    if (step) {
      const isQuestion = /\?$/.test(t) || /^(what|how|why|which|where|who|can|should|is|are|does|do|tell me|show me|explain)\b/.test(t);
      if (t === 'skip') return this.next('No problem, skipping that.');
      if (!isQuestion) {
        const r = step.take(t, raw);
        if (r && !Array.isArray(r) && r.retry) { this.bot(r.msg, { chips: step.chips, step: S.chatStep }); return; }
        if (r) {
          const updates = Array.isArray(r) ? r : r.updates;
          // pick up any extra details mentioned along the way
          const extra = step.key !== 'name' && step.key !== 'likes' ? this.passive(t, step.key) : [];
          save();
          const pre = !Array.isArray(r) && r.msg ? r.msg : this.ack();
          const aft = step.after ? step.after() : '';
          return this.next([pre, aft].filter(Boolean).join(' '), [...updates, ...extra]);
        }
      }
      // A question in the middle of intake: answer it, then come back.
      const ans = this.answer(t, raw);
      if (ans) {
        this.bot(ans.html, { updates: ans.updates });
        this.bot(`Back to ${esc(lovedName())}: ${step.ask()}`, { chips: step.chips, step: S.chatStep });
      } else {
        this.bot(`Sorry, I didn't catch that. ${step.ask()}`, { chips: step.chips, step: S.chatStep });
      }
      return;
    }

    const ans = this.answer(t, raw) || this.fallback(t);
    this.bot(ans.html, { updates: ans.updates, chips: ans.chips || this.suggest() });
  },

  ack() {
    const a = ['Got it!', 'Thanks!', 'Okay, noted.', 'Perfect.', 'Thank you.'];
    return a[Math.floor(Math.random() * a.length)];
  },

  next(msg, updates = []) {
    S.chatStep++;
    // skip steps already answered elsewhere (e.g. ZIP mentioned earlier)
    while (S.chatStep < STEPS.length && this.answered(STEPS[S.chatStep].key)) S.chatStep++;
    save();
    if (S.chatStep < STEPS.length) {
      const s = STEPS[S.chatStep];
      this.bot(`${msg ? msg + '<br><br>' : ''}${s.ask()}`, { chips: s.chips, step: S.chatStep, updates });
    } else {
      this.bot(msg || 'Thanks!', { updates });
      this.finish();
    }
  },

  answered(key) {
    if (S.chatRedo) return false;   // after "Restart", ask every question again
    const P = S.person, C = S.care;
    return { relation: P.relation, name: P.name, age: P.age, stage: P.stage, mobility: P.mobility, zip: C.zip, budget: C.budget, timeline: C.timeline }[key];
  },

  finish() {
    const top = ranked().slice(0, 3);
    this.bot(`🎉 <b>${esc(lovedName())}'s profile is ${completeness()}% complete!</b> Here are ${she().p} best matches right now:<br>
      <div class="flinks">${top.map(({ p, m }) => fLink(p, m)).join('')}</div>
      Tap one to see it on the map. You can also ask me things like "Why is ${esc(top[0].p.name)} #1?" or "Which homes take Medicaid?"`,
      { chips: ['Show me the map', `Why is #1 the best?`, 'What is memory care?', 'How does Medicaid work?'] });
  },

  /* Listen for extra facts in any message ("she's 84 and wanders at night") */
  passive(t, skipKey) {
    const P = S.person, C = S.care, u = [];
    if (skipKey !== 'age' && !P.age && /\b(is|she'?s|he'?s|they'?re|age|aged|turned|years?)\b/.test(t)) {
      const a = X.age(t); if (a) { P.age = a; u.push(`Age: ${a}`); }
    }
    if (skipKey !== 'behaviors') X.behaviors(t).forEach(b => { if (!P.behaviors.includes(b)) { P.behaviors.push(b); u.push(`Behavior: ${LBL.behaviors[b]}`); } });
    if (skipKey !== 'medical') X.medical(t).forEach(b => { if (!P.medical.includes(b)) { P.medical.push(b); u.push(`Medical: ${LBL.medical[b]}`); } });
    if (skipKey !== 'payment') X.payment(t).forEach(b => { if (!C.payment.includes(b)) { C.payment.push(b); u.push(`Paying with: ${LBL.payment[b]}`); } });
    if (skipKey !== 'mobility' && !P.mobility) { const m = X.mobility(t); if (m && m !== 'walks') { P.mobility = m; u.push(`Mobility: ${LBL.mobility[m]}`); } }
    if (skipKey !== 'zip') { const z = (t.match(/\b(68\d{3}|51\d{3})\b/) || [])[1]; if (z && DATA.zips[z] && z !== C.zip) { C.zip = z; u.push(`ZIP code: ${z}`); } }
    if (skipKey !== 'budget' && /\$|budget|afford|per month|a month/.test(t)) { const b = X.money(t); if (b && b !== C.budget) { C.budget = b; u.push(`Budget: $${fmt(b)}/mo`); } }
    if (u.length) save();
    return u;
  },

  findHome(t) {
    const stop = /\b(the|of|at|and|nursing|home|homes|care|center|centre|memory|living|senior|community|rehab|rehabilitation|health|healthcare|assisted|lincoln|omaha|village|place|house|manor)\b/g;
    let best = null, bestLen = 0;
    for (const p of DATA.facilities) {
      for (const nm of [p.name, p.aka].filter(Boolean)) {
        const key = nm.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(stop, '').replace(/\s+/g, ' ').trim();
        if (key.length >= 4 && t.replace(/[^a-z0-9 ]/g, '').includes(key) && key.length > bestLen) { best = p; bestLen = key.length; }
      }
    }
    return best;
  },

  answer(t, raw) {
    const updates = this.passive(t);
    const R = (html, chips) => ({ html, updates, chips });
    const name = esc(lovedName());
    const top = ranked();
    const near = (filter, n = 3) => top.filter(({ p }) => filter(p) && dist(p) <= (S.care.maxMiles || 20)).slice(0, n);
    const links = arr => arr.length ? `<div class="flinks">${arr.map(({ p, m }) => fLink(p, m)).join('')}</div>` : '<i>None within your drive distance. Try a bigger distance in the profile.</i>';

    if (/\b(show|open|see|go to)\b.*\bmap\b|^map$|show me the map/.test(t)) {
      setTimeout(() => App.go('map'), 300);
      return R(`Opening the map! Greener pins are better matches for ${name}. 🗺️`);
    }

    const h = this.findHome(t);
    if (h) {
      const m = match(h);
      const rank = top.findIndex(x => x.p.id === h.id) + 1;
      return R(`<b>${esc(h.name)}</b> is a ${m.score}% match for ${name} (#${rank} of ${top.length}).<br>${esc(h.bio)}<br>
        <ul class="mini-list">${m.good.slice(0, 4).map(g => `<li>✅ ${esc(g)}</li>`).join('')}${m.warn.slice(0, 3).map(w => `<li>⚠️ ${esc(w)}</li>`).join('')}</ul>
        Cost: about $${fmt(h.priceLow)}${h.priceHigh ? `–$${fmt(h.priceHigh)}` : '+'}/mo${h.priceEstimated ? ' (area average)' : ''}. Phone: <a href="${telUrl(h)}">${esc(h.phone)}</a>
        <div class="flinks">${fLink(h, m)}</div>`,
        ['Questions to ask on a tour', 'Show me similar homes', 'What do the stars mean?']);
    }

    if (/why.*(#?1|number one|first|top|best)|why is/.test(t)) {
      const { p, m } = top[0];
      return R(`<b>${esc(p.name)}</b> scores ${m.score}% because:<ul class="mini-list">${m.good.map(g => `<li>✅ ${esc(g)}</li>`).join('')}</ul>${m.warn.length ? `Things to check:<ul class="mini-list">${m.warn.map(w => `<li>⚠️ ${esc(w)}</li>`).join('')}</ul>` : ''}${links([top[0]])}`);
    }
    if (/best|top|recommend|match|which (home|one|place)|similar/.test(t)) {
      return R(`Top matches for ${name} within ${S.care.maxMiles || 20} miles:${links(near(() => true, 5))}`);
    }
    if (/closest|nearest|near me|nearby|close to/.test(t)) {
      const c = top.slice().sort((a, b) => a.m.d - b.m.d).slice(0, 4);
      return R(`Closest homes to ${esc(S.care.zip || 'Lincoln')}:${links(c)}`);
    }
    if (/medicaid|kancare|title 19/.test(t)) {
      const n = DATA.facilities.filter(p => p.payment.medicaid === 'yes').length;
      return R(`<b>Medicaid</b> pays for long-term nursing home care once someone's savings are mostly spent (in Nebraska, about <b>$4,000</b> in countable assets for a single person). The house and a spouse's money are often protected.<br><br>
        To apply: contact <b>Nebraska DHHS (ACCESSNebraska)</b> or your Area Agency on Aging (Aging Partners in Lincoln). It can take 45–90 days, so start early.<br><br>
        ${n} of the ${DATA.facilities.length} homes on the map say "Yes" to Medicaid. Best Medicaid matches near you:${links(near(p => p.payment.medicaid === 'yes'))}`,
        ['What does Medicare cover?', 'How much does care cost?', 'What should I do first?']);
    }
    if (/medicare/.test(t)) {
      return R(`<b>Medicare</b> only pays for a <b>short rehab stay</b> (up to 100 days, full cost for the first 20) after a 3-night hospital stay. It does <b>not</b> pay for long-term living in a nursing home or memory care. For that, families use savings, Medicaid, VA benefits or long-term care insurance.`, ['How does Medicaid work?', 'VA benefits?']);
    }
    if (/\bva\b|veteran|military/.test(t)) {
      return R(`If ${name} served in the military, the <b>VA</b> may help through the Aid & Attendance pension or VA-contract nursing homes. Call the Nebraska VA or a county Veterans Service Officer. Homes that work with the VA:${links(near(p => p.payment.va === 'yes'))}`);
    }
    if (/memory care|difference|assisted|types? of|what kind|\bvs\b|versus/.test(t)) {
      return R(`Quick guide:<ul class="mini-list">
        <li>🏠 <b>Assisted living</b>: apartment + help with meals, meds, bathing. Best for early stage.</li>
        <li>🧠 <b>Memory care</b>: a secured, locked area just for dementia, with trained staff and calm routines. Good for wandering, middle stage.</li>
        <li>🏥 <b>Nursing home</b>: nurses 24/7 for heavy medical needs. Many have a memory unit. Good for late stage.</li></ul>
        Based on ${name}'s profile, I'd look first at <b>${S.person.stage === 'late' || S.person.medical.length ? 'nursing homes with a memory unit' : S.person.stage === 'early' ? 'assisted living with memory care' : 'memory care communities'}</b>.`);
    }
    if (/cost|price|afford|expensive|cheap|how much|pay for/.test(t)) {
      const cheap = top.filter(({ p }) => dist(p) <= (S.care.maxMiles || 20)).sort((a, b) => a.p.priceLow - b.p.priceLow).slice(0, 3);
      return R(`Around Lincoln/Omaha, roughly:<ul class="mini-list"><li>Memory care: <b>$5,000–$8,000</b>/mo</li><li>Nursing home: <b>$8,400–$10,000</b>/mo</li></ul>
        Many homes don't post prices, so the map shows area averages marked "est." Lowest listed costs near you:${links(cheap)}
        ${S.care.budget ? `Your budget is $${fmt(S.care.budget)}/mo.` : 'Tell me a monthly budget and I\'ll use it in the matches.'}`, ['How does Medicaid work?', 'VA benefits?']);
    }
    if (/wander|lock|secure|escape|elope/.test(t)) {
      return R(`For wandering, look for a <b>secured memory unit</b> (locked doors, enclosed garden, alarms). Homes near you that have one:${links(near(p => p.memoryCare !== 'ask', 4))}`);
    }
    if (/tour|ask (them|on|during|the)|questions? (to|should)|checklist|visit/.test(t)) {
      return R(`Great questions for a tour:<ul class="mini-list">
        <li>How many aides per resident on the memory unit, day and <b>night</b>?</li>
        <li>What dementia training do staff get?</li><li>Is the unit secured? Is there a safe outdoor space?</li>
        <li>Do you take Medicaid, and is there a private-pay period first?</li><li>What would make you ask a resident to leave?</li>
        <li>Can we visit any time and join a meal?</li></ul>
        Tip: visit around lunch or early evening to see real life. Book a tour from any home's card on the map 📅.`);
    }
    if (/star|rating|safe|inspection|citation|violation|quality/.test(t)) {
      return R(`For nursing homes, the stars come from <b>Medicare Care Compare</b>: health inspections, staffing and quality of care, each 1–5 stars. I also lower a home's match if it had a recent serious citation, is on Medicare's watch list, or uses a lot of antipsychotic drugs (sometimes used to sedate dementia residents). Memory care communities aren't rated by Medicare, so their stars are family reviews.`);
    }
    if (/next|first step|where do i start|what (do|should) i do|steps|process|start/.test(t)) {
      return R(`Steps most families go through:<ol class="mini-list">
        <li>Get the dementia diagnosis written down by a doctor.</li><li>Figure out how you'll pay (savings, Medicaid, VA, insurance).</li>
        <li>Make a short list here: heart 3–5 homes ❤️.</li><li>Tour at least 2 📅 and ask the tour questions.</li>
        <li>Apply for Medicaid early if you'll need it (takes 45–90 days).</li><li>Plan the move: familiar photos, blanket, music.</li></ol>
        Free help: <b>Aging Partners</b> (Lincoln) or the <b>Alzheimer's Association</b> 24/7 helpline, 1-800-272-3900.`);
    }
    if (/saved|heart|favorite|my list/.test(t)) {
      const hs = S.hearts.map(byId).filter(Boolean);
      return R(hs.length ? `Your saved homes:<div class="flinks">${hs.map(p => fLink(p)).join('')}</div>` : `You haven't saved any yet. Tap a pin on the map and press 🤍 Heart.`);
    }
    if (/what do you know|profile|summar|about (her|him|them|grandma|grandpa)/.test(t)) {
      const P = S.person, C = S.care;
      const items = [P.age && `${P.age} years old`, P.stage && LBL.stage[P.stage], P.behaviors.length && P.behaviors.map(b => LBL.behaviors[b].toLowerCase()).join(', '),
        P.mobility && LBL.mobility[P.mobility].toLowerCase(), C.payment.length && 'paying with ' + C.payment.map(x => LBL.payment[x]).join(' + '),
        C.budget && `$${fmt(C.budget)}/mo budget`, C.zip && `near ${C.zip}`, P.likes.length && 'loves ' + P.likes.join(', ')].filter(Boolean);
      return R(items.length ? `Here's what I know about ${name}:<ul class="mini-list">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>Tell me anything new and I'll add it.` : `I don't know much yet! Say "restart" and I'll ask a few questions.`);
    }
    if (/^(hi|hello|hey|yo|howdy)\b/.test(t)) return R(`Hi! 👋 What would you like to know?`);
    if (/thank/.test(t)) return R(`You're welcome! This is a hard thing to go through, and you're doing a good job looking out for ${name}. 💛`);
    if (updates.length) return R(`Thanks, I added that to ${name}'s profile and updated the matches.`);
    return null;
  },

  fallback() {
    return { html: `I'm a prototype guide, so I don't know everything yet. 🙂 Try asking about a home by name, Medicaid, costs, wandering, or what to ask on a tour. You can also tell me new things about ${esc(lovedName())} and I'll add them to the profile.` };
  },

  suggest() {
    return ['Top matches', 'How does Medicaid work?', 'What to ask on a tour', 'What should I do first?'];
  }
};
