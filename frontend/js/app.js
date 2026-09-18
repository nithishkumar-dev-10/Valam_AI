// Entry point — mounts static chrome, wires the hash router, renders views.
import { store } from './store.js';
import { mountStaticChrome } from './components/shared.js';
import { renderLanding } from './components/landing.js';
import { renderCheck } from './components/check.js';
import { renderProcessing } from './components/processing.js';
import { renderResults } from './components/results.js';
import { renderLogin, renderSignup } from './components/auth.js';

const viewEl = document.getElementById('view');

const RENDERERS = {
  home: renderLanding,
  check: renderCheck,
  processing: renderProcessing,
  results: renderResults,
  login: renderLogin,
  signup: renderSignup,
};

function render() {
  const view = store.state.view;
  const fn = RENDERERS[view] || renderLanding;
  viewEl.replaceChildren(fn());
}

function boot() {
  document.documentElement.lang = store.state.lang === 'ta' ? 'ta' : 'en';
  mountStaticChrome();

  // hash → view
  const sync = () => {
    const view = (location.hash || '').replace(/^#\/?/, '') || 'home';
    store.set({ view });
    if (RENDERERS[view]) render();
  };
  window.addEventListener('hashchange', sync);

  // programmatic navigation (store.navigate pushes state but not hash for home)
  store.subscribe('nav', () => {
    const v = store.state.view;
    if (RENDERERS[v]) render();
  });

  // language switch re-renders the current screen, but not 'check'
  // (its in-progress voice/photo input is preserved & synced directly).
  store.subscribe('lang', () => {
    if (store.state.view !== 'check') render();
  });

  render();
}

boot();