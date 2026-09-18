// Check screen — composes voice recorder, photo uploader, location input,
// language selection, and submit button.
import { el } from '../dom.js';
import { t } from '../i18n.js';
import { store } from '../store.js';
import { submitCheck, ApiError } from '../api.js';
import { showToast } from './shared.js';
import { iconChevronLeft, iconMic, iconCamera, iconPin, iconGlobe } from '../icons.js';
import { createVoiceRecorder } from './voice.js';
import { createPhotoUploader } from './photo.js';
import { createLocationInput } from './location.js';
import { LANGS } from '../i18n.js';

let activeForm = null;
store.subscribe('lang', (s) => {
  if (!activeForm) return;
  const newLang = s.lang === 'auto' ? 'auto' : s.lang;
  if (newLang !== activeForm.selectedLang) {
    activeForm.selectedLang = newLang;
    activeForm.onLangChange();
  }
});

export function renderCheck() {
  const l = store.state.lang;
  const saved = store.state.pendingInput;
  store.setResult(null, null);

  const voice = createVoiceRecorder({ onChange: () => updateSubmit() });
  const photo = createPhotoUploader({ onChange: () => updateSubmit() });
  const location = createLocationInput({ onChange: () => updateSubmit() });

  if (saved?.audio) voice.restore(saved.audio);
  if (saved?.image) photo.restore(saved.image);
  if (saved?.location) location.restore(saved.location);

  let selectedLang = store.state.lang === 'auto' ? 'auto' : store.state.lang;
  let submitting = false;

  const hintEl = el('p', { className: 'submit-hint' }, t('submitHint', l));
  const submitBtn = el('button', {
    type: 'button', className: 'btn btn-gold btn-lg btn-block',
    onclick: doSubmit,
    disabled: true,
  }, t('submit', l));

  function updateSubmit() {
    const hasAny = voice.getValue() || photo.getValue() || location.getValue().gps;
    submitBtn.disabled = !hasAny || submitting;
    if (hasAny) hintEl.textContent = t('submitReady', l);
    else hintEl.textContent = t('submitHint', l);
  }

  // language picker inside the form
  const langToggle = el('div', { className: 'lang-toggle', role: 'group', 'aria-label': 'Answer language' });
  function drawLangToggle() {
    langToggle.innerHTML = '';
    LANGS.forEach((lg) => {
      const active = selectedLang === lg.value;
      const btn = el('button', {
        type: 'button', className: `lang-btn${active ? ' active' : ''}`,
        'aria-pressed': active,
        onclick: () => { selectedLang = lg.value; drawLangToggle(); },
      }, lg.labelEn);
      langToggle.append(btn);
    });
  }
  drawLangToggle();

const langCard = el('div', { className: 'input-card' },
    el('div', { className: 'card-head' },
      el('span', { className: 'card-ic', style: { background: 'var(--green-soft)', color: 'var(--green-deep)' }, html: iconGlobe }),
      el('div', null,
        el('span', { className: 'card-title' }, t('langNote', l)),
        el('span', { className: 'card-sub' }, t('langNoteSub', l))),
    ),
    langToggle,
  );

  const main = el('div', { className: 'screen' },
    el('div', { className: 'screen-head' },
      el('a', { className: 'back-btn', href: '#home', onclick: (e) => { e.preventDefault(); store.navigate('home'); } },
        iconChevronLeft, ' ', t('back', l)),
      el('h1', { className: 'screen-title' }, t('newCheck', l)),
      el('p', { className: 'screen-sub' }, t('newCheckSub', l)),
    ),
    el('div', { className: 'check-stage', style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      voice.el,
      photo.el,
      location.el,
      langCard,
    ),
    el('div', { className: 'submitbar' }, submitBtn, hintEl),
  );

  activeForm = { selectedLang, onLangChange: drawLangToggle };

  updateSubmit();

  async function doSubmit() {
    if (submitting) return;
    submitting = true;
    submitBtn.disabled = true;

    const input = {
      audio: voice.getValue(),
      image: photo.getValue(),
      location: location.getValue(),
      lang: selectedLang,
    };

    store.navigate('processing');
    try {
      const result = await submitCheck(input);
      store.setResult(result, input);
      store.navigate('results');
    } catch (err) {
      let errMessage;
      if (err instanceof ApiError && err.status === 429) {
        errMessage = t('errTooFast', l);
      } else if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        errMessage = err.message || t('errGeneric', l);
      } else {
        errMessage = t('errNetwork', l);
      }
      store.setResult(null, { audio: input.audio, image: input.image, location: input.location });
      store.navigate('check');
      showToast(errMessage, 'error');
    } finally {
      submitting = false;
      updateSubmit();
    }
  }

  return main;
}