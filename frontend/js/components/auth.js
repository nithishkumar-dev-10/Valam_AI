// Auth screens — login and signup. Same backend contract as before:
// signup (JSON) then auto-login (form-urlencoded), fetch profile, store session.
import { el } from '../dom.js';
import { t } from '../i18n.js';
import { store } from '../store.js';
import { authSignup, authLogin, authMe, ApiError } from '../api.js';
import { iconChevronLeft, iconEye, iconEyeOff, iconUser } from '../icons.js';

const PHONE_RE = /^\+?[0-9]{10,15}$/;

function buildAuthCard({ mode }) {
  const l = store.state.lang;
  const isSignup = mode === 'signup';

  const inputs = {};
  const errors = {};
  const errEl = el('div', { className: 'alert error', role: 'alert', style: { display: 'none' } });
  const submitBtn = el('button', { type: 'submit', className: 'btn btn-primary btn-lg btn-block' }, t(isSignup ? 'signUp' : 'signIn', l));

  function makeField(id, labelKey, opts = {}) {
    const input = el('input', {
      id, className: 'input',
      type: opts.type || 'text',
      autocomplete: opts.autocomplete || 'off',
      placeholder: opts.placeholder || '',
      inputmode: opts.inputmode || undefined,
    });
    inputs[labelKey] = input;
    const err = el('p', { className: 'input-error', id: `${id}-err`, role: 'alert' });
    err.hidden = true;
    return el('div', { className: 'field' },
      el('label', { className: 'label', htmlFor: id }, t(labelKey, l)),
      el('div', { className: 'input-wrap' }, input, pwToggleIfNeeded(input)),
      err);
  }

  function pwToggleIfNeeded(input) {
    if (input.type !== 'password') return null;
    const btn = el('button', { type: 'button', className: 'pw-toggle', title: 'toggle', html: iconEye });
    let shown = false;
    btn.addEventListener('click', () => {
      shown = !shown;
      input.type = shown ? 'text' : 'password';
      btn.innerHTML = shown ? iconEyeOff : iconEye;
    });
    return btn;
  }

  const title = isSignup ? t('signupTitle', l) : t('loginTitle', l);

  const form = el('form', { onsubmit: (e) => { e.preventDefault(); handleSubmit(); }, novalidate: '' },
    errEl,
    isSignup ? makeField('auth-name', 'name', { autocomplete: 'name' }) : null,
    makeField('auth-phone', 'phone', { type: 'tel', inputmode: 'numeric', autocomplete: 'username' }),
    makeField('auth-password', 'password', { type: 'password', autocomplete: isSignup ? 'new-password' : 'current-password' }),
    isSignup ? makeField('auth-confirm', 'confirmPassword', { type: 'password', autocomplete: 'new-password' }) : null,
    el('div', { style: { marginTop: '4px' } }, submitBtn),
  );

  function handleSubmit() {
    errEl.style.display = 'none';
    clearErrors();

    const valid = validate();
    if (!valid) return;

    submitBtn.disabled = true;
    submitBtn.textContent = isSignup ? '…' : '…';

    const payload = {
      name: inputs.name?.value?.trim(),
      phone_number: inputs.phone.value.trim(),
      password: inputs.password.value,
    };

    const doLogin = async () => {
      const res = await authLogin({ phone_number: payload.phone_number, password: payload.password });
      const me = await authMe(res.access_token).catch(() => ({
        phone_number: payload.phone_number.replace(/[\s-]/g, ''),
        name: payload.name || '',
      }));
      store.signIn(res.access_token, me, res.refresh_token);
      store.navigate('home');
    };

    const run = isSignup ? authSignup(payload).then(doLogin) : doLogin();

    run.catch((err) => {
      let msg;
      if (err instanceof ApiError && err.status === 429) msg = t('errTooFast', l);
      else if (isSignup && err instanceof ApiError && /already exists/i.test(String(err.detail || err.message))) {
        // redirect to login but show a helpful message instead of erroring
        showAccountExists();
        return;
      } else if (err instanceof ApiError && (err.status === 401 || /incorrect/i.test(String(err.detail || err.message)))) {
        msg = t('authInvalid', l);
      } else {
        msg = err.message || t('authGenericError', l);
      }
      showError(msg);
    }).finally(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = t(isSignup ? 'signUp' : 'signIn', l);
    });
  }

  function showAccountExists() {
    store.navigate('login');
    // surface via alert
    errEl.textContent = '';
    errEl.append(el('span', null, t('accountExists', l)));
    errEl.style.display = '';
    setTimeout(() => { errEl.style.display = 'none'; }, 6000);
  }

  function showError(msg) {
    errEl.textContent = '';
    errEl.append(el('span', null, msg));
    errEl.style.display = '';
  }

  function clearErrors() {
    Object.values(errors).forEach((e) => { e.hidden = true; });
  }

  function validate() {
    let ok = true;
    const setErr = (k, msg) => {
      const p = document.getElementById(`${inputId(k)}-err`);
      if (p) { p.textContent = msg; p.hidden = false; }
      const inp = inputs[k];
      if (inp) inp.classList.add('invalid');
      ok = false;
    };
    const inputId = (k) => `auth-${k === 'name' ? 'name' : k === 'phone' ? 'phone' : k === 'password' ? 'password' : 'confirm'}`;

    if (isSignup && !inputs.name.value.trim()) setErr('name', t('nameRequired', l));
    const digits = inputs.phone.value.replace(/[\s-]/g, '');
    if (!inputs.phone.value.trim()) setErr('phone', t('phoneRequired', l));
    else if (!PHONE_RE.test(digits)) setErr('phone', t('phoneInvalid', l));
    if (!inputs.password.value) setErr('password', t('pwdRequired', l));
    else if (isSignup && inputs.password.value.length < 6) setErr('password', t('pwdMin', l));
    if (isSignup && inputs.confirm.value !== inputs.password.value) setErr('confirmPassword', t('pwdMismatch', l));
    return ok;
  }

  return {
    card: el('div', { className: 'auth-card' },
      el('div', null,
        el('h2', { className: 'auth-title' }, title),
        el('p', { className: 'auth-opt' }, t('authOpt', l))),
      form,
    ),
  };
}

export function renderLogin() {
  const l = store.state.lang;
  const { card } = buildAuthCard({ mode: 'login' });

  const switchRow = el('div', { className: 'auth-switch' },
    t('noAccount', l), ' ',
    el('button', { type: 'button', onclick: () => store.navigate('signup') }, t('signUp', l)),
  );
  card.append(switchRow);

  return el('div', { className: 'screen' },
    el('div', { className: 'screen-head' },
      el('a', { className: 'back-btn', href: '#home', onclick: (e) => { e.preventDefault(); store.navigate('home'); } },
        iconChevronLeft, ' ', t('back', l)),
      el('h1', { className: 'screen-title' }, t('signIn', l)),
    ),
    card,
  );
}

export function renderSignup() {
  const l = store.state.lang;
  const { card } = buildAuthCard({ mode: 'signup' });

  const switchRow = el('div', { className: 'auth-switch' },
    t('haveAccount', l), ' ',
    el('button', { type: 'button', onclick: () => store.navigate('login') }, t('signIn', l)),
  );
  card.append(switchRow);

  return el('div', { className: 'screen' },
    el('div', { className: 'screen-head' },
      el('a', { className: 'back-btn', href: '#home', onclick: (e) => { e.preventDefault(); store.navigate('home'); } },
        iconChevronLeft, ' ', t('back', l)),
      el('h1', { className: 'screen-title' }, t('signUp', l)),
    ),
    card,
  );
}