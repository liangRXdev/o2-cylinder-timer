// js/calc.js 規格測試 — 期望值為紙本對照表與手算值，這份就是規格
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CONFIG, TANKS, usableMin, validatePsi } = require('../js/calc.js');

// ------------------------------------------------------------
// Characterization：抽出前（bdc7695 index.html 行內 usableMin）產生的完整對照表
// 列 = CONFIG.PRESSURES，欄 = CONFIG.FLOWS（15/10/5/4/3/2）；null = 「請更新」
// ------------------------------------------------------------
const TABLE = {
  '3.4': [
    [1800, 24, 37, 74, 92, 123, 185],
    [1500, 20, 30, 60, 75, 100, 150],
    [1200, 15, 23, 46, 57, 77, 115],
    [900, 10, 16, 32, 40, 53, 80],
    [600, null, null, 18, 23, 30, 46],
    [300, null, null, null, null, null, 11],
    [150, null, null, null, null, null, null]
  ],
  '2.8': [
    [1800, 20, 30, 60, 76, 101, 152],
    [1500, 16, 24, 49, 61, 82, 123],
    [1200, 12, 19, 38, 47, 63, 95],
    [900, null, 13, 26, 33, 44, 66],
    [600, null, null, 15, 19, 25, 38],
    [300, null, null, null, null, null, null],
    [150, null, null, null, null, null, null]
  ]
};

test('常數與紙本一致', () => {
  assert.equal(CONFIG.SAFETY_RESIDUAL_PSI, 200);
  assert.equal(CONFIG.WARN_SWAP_PSI, 600);
  assert.equal(CONFIG.FULL_PSI, 1800);
  assert.equal(CONFIG.MAX_INPUT_PSI, 2200);
  assert.equal(CONFIG.UPDATE_THRESHOLD_MIN, 10);
  assert.equal(CONFIG.PSI_PER_ATM, 14.7);
  assert.deepEqual([...CONFIG.PRESSURES], [1800, 1500, 1200, 900, 600, 300, 150]);
  assert.deepEqual([...CONFIG.FLOWS], [15, 10, 5, 4, 3, 2]);
  assert.deepEqual(Object.keys(TANKS).sort(), ['2.8', '3.4']);
  assert.equal(TANKS['3.4'].vol, 3.4);
  assert.equal(TANKS['2.8'].vol, 2.8);
});

for (const [vol, rows] of Object.entries(TABLE)) {
  test(`characterization：${vol} L 對照表 ${rows.length}×${CONFIG.FLOWS.length} 全部鎖住`, () => {
    assert.deepEqual(rows.map(r => r[0]), [...CONFIG.PRESSURES]);
    for (const [psi, ...cells] of rows) {
      CONFIG.FLOWS.forEach((flow, i) => {
        assert.equal(usableMin(psi, flow, TANKS[vol].vol), cells[i], `${vol} L ${psi} psi @ ${flow} L/min`);
      });
    }
  });
}

test('手算例', () => {
  // floor(1300 × 3.4 / 14.7 / 5) = floor(60.136) = 60
  assert.equal(usableMin(1500, 5, 3.4), 60);
  // README 紙本核對列
  assert.equal(usableMin(1800, 5, 3.4), 74);   // 1600 × 3.4 / 14.7 / 5 = 74.01
  assert.equal(usableMin(1500, 3, 3.4), 100);  // 100.23
  assert.equal(usableMin(900, 15, 3.4), 10);   // 10.79
  assert.equal(usableMin(600, 5, 3.4), 18);    // 18.50
  assert.equal(usableMin(1800, 5, 2.8), 60);   // 60.95
  assert.equal(usableMin(1500, 2, 2.8), 123);  // 123.81
  assert.equal(usableMin(900, 15, 2.8), null); // 8.89 → 請更新
  assert.equal(usableMin(600, 5, 2.8), 15);    // 15.24
  // 2200 上限：2000 × 3.4 / 14.7 / 2 = 231.29
  assert.equal(usableMin(2200, 2, 3.4), 231);
});

test('殘壓與 <10 分分界', () => {
  assert.equal(usableMin(200, 2, 3.4), null);   // avail = 0
  assert.equal(usableMin(199, 2, 3.4), null);   // avail < 0
  assert.equal(usableMin(0, 2, 3.4), null);
  // 3.4 L @ 2 L/min：m ≥ 10 ⇔ psi − 200 ≥ 10 × 2 × 14.7 / 3.4 = 86.47
  assert.equal(usableMin(286, 2, 3.4), null);   // 9.95
  assert.equal(usableMin(287, 2, 3.4), 10);     // 10.06
});

test('浮點：整數錶壓 0–2200 × 兩容積 × 全部流量，floor 結果與有理數精確值相同', () => {
  // (psi − 200) × V/14.7 / f = (psi − 200) × V10 / (147 f)，以整數運算求精確 floor
  for (const [vol, v10] of [[3.4, 34], [2.8, 28]]) {
    for (const flow of CONFIG.FLOWS) {
      for (let psi = 0; psi <= CONFIG.MAX_INPUT_PSI; psi++) {
        const n = (psi - 200) * v10, d = 147 * flow;
        const exact = n <= 0 ? null : Math.floor(n / d);
        const expect = exact === null || exact < 10 ? null : exact;
        assert.equal(usableMin(psi, flow, vol), expect, `${vol} L ${psi} psi @ ${flow}`);
      }
    }
  }
  // 數學上剛好整除的組合不可少算 1 分：147 × 2 / 34 非整數，改取 psi − 200 = 147 × k
  assert.equal(usableMin(200 + 147 * 5, 2, 3.4), 85);   // 735 × 34 / 294 = 85 整除
  assert.equal(usableMin(200 + 147 * 10, 5, 2.8), 56);  // 1470 × 28 / 735 = 56 整除
});

test('validatePsi：有效數值', () => {
  assert.deepEqual(validatePsi('1500'), { ok: true, value: 1500 });
  assert.deepEqual(validatePsi('0'), { ok: true, value: 0 });
  assert.deepEqual(validatePsi('1e3'), { ok: true, value: 1000 });   // 科學記號
  for (const p of [200, 600, 1800, 2200, 2000]) {
    assert.deepEqual(validatePsi(String(p)), { ok: true, value: p }, `${p}`);
  }
});

test('validatePsi：無效數值', () => {
  for (const raw of ['', 'abc', '-1', '-50', '2200.5', '2201', '3000', 'Infinity', '1e4']) {
    assert.equal(validatePsi(raw).ok, false, JSON.stringify(raw));
  }
  assert.match(validatePsi('-1').msg, /負值/);
  assert.match(validatePsi('2201').msg, /2200/);
});
