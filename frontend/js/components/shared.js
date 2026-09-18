// Shared chrome: language toggle, auth footer, toast, model result card.
import { el, clear } from '../dom.js';
import { LANGS, t } from '../i18n.js';
import { store } from '../store.js';
import { iconLeaf, iconAlert, iconBug, iconGlobe } from '../icons.js';

export function mountStaticChrome() {
  const toggle = document.querySelector('[data-lang-toggle]');
  const authfoot = document.querySelector('[data-authfoot]');

  function renderToggle() {
    clear(toggle);
    LANGS.forEach((l) => {
      const active = store.state.lang === l.value;
      const btn = el('button', {
        type: 'button',
        className: `lang-btn${active ? ' active' : ''}`,
        'aria-pressed': active,
        onclick: () => { store.setLang(l.value); },
      }, store.state.lang === 'ta' ? l.labelTa : l.labelEn);
      toggle.append(btn);
    });
  }

  function renderFoot() {
    clear(authfoot);
    const lang = store.state.lang;
    if (store.isAuthed) {
      const name = store.state.user?.name || store.state.user?.phone_number || '';
      authfoot.append(
        el('div', { className: 'authbar' },
          el('span', { className: 'ab-name' }, name),
          el('button', { type: 'button', className: 'btn btn-ghost btn-sm', onclick: () => store.signOut() },
            t('signOut', lang)),
        ),
      );
    } else {
      authfoot.append(
        el('div', { className: 'authbar' },
          el('span', null, t('signIn', lang) + ' · ' + t('signUp', lang) + ' — ' + t('authOpt', lang)),
          el('a', { className: 'btn btn-ghost btn-sm', href: '#/login' }, t('signIn', lang)),
          el('a', { className: 'btn btn-primary btn-sm', href: '#/signup' }, t('signUp', lang)),
        ),
      );
    }
  }

  renderToggle();
  renderFoot();
  store.subscribe('lang', renderToggle);
  store.subscribe('auth', renderFoot);
}

// ---- toast ----
let toastTimer = null;
const toast = document.querySelector('.toast');
export function showToast(message, kind = '') {
  toast.innerHTML = '';
  toast.append(el('span', null, message));
  toast.className = `toast show${kind ? ` ${kind}` : ''}`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toast.hidden = true; }, 220);
  }, 3200);
}

// ---- model result card ----
const MODEL_META = {
  crop:    { key: 'modelCrop', icon: iconLeaf, cls: 'kcrop' },
  disease: { key: 'modelDisease', icon: iconAlert, cls: 'kdisease' },
  pest:    { key: 'modelPest', icon: iconBug, cls: 'kpest' },
};
const RES_META = {
  district: { key: 'resDistrict', cls: '' },
  state:    { key: 'resState', cls: 'soil' },
  fallback: { key: 'resFallback', cls: 'soil' },
  manual:   { key: 'resManual', cls: 'gold' },
};
const CONF_LABEL = { high: 'high', medium: 'medium', low: 'low' };

export function renderModelCard(result, lang) {
  const meta = MODEL_META[result.model] || MODEL_META.disease;
  const pct = Math.round((result.confidence || 0) * 100);
  const label = (result.confidence_label || '').toLowerCase() || CONF_LABEL[pct >= 80 ? 'high' : pct >= 60 ? 'medium' : 'low'];
  const labelText = t(label === 'high' ? 'resHigh' : label === 'medium' ? 'resMedium' : 'resLow', lang).toUpperCase();
  const isCrop = result.model === 'crop';
  const klass = isCrop ? result.predicted_crop : result.predicted_class;

  const iconColor = { crop: '#fff', disease: '#fff', pest: '#fff' }[result.model] || '#fff';
  const bg = { crop: 'var(--green)', disease: 'var(--soil)', pest: 'var(--danger)' }[result.model] || 'var(--soil)';

  const head = el('div', { className: 'rc-head' },
    el('span', { className: 'rc-ic', style: { background: bg }, html: meta.icon }, ''),
    el('span', { className: 'rc-name' }, t(meta.key, lang)),
    el('span', { className: `chip ${label === 'low' ? 'danger' : label === 'medium' ? 'gold' : ''}`, style: { marginLeft: 'auto' } },
      `${t('confidence', lang)} · ${labelText}`),
  );

  const row = el('div', { className: 'rc-value-row' },
    el('div', { className: 'rc-class' }, klass || '—'),
    el('div', { className: 'rc-pct' },
      el('span', { className: 'pct', style: { color: bg } }, `${pct}%`),
      el('svg', { className: 'conf-ring', viewBox: '0 0 46 46', 'aria-hidden': 'true', html: ringSvg(pct, bg) }),
    ),
  );

  const card = el('div', { className: `result-card ${meta.cls}` }, head, row);

  if (isCrop) {
    const resKey = (RES_META[result.data_resolution] || RES_META.fallback).key;
    const resCls = (RES_META[result.data_resolution] || RES_META.fallback).cls;
    const metaRow = el('div', { className: 'rc-meta' },
      el('span', { className: `chip ${resCls}` }, t(resKey, lang)),
      result.input_confidence
        ? el('span', { className: 'chip soil' }, `${t('resInputConf', lang)} · ${t(result.input_confidence === 'high' ? 'resHigh' : result.input_confidence === 'medium' ? 'resMedium' : 'resLow', lang).toUpperCase()}`)
        : null,
      result.location ? el('span', { className: 'res-loc', style: { fontSize: '13.5px', color: 'var(--ink-soft)' } }, result.location) : null,
    );
    card.append(metaRow);
    const noteText = result.data_quality_note || result.warning;
    if (noteText) {
      card.append(
        el('div', { className: `quality-note${result.warning ? ' warn' : ''}`, role: 'note' },
          el('span', { html: iconGlobe }),
          el('span', null, noteText)),
      );
    }
  }
  return card;
}

function ringSvg(pct, color) {
  const r = 19, c = 2 * Math.PI * r;
  const fill = Math.max(0, Math.min(100, pct)) / 100 * c;
  return `
    <circle cx="23" cy="23" r="${r}" fill="none" stroke="var(--line)" stroke-width="5"/>
    <circle cx="23" cy="23" r="${r}" fill="none" stroke="${color}" stroke-width="5"
      stroke-linecap="round" stroke-dasharray="${fill} ${c}"
      transform="rotate(-90 23 23)"/>
  `;
}