// ============================================================
// O2 小鋼瓶可用時間計算器 — UI 綁定
// 計算一律走 O2Calc（js/calc.js），這裡不放公式
// 瀏覽器：自動 mount(document)；Node 測試：require 後以假 DOM 呼叫 mount
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.O2App = api;
    api.mount(root.document, root.O2Calc);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function mount(doc, calc) {
    const { CONFIG, TANKS, usableMin, validatePsi } = calc;

    // --- 狀態 ---
    // psiError 非 null 時 psi 視為無效：結果區回到 idle，不沿用前一次數值
    let state = { psi: 1500, psiError: null, flow: 5, vol: 3.4 };

    // --- DOM ---
    const $psiInput   = doc.getElementById('psiInput');
    const $psiSlider  = doc.getElementById('psiSlider');
    const $psiMarker  = doc.getElementById('psiMarker');
    const $flowGrid   = doc.getElementById('flowGrid');
    const $resultBox  = doc.getElementById('resultBox');
    const $resultMin  = doc.getElementById('resultMinutes');
    const $resultSta  = doc.getElementById('resultStatus');
    const $resultDet  = doc.getElementById('resultDetail');
    const $errMsg     = doc.getElementById('errMsg');
    const $refTable   = doc.getElementById('refTable');
    const $volGrid    = doc.getElementById('volGrid');
    const $tankDesc   = doc.getElementById('tankDesc');
    const $refLabel   = doc.getElementById('refTableLabel');
    const $footerNote = doc.getElementById('footerNote');

    function showError(msg) { $errMsg.textContent = msg; $errMsg.hidden = false; }
    function clearError()   { $errMsg.hidden = true; }

    // --- 結果渲染 ---
    function render() {
      const { psi, flow } = state;

      // 結果分級
      $resultBox.className = 'result-box';
      $resultMin.className = 'result-minutes';
      if (state.psiError) {
        showError(state.psiError);
        $psiMarker.style.visibility = 'hidden';
        $resultBox.classList.add('idle');
        $resultMin.textContent = '—';
        $resultSta.textContent = '請輸入有效的錶壓';
        $resultDet.textContent = '';
        highlightTableRow();
        return;
      }
      clearError();
      const minutes = usableMin(psi, flow, state.vol);

      // 壓力指示條 marker（0–1800 線性）
      const pct = Math.min(psi, CONFIG.FULL_PSI) / CONFIG.FULL_PSI * 100;
      $psiMarker.style.left = `calc(${pct}% - 2px)`;
      $psiMarker.style.visibility = '';

      if (minutes === null) {
        $resultBox.classList.add('danger');
        $resultMin.classList.add('danger');
        $resultMin.textContent = '請更新';
        $resultSta.textContent = psi <= CONFIG.SAFETY_RESIDUAL_PSI
          ? `錶壓已達安全殘壓（≤ ${CONFIG.SAFETY_RESIDUAL_PSI} psi），立即更換鋼瓶`
          : `可用時間不足 ${CONFIG.UPDATE_THRESHOLD_MIN} 分鐘，立即更換鋼瓶`;
        $resultDet.textContent = `輸入：${psi} psi @ ${flow} L/min`;
      } else {
        const isWarn = psi <= CONFIG.WARN_SWAP_PSI;
        $resultBox.classList.add(isWarn ? 'caution' : 'ok');
        $resultMin.classList.add(isWarn ? 'caution' : 'ok');
        $resultMin.textContent = `${minutes} 分`;
        $resultSta.textContent = isWarn
          ? '⚠ 已達建議換瓶線（≤600 psi），請安排更換'
          : '可正常使用';
        const hr = Math.floor(minutes / 60), mn = minutes % 60;
        const hrTxt = hr > 0 ? `≈ ${hr} 小時 ${mn} 分｜` : '';
        $resultDet.textContent = `${hrTxt}${psi} psi @ ${flow} L/min（已扣 ${CONFIG.SAFETY_RESIDUAL_PSI} psi 殘壓）`;
      }

      highlightTableRow();
    }

    // --- 對照表 ---
    function buildTable() {
      const thead = `<thead><tr><th>錶壓<br>(psi)</th>${
        CONFIG.FLOWS.map(f => `<th>${f} L/分</th>`).join('')
      }</tr></thead>`;

      const rows = CONFIG.PRESSURES.map(p => {
        const cls = p === CONFIG.FULL_PSI ? 'row-full'
                  : p === CONFIG.WARN_SWAP_PSI ? 'row-warn' : '';
        const psiLabel = p === CONFIG.WARN_SWAP_PSI
          ? `${p}<br><small style="font-size:0.65rem;">建議換瓶</small>` : p;
        const cells = CONFIG.FLOWS.map(f => {
          const v = usableMin(p, f, state.vol);
          return v === null
            ? `<td class="cell-danger">請更新</td>`
            : `<td>${v} 分</td>`;
        }).join('');
        return `<tr class="${cls}" data-psi="${p}"><td class="psi-col">${psiLabel}</td>${cells}</tr>`;
      }).join('');

      $refTable.innerHTML = thead + `<tbody>${rows}</tbody>`;
    }

    function highlightTableRow() {
      // 找最接近輸入值的標準列（向下取，<150 則不標）
      const candidates = state.psiError ? [] : CONFIG.PRESSURES.filter(p => p <= state.psi);
      const nearest = candidates.length ? Math.max(...candidates) : null;
      $refTable.querySelectorAll('tbody tr').forEach(tr => {
        tr.classList.toggle('row-current', Number(tr.dataset.psi) === nearest);
      });
    }

    // --- 事件 ---
    function applyPsiInput() {
      const r = validatePsi($psiInput.value);
      if (!r.ok) { state.psiError = r.msg; render(); return; }
      state.psiError = null;
      state.psi = r.value;
      $psiSlider.value = Math.min(r.value, CONFIG.FULL_PSI);
      render();
    }

    $psiInput.addEventListener('input', applyPsiInput);
    // 瀏覽器重新整理／上一頁還原表單值時不觸發 input（Chromium 於 load 後、pageshow 前還原）
    if (doc.defaultView) doc.defaultView.addEventListener('pageshow', applyPsiInput);

    $psiSlider.addEventListener('input', () => {
      state.psi = Number($psiSlider.value);
      state.psiError = null;
      $psiInput.value = state.psi;
      render();
    });

    $flowGrid.addEventListener('click', e => {
      const btn = e.target.closest('.flow-btn');
      if (!btn) return;
      $flowGrid.querySelectorAll('.flow-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.flow = Number(btn.dataset.flow);
      render();
    });

    $volGrid.addEventListener('click', e => {
      const btn = e.target.closest('.vol-btn');
      if (!btn) return;
      $volGrid.querySelectorAll('.vol-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.vol = Number(btn.dataset.vol);
      syncTankText();
      buildTable();   // 容積改變→重建對照表數值
      render();
    });

    // 依目前容積更新頁面文字（規格說明、對照表標題、公式係數）
    function syncTankText() {
      const key  = String(state.vol);
      const info = TANKS[key];
      const factor = (state.vol / CONFIG.PSI_PER_ATM).toFixed(4);
      $tankDesc.textContent = `鋼瓶規格：水容積 ${info.label}｜${info.desc}`;
      $refLabel.textContent = `標準對照表（${info.label}，目前輸入列以框線標示）`;
      $footerNote.innerHTML =
        `公式：可用時間(分) = (錶壓 − ${CONFIG.SAFETY_RESIDUAL_PSI} psi 安全殘壓) × ${factor} ÷ 流量；無條件捨去。<br>` +
        `「請更新」= 可用時間不足 ${CONFIG.UPDATE_THRESHOLD_MIN} 分鐘。${CONFIG.WARN_SWAP_PSI} psi（橘列）= 建議換瓶警示線。<br>` +
        `依波以耳定律估算；實際時間受流量錶誤差影響，僅供臨床參考，不可作為唯一依據。`;
    }

    // --- init ---
    syncTankText();
    buildTable();
    applyPsiInput();   // 以輸入框現值為準：瀏覽器重新整理／上一頁可能還原成非預設值

    return { state };
  }

  return { mount };
});
