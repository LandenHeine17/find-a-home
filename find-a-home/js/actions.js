/**
 * One click handler for the whole app. Buttons declare what they do with
 * data-action="..." (and data-id="<place id>"), so views stay plain HTML strings.
 */
import { S, save, resetState, defaultFilters } from './core/state.js';
import { toast } from './core/util.js';
import { go, refresh } from './router.js';
import { readIntake } from './views/welcome.js';
import { shareList } from './views/list.js';
import { openTour, openReview, openRateApp, showSources } from './components/modals.js';

const toggle = (list, id) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

const ACTIONS = {
  'mode': (el) => { S.mode = el.dataset.mode; save(); refresh(); },
  'reset-filters': () => { S.filters = defaultFilters(); save(); refresh(); },
  'edit-intake': () => { S.step = 1; save(); go('#/welcome'); },
  'skip-intake': () => { S.intakeDone = false; save(); go('#/results'); },
  'intake-back': () => { readIntake(); S.step--; save(); refresh(); },
  'save-toggle': (el, id) => {
    S.saved = toggle(S.saved, id); save();
    toast(S.saved.includes(id) ? 'Saved to My list' : 'Removed from My list'); refresh();
  },
  'compare-toggle': (el, id) => {
    if (!S.compare.includes(id) && S.compare.length >= 3) {
      toast('You can compare up to 3 at a time'); if (el.type === 'checkbox') el.checked = false; return;
    }
    S.compare = toggle(S.compare, id); save(); refresh();
  },
  'compare-remove': (el, id) => { S.compare = S.compare.filter(x => x !== id); save(); refresh(); },
  'compare-clear': () => { S.compare = []; save(); refresh(); },
  'tour': (el, id) => openTour(id),
  'tour-status': (el, id) => { const t = S.tours.find(x => x.id === id); if (t) t.status = el.dataset.status; save(); refresh(); },
  'choose': (el, id) => {
    const t = S.tours.find(x => x.id === id); if (t) t.status = 'chosen';
    S.chosen = id; save(); refresh(); openRateApp();
  },
  'share': () => shareList(),
  'review': (el, id) => openReview(id),
  'guide-toggle': (el) => { S.guide[el.dataset.i] = !S.guide[el.dataset.i]; save(); refresh(); },
  'sources': () => showSources(),
  'reset': () => {
    if (confirm('Clear your answers, saved places and tours, and start over?')) { resetState(); go('#/welcome'); }
  }
};
ACTIONS['compare-toggle-btn'] = ACTIONS['compare-toggle'];

export function bindActions() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (el && ACTIONS[el.dataset.action]) {
      e.stopPropagation();
      ACTIONS[el.dataset.action](el, el.dataset.id);
      return;
    }
    // Clicking a match card (but not its buttons/links) opens its detail page.
    if (e.target.closest('[data-stop], a, button, input, label')) return;
    const card = e.target.closest('[data-place]');
    if (card) go('#/place/' + card.dataset.place);
  });
  document.addEventListener('keydown', e => {
    const card = e.target.closest && e.target.closest('[data-place]');
    if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go('#/place/' + card.dataset.place); }
  });
}
