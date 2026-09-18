// Location input — text field (informational label) + GPS button.
// The backend only uses lat/lon; the text field is a user reference.
// Returns .el, .getValue() → { text, gps }, .reset().
import { el } from '../dom.js';
import { t } from '../i18n.js';
import { store } from '../store.js';
import { iconPin, iconCheck } from '../icons.js';

export function createLocationInput({ onChange }) {
  let text = '';
  let gps = null;
  let locating = false;
  let err = '';
  const lang = () => store.state.lang;

  let textEl, gpsBtn, metaEl, errEl;
  const body = el('div');

  function draw() {
    const l = lang();
    textEl = el('input', {
      className: 'loc-input',
      type: 'text',
      placeholder: t('locPlaceholder', l),
      value: text,
      oninput: (e) => { text = e.target.value; push(); },
    });

    gpsBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost btn-sm gps-btn',
      onclick: useGps,
    }, locating ? el('span', { className: 'rec-dot', style: { background: 'var(--sky)' } }) : iconPin, ' ', t('locGps', l));

    metaEl = el('div', { className: 'loc-meta' });
    errEl = el('div', { className: 'loc-meta', style: { color: 'var(--danger)' } });
    if (err) errEl.textContent = t('locCant', l);

    if (gps) {
      metaEl.append(
        el('span', { className: 'chip sky', html: iconCheck, style: { marginRight: '4px' } }),
        el('span', null, t('locFound', l)),
        el('span', { style: { fontSize: '13px', color: 'var(--ink-faint)' } }, `(${gps.lat}, ${gps.lon})`),
      );
    }

    const hint = el('div', { className: 'card-sub' }, t('locHint', l));

    const row = el('div', { className: 'loc-row' }, textEl, gpsBtn);
    body.innerHTML = '';
    body.append(row, metaEl, errEl, hint);
  }

  const node = el('div', { className: 'input-card' },
    el('div', { className: 'card-head' },
      el('span', { className: 'card-ic', style: { background: 'var(--sky-soft)', color: 'var(--sky)' }, html: iconPin }),
      el('div', null,
        el('span', { className: 'card-title' }, t('locTitle', lang())),
        el('span', { className: 'card-sub' }, t('locSub', lang())))),
    body);

  function push() { onChange({ text, gps }); }

  function useGps() {
    if (!navigator.geolocation) { err = 'denied'; push(); draw(); return; }
    locating = true;
    err = '';
    push(); draw();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gps = { lat: +pos.coords.latitude.toFixed(5), lon: +pos.coords.longitude.toFixed(5) };
        locating = false; err = '';
        push(); draw();
      },
      () => { locating = false; err = 'denied'; push(); draw(); },
      { timeout: 8000, enableHighAccuracy: false },
    );
  }

  draw();

  return {
    el: node,
    getValue: () => ({ text, gps }),
    reset: () => { text = ''; gps = null; locating = false; err = ''; draw(); },
    restore(s) {
      text = (s && s.text) || '';
      gps = (s && s.gps) || null;
      locating = false;
      err = '';
      draw();
      push();
    },
  };
}