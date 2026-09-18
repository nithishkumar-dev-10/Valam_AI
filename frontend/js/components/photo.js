// Photo uploader — states: empty (with guide tips) / preview.
import { el } from '../dom.js';
import { t } from '../i18n.js';
import { store } from '../store.js';
import { checkImageFile } from '../api.js';
import { MAX_IMAGE_PIXELS } from '../config.js';
import { showToast } from './shared.js';
import { iconCamera, iconUpload, iconX } from '../icons.js';

export function createPhotoUploader({ onChange }) {
  let imageFile = null;
  let previewUrl = null;
  let imgWidth = 0, imgHeight = 0;

  const lang = () => store.state.lang;
  const fileInput = el('input', { type: 'file', accept: 'image/*', hidden: true });

  const guideTitle = el('span', { className: 'card-title' });
  const guideSub = el('span', { className: 'card-sub' });

  const zone = el('div', { className: 'photo-zone', role: 'button', tabindex: '0' });
  const previewWrap = el('div', { className: 'preview-wrap', style: { display: 'none' } });
  const previewImg = el('img', { alt: 'preview' });

  const guideEl = el('div', { className: 'photo-guide', style: { width: '100%' } });

  // guide rows with 3 tips (reusable nodes updated on draw)
  const tipIc = [el('span', { className: 'g-ic' }, el('span', null, '1')), el('span', { className: 'g-ic' }, el('span', null, '2')), el('span', { className: 'g-ic' }, el('span', null, '3'))];
  const tipTxt = [el('span'), el('span'), el('span')];
  const guideRows = [0, 1, 2].map(i =>
    el('div', { className: 'guide-row' }, tipIc[i], tipTxt[i]),
  );

  const dropHint = el('small');
  const changeBtn = el('button', { type: 'button', className: 'btn btn-ghost btn-sm' });
  const removeBtn = el('button', { type: 'button', className: 'btn btn-ghost btn-sm', style: { color: 'var(--danger)' } });
  const previewActions = el('div', { className: 'preview-actions' }, changeBtn, removeBtn);

  previewWrap.append(previewImg, previewActions);
  guideEl.append(...guideRows);

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => { zone.classList.remove('dragover'); });
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); zone.classList.remove('dragover');
    const f = e.dataTransfer.files?.[0]; if (f) validateAndSet(f);
  });

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) validateAndSet(f);
    e.target.value = '';
  });

  changeBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
  removeBtn.addEventListener('click', (e) => { e.stopPropagation(); clear(); });

  const node = el('div', { className: 'input-card' },
    el('div', { className: 'card-head' },
      el('span', { className: 'card-ic', style: { background: 'var(--green-soft)', color: 'var(--green-deep)' }, html: iconCamera }),
      el('div', null, guideTitle, guideSub)),
    previewWrap,
    zone,
    guideEl,
    fileInput);

  function draw() {
    const l = lang();
    guideTitle.textContent = t('photoTitle', l);
    guideSub.textContent = t('photoSub', l);
    tipTxt[0].textContent = t('photoGuide1', l);
    tipTxt[1].textContent = t('photoGuide2', l);
    tipTxt[2].textContent = t('photoGuide3', l);
    dropHint.textContent = t('photoDrop', l);
    changeBtn.textContent = t('photoChange', l);
    removeBtn.innerHTML = '';
    removeBtn.append(el('span', null), el('span', null, t('photoRemove', l)));

    if (imageFile) {
      zone.style.display = 'none';
      guideEl.style.display = 'none';
      previewWrap.style.display = '';
      if (previewUrl) previewImg.src = previewUrl;
    } else {
      zone.style.display = '';
      guideEl.style.display = '';
      previewWrap.style.display = 'none';
      zone.innerHTML = '';
      zone.append(el('span', { html: iconUpload }), el('span', null, t('photoDrop', l)), dropHint);
    }
  }

  function validateAndSet(file) {
    const err = checkImageFile(file);
    if (err) { showToast(err, 'error'); return; }
    // Check pixel dimensions (client-side mirror of MAX_IMAGE_PIXELS guard)
    const img = new Image();
    img.onload = () => {
      if (img.width * img.height > MAX_IMAGE_PIXELS) {
        showToast(t('imageTooManyPixels', lang()), 'error');
        URL.revokeObjectURL(img.src);
        return;
      }
      applyFile(file);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => { showToast(t('errImage', lang()), 'error'); };
    img.src = URL.createObjectURL(file);
  }

  function applyFile(file) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    imageFile = file;
    onChange(file);
    draw();
  }

  function clear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    imageFile = null;
    onChange(null);
    draw();
  }

  draw();

  return {
    el: node,
    getValue: () => imageFile,
    reset: clear,
    restore(file) { if (file) applyFile(file); },
  };
}