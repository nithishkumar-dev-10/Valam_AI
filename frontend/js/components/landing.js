// Landing screen — voice-first hero, quickstart cards, feature highlight.
import { el } from '../dom.js';
import { t } from '../i18n.js';
import { store } from '../store.js';
import { iconMic, iconCamera, iconPin, iconLeaf, iconBug, iconSpark, iconCheck } from '../icons.js';

export function renderLanding() {
  const l = store.state.lang;
  const container = el('div', { className: 'hero' });

  // hero text
  container.append(
    el('h1', null, 'Valam AI · ', el('span', { style: { color: 'var(--green)' } }, 'வாலம்')),
    el('p', { className: 'hero-tag' }, t('tagline', l)),
    el('p', { className: 'lang-pair', style: { marginTop: '2px', fontSize: '13px', color: 'var(--ink-faint)' } }, t('langPair', l)),
  );

  // -- big mic hero --
  const micHalo = el('span', { className: 'mic-halo', style: { animationDelay: '0.5s' } });
  const micBtn = el('button', {
    type: 'button',
    className: 'mic-btn',
    onclick: () => store.navigate('check'),
    'aria-label': t('micCta', l),
  }, micHalo, el('span', { html: iconMic }));

  container.append(
    el('div', { className: 'voice-hero' },
      micBtn,
      el('span', { className: 'mic-label', style: { color: 'var(--gold-deep)' } }, t('micCta', l)),
      el('span', { className: 'mic-sub' }, t('micSub', l)),
    ),
  );

  // -- quickstart cards --
  const camCard = el('button', {
    type: 'button', className: 'qs-card',
    onclick: () => { store.navigate('check'); },
  },
    el('span', { className: 'qs-ic', html: iconCamera }),
    el('b', null, t('qsCam', l)),
    el('span', null, t('qsCamSub', l)),
  );

  const locCard = el('button', {
    type: 'button', className: 'qs-card',
    onclick: () => store.navigate('check'),
  },
    el('span', { className: 'qs-ic sky', html: iconPin }),
    el('b', null, t('qsLoc', l)),
    el('span', null, t('qsLocSub', l)),
  );

  container.append(
    el('div', { style: { textAlign: 'center', marginTop: '24px', color: 'var(--ink-soft)', fontWeight: 800, fontSize: '14.5px' } }, t('quickTitle', l)),
    el('div', { className: 'quickstart' }, camCard, locCard),
  );

  // -- features --
  const featHead = el('div', { className: 'feat-head' }, el('span', { html: iconSpark }), t('featTitle', l));
  const featCrop = el('div', { className: 'feat-card' },
    el('span', { className: 'fc-ic fc-leaf', html: iconLeaf }),
    el('p', null, t('featCrop', l)));
  const featDisease = el('div', { className: 'feat-card' },
    el('span', { className: 'fc-ic fc-disease', html: iconCheck }),
    el('p', null, t('featDisease', l)));
  const featPest = el('div', { className: 'feat-card' },
    el('span', { className: 'fc-ic fc-pest', html: iconBug }),
    el('p', null, t('featPest', l)));

  container.append(
    el('div', { className: 'feat' },
      featHead,
      el('div', { className: 'feat-row' }, featCrop, featDisease, featPest)),
  );

  return container;
}