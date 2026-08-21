/* ===========================================================
   Valam AI — test console logic
=========================================================== */

let token = null;
let farmer = { name: null, phone: null };
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let recording = false;
let queryCount = 0;

const $ = id => document.getElementById(id);

function apiBase() {
  return $('apiBase').value.replace(/\/$/, '');
}

/* ---------------- view routing ---------------- */
function showView(name) {
  ['signup', 'login', 'dashboard'].forEach(v => {
    $('view-' + v).classList.toggle('hidden', v !== name);
  });
}

$('goLogin').addEventListener('click', e => { e.preventDefault(); showView('login'); });
$('goSignup').addEventListener('click', e => { e.preventDefault(); showView('signup'); });

/* ---------------- backend health ---------------- */
async function checkHealth() {
  const pill = $('connPill');
  try {
    const res = await fetch(apiBase() + '/');
    const data = await res.json();
    pill.className = 'status-pill ok';
    pill.innerHTML = '<span class="dot"></span>backend online';
    $('backendMetric').textContent = data.status || 'running';
  } catch (e) {
    pill.className = 'status-pill err';
    pill.innerHTML = '<span class="dot"></span>unreachable';
    $('backendMetric').textContent = 'unreachable';
  }
}
checkHealth();
setInterval(checkHealth, 15000);

/* ---------------- log ---------------- */
function logEvent(label, data, isErr) {
  const el = $('log');
  if (!el) return;
  const time = new Date().toLocaleTimeString();
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<div class="${isErr ? 'log-head err' : 'log-head'}"><span class="log-time">${time}</span>${escapeHtml(label)}</div><div class="log-body">${escapeHtml(body)}</div>`;
  el.prepend(line);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function setMsg(id, text, ok) {
  const el = $(id);
  el.textContent = text;
  el.className = 'form-msg ' + (ok ? 'ok' : 'err');
}

/* ---------------- signup ---------------- */
$('suSubmit').addEventListener('click', async () => {
  const body = {
    name: $('suName').value.trim(),
    phone_number: $('suPhone').value.trim(),
    password: $('suPass').value,
  };
  if (!body.name || !body.phone_number || !body.password) {
    setMsg('suMsg', 'Fill in all fields.', false);
    return;
  }
  try {
    const res = await fetch(apiBase() + '/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    setMsg('suMsg', 'Account created — log in below.', true);
    logEvent('POST /auth/signup — ' + res.status, data);
    $('liPhone').value = body.phone_number;
    setTimeout(() => showView('login'), 700);
  } catch (e) {
    setMsg('suMsg', e.detail ? JSON.stringify(e.detail) : 'Signup failed.', false);
    logEvent('POST /auth/signup failed', e, true);
  }
});

/* ---------------- login ---------------- */
$('liSubmit').addEventListener('click', async () => {
  const phone = $('liPhone').value.trim();
  const pass = $('liPass').value;
  if (!phone || !pass) {
    setMsg('liMsg', 'Enter phone number and password.', false);
    return;
  }
  const form = new URLSearchParams();
  form.set('grant_type', 'password');
  form.set('username', phone);
  form.set('password', pass);

  try {
    const res = await fetch(apiBase() + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    token = data.access_token;
    farmer.phone = phone;
    farmer.name = $('suName').value.trim() || phone;
    logEvent('POST /auth/login — ' + res.status, data);
    enterDashboard();
  } catch (e) {
    setMsg('liMsg', e.detail ? String(e.detail) : 'Login failed.', false);
    logEvent('POST /auth/login failed', e, true);
  }
});

/* ---------------- dashboard entry / logout ---------------- */
function enterDashboard() {
  $('farmerName').textContent = farmer.name || 'Farmer';
  $('farmerPhone').textContent = farmer.phone || '';
  $('farmerInitial').textContent = (farmer.name || '?').charAt(0).toUpperCase();
  showView('dashboard');
}

$('logoutBtn').addEventListener('click', () => {
  token = null;
  recordedBlob = null;
  $('recStatus').textContent = 'Tap to record';
  $('sendVoiceBtn').disabled = true;
  $('sendVoiceBtn').textContent = 'Record audio to enable send';
  $('resultBlock').classList.add('hidden');
  showView('login');
});

/* ---------------- tab switching ---------------- */
document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item[data-tab]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* ---------------- geolocation ---------------- */
$('gpsBtn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    logEvent('Geolocation', 'not supported in this browser', true);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      $('lat').value = pos.coords.latitude.toFixed(6);
      $('lng').value = pos.coords.longitude.toFixed(6);
      logEvent('Geolocation captured', `lat=${pos.coords.latitude}, lng=${pos.coords.longitude}`);
    },
    err => logEvent('Geolocation failed', err.message, true)
  );
});

/* ---------------- mic recording ---------------- */
$('recBtn').addEventListener('click', async () => {
  const btn = $('recBtn');
  const status = $('recStatus');
  const wave = $('wave');

  if (!recording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        recordedBlob = new Blob(recordedChunks, { type: 'audio/webm' });
        status.textContent = `Recorded ${(recordedBlob.size / 1024).toFixed(1)} KB`;
        $('sendVoiceBtn').disabled = !token;
        $('sendVoiceBtn').textContent = token ? 'Send to /voice/query' : 'Log in to send';
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      recording = true;
      btn.classList.add('active');
      wave.classList.add('live');
      status.textContent = 'Recording…';
    } catch (e) {
      logEvent('Mic access failed', e.message, true);
      status.textContent = 'Mic access denied';
    }
  } else {
    mediaRecorder.stop();
    recording = false;
    btn.classList.remove('active');
    wave.classList.remove('live');
  }
});

/* ---------------- send voice query ---------------- */
$('sendVoiceBtn').addEventListener('click', async () => {
  if (!token) { logEvent('Send blocked', 'no access token — log in first', true); return; }
  if (!recordedBlob) { logEvent('Send blocked', 'record audio first', true); return; }

  const fd = new FormData();
  fd.append('audio', recordedBlob, 'query.webm');

  const imageInput = $('imageFile');
  if (imageInput.files[0]) fd.append('image', imageInput.files[0]);

  const lat = $('lat').value, lng = $('lng').value;
  if (lat) fd.append('latitude', lat);
  if (lng) fd.append('longitude', lng);

  const sendBtn = $('sendVoiceBtn');
  sendBtn.disabled = true;
  const prevText = sendBtn.textContent;
  sendBtn.textContent = 'Sending…';

  try {
    const res = await fetch(apiBase() + '/voice/query', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw data;

    logEvent('POST /voice/query — ' + res.status, data);
    queryCount++;
    $('queryCount').textContent = queryCount;

    $('resultBlock').classList.remove('hidden');
    $('rIntent').textContent = data.intent || '—';
    $('rTranscribed').textContent = data.transcribed_text || '—';
    $('rResponse').textContent = data.response_text || '—';

    if (data.audio_response_path) {
      const audioEl = $('rAudio');
      audioEl.src = apiBase() + data.audio_response_path;
      audioEl.classList.remove('hidden');
    }
  } catch (e) {
    logEvent('POST /voice/query failed', e, true);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = prevText;
  }
});
