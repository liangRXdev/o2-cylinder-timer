// 最小假 DOM：只實作 js/app.js 用到的介面，讓 UI 綁定能在純 Node 下測試（不引入 jsdom）
// 元素 id、按鈕、輸入框初始值皆從 index.html 解析，測試跟著真實頁面走
'use strict';
const fs = require('node:fs');
const path = require('node:path');

class FakeEl {
  constructor(attrs = {}) {
    this._cls = new Set();
    this.className = attrs.class || '';
    this.dataset = { ...(attrs.dataset || {}) };
    this.value = attrs.value != null ? String(attrs.value) : '';
    this.hidden = !!attrs.hidden;
    this.textContent = '';
    this._html = '';
    this.style = {};
    this.children = [];
    this._listeners = {};
    this._rows = null;
    const self = this;
    this.classList = {
      add: (...c) => c.forEach(x => self._cls.add(x)),
      remove: (...c) => c.forEach(x => self._cls.delete(x)),
      contains: c => self._cls.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !self._cls.has(c) : !!force;
        if (on) self._cls.add(c); else self._cls.delete(c);
        return on;
      }
    };
  }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  // 與瀏覽器相同：value 一律存成字串
  get value() { return this._value; }
  set value(v) { this._value = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this._rows = null; }
  addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); }
  dispatch(type, target = this) {
    (this._listeners[type] || []).forEach(fn => fn({ type, target }));
  }
  closest(sel) {
    return sel.startsWith('.') && this._cls.has(sel.slice(1)) ? this : null;
  }
  querySelectorAll(sel) {
    if (sel === 'tbody tr') {
      if (!this._rows) {
        this._rows = [...this._html.matchAll(/<tr class="([^"]*)" data-psi="(\d+)">/g)]
          .map(m => new FakeEl({ class: m[1], dataset: { psi: m[2] } }));
      }
      return this._rows;
    }
    if (sel.startsWith('.')) return this.children.filter(c => c._cls.has(sel.slice(1)));
    throw new Error(`fake-dom: 不支援的 selector ${sel}`);
  }
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

// 以 index.html 建立假 document；overrides 可改寫輸入框初始值（模擬瀏覽器還原表單）
function createDocument(overrides = {}) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const els = {};
  for (const m of html.matchAll(/<(\w+)\b[^>]*\sid="([^"]+)"[^>]*>/g)) {
    const tag = m[0];
    const el = new FakeEl({ class: attr(tag, 'class'), value: attr(tag, 'value'), hidden: /\shidden[\s>]/.test(tag) });
    el.tagName = m[1].toUpperCase();
    els[m[2]] = el;
  }
  for (const [grid, key] of [['flowGrid', 'flow'], ['volGrid', 'vol']]) {
    const block = html.slice(html.indexOf(`id="${grid}"`));
    const end = block.indexOf('</div>');
    for (const b of block.slice(0, end).matchAll(/<button\b[^>]*>/g)) {
      els[grid].children.push(new FakeEl({ class: attr(b[0], 'class'), dataset: { [key]: attr(b[0], `data-${key}`) } }));
    }
  }
  for (const [id, v] of Object.entries(overrides)) els[id].value = String(v);
  return {
    getElementById: id => els[id] || null,
    defaultView: new FakeEl(),   // window：只用到 addEventListener('pageshow')
    el: els
  };
}

// 測試輔助：模擬使用者操作
const ui = {
  typePsi(doc, v) { const el = doc.el.psiInput; el.value = String(v); el.dispatch('input'); },
  slide(doc, v)   { const el = doc.el.psiSlider; el.value = String(v); el.dispatch('input'); },
  // 模擬瀏覽器還原表單：直接改 value、不觸發 input 事件，之後才發 pageshow（Chromium 實測順序）
  restoreForm(doc, v) { doc.el.psiInput.value = String(v); doc.defaultView.dispatch('pageshow'); },
  clickFlow(doc, f) {
    const g = doc.el.flowGrid; g.dispatch('click', g.children.find(b => b.dataset.flow === String(f)));
  },
  clickVol(doc, v) {
    const g = doc.el.volGrid; g.dispatch('click', g.children.find(b => b.dataset.vol === String(v)));
  },
  currentRows(doc) {
    return doc.el.refTable.querySelectorAll('tbody tr').filter(r => r.classList.contains('row-current')).map(r => Number(r.dataset.psi));
  }
};

module.exports = { createDocument, ui, FakeEl };
