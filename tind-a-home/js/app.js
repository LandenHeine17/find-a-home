/* App controller: which screen is showing, the pop-up layer, and one delegated handler for every click. */
const App = (() => {
  let view = 'swipe';
  const VIEWS = { swipe: Swipe.render, matches: Views.matches, saved: Views.saved, profile: Views.profile, guide: Views.guide, onboarding: Onboarding.render };

  function go(v) {
    closeModal();
    view = v;
    if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
    render();
    $('#view').scrollTop = 0; window.scrollTo(0, 0);
  }

  function render() {
    const needsOb = !S.onboarded || view === 'onboarding';
    const v = needsOb ? 'onboarding' : view;
    document.body.dataset.view = v;
    clearMatchCache();
    (VIEWS[v] || Swipe.render)($('#view'));
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
    $('#tb-avatar').textContent = S.person.avatar;
    badges();
  }

  function badges() {
    const nm = S.matches.filter(x => !x.seen).length;
    const b1 = $('#badge-matches'); b1.hidden = !nm; b1.textContent = nm;
    const b2 = $('#badge-saved'); b2.hidden = !S.saved.length; b2.textContent = S.saved.length;
  }

  /* ---------- modal layer ---------- */
  let lastFocus = null;
  function modal(html, cls = '') {
    const w = $('#modal');
    if (w.hidden) lastFocus = document.activeElement;
    w.className = 'modal-wrap ' + cls;
    w.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    w.hidden = false;
    $('.modal', w).scrollTop = 0;
    requestAnimationFrame(() => { w.classList.add('in'); const f = $('button, a, input', w); if (f) f.focus({ preventScroll: true }); });
  }
  function closeModal() {
    const w = $('#modal');
    if (w.hidden) return;
    w.hidden = true; w.classList.remove('in'); w.innerHTML = '';
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  const modalOpen = () => !$('#modal').hidden;

  /* ---------- helpers for data-field paths like "person.behaviors" ---------- */
  function getPath(p) { return p.split('.').reduce((o, k) => o[k], S); }
  function setPath(p, v) { const ks = p.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], S)[last] = v; }

  async function copy(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg, 'good'); }
    catch (e) { toast('Select the text and copy it manually'); }
  }

  /* ---------- clicks ---------- */
  const ACTIONS = {
    go: el => go(el.dataset.view),
    'ob-next': () => Onboarding.next(),
    'ob-back': () => Onboarding.back(),
    edit: el => Onboarding.edit(el.dataset.step),

    pick: el => {
      setPath(el.dataset.field, el.dataset.value); save();
      if (view === 'onboarding' || !S.onboarded) { rerenderOb(); }
    },
    toggle: el => {
      const arr = getPath(el.dataset.field), v = el.dataset.value;
      const i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1);
      else {
        if (v === 'none') arr.length = 0; else { const n = arr.indexOf('none'); if (n >= 0) arr.splice(n, 1); }
        if (el.dataset.field === 'person.likes' && arr.length >= 6) return toast('Pick up to 6. Tap one to remove it first.');
        arr.push(v);
      }
      save(); rerenderOb();
    },

    swipe: el => Swipe.fly(el.dataset.dir),
    rewind: () => Swipe.rewind(),
    'detail-top': () => { const c = $('#deck .card:last-of-type'); if (c) Detail.open(c.dataset.id); },
    detail: el => Detail.open(el.dataset.id),
    'close-modal': () => { closeModal(); if (view !== 'swipe') render(); },

    'match-from-detail': el => { const id = el.dataset.id; S.history.push({ id, action: 'match' }); addMatch(id); S.saved = S.saved.filter(x => x !== id); save(); closeModal(); render(); Swipe.showMatch(id); },
    'pass-from-detail': el => { const id = el.dataset.id; if (view === 'swipe' && $(`#deck .card:last-of-type[data-id="${id}"]`)) { closeModal(); Swipe.fly('left'); return; } if (!S.passed.includes(id)) S.passed.push(id); S.saved = S.saved.filter(x => x !== id); save(); closeModal(); render(); },
    'save-toggle': el => { const on = toggleSave(el.dataset.id); toast(on ? '⭐ Saved for later' : 'Removed from saved', on ? 'blue' : ''); el.classList.toggle('on', on); el.textContent = on ? '★ Saved' : '☆ Save'; badges(); },
    unmatch: el => { const h = byId(el.dataset.id); if (!confirm(`Unmatch ${h.name}? Your tour notes for it will be kept.`)) return; unmatch(el.dataset.id); S.passed.push(el.dataset.id); save(); closeModal(); render(); toast('Unmatched'); },
    unsave: el => { toggleSave(el.dataset.id); S.passed.push(el.dataset.id); save(); render(); },
    'match-saved': el => { const id = el.dataset.id; S.saved = S.saved.filter(x => x !== id); addMatch(id); render(); Swipe.showMatch(id); },
    'match-passed': el => { const id = el.dataset.id; addMatch(id); render(); Swipe.showMatch(id); },
    unpass: el => { S.passed = S.passed.filter(x => x !== el.dataset.id); save(); Views.passed(); render(); toast('Back in your deck'); },
    recycle: () => { S.passed = []; save(); render(); toast('Passed homes are back in your deck'); },
    widen: () => { const far = DATA.homes.map(h => m(h).d).filter(d => d > S.care.maxMiles).sort((a, b) => a - b); S.care.maxMiles = Math.min(150, Math.ceil((far[Math.min(4, far.length - 1)] || S.care.maxMiles + 20) / 5) * 5); save(); render(); toast(`Now showing homes within ${S.care.maxMiles} miles`); },

    tour: el => Detail.tour(el.dataset.id),
    'set-status': el => { const mt = getMatch(el.dataset.id); mt.status = el.dataset.value; save(); $$('.pl').forEach(b => b.classList.toggle('on', b === el)); toast(`Status: ${LBL.status[mt.status]}`); },
    'tour-with': el => { const t = S.tours[el.dataset.id] = { ...(S.tours[el.dataset.id] || {}), withLO: el.dataset.value }; save(); $$('[data-action="tour-with"]').forEach(b => b.classList.toggle('on', b === el)); updateMsg(el.dataset.id, t); },
    'tour-sent': el => {
      const id = el.dataset.id, mt = getMatch(id);
      S.tours[id] = { ...(S.tours[id] || {}), sent: true };
      if (mt.status === 'matched') mt.status = 'requested';
      save(); Detail.tour(id); toast('📅 Marked as tour requested', 'good');
    },
    'tour-check': el => {
      const id = el.dataset.id, i = +el.dataset.i, arr = S.checks[id] = S.checks[id] || [];
      const k = arr.indexOf(i); if (el.checked && k < 0) arr.push(i); if (!el.checked && k >= 0) arr.splice(k, 1);
      save();
      const h3 = el.closest('.d-sec').querySelector('h3'); h3.textContent = h3.textContent.replace(/\(\d+\//, `(${arr.length}/`);
    },
    'copy-msg': () => copy($('#t-msg').value, '📋 Message copied'),
    'copy-share': () => copy($('#share-txt').value, '📋 Copied. Paste it in a text or email.'),

    'compare-toggle': el => {
      const id = el.dataset.id;
      if (el.checked) { if (S.compare.length >= 3) { el.checked = false; return toast('Compare up to 3 at a time'); } S.compare.push(id); }
      else S.compare = S.compare.filter(x => x !== id);
      save(); render();
    },
    compare: () => Views.compare(),
    share: () => Views.share(),
    passed: () => Views.passed(),
    'open-settings': () => Views.settings(),
    'type-toggle': el => {
      const t = S.settings.types, v = el.dataset.value;
      if (el.checked) { if (!t.includes(v)) t.push(v); }
      else { if (t.length === 1) { el.checked = true; return toast('Keep at least one care type'); } S.settings.types = t.filter(x => x !== v); }
      save(); render();
    },
    setting: el => { S.settings[el.dataset.key] = el.checked; save(); render(); },
    'guide-toggle': el => { S.guide[el.dataset.i] = !S.guide[el.dataset.i]; save(); render(); },
    reset: () => { if (confirm('Erase this profile, your matches and notes from this device?')) { resetAll(); go('swipe'); } }
  };

  function rerenderOb() {
    if (!S.onboarded || view === 'onboarding') {
      const y = window.scrollY; Onboarding.render($('#view')); window.scrollTo(0, y);
    }
  }
  function updateMsg(id, t) { const box = $('#t-msg'); if (box) box.value = Detail.tourMessage(byId(id), t); }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (el && el.type === 'checkbox' && e.type === 'click') { /* handled on change */ }
    if (el && !(el.tagName === 'INPUT')) {
      const fn = ACTIONS[el.dataset.action];
      if (fn) { e.preventDefault(); fn(el); }
      return;
    }
    if (e.target.id === 'modal') { closeModal(); if (view !== 'swipe') render(); }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.matches('input[type=checkbox][data-action]')) { const fn = ACTIONS[el.dataset.action]; if (fn) fn(el); }
    if (el.id === 't-date' || el.id === 't-time') {
      const id = $('[data-action="tour-sent"]').dataset.id;
      const t = S.tours[id] = { ...(S.tours[id] || {}), [el.id === 't-date' ? 'date' : 'time']: el.value };
      save(); updateMsg(id, t);
    }
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.bind) {
      let v = el.value;
      if (el.dataset.bind === 'care.zip') v = v.replace(/\D/g, '').slice(0, 5), el.value = v;
      setPath(el.dataset.bind, el.dataset.num !== undefined ? +v : v);
      if (el.dataset.out) $(el.dataset.out).textContent = (el.dataset.prefix || '') + fmt(v) + (el.dataset.suffix || '');
      save();
      if (!S.onboarded || view === 'onboarding') Onboarding.refreshNext();
      else if (el.dataset.bind === 'care.maxMiles') { clearMatchCache(); (VIEWS[view] || Swipe.render)($('#view')); }
    }
    if (el.dataset.note) { S.notes[el.dataset.note] = el.value; save(); }
  });

  /* keyboard: swipe with arrows, Esc closes pop-ups, Enter continues onboarding */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalOpen()) { closeModal(); if (view !== 'swipe') render(); return; }
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (e.key === 'Enter' && (!S.onboarded || view === 'onboarding') && document.activeElement.tagName === 'INPUT') { e.preventDefault(); Onboarding.next(); return; }
    if (typing || modalOpen() || view !== 'swipe' || !S.onboarded || Swipe.isBusy()) return;
    if (!$('#deck .card')) return;
    const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up' }[e.key];
    if (k) { e.preventDefault(); Swipe.fly(k); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ACTIONS['detail-top'](); }
    else if (e.key === 'Backspace') { e.preventDefault(); Swipe.rewind(); }
  });

  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS[v] && v !== view) go(v); });

  // start
  const start = location.hash.slice(1);
  if (VIEWS[start] && start !== 'onboarding') view = start;
  render();

  return { go, render, modal, closeModal, badges };
})();
