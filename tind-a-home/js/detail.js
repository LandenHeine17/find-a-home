/* Home detail ("their profile") and the tour planner for a match. */
const TOUR_QS = [
  'Do you have a secured (locked) memory care unit?', 'How many staff are on duty during the day? At night?',
  'What dementia training do caregivers get?', 'What did your last state inspection find?',
  'Do you accept our payment type? What happens if we run out of savings?', 'What is included in the base price, and what costs extra?',
  'Is there a waitlist? How long is it?', 'How do you handle wandering, falls and agitation?',
  'Can we visit any time? Can family join meals?', 'When would residents need to move to a higher level of care?',
  'Watch: are residents engaged, clean and calm? Do staff know them by name?'
];
function tourQuestions() {
  return [...S.person.likes.filter(k => LIKE_QS[k]).map(k => LIKE_QS[k]), ...TOUR_QS];
}

const Detail = (() => {
  const yn = v => `<span class="pv pv-${v}">${LBL.pay[v] || v}</span>`;
  const stars = n => n == null ? '<span class="muted">n/a</span>' : `<span class="stars" aria-label="${n} of 5">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
  const sevWord = { 1: 'Minor', 2: 'Could cause harm', 3: 'Resident harmed', 4: 'Serious danger' };

  function section(f, title, body) {
    return `<section class="d-sec">
      <h3><span class="f f-${f.v}"><i>${FIVE_ICON[f.v]}</i></span> ${title}</h3>${body}</section>`;
  }

  function safety(h) {
    const A = DATA.averages;
    if (!h.cms) {
      return `${h.rating && h.rating.value ? `<p><b>${h.rating.value}★</b> from ${h.rating.count} family review${h.rating.count === 1 ? '' : 's'} <small class="muted">(${esc(h.rating.source)})</small></p>` : '<p>No family reviews found yet.</p>'}
        <p class="note">Assisted living and memory care communities are licensed by Nebraska DHHS, not rated by Medicare. On your tour, <b>ask to see their most recent state inspection report</b>.</p>`;
    }
    const c = h.cms;
    const qrows = h.quality.map(q => {
      const bad = q.value != null && q.value > q.ne * 1.3, good = q.value != null && q.value < q.ne * 0.8;
      return `<tr><td>${esc(q.label)}</td><td class="${bad ? 'bad' : good ? 'good' : ''}">${q.value ?? 'n/a'}${q.value != null ? '%' : ''}</td><td class="muted">${q.ne}%</td></tr>`;
    }).join('');
    return `
      ${c.sff ? '<p class="alert">🚩 This home is on Medicare\'s Special Focus Facility list (homes with a history of serious problems).</p>' : c.sffCandidate ? '<p class="alert">🚩 Candidate for Medicare\'s Special Focus watch list.</p>' : ''}
      ${c.abuse ? '<p class="alert">🚩 Medicare flagged this home for an abuse citation.</p>' : ''}
      <div class="ratings">
        <div><small>Overall</small>${stars(c.overall)}</div><div><small>Inspections</small>${stars(c.inspection)}</div>
        <div><small>Staffing</small>${stars(c.staffing)}</div><div><small>Quality</small>${stars(c.quality)}</div>
      </div>
      <ul class="facts">
        <li><b>${c.deficiencies ?? '–'}</b> problems found at the last inspection${c.inspectionDate ? ` (${esc(c.inspectionDate)})` : ''}. Nebraska average: ${A.neDeficiencies}.</li>
        ${c.complaintDeficiencies ? `<li><b>${c.complaintDeficiencies}</b> came from complaints by residents or families.</li>` : ''}
        ${c.nurseHours ? `<li><b>${c.nurseHours}</b> nurse hours per resident per day (NE avg ${A.neNurseHours}).</li>` : ''}
        ${c.turnover ? `<li><b>${c.turnover}%</b> of nursing staff left in a year (NE avg ${A.neTurnover}%).</li>` : ''}
        ${c.fines ? `<li><b>${c.fines}</b> fine${c.fines === 1 ? '' : 's'}${c.fineDollars ? ` totaling $${fmt(c.fineDollars)}` : ''} in the last 3 years.</li>` : '<li>No fines in the last 3 years.</li>'}
        ${c.ownership ? `<li>Ownership: ${esc(c.ownership)}${c.familyCouncil ? ' · Has a family council' : ''}</li>` : ''}
      </ul>
      ${h.citations.length ? `<details class="d-more"><summary>Latest inspection citations (${h.citations.length})</summary>
        <ul class="cites">${h.citations.map(ci => `<li class="sev-${ci.sev}"><b>${esc(ci.title)}</b><small>${sevWord[ci.sev] || ''}${ci.dementia ? ' · dementia-related' : ''}${ci.complaint ? ' · from a complaint' : ''}${ci.corrected ? ' · corrected' : ''} · ${esc(ci.date)}</small></li>`).join('')}</ul></details>` : ''}
      ${qrows ? `<details class="d-more"><summary>Dementia-related quality measures</summary>
        <table class="qtable"><thead><tr><th>Long-stay residents with…</th><th>Here</th><th>NE avg</th></tr></thead><tbody>${qrows}</tbody></table>
        <p class="muted small">Lower is better for all of these. High antipsychotic use can mean behaviors are being sedated instead of managed.</p></details>` : ''}`;
  }

  function payment(h) {
    const mine = S.care.payment;
    return `
      <p class="price">${priceText(h)} ${h.priceEstimated ? '<small class="muted">estimate</small>' : ''}</p>
      ${h.priceNote ? `<p class="muted small">${esc(h.priceNote)}</p>` : ''}
      <table class="paytable">${Object.keys(LBL.payment).map(k => `<tr class="${mine.includes(k) ? 'mine' : ''}"><td>${LBL.paymentIcon[k]} ${LBL.payment[k]}${mine.includes(k) ? ' <small>(yours)</small>' : ''}</td><td>${yn(h.payment[k])}</td></tr>`).join('')}</table>`;
  }

  function dementiaCare(h) {
    const mc = { dedicated: 'This community cares only for people with Alzheimer\'s and other dementias.', unit: 'Has a secured memory care unit, separate from other residents.', ask: 'We could not confirm a secured memory care unit. Ask on the phone before touring.' }[h.memoryCare];
    const typeTxt = {
      nursing: '<b>Nursing home:</b> 24-hour licensed nurses. Best for heavy medical needs or late-stage dementia. Rated by Medicare.',
      memory: '<b>Memory care:</b> a secured, dementia-focused home with trained staff. Good for wandering, confusion and middle-stage dementia.',
      assisted_memory: '<b>Assisted living + memory care:</b> apartments with help for daily tasks, plus a secured memory wing they can move into as needs grow.'
    }[h.type];
    return `<p>${mc}</p>
      <ul class="facts">
        ${h.memoryUnits ? `<li><b>${h.memoryUnits}</b> memory care spots</li>` : ''}
        ${h.behavioral ? '<li>Accepts residents with behavior needs (agitation, aggression)</li>' : ''}
      </ul>
      <p class="note">${typeTxt}</p>`;
  }

  function open(id) {
    const h = byId(id); if (!h) return;
    const r = m(h), f = Object.fromEntries(r.five.map(x => [x.k, x]));
    const matched = isMatched(id), saved = isSaved(id);
    App.modal(`
      <div class="detail">
        <div class="d-hero">${Swipe.art(h)}
          <button class="close-x" data-action="close-modal" aria-label="Close">✕</button>
          <div class="d-hero-info">
            <span class="type-pill static">${LBL.typeIcon[h.type]} ${LBL.type[h.type]}</span>
            <h2>${esc(h.name)}</h2>
            <p>${esc(h.address)}</p>
          </div>
          <div class="score-ring ${scoreClass(r.score)}" style="--p:${r.score}"><b>${r.score}%</b><small>fit</small></div>
        </div>

        <div class="d-actions">
          ${matched ? `<button class="btn btn-grad" data-action="tour" data-id="${id}">📅 Plan tour</button>`
                    : `<button class="btn btn-grad" data-action="match-from-detail" data-id="${id}">♥ Match</button>`}
          <button class="btn btn-ghost ${saved ? 'on' : ''}" data-action="save-toggle" data-id="${id}">${saved ? '★ Saved' : '☆ Save'}</button>
          <a class="btn btn-ghost" href="${telUrl(h)}">📞 Call</a>
          <a class="btn btn-ghost" href="${mapsUrl(h)}" target="_blank" rel="noopener">🧭 Directions</a>
        </div>

        <section class="d-sec d-why">
          <h3>Why ${scoreWord(r.score).toLowerCase()} for ${esc(lovedName())}</h3>
          <div class="five five-big">${r.five.map(x => `<span class="f f-${x.v}"><i>${FIVE_ICON[x.v]}</i>${x.q}</span>`).join('')}</div>
          <div class="reasons">
            ${r.good.map(g => `<span class="rs rs-good">✓ ${esc(g)}</span>`).join('')}
            ${r.warn.map(w => `<span class="rs rs-warn">⚠ ${esc(w)}</span>`).join('')}
          </div>
        </section>

        ${h.bio ? `<section class="d-sec"><h3>About</h3><p>${esc(h.bio)}</p></section>` : ''}
        ${section(f.safe, 'Is it safe?', safety(h))}
        ${section(f.pay, 'Can we pay?', payment(h))}
        ${section(f.dementia, 'Can they care for dementia?', dementiaCare(h))}
        ${section(f.close, 'Is it close?', `<p><b>${r.d.toFixed(1)} miles</b> from ZIP ${esc(S.care.zip || 'Lincoln')} (straight line). ${esc(h.city)}, ${esc(h.area || '')}.</p>
          <p><a href="${mapsUrl(h)}" target="_blank" rel="noopener">Get driving directions ↗</a></p>`)}
        ${section(f.room, 'Is there room?', `<p>${h.openings && h.openings.est != null ? `About <b>${h.openings.est}</b> bed${h.openings.est === 1 ? '' : 's'} may be open.` : 'Openings are not published.'}${h.beds ? ` ${h.beds} beds total.` : ''}</p>
          <p class="muted small">${esc(h.openings && h.openings.note || 'Call to ask about openings and waitlists.')}</p>`)}

        <section class="d-sec">
          <h3>📋 Ask on your tour</h3>
          <ul class="qs">${tourQuestions().slice(0, 6).map(q => `<li>${esc(q)}</li>`).join('')}</ul>
          ${matched ? `<button class="link-btn" data-action="tour" data-id="${id}">Open the full checklist →</button>` : ''}
        </section>

        <section class="d-sec d-contact">
          <h3>Contact</h3>
          <p>📞 <a href="${telUrl(h)}">${esc(h.phone)}</a></p>
          ${h.website ? `<p>🌐 <a href="${esc(h.website)}" target="_blank" rel="noopener">${esc(h.website.replace(/^https?:\/\/(www\.)?/, ''))}</a></p>` : ''}
          ${h.careCompare ? `<p>🏛️ <a href="${esc(h.careCompare)}" target="_blank" rel="noopener">Full report on Medicare Care Compare ↗</a></p>` : ''}
        </section>

        <details class="d-sources"><summary>Where this information comes from</summary><ul>${(h.sources || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          <p>Prices marked as estimates are area averages. Always confirm price, payment and openings with the home.</p></details>

        <div class="d-foot">
          ${matched ? `<button class="link-btn danger" data-action="unmatch" data-id="${id}">Unmatch</button>`
                    : `<button class="btn btn-ghost" data-action="pass-from-detail" data-id="${id}">✕ Not for us</button>`}
        </div>
      </div>`, 'modal-sheet');
  }

  /* ---------- tour planner ---------- */
  function tour(id) {
    const h = byId(id); if (!h) return;
    if (!isMatched(id)) addMatch(id);
    const t = S.tours[id] || {};
    const mt = getMatch(id);
    const checked = S.checks[id] || [];
    const qs = tourQuestions();
    const today = new Date().toISOString().slice(0, 10);
    App.modal(`
      <div class="detail tour">
        <div class="tour-head">
          <div class="th-art">${Swipe.art(h, 'art-round')}</div>
          <div><h2>Plan a tour</h2><p class="muted">${esc(h.name)}</p></div>
          <button class="close-x dark" data-action="close-modal" aria-label="Close">✕</button>
        </div>

        <div class="pipeline" role="group" aria-label="Status">
          ${Object.entries(LBL.status).map(([k, v]) => `<button class="pl ${mt.status === k ? 'on' : ''}" data-action="set-status" data-id="${id}" data-value="${k}">${v}</button>`).join('')}
        </div>

        <section class="d-sec">
          <h3>1. Pick a time</h3>
          <div class="row2">
            <label class="field"><span>Preferred day</span><input type="date" min="${today}" id="t-date" value="${esc(t.date || '')}"></label>
            <label class="field"><span>Time of day</span><select id="t-time">${['Morning', 'Around lunch (see a meal)', 'Afternoon', 'Evening'].map(x => `<option ${t.time === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          </div>
          <div class="field"><span>Will ${esc(lovedName())} come along?</span>
            <div class="chips">${[['yes', 'Yes'], ['no', 'Family only'], ['unsure', 'Not sure yet']].map(([k, v]) => `<button type="button" class="chip ${(t.withLO || 'unsure') === k ? 'on' : ''}" data-action="tour-with" data-id="${id}" data-value="${k}">${v}</button>`).join('')}</div>
            <small class="muted">Families told us watching their loved one's reaction helped them decide.</small></div>
        </section>

        <section class="d-sec">
          <h3>2. Send this message</h3>
          <textarea id="t-msg" rows="7" class="msg">${esc(tourMessage(h, t))}</textarea>
          <div class="d-actions">
            <a class="btn btn-grad" href="${telUrl(h)}">📞 Call ${esc(h.phone)}</a>
            <button class="btn btn-ghost" data-action="copy-msg">📋 Copy message</button>
          </div>
          <button class="btn btn-white wide" data-action="tour-sent" data-id="${id}">${t.sent ? '✓ Tour requested. Update details' : '✓ I called / sent it. Mark tour requested'}</button>
        </section>

        <section class="d-sec">
          <h3>3. On the tour (${checked.length}/${qs.length})</h3>
          <ul class="checklist">${qs.map((q, i) => `<li><label><input type="checkbox" data-action="tour-check" data-id="${id}" data-i="${i}" ${checked.includes(i) ? 'checked' : ''}> <span>${esc(q)}</span></label></li>`).join('')}</ul>
        </section>

        <section class="d-sec">
          <h3>4. Your notes</h3>
          <textarea rows="4" data-note="${id}" placeholder="How did it feel? Did staff know residents by name? Smell? Activities going on?">${esc(S.notes[id] || '')}</textarea>
          <small class="muted">Saved automatically on this device.</small>
        </section>
      </div>`, 'modal-sheet');
  }

  function tourMessage(h, t) {
    const P = S.person, C = S.care;
    const needs = [
      P.stage && P.stage !== 'unsure' ? LBL.stage[P.stage].toLowerCase() + ' dementia' : 'dementia',
      ...P.behaviors.filter(b => b !== 'none').map(b => LBL.behaviors[b].toLowerCase()),
      P.mobility ? LBL.mobility[P.mobility].toLowerCase() : ''
    ].filter(Boolean);
    const pays = C.payment.map(k => LBL.payment[k]).join(', ');
    return `Hello, my name is ${S.you.name || '[your name]'}. I'm looking for a place for my ${(S.you.relation || 'loved one').toLowerCase()}, ${P.name || '[name]'}${P.age ? ` (${P.age})` : ''}, who has ${needs.join(', ')}.

Could we schedule a tour${t.date ? ` on ${new Date(t.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` : ''}${t.time ? `, ${t.time.toLowerCase()}` : ''}?

Before we come, could you confirm:
• Do you have an opening${C.timeline === 'now' ? ' soon' : ''}, or a waitlist?
• Do you accept ${pays || 'our payment type'}?
• Do you have a secured memory care area?

Thank you!`;
  }

  return { open, tour, tourMessage };
})();
