/* Onboarding: the ~2 minute intake, one question per screen like a dating-app sign-up.
   Inputs write straight into state through data-bind / data-action="pick|toggle" (see app.js). */
const Onboarding = (() => {
  let editing = false; // true when opened from the Profile page to change one answer

  const chip = (field, value, label, multi, icon = '') => {
    const cur = field.split('.').reduce((o, k) => o[k], S);
    const on = multi ? cur.includes(value) : cur === value;
    return `<button type="button" class="chip ${on ? 'on' : ''}" aria-pressed="${on}"
      data-action="${multi ? 'toggle' : 'pick'}" data-field="${field}" data-value="${esc(value)}">${icon ? `<span>${icon}</span>` : ''}${esc(label)}</button>`;
  };

  const STEPS = [
    {
      id: 'welcome', hideNav: true,
      html: () => `
        <div class="ob-hero">
          <div class="hero-cards" aria-hidden="true">
            <div class="hc hc1">🏥</div><div class="hc hc2">🏡</div><div class="hc hc3">🧠<span class="hc-like">MATCH</span></div>
          </div>
          <h1>Swipe right on<br><span class="grad">the right home.</span></h1>
          <p class="lead">Finding memory care for someone with dementia took one family we interviewed <b>six months</b> of cold calls. Tind-A-Home asks a few questions, then shows you one home at a time that actually fits.</p>
          <ul class="hero-points">
            <li><b>💚 Swipe right</b> to match and plan a tour</li>
            <li><b>⭐ Save</b> the ones you're not sure about</li>
            <li><b>✕ Pass</b> on the rest. You can always undo.</li>
          </ul>
          <button class="btn btn-grad btn-big" data-action="ob-next">Get started</button>
          <p class="fine">69 real nursing homes and memory care communities around Lincoln and Omaha, Nebraska. Rankings are never paid for by homes. Not medical advice.</p>
        </div>`
    },
    {
      id: 'you', title: "First, who's searching?", sub: 'We use this to word things for you. It stays on this device.',
      ok: () => true,
      html: () => `
        <label class="field"><span>Your first name</span>
          <input type="text" data-bind="you.name" value="${esc(S.you.name)}" placeholder="Your first name" autocomplete="given-name"></label>
        <div class="field"><span>The person you're helping is your…</span>
          <div class="chips">${RELATIONS.map(r => chip('you.relation', r, r, false)).join('')}</div></div>`
    },
    {
      id: 'them', title: 'Who are we finding a home for?', sub: 'This becomes their profile. Homes never see it unless you send a tour request.',
      ok: () => !!S.person.name.trim(),
      html: () => `
        <div class="avatar-pick">${AVATARS.map(a => `<button type="button" class="av ${S.person.avatar === a ? 'on' : ''}" data-action="pick" data-field="person.avatar" data-value="${a}" aria-label="Choose picture ${a}">${a}</button>`).join('')}</div>
        <label class="field"><span>Their name (or what you call them)</span>
          <input type="text" data-bind="person.name" value="${esc(S.person.name)}" placeholder="e.g. Grandma Rose"></label>
        <label class="field"><span>Age <small>(optional)</small></span>
          <input type="number" inputmode="numeric" min="40" max="110" data-bind="person.age" value="${esc(S.person.age)}" placeholder="82"></label>`
    },
    {
      id: 'stage', title: () => `Where is ${lovedName()} with dementia?`, sub: 'Dementia changes over time. Pick what fits best today.',
      ok: () => !!S.person.stage,
      html: () => `
        <div class="opt-list">${['early', 'middle', 'late', 'unsure'].map(k => `
          <button type="button" class="opt ${S.person.stage === k ? 'on' : ''}" data-action="pick" data-field="person.stage" data-value="${k}">
            <b>${LBL.stage[k]}</b><span>${LBL.stageHint[k]}</span></button>`).join('')}</div>
        <div class="field"><span>Type of dementia <small>(optional)</small></span>
          <div class="chips">${Object.entries(LBL.diagnosis).map(([k, v]) => chip('person.diagnosis', k, v, false)).join('')}</div></div>`
    },
    {
      id: 'behaviors', title: 'Any of these going on?', sub: 'This is the biggest clue for whether they need a secured (locked) memory unit. Pick all that apply.',
      ok: () => S.person.behaviors.length > 0,
      html: () => `<div class="chips chips-lg">${Object.keys(LBL.behaviors).map(k => chip('person.behaviors', k, LBL.behaviors[k], true, LBL.behaviorIcon[k])).join('')}</div>
        <p class="note">💡 Nurses told us wandering and trying to leave are the most common reasons a home says "we can't keep them safe here."</p>`
    },
    {
      id: 'daily', title: 'Day-to-day care', sub: 'Heavy medical needs usually mean a nursing home rather than assisted living.',
      ok: () => !!S.person.mobility,
      html: () => `
        <div class="field"><span>Getting around</span>
          <div class="chips">${Object.keys(LBL.mobility).map(k => chip('person.mobility', k, LBL.mobility[k], false, LBL.mobilityIcon[k])).join('')}</div></div>
        <div class="field"><span>Medical needs <small>(pick all that apply)</small></span>
          <div class="chips">${Object.keys(LBL.medical).map(k => chip('person.medical', k, LBL.medical[k], true)).join('')}</div></div>`
    },
    {
      id: 'pay', title: 'How will you pay for care?', sub: 'Many homes in Nebraska don\'t take every payment type. Pick all that might apply.',
      ok: () => S.care.payment.length > 0,
      html: () => `
        <div class="chips chips-lg">${Object.keys(LBL.payment).map(k => chip('care.payment', k, LBL.payment[k], true, LBL.paymentIcon[k])).join('')}</div>
        <label class="field"><span>Monthly budget: <b class="out" id="budget-out">$${fmt(S.care.budget)}</b></span>
          <input type="range" min="2000" max="14000" step="250" data-bind="care.budget" data-num value="${S.care.budget}" data-out="#budget-out" data-prefix="$"></label>
        <p class="note">For reference: memory care around Lincoln runs about <b>$5,900–$10,500</b>/mo, and Nebraska nursing homes average about <b>$8,400–$10,000</b>/mo. <b>Medicare</b> only covers short rehab stays, not long-term care.</p>`
    },
    {
      id: 'where', title: 'Where should we look?', sub: 'Families told us being close enough to visit matters a lot.',
      ok: () => !!DATA.zips[S.care.zip],
      html: () => `
        <label class="field"><span>ZIP code where family lives</span>
          <input type="text" inputmode="numeric" maxlength="5" data-bind="care.zip" value="${esc(S.care.zip)}" placeholder="68502" id="zip-in">
          <small class="zip-msg" id="zip-msg">${zipMsg()}</small></label>
        <label class="field"><span>How far will you drive? <b class="out" id="miles-out">${S.care.maxMiles} miles</b></span>
          <input type="range" min="5" max="80" step="5" data-bind="care.maxMiles" data-num value="${S.care.maxMiles}" data-out="#miles-out" data-suffix=" miles"></label>
        <div class="field"><span>When do you need a place?</span>
          <div class="chips">${Object.keys(LBL.timeline).map(k => chip('care.timeline', k, LBL.timeline[k], false)).join('')}</div></div>`
    },
    {
      id: 'likes', title: () => `What does ${lovedName()} love?`, sub: 'Like interests on a dating profile. We turn these into questions to ask on each tour. Pick up to 6.',
      ok: () => true,
      html: () => `
        <div class="chips">${LBL.likes.map(([k, v]) => chip('person.likes', k, v, true)).join('')}</div>
        <label class="field"><span>Anything staff should know? <small>(optional)</small></span>
          <textarea rows="3" data-bind="person.about" placeholder="e.g. Retired teacher. Calms down with old hymns. Gets upset if called by the wrong name.">${esc(S.person.about)}</textarea></label>`
    },
    {
      id: 'done', hideNav: true,
      html: () => `
        <div class="finding">
          <div class="radar"><span></span><span></span><span></span><div class="radar-av">${S.person.avatar}</div></div>
          <h2>Finding homes for ${esc(LovedName())}…</h2>
          <p class="muted" id="finding-msg">Checking Medicare inspections and ratings</p>
        </div>`
    }
  ];

  function zipMsg() {
    const z = S.care.zip;
    if (!z) return 'Lincoln, Omaha and nearby towns are covered.';
    if (z.length < 5) return '';
    return DATA.zips[z] ? '✓ Got it' : "We don't cover that ZIP yet. Try one near Lincoln or Omaha (68xxx).";
  }

  function render(view) {
    const i = S.step, st = STEPS[i];
    const real = STEPS.length - 2; // question steps (not welcome / done)
    const title = typeof st.title === 'function' ? st.title() : st.title;
    view.innerHTML = `
      <section class="ob ob-${st.id}">
        ${st.hideNav ? '' : `
          <div class="ob-top">
            <button class="icon-btn" data-action="ob-back" aria-label="Back">‹</button>
            <div class="ob-progress" aria-label="Step ${i} of ${real}"><i style="width:${100 * i / real}%"></i></div>
            <span class="ob-count">${i}/${real}</span>
          </div>`}
        <div class="ob-body">
          ${title ? `<h2 class="ob-title">${esc(title)}</h2>` : ''}
          ${st.sub ? `<p class="ob-sub">${esc(st.sub)}</p>` : ''}
          ${st.html()}
        </div>
        ${st.hideNav ? '' : `
          <div class="ob-foot">
            <button class="btn btn-grad btn-big" data-action="ob-next" id="ob-next" ${st.ok() ? '' : 'disabled'}>${editing ? 'Save' : 'Continue'}</button>
          </div>`}
      </section>`;
    if (st.id === 'done') runFinding();
  }

  function refreshNext() {
    const b = $('#ob-next'); if (b) b.disabled = !STEPS[S.step].ok();
    const zm = $('#zip-msg'); if (zm) zm.textContent = zipMsg();
  }

  function next() {
    const st = STEPS[S.step];
    if (st.ok && !st.ok()) return;
    if (editing) { editing = false; clearMatchCache(); save(); App.go('profile'); toast('✓ Profile updated. Your deck was re-ranked.', 'good'); return; }
    S.step = Math.min(S.step + 1, STEPS.length - 1); save(); App.render();
  }
  function back() {
    if (editing) { editing = false; App.go('profile'); return; }
    S.step = Math.max(0, S.step - 1); save(); App.render();
  }
  function edit(stepId) {
    editing = true;
    S.step = STEPS.findIndex(s => s.id === stepId);
    App.go('onboarding');
  }

  function runFinding() {
    const msgs = ['Checking Medicare inspections and ratings', 'Matching dementia care to their needs', 'Checking who takes your payment', 'Measuring the drive from family'];
    let k = 0;
    const t = setInterval(() => { const el = $('#finding-msg'); if (!el) return clearInterval(t); el.textContent = msgs[++k % msgs.length]; }, 650);
    setTimeout(() => {
      clearInterval(t);
      S.onboarded = true; S.step = 0; clearMatchCache(); save();
      App.go('swipe');
      toast(`🔥 ${deck().length} homes to swipe through for ${esc(lovedName())}`, 'good');
    }, 2700);
  }

  return { render, next, back, edit, refreshNext, isEditing: () => editing };
})();
