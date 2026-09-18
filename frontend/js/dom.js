// Minimal createElement helper — the "framework" is this file.
// el('div', { className: 'x', onclick: fn, html: '<b>' }, child1, child2)
// Attribute keys map 1:1; `html` raw-sets innerHTML (only for static markup we
// author, never for user input); special keys handle events/data/refs.

const S = new Set(['stopPropagation', 'preventDefault']);
const EV = /^on(\w+)$/i;

export function frag(...kids) {
  const f = document.createDocumentFragment();
  kids.flat(Infinity).forEach(k => {
    if (k == null || k === false) return;
    if (k === true) { f.append(''); return; }
    if (typeof k === 'string' && k.trimStart().startsWith('<')) {
      const t = document.createElement('template');
      t.innerHTML = k;
      f.append(t.content);
    } else {
      f.append(k);
    }
  });
  return f;
}

export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs || {})) {
    if (val == null || val === false) continue;
    if (key === 'html') { node.innerHTML = val; continue; }
    if (key === 'className') { node.className = val; continue; }
    if (key === 'htmlFor') { node.htmlFor = val; continue; }
    const ev = key.match(EV);
    if (ev && typeof val === 'function') {
      node.addEventListener(ev[1].toLowerCase(), val);
    } else if (val === true) {
      node.setAttribute(key, '');
    } else if (key === 'dataset') {
      Object.assign(node.dataset, val);
    } else if (key === 'style' && typeof val === 'object') {
      Object.assign(node.style, val);
    } else {
      node.setAttribute(key.replace(/^(aria|data)([A-Z])/, (m, p, c) => `${p}-${c.toLowerCase()}`), val);
    }
  }
  node.append(frag(...kids));
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export { S };