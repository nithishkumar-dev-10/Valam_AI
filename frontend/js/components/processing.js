// Processing screen — staged progress animation shown while awaiting the API.
import { el, clear } from '../dom.js';
import { t } from '../i18n.js';
import { store } from '../store.js';
import { iconMic, iconCamera, iconPin, iconSpark } from '../icons.js';

const STEPS = [
  { key: 'stepListen',  cond: (i) => !!i.audio },
  { key: 'stepRead',    cond: (i) => !!i.image },
  { key: 'stepCrop',    cond: (i) => !!i.location?.gps },
  { key: 'stepAnswer',  cond: () => true },
  { key: 'stepDone',    cond: () => false },
];
const STEP_ICONS = [iconMic, iconCamera, iconPin, iconSpark, null];

export function renderProcessing() {
  const l = store.state.lang;
  const input = store.state.pendingInput || {};
  const steps = STEPS.filter(s => s.cond(input));
  const lastIdx = steps.length - 1;

  let activeIdx = 0;

  // build nodes
  const stepNodes = steps.map((s, i) =>
    el('div', { className: 'step', id: `proc-step-${i}` },
      el('span', { className: 'step-dot' }),
      el('span', null, t(s.key, l)),
    ),
  );

  const stateText = el('p', { className: 'proc-state' });
  const note = el('p', { className: 'proc-note', style: { marginTop: '6px', fontSize: '13px', color: 'var(--ink-faint)' } },
    t('procNote', l));

  const illo = el('div', { className: 'proc-illo pulsing', html: iconSpark });

  const main = el('div', { className: 'proc' },
    illo,
    el('h2', null, t('processingTitle', l)),
    stateText,
    el('div', { className: 'step-list', id: 'proc-step-list' }, ...stepNodes),
    note,
  );

  // advance one step every 1.1s
  const timer = setInterval(() => {
    if (activeIdx <= lastIdx) {
      // mark previous as done
      if (activeIdx > 0) stepNodes[activeIdx - 1]?.classList.replace('active', 'done');
      stepNodes[activeIdx]?.classList.add('active');
      stateText.textContent = t(steps[Math.min(activeIdx, lastIdx)].key, l);
      activeIdx++;
    } else {
      clearInterval(timer);
    }
  }, 1100);

  // ensure clean-up if view changes before completion
  const unsub = store.subscribe('nav', () => { clearInterval(timer); unsub(); });

  // immediately show first step
  stepNodes[0]?.classList.add('active');
  stateText.textContent = t(steps[0]?.key || 'stepAnswer', l);

  return main;
}