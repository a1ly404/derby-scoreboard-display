# EoD Overlay — WCAG 2.1 Contrast Audit

Automated contrast analysis for all eight league colour presets against WCAG 2.1 Level AA (4.5:1 normal text, 3:1 large/UI text).

All ratios calculated using the WCAG 2.1 relative luminance formula.  
Target threshold: **4.5:1** (AA normal text / non-text UI components with this overlay's font sizes).

---

## Summary Table

| League | Bar fg | Bar bg | Bar text | Ratio | Lead flash | Ratio | SP text | Ratio | Roster# text on bg | Ratio |
|--------|--------|--------|----------|-------|------------|-------|---------|-------|--------------------|-------|
| Denver | `#1f3264` | `#000000` | ⬜ `#ffffff` | 12.36:1 ✅ | ⬜ `#ffffff` | 12.36:1 ✅ | ⬜ `#ffffff` | 12.36:1 ✅ | ⬜ white on `#000000` | 21.00:1 ✅ |
| Faultline | `#0096bc` | `#000000` | ⬛ `#000000` | 6.09:1 ✅ | ⬛ `#000000` | 6.09:1 ✅ | ⬛ `#000000` | 6.09:1 ✅ | ⬜ white on `#000000` | 21.00:1 ✅ |
| GVRDA | `#000000` | `#000000` | ⬜ `#ffffff` | 21.00:1 ✅ | 🔴 `#ff0000` | 5.25:1 ✅ | ⬜ `#ffffff` | 21.00:1 ✅ | ⬜ white on `#000000` | 21.00:1 ✅ |
| Hard Dark | `#12325e` | `#b6b6b6` | ⬜ `#ffffff` | 12.78:1 ✅ | ⬜ `#ffffff` | 12.78:1 ✅ | ⬜ `#ffffff` | 12.78:1 ✅ | ⬛ black on `#b6b6b6` | 10.36:1 ✅ |
| Saskatoon | `#ff2100` | `#000000` | ⬛ `#000000` | 5.47:1 ✅ | ⬛ `#000000` | 5.47:1 ✅ | ⬛ `#000000` | 5.47:1 ✅ | ⬜ white on `#000000` | 21.00:1 ✅ |
| West Sound | `#bf4c0d` | `#6a306d` | ⬜ `#ffffff` | 4.94:1 ✅ | ⬜ `#ffffff` | 4.94:1 ✅ | ⬜ `#ffffff` | 4.94:1 ✅ | ⬜ white on `#6a306d` | 9.31:1 ✅ |
| EoD Envy | `#12325e` | `#b6b6b6` | ⬜ `#ffffff` | 12.78:1 ✅ | ⬜ `#ffffff` | 12.78:1 ✅ | ⬜ `#ffffff` | 12.78:1 ✅ | ⬛ black on `#b6b6b6` | 10.36:1 ✅ |
| EoD Encore | `#12325e` | `#b6b6b6` | ⬜ `#ffffff` | 12.78:1 ✅ | ⬜ `#ffffff` | 12.78:1 ✅ | ⬜ `#ffffff` | 12.78:1 ✅ | ⬛ black on `#b6b6b6` | 10.36:1 ✅ |

**All presets pass WCAG 2.1 AA** when the overlay's automatic WCAG correction logic runs correctly (see bugs section below).

---

## Element-by-Element Explanation

### Bar text (team name + score)
Applied via `--teamN-text` CSS variable, auto-selected in `index.js`:
- White if `contrast(#ffffff, barColour) >= 4.5`
- Otherwise black

### Lead jammer ★ flash animation
Selected by `wcagCheckLeadFlash(teamNum, barColour)` in `index.js`:
- Tries `#ff0000`, `#ffffff`, `#ffff00`, `#000000` in order
- Picks first candidate ≥ 4.5:1 vs bar colour
- Injects `@keyframes HasLead_TN` + `color` override per team

### Star pass `SP` text in Indicator
The Indicator box shows `SP` when `StarPass` is true.  
Background = `--teamN-bar` (the bar colour).  
Text colour = `--teamN-text` (the same auto white/black as bar text).  
Therefore contrast = same ratio as bar text → all pass.

### Roster number text (`.Number` cells)
Default CSS: `color: white !important`  
`wcagCheckRosterNumber(teamNum, bgColour)` injects a black override if white fails 4.5:1 vs the bg.

---

## Contrast Details per League

### Denver (`#1f3264` / bg `#000000`)
```
White on #1f3264:   12.36:1  ✅  → bar text = white
Black on #1f3264:    1.70:1  ❌
Red on #1f3264:      3.09:1  ⚠️  (below 4.5 — JS skips)
White flash on bar: 12.36:1  ✅  → lead flash = white
White on bg #000:   21.00:1  ✅  → roster# = white (default)
```

### Faultline (`#0096bc` / bg `#000000`)
```
White on #0096bc:    3.45:1  ⚠️  (fails 4.5 — JS skips)
Black on #0096bc:    6.09:1  ✅  → bar text = BLACK
Red on #0096bc:      1.16:1  ❌  (invisible on teal)
Black flash on bar:  6.09:1  ✅  → lead flash = BLACK (not red!)
White on bg #000:   21.00:1  ✅  → roster# = white
```

> ⚠️ **Faultline note:** The ★ and `SP` will appear in **black**, not the default white. This is correct behaviour — white on teal only reaches 3.45:1 which fails AA. The JS correctly picks black.

### GVRDA (`#000000` / bg `#000000`)
```
White on #000000:   21.00:1  ✅  → bar text = white
Red on #000000:      5.25:1  ✅  → lead flash = RED (first candidate that passes)
White flash:        21.00:1  ✅  (also passes, but red chosen first)
White on bg #000:   21.00:1  ✅  → roster# = white
```

> ⚠️ **GVRDA note:** Both fg and bg are `#000000`. The bar is fully black, and the alt/bg colour is also black. This is intentional for GVRDA's branding — white text and red lead flash are both highly readable.

### Hard Dark / EoD Envy / EoD Encore (`#12325e` / bg `#b6b6b6`)
```
White on #12325e:   12.78:1  ✅  → bar text = white
Red on #12325e:      3.20:1  ⚠️  (fails 4.5)
White flash on bar: 12.78:1  ✅  → lead flash = white
White on bg #b6b6b6: 2.03:1  ❌  (FAILS — light grey bg)
Black on bg #b6b6b6:10.36:1  ✅  → wcagCheckRosterNumber() injects black
```

> 🔴 **Hard Dark / EoD BUG (now fixed):** The roster `.Number` background is `#b6b6b6` (light grey). White text on light grey is only 2.03:1 — a WCAG AA failure. The `wcagCheckRosterNumber()` function correctly detects and fixes this **only if the `bg` URL param is present** or if the WS state is set before the check runs. A `WS.Register` listener has been added to `index.js` to re-run the check whenever `overlay.bg` changes via the admin panel.

### Saskatoon (`#ff2100` / bg `#000000`)
```
White on #ff2100:    3.84:1  ⚠️  (fails 4.5)
Black on #ff2100:    5.47:1  ✅  → bar text = BLACK
Red on #ff2100:      1.04:1  ❌  (red on red = invisible)
Black flash on bar:  5.47:1  ✅  → lead flash = BLACK (not red — would be invisible)
White on bg #000:   21.00:1  ✅  → roster# = white
```

> ⚠️ **Saskatoon note:** Both bar text AND lead flash will appear black on the red bar. This is visually correct and passes WCAG. Red flash on red is 1.04:1 — invisible. The JS candidate order correctly skips red and selects black.

### West Sound (`#bf4c0d` / bg `#6a306d`)
```
White on #bf4c0d:    4.94:1  ✅  → bar text = white (marginally above AA)
Black on #bf4c0d:    4.25:1  ⚠️  (just below 4.5)
Red on #bf4c0d:      1.23:1  ❌
White flash on bar:  4.94:1  ✅  → lead flash = white
White on bg #6a306d: 9.31:1  ✅  → roster# = white
```

> ⚠️ **West Sound note:** White on burnt orange is only 4.94:1 — it passes AA but is the closest any preset gets to the threshold. If the bar colour is tweaked slightly darker, it could fail. Monitor during live use.

---

## Bugs Found and Fixed

### BUG-001 — Dynamic `wcagCheckRosterNumber` not firing on admin colour change

**Status:** Fixed in `eod-overlay/index.js`

**Root cause:**  
`wcagCheckRosterNumber` only ran during initial page load via URL params. If the overlay was loaded without `?homebg=` and colours were set via the admin panel, it defaulted to `#000000` as the bg — which always passes white. Teams with a light `bg` colour (`#b6b6b6` — Hard Dark, EoD Envy, EoD Encore) would display unreadable white-on-light-grey roster numbers.

**Fix:**  
Added a `WS.Register` listener in `index.js` watching `Team(N).Color(overlay.fg)` and `Team(N).Color(overlay.bg)` for both teams. When the admin panel pushes a colour change via WS, the listener re-runs `wcagCheckLeadFlash` (for fg changes) and `wcagCheckRosterNumber` (for bg changes).

---

### BUG-002 — Admin preview iframe missing `--teamN-text` update and lead flash

**Status:** Fixed in `eod-overlay/admin/index.js`

**Root cause:**  
`pushBarColourToPreview()` only set `--teamN-bar` in the iframe. The text colour (`--teamN-text`) and lead flash animation remained at their defaults (black text, white flash). The preview was inaccurate for presets like Faultline where bar text should be black, not white.

**Fix:**  
`pushBarColourToPreview()` now also calls `contrastRatio` and `wcagCheckLeadFlash` from the iframe's own `contentWindow` context so all three CSS updates happen in sync.

---

## Elements NOT Covered by Automated Checks

These elements require **manual visual testing** — they involve CRG-injected inline styles or dynamic state:

| Element | Risk | How to test |
|---------|------|-------------|
| Panel `<h1>` headers (roster, penalty) | Uses `sbCss background: Color(overlay.bg)` — no CSS var override | Open each panel with each preset, check header readability |
| PPJ chart `GraphBlock` bars | `sbCss background: Color(overlay.bg)` | Open PPJ panel mid-game |
| Lower third `<h5>` | `sbCss background: Color(overlay.bg)` | Open lower third with team-coloured style |
| Penalty badge colours (`darkorange`, `orange`, `red`) | Hardcoded — not dynamic | Check text legibility on dark penalty panel rows |
| Clock description bar (`#444`, `#c0392b`, `#1a4a8a`) | Hardcoded backgrounds with white text | Advance through game states and check ClockDescription text |

---

## WCAG Criteria Covered

| Criterion | Description | Status |
|-----------|-------------|--------|
| 1.4.3 Contrast (Minimum) | Text contrast ≥ 4.5:1 | ✅ Automated check for all bar elements |
| 1.4.11 Non-text Contrast | UI component contrast ≥ 3:1 | ✅ Flash animation and SP indicator both exceed 4.5:1 |
| 2.3.1 Three Flashes | Flashing content ≤ 3 Hz | ✅ HasLead animation = ~0.5 Hz (2s / 1 flash cycle) |
| 1.4.4 Resize Text | Text not clipped at 200% zoom | ⚠️ Needs manual browser zoom test |
| 1.4.10 Reflow | Content reflows at 320px width | ❌ Out of scope — overlay is fixed-width broadcast |

---

*Generated: 2026-04-03 | Based on overlay version `eod-overlay/` in repo `derby-scoreboard-display`*
