// Voice recorder — self-contained component with idle / recording / pending /
// committed states. Uses MediaRecorder + Web Audio. Returns .el (mountable),
// .getValue() (File | null), .reset().
import { el } from '../dom.js';
import { t } from '../i18n.js';
import { store } from '../store.js';
import { checkAudioFile } from '../api.js';
import { showToast } from './shared.js';
import { iconMic, iconStop, iconPlay, iconX, iconUpload } from '../icons.js';

export function createVoiceRecorder({ onChange }) {
  let audioFile = null;          // the committed file (input.audio)
  let pendingBlob = null;        // just-recorded, not confirmed
  let recording = false;
  let seconds = 0;
  let recorder = null;
  let chunks = [];
  let timer = null;
  let startAt = 0;
  let playUrl = null;

  const lang = () => store.state.lang;

  // -- refs to update --
  let statusEl = null;
  let orbBtn = null;
  let commitActionsEl = null;
  let committedEl = null;
  let timerEl = null;
  let uploadBtn = null;
  let fileInput = null;
  let audioPreview = null;

  function draw() {
    const l = lang();
    clear(); // remove old children and rebuild DOM fragments

    // ---- main container ----
    commitActionsEl = el('div', { style: { width: '100%', display: 'none' } });
    committedEl = el('div', { style: { width: '100%', display: 'none' } });
    audioPreview = el('audio', { controls: 'controls' });

    // recording state indicators (only rendered when recording)
    timerEl = el('span', { className: 'rec-timer' }, '0:00');

    const waveBars = el('span', { className: 'wave-bars', ariaHidden: 'true' },
      el('i', null), el('i', null), el('i', null), el('i', null), el('i', null), el('i', null),
    );

    statusEl = el('div', { className: 'rec-status' });
    statusEl.append(timerEl);

    // -- orb button (mic / stop) --
    const orbRing = el('span', { className: 'orb-ring' });
    orbBtn = el('button', {
      type: 'button',
      className: 'rec-orb',
      'aria-label': recording ? t('micStop', l) : t('micStart', l),
      onclick: () => { recording ? stop() : start(); },
    });
    orbBtn.innerHTML = '';
    orbBtn.append(orbRing);

    // -- upload fallback --
    fileInput = el('input', {
      type: 'file', accept: 'audio/*', hidden: true,
      onchange: (e) => {
        const f = e.target.files?.[0];
        if (f) {
          const err = checkAudioFile(f);
          if (err) { showToast(err, 'error'); return; }
          commitFile(f);
        }
        e.target.value = '';
      },
    });
    uploadBtn = el('button', {
      type: 'button', className: 'btn btn-ghost btn-sm',
      onclick: () => fileInput.click(),
    }, iconUpload, ' ', t('micUpload', l));

    const actions = el('div', { className: 'voice-actions' }, fileInput, uploadBtn);
    const tip = el('div', { className: 'prompt-tip', html: t('micHint', l) });

    node.append(el('div', { className: 'voicearea' }, orbBtn, statusEl, actions, commitActionsEl, committedEl, tip));

    // apply current state styles
    updateStyles();
  }

  const node = el('div', { className: 'field', style: { width: '100%' } });

  function updateStyles() {
    if (!statusEl || !orbBtn) return;
    const l = lang();
    orbBtn.className = `rec-orb${recording ? ' recording' : ''}`;
    orbBtn.setAttribute('aria-label', recording ? t('micStop', l) : t('micStart', l));
    orbBtn.innerHTML = '';
    const ring = el('span', { className: 'orb-ring' });
    orbBtn.append(ring, recording ? el('span', { html: iconStop }) : el('span', { html: iconMic }));

    if (recording) {
      statusEl.innerHTML = '';
      statusEl.append(timerEl);
      statusEl.append(el('span', { style: { fontSize: '15px' } }, ' ', t('micListening', l)));
    }

    commitActionsEl.style.display = pendingBlob ? '' : 'none';
    committedEl.style.display = audioFile && !pendingBlob ? '' : 'none';
  }

  function start() {
    const l = lang();
    recording = true;
    seconds = 0;
    chunks = [];

    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(t('micUnavailable', l), 'error');
      recording = false;
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        recorder.onstop = () => {
          stream.getTracks().forEach((tr) => tr.stop());
          const type = recorder.mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type });
          pendingBlob = new File([blob], 'recording.webm', { type });
          recording = false;
          clearInterval(timer);
          onPending();
        };
        recorder.start();
        startAt = Date.now();
        updateStyles();
        timer = setInterval(() => {
          seconds = Math.round((Date.now() - startAt) / 1000);
          if (timerEl) timerEl.textContent = formatTime(seconds);
        }, 250);
      })
      .catch(() => {
        recording = false;
        showToast(t('micUnavailable', l), 'error');
        updateStyles();
      });
  }

  function stop() {
    recorder?.stop();
    clearInterval(timer);
    recording = false;
    updateStyles();
  }

  function onPending() {
    const l = lang();
    commitActionsEl.innerHTML = '';
    commitActionsEl.style.display = '';
    updateStyles();

    // play pending
    const playUrlPending = URL.createObjectURL(pendingBlob);
    const playPendingBtn = el('button', {
      type: 'button', className: 'btn btn-ghost btn-sm',
      onclick: () => { audioPreview.src = playUrlPending; audioPreview.play(); },
    }, iconPlay, ' ', t('micListen', l));

    const keepBtn = el('button', {
      type: 'button', className: 'btn btn-primary btn-sm', style: { flex: 1 },
      onclick: () => { commitFile(pendingBlob); },
    }, t('micKeep', l));
    const redoBtn = el('button', {
      type: 'button', className: 'btn btn-ghost btn-sm', style: { flex: 1 },
      onclick: () => { pendingBlob = null; updateStyles(); },
    }, t('micRetry', l));

    commitActionsEl.append(playPendingBtn,
      el('div', { className: 'voice-actions', style: { justifyContent: 'center' } }, keepBtn, redoBtn));
  }

  function commitFile(file) {
    if (playUrl) URL.revokeObjectURL(playUrl);
    playUrl = URL.createObjectURL(file);
    audioFile = file;
    pendingBlob = null;
    onChange(file);
    onCommitted();
  }

  function onCommitted() {
    const l = lang();
    committedEl.innerHTML = '';
    committedEl.style.display = '';
    commitActionsEl.style.display = 'none';

    const ic = el('span', { className: 'clip-ic', html: iconMic });
    const info = el('div', { style: { flex: '1 1 0' } },
      el('b', null, t('audioFile', l)),
      el('span', { style: { fontSize: '13px', color: 'var(--ink-soft)' } }, audioFile.name || t('micStart', l)));
    const removeBtn = el('button', { className: 'btn btn-ghost btn-sm', type: 'button', onclick: reset }, iconX, ' ', t('micRemove', l));

    committedEl.append(
      el('div', { className: 'uploaded-clip' }, ic, info, removeBtn));
    committedEl.append(audioPreview);
  }

  function reset() {
    if (playUrl) URL.revokeObjectURL(playUrl);
    playUrl = null;
    audioFile = null;
    pendingBlob = null;
    recording = false;
    clearInterval(timer);
    seconds = 0;
    onChange(null);
    draw();
  }

  function clear() { if (node) node.innerHTML = ''; }

  draw();

  return {
    el: node,
    getValue: () => audioFile,
    reset,
    restore(file) {
      if (!file) return;
      const err = checkAudioFile(file);
      if (err) { showToast(err, 'error'); return; }
      commitFile(file);
    },
  };
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}