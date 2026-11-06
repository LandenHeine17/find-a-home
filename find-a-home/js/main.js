/**
 * Find-A-Home front end entry point.
 * Loads data from the API, registers the screens, and starts the router.
 *
 *   core/        state, data loading, matching, labels, helpers
 *   views/       one file per screen
 *   components/  pieces shared by screens (dialogs, nursing home sections)
 */
import { updateCounts } from './core/state.js';
import { loadData } from './core/data.js';
import { register, route, app } from './router.js';
import { bindActions } from './actions.js';
import { initAssistant } from './assistant.js';
import { renderWelcome } from './views/welcome.js';
import { renderResults } from './views/results.js';
import { renderPlace } from './views/place.js';
import { renderCompare } from './views/compare.js';
import { renderList } from './views/list.js';
import { renderGuide } from './views/guide.js';

register('welcome', renderWelcome, { isDefault: true });
register('results', renderResults);
register('place', renderPlace);
register('compare', renderCompare);
register('list', renderList);
register('next-steps', renderGuide);

async function start() {
  app.innerHTML = '<div class="card empty">Loading care options…</div>';
  try {
    await loadData();
  } catch (e) {
    app.innerHTML = '<div class="card empty"><h2>We couldn\'t load care options</h2><p>Please refresh the page. If you opened index.html directly, start the server with <code>npm start</code>.</p></div>';
    console.error(e);
    return;
  }
  bindActions();
  initAssistant();
  updateCounts();
  route();
}

start();
