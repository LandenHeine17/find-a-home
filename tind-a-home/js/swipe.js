/* The swipe deck: card art, drag gestures, buttons, rewind and the "It's a Match!" screen. */
const Swipe = (() => {
  const THRESH_X = 110, THRESH_Y = 120;
  let busy = false;

  /* ---------- card art: a little illustrated building, different for every home ---------- */
  function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const PALETTES = {
    nursing: [['#a1c4fd', '#c2e9fb'], ['#89f7fe', '#66a6ff'], ['#e0c3fc', '#8ec5fc'], ['#cfd9df', '#e2ebf0']],
    memory: [['#fbc2eb', '#a6c1ee'], ['#fdcbf1', '#e6dee9'], ['#ffecd2', '#fcb69f'], ['#f6d365', '#fda085']],
    assisted_memory: [['#d4fc79', '#96e6a1'], ['#84fab0', '#8fd3f4'], ['#fddb92', '#d1fdff'], ['#c1dfc4', '#deecdd']]
  };
  const WALLS = ['#fff8f0', '#f4ecdf', '#e9eef5', '#fbefe9', '#eef6ee', '#f6f1fb'];
  const ROOFS = ['#c0504d', '#5b6c8f', '#7a5c45', '#3f6e5b', '#8d4f7a', '#4c5a67'];
  function art(h, cls = '') {
    const r = hash(h.id), pick = (arr, sh) => arr[(r >>> sh) % arr.length];
    const [c1, c2] = pick(PALETTES[h.type] || PALETTES.nursing, 0);
    const wall = pick(WALLS, 3), roof = pick(ROOFS, 6);
    const wings = 1 + ((r >>> 9) % 3);           // 1-3 building sections
    const floors = h.type === 'nursing' ? 2 + ((r >>> 11) % 2) : 1 + ((r >>> 11) % 2);
    const sun = (r >>> 13) % 2 === 0;
    const trees = 2 + ((r >>> 15) % 3);
    const gid = 'g' + h.id.replace(/\W/g, '');
    let bld = '';
    const W = 300 / wings;
    for (let w = 0; w < wings; w++) {
      const x = 50 + w * (W * 0.92), fh = 34 * floors + (w === Math.floor(wings / 2) ? 14 : 0), y = 250 - fh, bw = W * 0.9;
      bld += `<rect x="${x}" y="${y}" width="${bw}" height="${fh}" rx="3" fill="${wall}" stroke="rgba(0,0,0,.08)"/>`;
      bld += (r >>> (17 + w)) % 2
        ? `<path d="M${x - 8} ${y} L${x + bw / 2} ${y - 34} L${x + bw + 8} ${y} Z" fill="${roof}"/>`
        : `<rect x="${x - 6}" y="${y - 10}" width="${bw + 12}" height="12" rx="2" fill="${roof}"/>`;
      for (let f = 0; f < floors; f++) {
        const cols = Math.max(2, Math.floor(bw / 30));
        for (let c = 0; c < cols; c++) {
          const wx = x + 10 + c * ((bw - 20) / cols), wy = y + 10 + f * 34;
          bld += `<rect x="${wx}" y="${wy}" width="${(bw - 20) / cols - 8}" height="18" rx="2" fill="${(r >>> (c + f)) % 5 === 0 ? '#ffe9a8' : '#bcd3ea'}"/>`;
        }
      }
    }
    // door + awning on the middle section
    bld += `<rect x="186" y="222" width="28" height="28" rx="3" fill="${roof}" opacity=".9"/><path d="M178 222h44l-6-10h-32z" fill="${roof}"/>`;
    let tr = '';
    for (let t = 0; t < trees; t++) {
      const tx = t % 2 ? 340 - t * 14 : 22 + t * 12, s = 0.8 + ((r >>> (t + 5)) % 4) / 10;
      tr += `<g transform="translate(${tx} ${250 - 46 * s}) scale(${s})"><rect x="-3" y="30" width="6" height="18" fill="#7a5c45"/><circle cy="18" r="20" fill="#5fb072"/><circle cx="-9" cy="26" r="13" fill="#4f9f62"/><circle cx="10" cy="26" r="13" fill="#6cc080"/></g>`;
    }
    return `<svg class="art ${cls}" viewBox="0 -40 400 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
      <rect y="-400" width="400" height="1100" fill="url(#${gid})"/>
      ${sun ? '<circle cx="330" cy="62" r="26" fill="#fff6c8" opacity=".9"/>' : '<g fill="#fff" opacity=".85"><ellipse cx="90" cy="60" rx="34" ry="12"/><ellipse cx="300" cy="80" rx="42" ry="13"/></g>'}
      <path d="M0 240 Q200 222 400 240 V700 H0Z" fill="#8fd18f"/>
      ${bld}${tr}
      <path d="M170 250 Q200 290 176 340 Q150 420 120 700 H280 Q250 420 224 340 Q200 290 214 250Z" fill="#e8dcc6"/>
    </svg>`;
  }

  /* ---------- deck ---------- */
  function cardHTML(h, i) {
    const r = m(h);
    const stars = h.cms ? `${h.cms.overall ?? '–'}★ Medicare` : h.rating && h.rating.value ? `${h.rating.value}★ reviews` : 'No ratings yet';
    return `
      <article class="card" data-id="${h.id}" style="--i:${i}" ${i === 0 ? 'tabindex="0" aria-label="' + esc(h.name) + '. ' + r.score + ' percent fit. Arrow keys to swipe, Enter for details."' : 'aria-hidden="true"'}>
        ${art(h)}
        <span class="type-pill">${LBL.typeIcon[h.type]} ${LBL.typeShort[h.type]}</span>
        <div class="score-ring ${scoreClass(r.score)}" style="--p:${r.score}"><b>${r.score}%</b><small>fit</small></div>
        <div class="stamp stamp-like">MATCH</div>
        <div class="stamp stamp-nope">PASS</div>
        <div class="stamp stamp-save">SAVE</div>
        <div class="card-info">
          <h2>${esc(h.name)}</h2>
          <p class="card-sub">📍 ${esc(h.city)} · ${r.d.toFixed(1)} mi &nbsp; 💵 ${priceText(h)}${h.priceEstimated ? '*' : ''} &nbsp; ⭐ ${stars}</p>
          <div class="five">${r.five.map(f => `<span class="f f-${f.v}" title="${f.q} ${f.v}"><i>${FIVE_ICON[f.v]}</i>${f.q.replace('?', '')}</span>`).join('')}</div>
          <div class="reasons">
            ${r.good.slice(0, 2).map(g => `<span class="rs rs-good">${esc(g)}</span>`).join('')}
            ${r.warn.slice(0, 1).map(w => `<span class="rs rs-warn">⚠ ${esc(w)}</span>`).join('')}
          </div>
          <button class="info-btn" data-action="detail" data-id="${h.id}" aria-label="More about ${esc(h.name)}">i</button>
        </div>
      </article>`;
  }

  function render(view) {
    const list = deck();
    const top = list.slice(0, 3);
    const more = hiddenByDistance();
    view.innerHTML = `
      <section class="swipe">
        <div class="deck-head">
          <span>${list.length ? `<b>${list.length}</b> home${list.length === 1 ? '' : 's'} to go for ${esc(lovedName())}` : ''}</span>
          <button class="link-btn" data-action="open-settings">⚙︎ Filters</button>
        </div>
        <div class="deck" id="deck">
          ${top.length ? top.map(cardHTML).reverse().join('') : `
            <div class="deck-empty">
              <div class="pulse-av">${S.person.avatar}</div>
              <h2>You've seen every home${S.care.maxMiles ? ` within ${S.care.maxMiles} miles` : ''}</h2>
              <p class="muted">${S.matches.length ? `You have <b>${S.matches.length}</b> match${S.matches.length === 1 ? '' : 'es'}. Next step: compare them and plan tours.` : 'No matches yet. Try widening your search or give passed homes a second look.'}</p>
              <div class="stack">
                ${S.matches.length ? '<button class="btn btn-grad" data-action="go" data-view="matches">💞 See my matches</button>' : ''}
                ${more ? `<button class="btn btn-ghost" data-action="widen">Widen search (+${more} homes farther away)</button>` : ''}
                ${S.passed.length ? `<button class="btn btn-ghost" data-action="recycle">Give ${S.passed.length} passed home${S.passed.length === 1 ? '' : 's'} another look</button>` : ''}
                <button class="btn btn-ghost" data-action="open-settings">Change filters</button>
              </div>
            </div>`}
        </div>
        <div class="actions" role="group" aria-label="Swipe buttons">
          <button class="act act-sm act-rewind" data-action="rewind" ${S.history.length ? '' : 'disabled'} aria-label="Undo last swipe" title="Undo (Backspace)">↺</button>
          <button class="act act-nope" data-action="swipe" data-dir="left" ${top.length ? '' : 'disabled'} aria-label="Pass" title="Pass (←)">✕</button>
          <button class="act act-sm act-save" data-action="swipe" data-dir="up" ${top.length ? '' : 'disabled'} aria-label="Save for later" title="Save (↑)">★</button>
          <button class="act act-like" data-action="swipe" data-dir="right" ${top.length ? '' : 'disabled'} aria-label="Match" title="Match (→)">♥</button>
          <button class="act act-sm act-info" data-action="detail-top" ${top.length ? '' : 'disabled'} aria-label="Details" title="Details (Enter)">i</button>
        </div>
        <p class="hint-keys">Drag the card, or use ← ↑ → on your keyboard. Swipe up to save.</p>
      </section>`;
    bindDrag();
  }

  function topCard() { return $('#deck .card:last-of-type'); }

  /* ---------- drag ---------- */
  function bindDrag() {
    const card = topCard(); if (!card) return;
    let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false, moved = false, pid = null;
    const like = $('.stamp-like', card), nope = $('.stamp-nope', card), sav = $('.stamp-save', card);
    const setStamps = () => {
      like.style.opacity = Math.max(0, Math.min(1, dx / THRESH_X));
      nope.style.opacity = Math.max(0, Math.min(1, -dx / THRESH_X));
      sav.style.opacity = Math.abs(dx) < 60 ? Math.max(0, Math.min(1, -dy / THRESH_Y)) : 0;
    };
    card.addEventListener('pointerdown', e => {
      if (busy || e.button > 0 || e.target.closest('.info-btn')) return;
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY; dx = dy = 0; pid = e.pointerId;
      card.setPointerCapture(pid); card.classList.add('dragging');
    });
    card.addEventListener('pointermove', e => {
      if (!dragging) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
      setStamps();
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; card.classList.remove('dragging');
      if (!moved) { card.style.transform = ''; return Detail.open(card.dataset.id); }
      if (dx > THRESH_X) fly('right');
      else if (dx < -THRESH_X) fly('left');
      else if (dy < -THRESH_Y && Math.abs(dx) < 90) fly('up');
      else { card.style.transform = ''; dx = dy = 0; setStamps(); }
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }

  /* ---------- actions ---------- */
  function fly(dir) {
    const card = topCard(); if (!card || busy) return;
    busy = true;
    const id = card.dataset.id;
    const stamp = { right: '.stamp-like', left: '.stamp-nope', up: '.stamp-save' }[dir];
    $(stamp, card).style.opacity = 1;
    card.classList.add('flying');
    const w = window.innerWidth;
    card.style.transform = dir === 'up' ? 'translate(0, -120vh) rotate(0)' : `translate(${dir === 'right' ? w : -w}px, 40px) rotate(${dir === 'right' ? 30 : -30}deg)`;
    setTimeout(() => { busy = false; decide(id, dir); }, 320);
  }

  function decide(id, dir) {
    const h = byId(id);
    if (dir === 'right') { addMatch(id); S.history.push({ id, action: 'match' }); }
    else if (dir === 'up') { if (!isSaved(id)) S.saved.unshift(id); S.history.push({ id, action: 'save' }); toast(`⭐ Saved <b>${esc(h.name)}</b> for later`, 'blue'); }
    else { if (!S.passed.includes(id)) S.passed.push(id); S.history.push({ id, action: 'pass' }); }
    S.history = S.history.slice(-30);
    save();
    App.render();
    if (dir === 'right') showMatch(id);
  }

  function rewind() {
    const last = S.history.pop(); if (!last) return;
    const { id, action } = last;
    if (action === 'match') S.matches = S.matches.filter(x => x.id !== id);
    if (action === 'save') S.saved = S.saved.filter(x => x !== id);
    if (action === 'pass') S.passed = S.passed.filter(x => x !== id);
    save(); App.render();
    toast(`↺ Brought back <b>${esc(byId(id).name)}</b>`);
  }

  /* ---------- "It's a Match!" ---------- */
  function showMatch(id) {
    const h = byId(id), r = m(h);
    const yes = r.five.filter(f => f.v === 'yes').length;
    const nos = r.five.filter(f => f.v === 'no');
    App.modal(`
      <div class="match-screen">
        <h1 class="match-title">It's a Match!</h1>
        <p class="match-sub">${esc(LovedName())} and <b>${esc(h.name)}</b> check <b>${yes} of 5</b> boxes that families told us matter most.</p>
        <div class="match-pair">
          <div class="mp mp-l"><span>${S.person.avatar}</span></div>
          <div class="mp-heart">♥</div>
          <div class="mp mp-r">${art(h, 'art-round')}</div>
        </div>
        <div class="five five-big">${r.five.map(f => `<span class="f f-${f.v}"><i>${FIVE_ICON[f.v]}</i>${f.q}</span>`).join('')}</div>
        ${nos.length ? `<p class="match-warn">⚠ Heads up: ${esc(r.warn.slice(0, 2).join(' · '))}</p>` : ''}
        <button class="btn btn-grad btn-big" data-action="tour" data-id="${id}">📅 Plan a tour</button>
        <button class="btn btn-white" data-action="detail" data-id="${id}">See everything about this home</button>
        <button class="link-btn light" data-action="close-modal">Keep swiping</button>
      </div>`, 'modal-match');
    const mt = getMatch(id); if (mt) { mt.seen = true; save(); App.badges(); }
  }

  return { render, fly, rewind, art, showMatch, isBusy: () => busy };
})();
