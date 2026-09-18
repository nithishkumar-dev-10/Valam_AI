// ---------------------------------------------------------------------------
// Tiny global store with pub/sub. No framework — just enough reactive glue:
// views subscribe to what they render, the router re-renders on navigation,
// and auth/lang changes notify the topbar/footer.
// localStorage keys stay IDENTICAL to the old frontend (valam_token / valam_user)
// so any previously stored session keeps working.
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'valam_token';
const REFRESH_KEY = 'valam_refresh';
const USER_KEY = 'valam_user';
const LANG_KEY = 'valam_lang';

const state = {
  lang: localStorage.getItem(LANG_KEY) || 'auto',
  token: localStorage.getItem(TOKEN_KEY) || null,
  refreshToken: localStorage.getItem(REFRESH_KEY) || null,
  user: readUser(),
  view: currentHash(),
  result: null,
  pendingInput: null,
};

const listeners = new Map();
let seq = 0;

function emit(part) {
  (listeners.get(part) || []).forEach((fn) => fn({ ...state }));
}

function set(patch) {
  Object.assign(state, patch);
  emit('*');
}

function currentHash() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  return h || 'home';
}

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const store = {
  get state() { return state; },
  set,
  emit,
  subscribe(part, fn) {
    if (!listeners.has(part)) listeners.set(part, new Set());
    listeners.get(part).add(fn);
    return () => listeners.get(part).delete(fn);
  },

  setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
    state.lang = lang;
    document.documentElement.lang = lang === 'ta' ? 'ta' : 'en';
    emit('lang');
    emit('*');
  },

  signIn(token, user, refreshToken) {
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    state.token = token;
    if (refreshToken) state.refreshToken = refreshToken;
    if (user) state.user = user;
    emit('auth');
    emit('*');
  },

  signOut() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    state.token = null;
    state.refreshToken = null;
    state.user = null;
    emit('auth');
    emit('*');
  },

  get isAuthed() { return Boolean(state.token); },

  setResult(result, pendingInput) {
    state.result = result;
    state.pendingInput = pendingInput || null;
    emit('*');
  },

  navigate(view) {
    if (view === 'home') {
      history.pushState(null, '', window.location.pathname + window.location.search);
    } else {
      history.pushState(null, '', `#/${view}`);
    }
    state.view = view;
    emit('nav');
    emit('*');
  },
};

export { currentHash };