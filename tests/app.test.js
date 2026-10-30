// js/app.js UI 綁定測試 — 以 tests/fake-dom.js 模擬 index.html，純 Node 執行
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../js/calc.js');
const { mount } = require('../js/app.js');
const { createDocument, ui } = require('./fake-dom.js');

function setup(overrides) {
  const doc = createDocument(overrides);
  mount(doc, calc);
  const el = doc.el;
  const view = () => ({
    minutes: el.resultMinutes.textContent,
    status: el.resultStatus.textContent,
    detail: el.resultDetail.textContent,
    box: el.resultBox.className,
    err: el.errMsg.hidden ? null : el.errMsg.textContent
  });
  return { doc, el, view };
}

test('初始：3.4 L、1500 psi、5 L/min → 60 分', () => {
  const { view, el } = setup();
  const v = view();
  assert.equal(v.minutes, '60 分');
  assert.equal(v.status, '可正常使用');
  assert.match(v.detail, /≈ 1 小時 0 分｜1500 psi @ 5 L\/min/);
  assert.match(v.box, /\bok\b/);
  assert.equal(v.err, null);
  assert.match(el.tankDesc.textContent, /3\.4 L/);
});

test('單筆結果與對照表同一格一致（兩容積 × 全部壓力 × 全部流量）', () => {
  const { doc, el, view } = setup();
  for (const vol of ['3.4', '2.8']) {
    ui.clickVol(doc, vol);
    const rows = [...el.refTable.innerHTML.matchAll(/<tr class="[^"]*" data-psi="(\d+)">(.*?)<\/tr>/g)];
    assert.equal(rows.length, calc.CONFIG.PRESSURES.length);
    for (const [, psi, rowHtml] of rows) {
      const cells = [...rowHtml.matchAll(/<td[^>]*>(.*?)<\/td>/g)].slice(1).map(m => m[1]);
      calc.CONFIG.FLOWS.forEach((flow, i) => {
        ui.clickFlow(doc, flow);
        ui.typePsi(doc, psi);
        assert.equal(view().minutes, cells[i], `${vol} L ${psi} psi @ ${flow}`);
      });
    }
  }
});

test('切換容積：結果、對照表、規格說明、對照表標題、頁尾係數全部同步', () => {
  const { doc, el, view } = setup();
  ui.clickVol(doc, '2.8');
  assert.equal(view().minutes, '49 分');                      // 1300 × 2.8 / 14.7 / 5 = 49.5
  assert.match(el.tankDesc.textContent, /2\.8 L/);
  assert.match(el.refTableLabel.textContent, /2\.8 L/);
  assert.match(el.footerNote.innerHTML, /× 0\.1905 ÷ 流量/);
  assert.match(el.refTable.innerHTML, /<tr class="row-full" data-psi="1800"><td class="psi-col">1800<\/td><td>20 分<\/td>/);
  assert.ok(el.volGrid.children.find(b => b.dataset.vol === '2.8').classList.contains('active'));
  assert.ok(!el.volGrid.children.find(b => b.dataset.vol === '3.4').classList.contains('active'));
  ui.clickVol(doc, '3.4');
  assert.equal(view().minutes, '60 分');
  assert.match(el.footerNote.innerHTML, /× 0\.2313 ÷ 流量/);
});

test('切換流量：結果與按鈕狀態同步', () => {
  const { doc, el, view } = setup();
  ui.clickFlow(doc, 15);
  assert.equal(view().minutes, '20 分');
  assert.match(view().detail, /@ 15 L\/min/);
  const active = el.flowGrid.children.filter(b => b.classList.contains('active')).map(b => b.dataset.flow);
  assert.deepEqual(active, ['15']);
});

test('滑桿 ↔ 輸入框同步；>1800 時滑桿停在 1800、結果用實際輸入', () => {
  const { doc, el, view } = setup();
  ui.slide(doc, 900);
  assert.equal(el.psiInput.value, '900');
  assert.equal(view().minutes, '32 分');
  ui.typePsi(doc, 2000);
  assert.equal(el.psiSlider.value, '1800');
  assert.equal(view().minutes, '83 分');                      // 1800 × 3.4 / 14.7 / 5 = 83.27
  assert.deepEqual(ui.currentRows(doc), [1800]);
});

test('分級：>600 ok、≤600 caution、<10 分 danger', () => {
  const { doc, view } = setup();
  ui.typePsi(doc, 601);
  assert.match(view().box, /\bok\b/);
  ui.typePsi(doc, 600);
  assert.match(view().box, /\bcaution\b/);
  assert.equal(view().minutes, '18 分');
  ui.clickFlow(doc, 15);
  assert.match(view().box, /\bdanger\b/);
  assert.equal(view().minutes, '請更新');
  assert.match(view().status, /不足 10 分鐘/);
});

test('對照表框線：取 ≤ 輸入值的最近標準列；<150 不標', () => {
  const { doc } = setup();
  ui.typePsi(doc, 1499);
  assert.deepEqual(ui.currentRows(doc), [1200]);
  ui.typePsi(doc, 150);
  assert.deepEqual(ui.currentRows(doc), [150]);
  ui.typePsi(doc, 149);
  assert.deepEqual(ui.currentRows(doc), []);
});

test('小時換算：≥60 分顯示「≈ X 小時 Y 分」，<60 分不顯示', () => {
  const { doc, view } = setup();
  ui.clickFlow(doc, 2);
  ui.typePsi(doc, 2200);
  assert.match(view().detail, /^≈ 3 小時 51 分｜/);           // 231 分
  ui.typePsi(doc, 300);
  assert.equal(view().minutes, '11 分');
  assert.doesNotMatch(view().detail, /小時/);
});
