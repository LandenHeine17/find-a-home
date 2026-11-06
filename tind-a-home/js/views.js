/* Matches, Saved, Profile, Guide, plus the Filters / Compare / Share / Passed pop-ups. */
const Views = (() => {
  const mini = h => `<div class="mini-art">${Swipe.art(h)}</div>`;
  const fiveDots = r => `<span class="dots">${r.five.map(f => `<i class="d-${f.v}" title="${f.q} ${f.v}"></i>`).join('')}</span>`;

  /* ---------- Matches ---------- */
  function matches(view) {
    const list = S.matches.map(x => ({ x, h: byId(x.id) })).filter(o => o.h);
    const order = { top: 0, toured: 1, requested: 2, matched: 3 };
    const sorted = [...list].sort((a, b) => order[a.x.status] - order[b.x.status] || m(b.h).score - m(a.h).score);
    view.innerHTML = `
      <section class="page">
        <h1 class="page-title">Matches <small>${list.length}</small></h1>
        ${list.length ? `
          <h2 class="sec-label">New matches</h2>
          <div class="bubbles">${list.slice(0, 12).map(({ x, h }) => `
            <button class="bubble ${x.seen ? '' : 'new'}" data-action="detail" data-id="${h.id}">
              ${mini(h)}<span>${esc(h.name.split(/[\s–-]+/).slice(0, 2).join(' '))}</span></button>`).join('')}</div>

          <h2 class="sec-label">Your shortlist <span class="muted">· tap to plan tours, check boxes to compare</span></h2>
          <ul class="mlist">${sorted.map(({ x, h }) => {
            const r = m(h);
            return `<li class="mrow">
              <label class="cmp" title="Compare"><input type="checkbox" data-action="compare-toggle" data-id="${h.id}" ${S.compare.includes(h.id) ? 'checked' : ''} aria-label="Compare ${esc(h.name)}"></label>
              <button class="mrow-main" data-action="detail" data-id="${h.id}">
                ${mini(h)}
                <span class="mrow-txt">
                  <b>${esc(h.name)}</b>
                  <small>${LBL.typeShort[h.type]} · ${r.d.toFixed(1)} mi · ${priceText(h)}</small>
                  <span class="mrow-meta"><span class="st st-${x.status}">${LBL.status[x.status]}</span>${fiveDots(r)}</span>
                </span>
                <span class="mscore ${scoreClass(r.score)}">${r.score}%</span>
              </button>
              <button class="btn btn-sm btn-grad" data-action="tour" data-id="${h.id}" aria-label="Plan tour at ${esc(h.name)}">📅</button>
            </li>`;
          }).join('')}</ul>
          <div class="cmp-bar ${S.compare.length >= 2 ? 'show' : ''}">
            <span>${S.compare.length} selected</span>
            <button class="btn btn-grad" data-action="compare" ${S.compare.length >= 2 ? '' : 'disabled'}>Compare side by side</button>
          </div>
          <button class="btn btn-ghost wide" data-action="share">👨‍👩‍👧 Share shortlist with family</button>
        ` : empty('💞', 'No matches yet', `Swipe right on a home that looks right for ${esc(lovedName())}. It'll show up here so you can plan tours and compare.`, 'Start swiping')}
      </section>`;
    S.matches.forEach(x => { x.seen = true; }); save();
  }

  function empty(icon, title, text, btn) {
    return `<div class="empty"><div class="empty-ico">${icon}</div><h2>${title}</h2><p class="muted">${text}</p>
      <button class="btn btn-grad" data-action="go" data-view="swipe">${btn}</button></div>`;
  }

  /* ---------- Saved ---------- */
  function saved(view) {
    const list = S.saved.map(byId).filter(Boolean);
    view.innerHTML = `
      <section class="page">
        <h1 class="page-title">Saved <small>${list.length}</small></h1>
        <p class="muted">Homes you starred to think about. Match them when you're ready to tour.</p>
        ${list.length ? `<div class="grid">${list.map(h => {
          const r = m(h);
          return `<article class="gcard">
            <button class="gcard-top" data-action="detail" data-id="${h.id}">
              ${Swipe.art(h)}<span class="gscore ${scoreClass(r.score)}">${r.score}%</span>
              <span class="gname">${esc(h.name)}<small>${esc(h.city)} · ${r.d.toFixed(1)} mi</small></span>
            </button>
            <div class="gcard-bot">${fiveDots(r)}
              <span class="gbtns">
                <button class="round r-nope" data-action="unsave" data-id="${h.id}" aria-label="Remove ${esc(h.name)}">✕</button>
                <button class="round r-like" data-action="match-saved" data-id="${h.id}" aria-label="Match ${esc(h.name)}">♥</button>
              </span></div>
          </article>`;
        }).join('')}</div>` : empty('⭐', 'Nothing saved yet', 'Not sure about a home? Swipe up or tap the star to save it for later.', 'Start swiping')}
      </section>`;
  }

  /* ---------- Profile ---------- */
  function profile(view) {
    const P = S.person, C = S.care, pct = completeness();
    const missing = profileChecks().filter(x => !x[1]).map(x => x[0]);
    const needs = [
      P.stage && LBL.stage[P.stage], P.diagnosis && LBL.diagnosis[P.diagnosis],
      ...P.behaviors.filter(b => b !== 'none').map(b => LBL.behaviorIcon[b] + ' ' + LBL.behaviors[b]),
      P.mobility && LBL.mobilityIcon[P.mobility] + ' ' + LBL.mobility[P.mobility],
      ...P.medical.filter(x => x !== 'none').map(x => LBL.medical[x])
    ].filter(Boolean);
    const row = (label, val, step) => `<button class="prow" data-action="edit" data-step="${step}"><span>${label}</span><b>${val || '<i class="muted">Add</i>'}</b><em>›</em></button>`;
    view.innerHTML = `
      <section class="page">
        <div class="pcard">
          <div class="pcard-top">
            <div class="pring" style="--p:${pct}"><span>${P.avatar}</span></div>
            <h1>${esc(LovedName())}${P.age ? `, <span>${esc(P.age)}</span>` : ''}</h1>
            <p class="muted">${S.you.name ? `Searching: ${esc(S.you.name)}${S.you.relation ? ` · for their ${esc(S.you.relation.toLowerCase())}` : ''}` : 'Profile kept on this device only'}</p>
            <div class="pcomp"><div class="bar"><i style="width:${pct}%"></i></div><small>Profile ${pct}% complete${missing.length ? ` · add ${missing.slice(0, 2).join(', ').toLowerCase()} for better matches` : ' 🎉'}</small></div>
          </div>
          <div class="pstats">
            <button data-action="go" data-view="matches"><b>${S.matches.length}</b><small>Matches</small></button>
            <button data-action="go" data-view="saved"><b>${S.saved.length}</b><small>Saved</small></button>
            <button data-action="passed"><b>${S.passed.length}</b><small>Passed</small></button>
            <button data-action="go" data-view="matches"><b>${S.matches.filter(x => x.status !== 'matched').length}</b><small>Tours</small></button>
          </div>
        </div>

        ${needs.length ? `<h2 class="sec-label">Care needs</h2><div class="chips static">${needs.map(n => `<span class="chip on">${esc(n)}</span>`).join('')}</div>` : ''}
        ${P.likes.length ? `<h2 class="sec-label">Loves</h2><div class="chips static">${P.likes.map(k => `<span class="chip">${esc(LIKE_LABEL[k])}</span>`).join('')}</div>` : ''}
        ${P.about ? `<h2 class="sec-label">About</h2><p class="about">${esc(P.about)}</p>` : ''}

        <h2 class="sec-label">Edit profile</h2>
        <div class="plist">
          ${row('Name & photo', esc(P.name), 'them')}
          ${row('Dementia stage', P.stage && LBL.stage[P.stage], 'stage')}
          ${row('Behaviors', P.behaviors.map(b => LBL.behaviors[b]).join(', '), 'behaviors')}
          ${row('Daily care', [P.mobility && LBL.mobility[P.mobility], ...P.medical.filter(x => x !== 'none').map(x => LBL.medical[x])].filter(Boolean).join(', '), 'daily')}
          ${row('Payment & budget', C.payment.length ? `${C.payment.map(k => LBL.payment[k]).join(', ')} · $${fmt(C.budget)}/mo` : '', 'pay')}
          ${row('Location', C.zip ? `${esc(C.zip)} · ${C.maxMiles} mi${C.timeline ? ' · ' + LBL.timeline[C.timeline] : ''}` : '', 'where')}
          ${row('Interests', P.likes.map(k => LIKE_LABEL[k]).join(' '), 'likes')}
          ${row('About you', [S.you.name, S.you.relation].filter(Boolean).map(esc).join(' · '), 'you')}
        </div>

        <h2 class="sec-label">Settings & tools</h2>
        <div class="plist">
          <button class="prow" data-action="open-settings"><span>⚙︎ Discovery filters</span><b>${S.settings.types.length}/3 care types</b><em>›</em></button>
          <button class="prow" data-action="share"><span>👨‍👩‍👧 Share with family</span><b></b><em>›</em></button>
          <button class="prow" data-action="go" data-view="guide"><span>🧭 What to do next</span><b>${Object.values(S.guide).filter(Boolean).length}/${GUIDE.length} steps</b><em>›</em></button>
          <button class="prow" data-action="passed"><span>✕ Passed homes</span><b>${S.passed.length}</b><em>›</em></button>
        </div>

        ${helpCards()}

        <p class="fine center">Tind-A-Home is a class prototype by IP Group 14 (Landen Heine, Ammi Meyer, Kellan Nash). Homes don't pay to be listed or ranked. This is not medical advice and doesn't replace a doctor or social worker. Everything you enter stays in this browser.</p>
        <button class="link-btn danger center-block" data-action="reset">Start over (erase this profile)</button>
      </section>`;
  }

  function helpCards() {
    return `<h2 class="sec-label">Free local help</h2>
      <div class="help">
        <a class="hcard" href="tel:18002723900"><b>Alzheimer's Association</b><small>24/7 helpline with dementia care consultants</small><span>1-800-272-3900</span></a>
        <a class="hcard" href="tel:4024417070"><b>Aging Partners (Lincoln)</b><small>Area Agency on Aging: care management, Medicaid help, ombudsman</small><span>402-441-7070</span></a>
        <a class="hcard" href="https://iserve.nebraska.gov" target="_blank" rel="noopener"><b>iServe Nebraska</b><small>Apply for Nebraska Medicaid online</small><span>iserve.nebraska.gov ↗</span></a>
        <a class="hcard" href="https://www.medicare.gov/care-compare/" target="_blank" rel="noopener"><b>Medicare Care Compare</b><small>Official nursing home ratings and inspections</small><span>medicare.gov ↗</span></a>
      </div>`;
  }

  /* ---------- What to do next ---------- */
  const GUIDE = [
    { t: 'Get the diagnosis in writing', b: () => `Ask ${lovedName()}'s doctor for a written diagnosis and a short summary of daily care needs. Memory care communities and Medicaid usually ask for it.`,
      more: ['Ask the doctor: "What stage is this, and what level of care do you recommend?"', 'Request a copy of the medication list.', 'If no one is the decision-maker yet, ask about power of attorney (healthcare and financial).'] },
    { t: 'Figure out how you\'ll pay', b: () => 'Most long-term dementia care is paid privately until savings run low. Then Medicaid may help. Start early: proving finances took one family we talked to months.',
      more: ['<b>Medicare</b> only pays for short-term skilled nursing or rehab after a hospital stay. It does not pay for long-term memory care.', '<b>Nebraska Medicaid</b> covers nursing homes once assets are spent down. Apply through <a href="https://iserve.nebraska.gov" target="_blank" rel="noopener">iServe Nebraska</a>. Approval can take a month or more.', '<b>VA:</b> veterans and surviving spouses may qualify for <a href="https://www.va.gov/pension/aid-attendance-housebound/" target="_blank" rel="noopener">Aid & Attendance</a>.', '<b>Long-term care insurance:</b> call the insurer to start a claim and ask about the waiting period.'] },
    { t: 'Choose the level of care', b: () => 'Match the care to what they need now, and soon.',
      more: ['<b>Assisted living:</b> an apartment with meals and help with daily tasks. Not always secured.', '<b>Memory care:</b> a secured, dementia-focused setting with trained staff. Good for wandering or confusion.', '<b>Nursing home:</b> 24-hour nursing for heavy medical needs. Rated by Medicare.'] },
    { t: 'Swipe, match and shortlist 2–3 homes', b: () => 'Check safety first, then cost, distance and openings. Use Compare on your Matches page.', link: ['matches', 'Open matches'] },
    { t: 'Tour, and bring your loved one if you can', b: () => 'Visit at a mealtime if possible. Watch how staff treat residents. Visit twice: once scheduled, once drop-in.', more: ['Use the tour checklist in each match.', 'Ask for their latest state inspection report.'] },
    { t: 'Apply and finish the assessments', b: () => 'The home will do its own care assessment before move-in.',
      more: ['Nursing homes that take Medicaid must do a pre-admission screening (PASRR).', 'Gather: photo ID, insurance and Medicare cards, power of attorney, medication list and doctor\'s orders.'] },
    { t: 'Plan the move', b: () => 'Familiar things help a lot with the change.',
      more: ['Bring photos, a favorite chair and blanket, and label clothing.', 'Share routines, likes and triggers with staff (your profile notes are a good start).', 'Nurses told us: avoid things that make them relive a loss, like photos from a spouse\'s funeral.'] },
    { t: 'After the move: check in', b: () => 'Dementia changes over time, and needs will too.',
      more: ['Attend care plan meetings (usually every 3 months).', 'If something isn\'t right, contact the Long-Term Care Ombudsman through Aging Partners (402-441-7070).', 'Take care of yourself too. The Alzheimer\'s Association runs caregiver support groups in Lincoln and Omaha.'] }
  ];

  function guide(view) {
    const done = GUIDE.filter((_, i) => S.guide[i]).length;
    view.innerHTML = `
      <section class="page">
        <h1 class="page-title">What to do next</h1>
        <p class="muted">A step-by-step plan for moving ${esc(lovedName())} into care. Families told us nothing like this existed. Check off steps as you go.</p>
        <div class="pcomp"><div class="bar"><i style="width:${100 * done / GUIDE.length}%"></i></div><small>${done} of ${GUIDE.length} steps done</small></div>
        <ol class="guide">${GUIDE.map((g, i) => `
          <li class="gstep ${S.guide[i] ? 'done' : ''}">
            <button class="gnum" data-action="guide-toggle" data-i="${i}" aria-label="${S.guide[i] ? 'Mark not done' : 'Mark done'}: ${esc(g.t)}">${S.guide[i] ? '✓' : i + 1}</button>
            <div><h3>${esc(g.t)}</h3><p>${esc(g.b())}</p>
              ${g.more ? `<details><summary>Details</summary><ul>${g.more.map(x => `<li>${x}</li>`).join('')}</ul></details>` : ''}
              ${g.link ? `<button class="link-btn" data-action="go" data-view="${g.link[0]}">${g.link[1]} →</button>` : ''}
            </div>
          </li>`).join('')}</ol>
        ${helpCards()}
      </section>`;
  }

  /* ---------- pop-ups ---------- */
  function settings() {
    const st = S.settings;
    App.modal(`
      <div class="detail sheet-pad">
        <div class="sheet-head"><h2>Discovery filters</h2><button class="close-x dark" data-action="close-modal" aria-label="Close">✕</button></div>
        <label class="field"><span>Maximum distance <b class="out" id="set-miles">${S.care.maxMiles} miles</b></span>
          <input type="range" min="5" max="80" step="5" data-bind="care.maxMiles" data-num value="${S.care.maxMiles}" data-out="#set-miles" data-suffix=" miles"></label>
        <div class="field"><span>Show me</span>
          ${Object.keys(LBL.type).map(k => `<label class="switch"><input type="checkbox" data-action="type-toggle" data-value="${k}" ${st.types.includes(k) ? 'checked' : ''}><i></i>${LBL.typeIcon[k]} ${LBL.type[k]}</label>`).join('')}</div>
        <div class="field"><span>Hide</span>
          <label class="switch"><input type="checkbox" data-action="setting" data-key="hidePayNo" ${st.hidePayNo ? 'checked' : ''}><i></i>Homes that don't take any of my payment types</label>
          <label class="switch"><input type="checkbox" data-action="setting" data-key="hideWatchList" ${st.hideWatchList ? 'checked' : ''}><i></i>Homes on Medicare's watch list</label></div>
        <button class="btn btn-grad btn-big" data-action="close-modal">Done</button>
      </div>`, 'modal-sheet');
  }

  function compare() {
    const hs = S.compare.map(byId).filter(Boolean).slice(0, 3);
    const rows = [
      ['Fit', h => `<b class="mscore ${scoreClass(m(h).score)}">${m(h).score}%</b>`],
      ['Type', h => LBL.typeShort[h.type]],
      ['Distance', h => `${m(h).d.toFixed(1)} mi`],
      ['Price', h => priceText(h) + (h.priceEstimated ? '*' : '')],
      ...m(hs[0]).five.map((f, i) => [f.q, h => { const v = m(h).five[i].v; return `<span class="f f-${v}"><i>${FIVE_ICON[v]}</i></span>`; }]),
      ['Medicare stars', h => h.cms ? `${h.cms.overall ?? '–'}★` : '<span class="muted">not rated</span>'],
      ['Family reviews', h => !h.cms && h.rating && h.rating.value ? `${h.rating.value}★ (${h.rating.count})` : '<span class="muted">–</span>'],
      ['Problems at last inspection', h => h.cms ? h.cms.deficiencies ?? '–' : '<span class="muted">ask</span>'],
      ['Memory care', h => ({ dedicated: 'Dementia only', unit: 'Secured unit', ask: 'Ask' })[h.memoryCare]],
      ['Medicaid', h => LBL.pay[h.payment.medicaid]],
      ['VA', h => LBL.pay[h.payment.va]],
      ['Openings', h => h.openings && h.openings.est != null ? `~${h.openings.est}` : 'Ask'],
      ['Status', h => LBL.status[(getMatch(h.id) || {}).status] || '–']
    ];
    App.modal(`
      <div class="detail sheet-pad">
        <div class="sheet-head"><h2>Compare</h2><button class="close-x dark" data-action="close-modal" aria-label="Close">✕</button></div>
        <div class="ctable-wrap"><table class="ctable">
          <thead><tr><th></th>${hs.map(h => `<th><button data-action="detail" data-id="${h.id}">${mini(h)}<span>${esc(h.name)}</span></button></th>`).join('')}</tr></thead>
          <tbody>${rows.map(([l, fn]) => `<tr><th>${l}</th>${hs.map(h => `<td>${fn(h)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <p class="muted small">* estimated from area averages. Compare up to 3 at a time.</p>
      </div>`, 'modal-sheet');
  }

  function shareText() {
    const line = h => { const r = m(h); return `• ${h.name} (${LBL.typeShort[h.type]}, ${h.city}): ${r.score}% fit, ${r.d.toFixed(1)} mi, ${priceText(h)}, ${h.phone}`; };
    const ms = S.matches.map(x => byId(x.id)).filter(Boolean), sv = S.saved.map(byId).filter(Boolean);
    return `Homes we're looking at for ${LovedName()} (from Tind-A-Home)\n\n` +
      (ms.length ? `MATCHES\n${S.matches.map(x => { const h = byId(x.id); return h ? line(h) + ` [${LBL.status[x.status]}]` : ''; }).filter(Boolean).join('\n')}\n\n` : '') +
      (sv.length ? `MAYBE (saved)\n${sv.map(line).join('\n')}\n\n` : '') +
      (!ms.length && !sv.length ? 'No homes picked yet.\n\n' : '') +
      'What do you think? Let\'s pick 2–3 to tour together.';
  }
  function share() {
    const txt = shareText();
    App.modal(`
      <div class="detail sheet-pad">
        <div class="sheet-head"><h2>Share with family</h2><button class="close-x dark" data-action="close-modal" aria-label="Close">✕</button></div>
        <p class="muted">Decisions like this are usually made together. Send your shortlist to siblings or a spouse.</p>
        <textarea id="share-txt" rows="12" class="msg">${esc(txt)}</textarea>
        <div class="d-actions">
          <button class="btn btn-grad" data-action="copy-share">📋 Copy</button>
          <a class="btn btn-ghost" href="mailto:?subject=${encodeURIComponent('Homes for ' + LovedName())}&body=${encodeURIComponent(txt)}">✉️ Email</a>
          <a class="btn btn-ghost" href="sms:?&body=${encodeURIComponent(txt)}">💬 Text</a>
        </div>
      </div>`, 'modal-sheet');
  }

  function passed() {
    const hs = S.passed.map(byId).filter(Boolean);
    App.modal(`
      <div class="detail sheet-pad">
        <div class="sheet-head"><h2>Passed homes</h2><button class="close-x dark" data-action="close-modal" aria-label="Close">✕</button></div>
        ${hs.length ? `<ul class="mlist">${hs.map(h => { const r = m(h); return `<li class="mrow">
          <button class="mrow-main" data-action="detail" data-id="${h.id}">${mini(h)}<span class="mrow-txt"><b>${esc(h.name)}</b><small>${r.d.toFixed(1)} mi · ${r.score}% fit</small></span></button>
          <button class="round r-like" data-action="match-passed" data-id="${h.id}" aria-label="Match ${esc(h.name)}">♥</button>
          <button class="btn btn-sm btn-ghost" data-action="unpass" data-id="${h.id}">Back to deck</button></li>`; }).join('')}</ul>`
          : '<p class="muted">You haven\'t passed on any homes.</p>'}
      </div>`, 'modal-sheet');
  }

  return { matches, saved, profile, guide, settings, compare, share, shareText, passed, GUIDE };
})();
