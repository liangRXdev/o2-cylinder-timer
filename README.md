# o2-cylinder-timer

**English** | [繁體中文](README.zh-TW.md)

A **remaining-time estimator for portable medical oxygen cylinders**, with switchable cylinder sizes.
A single HTML file with no backend, suited to GitHub Pages deployment for nursing stations, patient transport or ambulances. The interface is in Traditional Chinese.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Click%20Here-blue?style=for-the-badge)](https://liangrxdev.github.io/o2-cylinder-timer/)
---

## Supported Cylinders

| Water volume | Type | Use case |
|---|---|---|
| **3.4 L** (0.5 m³) | Small cylinder stocked at hospital nursing stations | Ward and OR transport |
| **2.8 L** (0.4 m³) | Portable ambulance cylinder | Prehospital care, long-distance transport |

After switching, the result, reference-table values and formula coefficient all update instantly.

---

## Use Cases

- Before transporting a patient, check whether the small cylinder will last until the destination
- Confirm onboard oxygen before an ambulance run
- Quickly check at the nursing station how long the current gauge pressure lasts at a given flow
- A digital replacement for laminated reference cards

All calculation happens locally in the browser; no data is sent to any server.

---

## Formula

```
Available time (min) = ⌊ (gauge pressure − 200 psi) × (water volume ÷ 14.7) ÷ flow ⌋
```

| Parameter | 3.4 L version | 2.8 L version | Basis |
|---|---|---|---|
| Conversion factor | 3.4 ÷ 14.7 = **0.2313** L/psi | 2.8 ÷ 14.7 = **0.1905** L/psi | Boyle's law; 1 kg/cm² = 14.7 psi |
| Safety residual pressure | **200 psi** (same for both) | **200 psi** | See explanation below |
| Rounding | Floor (round down) | Floor (round down) | Conservative direction |
| "Please replace" threshold | Available time < 10 minutes | Available time < 10 minutes | Clinical safety margin |
| Swap warning line | ≤ 600 psi | ≤ 600 psi | Administrative swap threshold; doesn't affect calculation |

> **Note:** At the same pressure, a 2.8 L cylinder lasts about 18% less than a 3.4 L one (volume ratio 2.8/3.4).
> For example, at 900 psi @ 15 L/min a 3.4 L cylinder still has 10 minutes, while a 2.8 L cylinder shows "please replace" straight away.
> This difference matters especially at the high flows used in ambulances.

---

## Why is the safety residual pressure 200 psi?

The safety residual is subtracted from the gauge pressure before calculating, meaning the gas corresponding to that pressure is **not counted as available time at all**. This is deliberate, for the following reasons:

### 1. The low-pressure range is the highest-risk zone during transport

You can't swap cylinders mid-transport. If the cylinder runs out on the way, the patient faces immediate hypoxia. The residual must cover:

- Flowmeter reading error (typically ±5–10%)
- Regulator relief dead zone
- Staff reaction time from noticing low pressure to completing a swap

### 2. Comparison with the "constant discount" method

Some institutions use a **constant discount method** (multiplying the conversion factor by a fixed discount without subtracting a residual),
for example:

```
Discount formula: available time = P × 0.185 ÷ flow
                  (i.e. 0.8 × 3.4/14.7, no fixed residual subtracted)
```

Back-calculating the equivalent residual implied by this formula:

```
P × 0.185 = (P − R) × 0.2313
R = P × 0.200   ← scales proportionally with pressure, not a fixed value
```

| Gauge pressure | Residual implied by discount method | This tool (fixed 200 psi) | More conservative |
|---|---|---|---|
| 1800 psi | 360 psi | 200 psi | Discount method |
| 1500 psi | 300 psi | 200 psi | Discount method |
| 1200 psi | 240 psi | 200 psi | Discount method |
| **1000 psi** | **200 psi** | **200 psi** | **Same** |
| 900 psi | 180 psi | 200 psi | **This tool** |
| 600 psi | 120 psi | 200 psi | **This tool** |

The two methods **cross at about 1000 psi**. The discount method is more conservative at high pressure; this tool is more conservative at low pressure.

Because the most dangerous moment for a portable cylinder is exactly during transport at low pressure with no chance to swap,
**a fixed residual gives stronger protection in the low-pressure zone where clinical risk is highest**, which is why this design was chosen.

### 3. Consistent with common respiratory therapy practice

A fixed residual of 150–200 psi (about 10–14 kg/cm²) is a commonly recommended minimum working pressure in the oxygen cylinder management literature.

> **Note:** The 600 psi swap warning line shown in the interface is an **administrative swap threshold** (prompting nurses to arrange a replacement) and is unrelated to the formula; don't confuse the two.

---

## Features

- **Volume switch**: two buttons at the top (3.4 L ward / transport, 2.8 L ambulance); the whole page updates instantly
- **Gauge pressure input**: number field and slider stay in sync, with a three-color pressure bar below showing the current position
- **Flow selection**: 6 buttons (2 / 3 / 4 / 5 / 10 / 15 L/min), touch-friendly
- **Three result states**: green (normal) / orange (≤ 600 psi, swap recommended) / red (replace now)
- **Standard reference table**: embedded at the bottom, recalculated on volume switch, with the row matching the current input outlined; collapsible
- **Works fully offline**: a pure static single file, referencing only CDN Bootstrap and Google Fonts

---

## Deploy to GitHub Pages

```bash
git clone https://github.com/<your-username>/o2-cylinder-timer.git
cd o2-cylinder-timer
# Put index.html in the repo root
git add index.html README.md
git commit -m "feat: add 2.8L ambulance cylinder support"
git push origin main
```

Then go to **GitHub repo → Settings → Pages → Branch: `main` / `/ (root)`**;
once deployed it is available at `https://<your-username>.github.io/o2-cylinder-timer/`.

---

## Changing Formula Parameters

Shared policy parameters (residual, thresholds, pressure scale) are centralized in `CONFIG`; cylinder volumes are defined in `TANKS`, with coefficients derived automatically from the volume — **managed in two layers, each a single source of truth**.

```javascript
// Shared policy parameters (independent of volume)
const CONFIG = Object.freeze({
  SAFETY_RESIDUAL_PSI: 200,        // safety residual pressure (psi)
  UPDATE_THRESHOLD_MIN: 10,        // "please replace" threshold (minutes)
  WARN_SWAP_PSI: 600,              // swap warning line (psi)
  FULL_PSI: 1800,                  // full-cylinder reference pressure
  MAX_INPUT_PSI: 2200,             // input validation upper limit
  PRESSURES: [1800,1500,1200,900,600,300,150],
  FLOWS: [15, 10, 5, 4, 3, 2],
});

// Switchable cylinder volumes (to add a volume: add an entry + one HTML button)
const TANKS = Object.freeze({
  '3.4': { vol: 3.4, label: '3.4 L', desc: '0.5 立方米（病房／轉送）' },
  '2.8': { vol: 2.8, label: '2.8 L', desc: '救護車用' }
});
```

**Adding another volume**: add an entry to `TANKS` and a `vol-btn` in the HTML; the calculation logic needs no changes.  
**Changing the residual policy**: edit `SAFETY_RESIDUAL_PSI` and record the reason in the git commit message for auditability.

---

## Verification Against the Paper Reference Table

Tool output matches the standard paper reference table exactly (floor rounding, tolerance ±0 minutes):

**3.4 L**

| Gauge pressure | Flow | Paper | Tool |
|---|---|---|---|
| 1800 psi | 5 L/min | 74 min | 74 min ✓ |
| 1500 psi | 3 L/min | 100 min | 100 min ✓ |
| 900 psi | 15 L/min | 10 min | 10 min ✓ |
| 600 psi | 5 L/min | 18 min | 18 min ✓ |

**2.8 L**

| Gauge pressure | Flow | Calculated | Tool |
|---|---|---|---|
| 1800 psi | 5 L/min | 60 min | 60 min ✓ |
| 1500 psi | 2 L/min | 123 min | 123 min ✓ |
| 900 psi | 15 L/min | Please replace | Please replace ✓ |
| 600 psi | 5 L/min | 15 min | 15 min ✓ |

---

## Disclaimer

This tool is only a clinical reference aid; actual available time is affected by flowmeter error, regulator tolerance and environmental factors.
It must not be the sole basis for patient-care decisions; follow your institution's medical gas management policies.

---

## License

[MIT](./LICENSE) © 2026 Che-chia Liang
