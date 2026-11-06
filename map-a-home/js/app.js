/* App shell: tab switching (tap or swipe), one click handler for every button, modals. */
const TABS = ['ai', 'home', 'map'];

const App = {
  go(tab) {
    if (!TABS.includes(tab)) return;
    S.tab = tab; save();
    $('#track').style.transform = `translateX(${-TABS.indexOf(tab) * 100 / 3}%)`;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.body.dataset.tab = tab;
    if (tab === 'map') {
      MapTab.init();
      setTimeout(() => MapTab.map && MapTab.map.invalidateSize(), 320);
    }
    if (tab === 'ai') setTimeout(() => { const i = $('#chat-text'); if (i && window.innerWidth > 700) i.focus(); }, 320);
  },

  refresh({ skipChat = false } = {}) {
    const pct = completeness();
    $('#tb-emoji').textContent = S.person.avatar;
    $('#tb-name').textContent = S.person.name || 'Your loved one';
    $('#tb-xp').style.width = pct + '%';
    $('#tb-xp-label').textContent = `Profile ${pct}%`;
    $('#tb-hearts').textContent = S.hearts.length;
    $('#tb-tours').textContent = S.tours.length;
    Home.render();
    MapTab.render();
    if (MapTab.openId) MapTab.open(MapTab.openId, { fly: false });
    if (!skipChat) Chat.render();
  },

  modal(html, cls = '') {
    const m = $('#modal');
    m.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true"><button class="sheet-x" data-action="close" aria-label="Close">✖</button>${html}</div>`;
    m.hidden = false;
  },
  closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; },

  celebrate(title, sub) {
    this.modal(`
      <div class="celebrate">
        <div class="burst">🎉</div>
        <h2>${esc(title)}</h2>
        <p>${sub}</p>
        <button class="btn btn-green full" data-action="close">Awesome!</button>
      </div>`, 'small');
  }
};

/* ---------- one click handler for everything ---------- */
const ACTIONS = {
  go: el => App.go(el.dataset.tab),
  close: () => App.closeModal(),
  'close-sheet': () => MapTab.close(),
  'map-filter': el => { S.mapFilter = el.dataset.f; save(); MapTab.close(); MapTab.render(); },
  'best-match': () => {
    const best = MapTab.visible()[0] || ranked()[0];
    if (best) MapTab.open(best.p.id);
  },
  'open-home': el => {
    App.closeModal();
    App.go('map');
    setTimeout(() => MapTab.open(el.dataset.id), 350);
  },
  heart: el => toggleHeart(el.dataset.id),
  info: el => MapTab.info(el.dataset.id),
  tour: el => MapTab.tour(el.dataset.id),
  'cancel-tour': el => {
    S.tours = S.tours.filter(t => t.tid !== el.dataset.tid); save(); App.refresh();
    toast('Tour canceled');
  },
  'ask-about': el => {
    App.go('ai');
    Chat.send(`Tell me about ${byId(el.dataset.id).name}`);
  },
  edit: () => Home.edit(),
  'pick-avatar': () => Home.pickAvatar(),
  'set-avatar': el => { S.person.avatar = el.dataset.a; save(); App.closeModal(); App.refresh(); },
  reset: () => {
    if (!confirm('Erase the profile, saved homes, tours and chat?')) return;
    resetAll(); MapTab.close(); Chat.start(); App.refresh(); App.go('home');
  },
  'chat-chip': el => Chat.send(el.dataset.t),
  'chat-toggle': el => {
    const t = el.dataset.t;
    const none = /^none/i.test(t);
    if (none) Chat.multiSel.clear();
    else [...Chat.multiSel].forEach(x => /^none/i.test(x) && Chat.multiSel.delete(x));
    Chat.multiSel.has(t) ? Chat.multiSel.delete(t) : Chat.multiSel.add(t);
    Chat.render();
  },
  'chat-multi-send': () => { if (Chat.multiSel.size) Chat.send([...Chat.multiSel].join(', ')); },
  'chat-restart': () => Chat.restart()
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) {
    if (e.target.id === 'modal') App.closeModal();
    return;
  }
  const fn = ACTIONS[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#modal').hidden) App.closeModal(); else MapTab.close(); }
});

/* ---------- swipe between tabs (not on the map, where dragging pans) ---------- */
(() => {
  let x0 = null, y0 = null;
  const vp = $('.viewport');
  vp.addEventListener('touchstart', e => {
    if (S.tab === 'map' || e.target.closest('.chat-chips, input, textarea')) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  vp.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const i = TABS.indexOf(S.tab) + (dx < 0 ? 1 : -1);
      if (i >= 0 && i < TABS.length) App.go(TABS[i]);
    }
    x0 = null;
  });
})();

/* ---------- start ---------- */
Chat.start();
App.refresh();
App.go(S.tab || 'home');
