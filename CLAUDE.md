# o2-cylinder-timer — 專案規則

攜帶式醫用氧氣小鋼瓶可用時間估算（3.4 L 病房／轉送、2.8 L 救護車）。vanilla JS，無框架、無相依套件、無建置步驟，部署於 GitHub Pages。

**定位：臨床參考輔助，不可作為唯一依據。**

---

## 公式與常數：對應單位紙本對照表，不自行更動

```
可用分鐘 = floor((錶壓 psi − 200) × 水容積 L / 14.7 / 流量 L/min)
```

| 項目 | 值 |
|---|---|
| 安全殘壓 | 200 psi |
| 建議換瓶線 | 600 psi（≤ 600 顯示橘色；行政門檻，不進公式） |
| 滿瓶參考 | 1800 psi |
| 輸入上限 | 2200 psi |
| 「請更新」 | 結果 < 10 分鐘或錶壓 ≤ 200 psi，不顯示數字 |
| 水容積 | 3.4 L、2.8 L |
| 流量選項 | 15／10／5／4／3／2 L/min |

- 以上與單位紙本對照表一致。**不要改寫、「改良」或換算法**（理想氣體近似、壓縮因子、溫度修正、改用廠商 L/psi 係數等），即使看起來更精確
- 懷疑有誤 → 只列為待決（附推算與出處），交由單位決定；不在 PR 裡順手改
- 真的要改常數：須有單位核定，同步改 `tests/calc.test.js` 的 characterization 表，並在 commit message 寫明理由以利稽核

## 架構

- `js/calc.js` — **全部計算與驗證**：`CONFIG`、`TANKS`、`usableMin(psi, flow, vol)`、`validatePsi(raw)`。UMD 包裝，瀏覽器掛 `window.O2Calc`、Node 走 `module.exports`，就是為了能純 Node 測試
- `js/app.js` — 只做 UI 綁定：`mount(doc, calc)`。瀏覽器自動 mount；**不要在這裡放公式**
- `index.html` — 版面與樣式；Bootstrap CSS/JS 與字型走 CDN（計算本身不依賴）
- `tests/calc.test.js` — 計算規格，**這份就是規格**（兩容積完整對照表＋手算例）
- `tests/app.test.js` — UI 同步與極端值；`tests/fake-dom.js` 解析 `index.html` 建最小假 DOM（不引入 jsdom）
- 無 PWA／`sw.js`、無 `_headers`

## 改動流程

1. **動 `js/calc.js` 前先看 `tests/calc.test.js`** — characterization 表取自抽出前的行內實作，比任何 prose 描述精確
2. 改完跑 `node --test`（Node ≥ 18 內建，無外部依賴），**須全綠**
3. 修 bug：**先寫會失敗的測試，再改程式**；確認拿掉修正時測試轉紅
4. `index.html` 新增帶 id 的元素或改按鈕結構 → 確認 `tests/fake-dom.js` 仍解析得到
5. 瀏覽器實測：直接開 `index.html`（`file://` 可用），或任何本機靜態伺服器

## 計算與顯示上不可退讓的幾點

- **只能無條件捨去**：任何四捨五入、進位都會高估可用時間。`validatePsi` 保留小數原值，不 `Math.round`（848.5 psi @ 15 L/min 是「請更新」，進位成 849 會變 10 分）
- **輸入無效時結果區回 idle（—）**，不可殘留前一次分鐘數；切換流量／容積不可清掉錯誤訊息
- **單筆結果與對照表走同一個 `usableMin`**，UI 不得自行算分鐘
- 狀態分界：`psi ≤ 200` →「已達安全殘壓」；`> 200` 且 `< 10 分` →「不足 10 分鐘」；`≤ 600` 且 `≥ 10 分` → 橘色換瓶提示
- `usableMin` 參數不合法（漏傳 vol、flow ≤ 0、非有限數值）丟 `RangeError`，不回傳 NaN／Infinity
- 壓力指示條的 marker、色帶分界、刻度標籤共用 `psiPct()`，百分比不要寫死在 CSS

## 新增容積

`TANKS` 加一筆 + `index.html` 加一顆 `vol-btn`。key 須等於 `String(vol)`（`'3'` 而非 `'3.0'`），`data-vol` 同值；`tests/calc.test.js` 補該容積的對照表。

## Commit

`fix(calc):` / `fix(ui):` / `refactor(calc):` / `test(calc):` / `docs(readme):` / `docs(claude):` + 繁中說明；修 bug 的 commit 附重現輸入。

## 樣式慣例

- 字型：`Noto Sans TC` 內文、`JetBrains Mono` 數字
- CSS 變數集中於 `:root`；class 用 kebab-case（`result-box`、`flow-btn active`），非 BEM
- 觸控目標 ≥ 44px
