// Results screen — voice answer, summary, per-model cards, retry.
import { el } from '../dom.js';
import { t } from '../i18n.js';
import { store } from '../store.js';
import { renderModelCard, showToast } from './shared.js';
import { iconSpeaker, iconRefresh, iconChevronLeft, iconCheck, iconSpark } from '../icons.js';

export function renderResults() {
  const l = store.state.lang;
  const result = store.state.result;
  const main = el('div', { className: 'screen' });

  const head = el('div', { className: 'screen-head' },
    el('a', { className: 'back-btn', href: '#home', onclick: (e) => { e.preventDefault(); store.navigate('home'); } },
      iconChevronLeft, ' ', t('back', l)),
    el('h1', { className: 'screen-title' }, t('results', l)),
  );
  main.append(head);

  if (!result) {
    main.append(emptyResult(l, () => store.navigate('check')));
    return main;
  }

  // ---- answer summary card ----
  const answerCard = el('div', { className: 'answer-card' },
    el('span', { className: 'ac-label' }, el('span', { html: iconCheck }), t('results', l)),
    el('p', { className: 'ac-text' }, result.summary || '—'),
  );
  main.append(answerCard);

  // ---- audio play ----
  if (result.audio?.url) {
    const audioEl = el('audio', { preload: 'none' });
    audioEl.src = result.audio.url;
    const pbIcon = el('span', { className: 'pb-ic', html: iconSpeaker });
    let playing = false;
    const playBtn = el('button', { type: 'button', className: 'play-big' },
      pbIcon,
      el('span', null, t('listenLabel', l)),
      audioEl,
    );
    const togglePlay = () => {
      if (!playing) {
        audioEl.play().catch(() => showAudioUnavailable(l));
        playBtn.classList.add('playing');
        playBtn.querySelector('span:nth-child(2)').textContent = t('playingLabel', l);
        playing = true;
      } else {
        audioEl.pause();
        playBtn.classList.remove('playing');
        playBtn.querySelector('span:nth-child(2)').textContent = t('listenLabel', l);
        playing = false;
      }
    };
    audioEl.addEventListener('ended', () => { playing = false; playBtn.classList.remove('playing'); });
    audioEl.addEventListener('error', () => showAudioUnavailable(l));
    playBtn.addEventListener('click', togglePlay);
    main.append(el('div', { className: 'answer-foot' }, playBtn));
  }

  // ---- model cards ----
  const models = result.models_ran || [];
  const list = el('div', { className: 'result-list' });
  list.append(el('h3', { className: 'result-list-label' }, el('span', { html: iconSpark }), t('whatChecked', l)));
  if (models.length) {
    models.forEach((m) => list.append(renderModelCard(m, l)));
  } else {
    list.append(emptyResult(l, () => store.navigate('check'), true));
  }
  main.append(list);

  // ---- CTA ----
  main.append(
    el('div', { className: 'submitbar', style: { position: 'static', background: 'transparent', padding: '10px 0 4px' } },
      el('button', { type: 'button', className: 'btn btn-gold btn-lg btn-block', onclick: () => store.navigate('check') },
        iconRefresh, ' ', t('newCheckBtn', l))),
  );

  return main;
}

function showAudioUnavailable(l) {
  showToast(t('audioUnavailable', l), 'error');
}

function emptyResult(l, onNew, inline = false) {
  return el('div', { className: 'empty-state' },
    el('span', { className: 'empty-ic', html: iconSpeaker }),
    el('p', null, t('emptyResults', l)),
    el('button', { type: 'button', className: 'btn btn-primary', onclick: onNew }, t('retry', l)),
  );
}