// ============================================================
// O2 小鋼瓶可用時間計算 — 純函式（無 DOM、無全域 state）
// 瀏覽器：window.O2Calc；Node：module.exports
// 公式與常數對應單位紙本對照表，不自行更動（見 CLAUDE.md）
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.O2Calc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 共用政策參數（與容積無關，單一事實來源）
  const CONFIG = Object.freeze({
    SAFETY_RESIDUAL_PSI: 200,
    UPDATE_THRESHOLD_MIN: 10,
    WARN_SWAP_PSI: 600,
    FULL_PSI: 1800,
    MAX_INPUT_PSI: 2200,            // 極端值上限（錶頭物理極限緩衝）
    PSI_PER_ATM: 14.7,
    PRESSURES: Object.freeze([1800, 1500, 1200, 900, 600, 300, 150]),
    FLOWS: Object.freeze([15, 10, 5, 4, 3, 2])
  });

  // 可切換的鋼瓶容積（水容積 L）；factor 由容積自動推導
  const TANKS = Object.freeze({
    '3.4': Object.freeze({ vol: 3.4, label: '3.4 L', desc: '0.5 立方米（病房／轉送）' }),
    '2.8': Object.freeze({ vol: 2.8, label: '2.8 L', desc: '救護車用' })
  });

  // --- 核心計算（與紙本完全一致） ---
  // 回傳可用分鐘（整數，無條件捨去）；< UPDATE_THRESHOLD_MIN 或已達殘壓回傳 null（畫面顯示「請更新」）
  function usableMin(psi, flow, vol) {
    const factor = vol / CONFIG.PSI_PER_ATM;
    const avail = (psi - CONFIG.SAFETY_RESIDUAL_PSI) * factor;
    if (avail <= 0) return null;
    const m = Math.floor(avail / flow);
    return m < CONFIG.UPDATE_THRESHOLD_MIN ? null : m;
  }

  // --- 輸入驗證（極端值處理） ---
  // 只收十進位與科學記號；Number() 會把 ' '、'\t' 當 0，也接受 0x / 0b / 0o，故先以正規式把關
  const DECIMAL_RE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

  function validatePsi(raw) {
    const s = String(raw).trim();
    const v = Number(s);
    if (!DECIMAL_RE.test(s) || Number.isNaN(v)) return { ok: false, msg: '請輸入有效的錶壓數值' };
    if (v < 0)  return { ok: false, msg: '錶壓不可為負值' };
    if (v > CONFIG.MAX_INPUT_PSI) return { ok: false, msg: `錶壓超出合理範圍（最大 ${CONFIG.MAX_INPUT_PSI} psi），請確認錶頭讀值` };
    return { ok: true, value: Math.round(v) };
  }

  return { CONFIG, TANKS, usableMin, validatePsi };
});
