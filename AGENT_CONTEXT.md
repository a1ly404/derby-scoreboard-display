# EoD Overlay — Agent Context

Everything a coding agent needs to continue work on the custom EoD broadcast overlay.

---

## 1. Project Overview

A custom broadcast overlay for the **CRG ScoreBoard** (open-source roller derby scoreboard software). The overlay lives inside the CRG install as a custom HTML view and connects to CRG's WebSocket API to receive live game data.

The overlay displays:
- Team score bar rows (team name, score, jam score, timeouts) with configurable team colours
- A clock box (period/jam clocks, lineup/timeout/intermission clocks)
- Lineup / jammer box showing the five on-track skaters per team — including **lead jammer ★ flash** and **star pass SP** indicator
- Panels (roster, penalties, PPJ chart, lower third, upcoming) that animate in/out

---

## 2. Repository

- **GitHub:** `https://github.com/a1ly404/derby-scoreboard-display`
- **Branch:** `main`

### Repo structure

```
eod-overlay/
  index.html      ← overlay page (loaded by CRG at /custom/eod-overlay/index.html)
  index.css       ← all styles (CSS custom properties drive team colours)
  index.js        ← URL param handling + WCAG contrast utilities + WS listeners
  preview.html    ← standalone preview (not connected to CRG)
  admin/
    index.html    ← admin/production control panel
    index.css     ← admin styles
    index.js      ← league presets + preview iframe sync
```

---

## 3. CRG ScoreBoard

### Running CRG locally

```bash
/opt/homebrew/opt/openjdk@17/bin/java \
  -jar derby/scoreboard/lib/crg-scoreboard.jar \
  -p 8002
```

CRG web UI: `http://localhost:8002`

### File sync — repo → CRG install

The repo `eod-overlay/` directory must be kept in sync with:

```
derby/scoreboard/html/custom/eod-overlay/
```

Sync command (run from repo root after editing source files):

```bash
cp eod-overlay/index.html  derby/scoreboard/html/custom/eod-overlay/index.html
cp eod-overlay/index.css   derby/scoreboard/html/custom/eod-overlay/index.css
cp eod-overlay/index.js    derby/scoreboard/html/custom/eod-overlay/index.js
cp eod-overlay/admin/index.html derby/scoreboard/html/custom/eod-overlay/admin/index.html
cp eod-overlay/admin/index.css  derby/scoreboard/html/custom/eod-overlay/admin/index.css
cp eod-overlay/admin/index.js   derby/scoreboard/html/custom/eod-overlay/admin/index.js
```

Or edit in-place inside `derby/scoreboard/html/custom/eod-overlay/`, then copy back before committing.

### Overlay URL

```
http://localhost:8002/custom/eod-overlay/index.html
```

With team colours (# encoded as %23):

```
http://localhost:8002/custom/eod-overlay/index.html?home=%231f3264&away=%23ff2100
```

With alt/bg colours too:

```
http://localhost:8002/custom/eod-overlay/index.html?home=%231f3264&homebg=%23000000&away=%23ff2100&awaybg=%23000000
```

Admin panel:

```
http://localhost:8002/custom/eod-overlay/admin/index.html
```

### CRG WebSocket API

- Endpoint: `ws://localhost:8002/WS`
- JS helpers: `WS.Set(key, value)`, `WS.Register(keys, callback)`, `WS.AfterLoad(fn)`
- Available via `/json/core.js` (included in the overlay `<head>`)

Key state paths used:

| Path | Purpose |
|------|---------|
| `ScoreBoard.CurrentGame.Team(N).Color(overlay.fg)` | Main bar hex colour for team N |
| `ScoreBoard.CurrentGame.Team(N).Color(overlay.bg)` | Indicator/alt bg hex colour |
| `ScoreBoard.Settings.Setting(Overlay.Interactive.*)` | Admin toggle state (Clock, Score, ShowJammers, etc.) |
| `ScoreBoard.CurrentGame.Clock(*).Running` | Which clocks are live |
| `ScoreBoard.CurrentGame.InJam` | Whether a jam is active |
| `ScoreBoard.CurrentGame.Team(N).DisplayLead` | Whether team N has lead jammer |
| `ScoreBoard.CurrentGame.Team(N).StarPass` | Whether a star pass is in progress |

---

## 4. Colour System

### URL params → CSS vars

`index.js` reads `?home=hex&away=hex` on load and:

1. Sets `--teamN-bar` CSS custom property on `:root` to the flat hex (overriding the default silver gradient)
2. Runs WCAG contrast check → sets `--teamN-text` to `#ffffff` or `#000000`
3. Calls `wcagCheckLeadFlash(teamNum, barColour)` to pick the best lead star flash colour
4. Optionally accepts `?homebg=hex&awaybg=hex` for the indicator/jammer bg (pushes to CRG state only — the CSS vars handle the main bar)

A `WS.Register` listener (added after the WCAG audit) re-runs all three of these whenever the admin panel changes `overlay.fg` or `overlay.bg` via WebSocket — so WCAG corrections apply even when colours are set at runtime, not via URL params.

### CSS custom properties

Defined in `:root` in `index.css`:

```css
:root {
  --team1-bar:  linear-gradient(to bottom, #eee, #ddd 30%, #ccc 60%, #bbb);  /* stock silver */
  --team2-bar:  linear-gradient(to bottom, #bbb, #ccc 30%, #ddd 60%, #eee);  /* stock silver (flipped) */
  --team1-text: #000000;
  --team2-text: #000000;
}
```

When URL params or admin changes are applied, JS overrides these with a flat hex string.

### What uses the vars

| Selector | Uses |
|----------|------|
| `[Team="1"] .barBackground` | `--team1-bar` bg, `--team1-text` fg |
| `[Team="2"] .barBackground` | `--team2-bar` bg, `--team2-text` fg |
| `[Team="1"] .Indicator` | `--team1-bar` bg, `--team1-text` fg |
| `[Team="2"] .Indicator` | `--team2-bar` bg, `--team2-text` fg |
| `[Team="1"] .JammerBox` | `--team1-bar` bg, `--team1-text` fg |
| `[Team="2"] .JammerBox` | `--team2-bar` bg, `--team2-text` fg |

### Clock box — always silver, never team-coloured

`.barBackgroundTop` and `.barBackgroundBottom` have their own hardcoded silver gradients and black text. They do **not** use the `--teamN-*` vars.

---

## 5. WCAG Utilities (`index.js`)

All functions are global (no module system):

### `hexToRgb(hex)` → `{r, g, b}`
Parses a 6-digit (or 3-digit) hex string.

### `relativeLuminance(rgb)` → float
WCAG 2.1 relative luminance formula.

### `contrastRatio(hex1, hex2)` → float
Returns the contrast ratio between two hex colours (e.g. `4.5` = WCAG AA).

### `wcagCheckLeadFlash(teamNum, barColour)`
Tries `#ff0000`, `#ffffff`, `#ffff00`, `#000000` in order; picks the first that hits 4.5:1 contrast against `barColour`. Injects a `<style>` block overriding the `HasLead` keyframe animation and sets `color` on `.JammerBox .Jamming` for that team.

### `wcagCheckRosterNumber(teamNum, bgColour)`
Checks if white text passes 4.5:1 on `bgColour`. If not, injects a `<style>` block forcing black on `.RosterTeam [Team="N"] .Number`.

---

## 6. League Colour Presets

```js
var leaguePresets = {
  Denver:    { name: 'Denver',     fg: '#1f3264', bg: '#000000' },
  Faultline: { name: 'Faultline',  fg: '#0096bc', bg: '#000000' },
  GVRDA:     { name: 'GVRDA',      fg: '#000000', bg: '#000000' },
  HardDark:  { name: 'Hard Dark',  fg: '#12325e', bg: '#b6b6b6' },
  Saskatoon: { name: 'Saskatoon',  fg: '#ff2100', bg: '#000000' },
  WestSound: { name: 'West Sound', fg: '#bf4c0d', bg: '#6a306d' },
  EoDEnvy:   { name: 'EoD Envy',   fg: '#12325e', bg: '#b6b6b6' },
  EoDEncore: { name: 'EoD Encore', fg: '#12325e', bg: '#b6b6b6' },
};
```

`applyLeaguePreset(team, leagueKey)` — pushes `fg`/`bg` to CRG state via `WS.Set`, updates swatches, and calls `pushBarColourToPreview()`.

`applyCustomColour(team, fgHex)` — same as above but for freeform hex input.

`pushBarColourToPreview(team, fgHex)` — sets `--teamN-bar` **and** `--teamN-text` (with WCAG check) on the preview `<iframe>`'s root element, and calls `wcagCheckLeadFlash` inside the iframe for instant accurate preview.

---

## 7. CRG's `sbCss` / `sbDisplay` Template System

CRG's `core.js` processes custom HTML attributes:

- **`sbDisplay="Key: fn"`** — reads a WS state key, passes through optional transform function, sets element text
- **`sbCss="property: Key: fn"`** — reads a WS key, sets a CSS property as an inline style
- **`sbClass="ClassName: Key: condition"`** — toggles a CSS class based on WS state
- **`sbContext="Path"`** — scopes all child `sb*` attributes relative to a WS path
- **`sbForeach="Type: ..."`** — repeats the element for each matching WS key

The inline `sbCss` for `color: Color(overlay.fg)` means CRG injects the team's `overlay.fg` colour as an inline `color:` style directly on elements like `.Indicator` and `.JammerBox`. Our CSS overrides these with `!important` using the CSS vars.

---

## 8. Key CSS Decisions

### Score bar text
`.TeamBox .Team .Name` and `.Score` use `color: inherit` — they pick up from `.barBackground`'s `color: var(--teamN-text)`.

### Indicator
Border-radius: `8px 0 0 0` (team 1 top-left) / `0 0 0 8px` (team 2 bottom-left). Background + text via CSS vars with `!important` to beat CRG's inline `sbCss`.

### JammerBox
Background + text via CSS vars with `!important`. `font-size: 50%` on `.JammerBox` itself (relative to TeamBox's `1.8em`). Inner `>div` elements: `font-size: 100%` (adjusted from 80% to improve readability).

### Clock box
`.ClockBarTop` / `.ClockBarBottom` — text is `#000000` (black on silver). Not connected to team CSS vars. Middle bar (`ClockBarMiddle`) has its `backgroundColor` set dynamically in JS via `$('.ClockDescription').css('backgroundColor', ...)` based on clock type (jam = `#444`, timeout = `#c0392b`, intermission = `#1a4a8a`).

### Lead flash
Default `@keyframes HasLead` flashes white. WCAG check in JS overrides per-team with a `<style>` block using a unique `@keyframes HasLead_TN` animation.

### Star pass
The Indicator element shows `SP` text when `StarPass` is true. It uses the same CSS vars as the bar (bg = team bar colour, text = auto white/black). All presets pass WCAG AA at this element.

### Roster numbers
`.RosterTeam .Team .Skater .Number { color: white !important; }` as default. WCAG check injects black override if needed. The WS.Register listener ensures this also runs when colours are set via the admin panel (not just URL params).

---

## 9. File Locations

All paths relative to the derby working directory (`derby/`):

| File | Relative path |
|------|---------------|
| Overlay HTML | `scoreboard/html/custom/eod-overlay/index.html` |
| Overlay CSS | `scoreboard/html/custom/eod-overlay/index.css` |
| Overlay JS | `scoreboard/html/custom/eod-overlay/index.js` |
| Admin HTML | `scoreboard/html/custom/eod-overlay/admin/index.html` |
| Admin CSS | `scoreboard/html/custom/eod-overlay/admin/index.css` |
| Admin JS | `scoreboard/html/custom/eod-overlay/admin/index.js` |
| Repo source | `derby-scoreboard-display/eod-overlay/` |
| CRG jar | `scoreboard/lib/crg-scoreboard.jar` |

---

## 10. Current State

- ✅ Team bar rows show team colour (flat hex via `--teamN-bar` CSS var), default to stock silver gradient
- ✅ Bar text (name, score) auto white/black via WCAG 4.5:1 check
- ✅ Indicator square matches team bar (CSS vars with `!important`)
- ✅ JammerBox / lineup box matches team bar
- ✅ Lineup skater text at `font-size: 100%` (readable)
- ✅ Clock box always silver — not team-coloured
- ✅ Clock text is black (`#000000`) on the silver clock bar
- ✅ Roster number text always white, WCAG-flipped to black if needed
- ✅ Lead flash star WCAG-checked per team colour
- ✅ Star pass `SP` text in Indicator — uses bar CSS vars, passes WCAG AA for all presets
- ✅ Admin panel: league preset dropdowns + custom hex inputs + live preview iframe
- ✅ WS.Register listener re-runs WCAG checks when admin changes colours at runtime
- ✅ Admin preview iframe now also updates `--teamN-text` and `wcagCheckLeadFlash`
- ✅ WCAG_AUDIT.md documents full contrast table for all 8 league presets
- ⚠️ **Star pass / lead flash live test still needed** — see Section 12

---

## 11. How to Make Further Changes

1. Edit source files in `derby/scoreboard/html/custom/eod-overlay/`
2. Test by loading the overlay URL in a browser (hard-refresh after CSS changes: Cmd+Shift+R)
3. Copy changed files back to `derby-scoreboard-display/eod-overlay/`
4. Commit and push

```bash
cd derby-scoreboard-display
git add eod-overlay/
git commit -m "your message"
git push origin main
```

---

## 12. Live-Readiness Checklist

Complete all items below before broadcasting live.

### A. Visual / WCAG verification (browser)

| # | Test | How |
|---|------|-----|
| A1 | Load overlay with each preset pair and confirm bar text is readable | Open `http://localhost:8002/custom/eod-overlay/index.html?home=%23BARCOLOR&away=%23BARCOLOR` |
| A2 | Lead jammer ★ is visible and flashes on dark AND bright bars (Faultline, Saskatoon) | Start a jam, assign lead in CRG scoreboard UI |
| A3 | Star pass `SP` text visible in Indicator box | In CRG scoreboard, trigger star pass during a jam |
| A4 | Roster number text is black (not white) on `#b6b6b6` bg (Hard Dark / EoD Envy / EoD Encore) | Open roster panel, verify `.Number` cells |
| A5 | Clock description bar changes colour: grey (jam), red (timeout), blue (intermission) | Advance through game states |
| A6 | Panels slide in/out cleanly (roster, penalty, PPJ, lower third, upcoming) | Use admin keyboard shortcuts 1-4, 0, 9, U |
| A7 | Preview iframe in admin matches overlay appearance after preset change | Pick preset in admin, check iframe |

### B. WebSocket / CRG state tests

| # | Test | How |
|---|------|-----|
| B1 | Setting colour via admin preset fires WS state AND updates overlay (no page reload) | Open overlay + admin side by side; change preset |
| B2 | `wcagCheckRosterNumber` fires on admin colour change (not just URL param) | Set Hard Dark via admin, open roster panel, inspect `.Number` colour in devtools |
| B3 | `wcagCheckLeadFlash` fires on admin colour change | Set Faultline via admin, verify flash star uses `#000000` not `#ffffff` |
| B4 | Both teams update independently | Set Team 1 to Denver, Team 2 to Saskatoon simultaneously |

### C. Star pass specific tests

| # | Test | Expected result |
|---|------|-----------------|
| C1 | During a jam, jammer hands star to pivot | Indicator switches from `★` to `SP` |
| C2 | `SP` text colour is readable on team bar | White on dark blue (Denver/Hard Dark/EoD), Black on teal (Faultline), Black on red (Saskatoon) |
| C3 | After star pass completes, indicator returns to blank or `★` | Indicator reflects new lead state |
| C4 | Star pass during a timeout / no lead jam | Indicator should show `SP` without `★` |

### D. Lead jammer flash specific tests

| # | Test | Expected result |
|---|------|-----------------|
| D1 | Lead jammer assigned — ★ appears and animates | `HasLead_T1` or `HasLead_T2` animation runs |
| D2 | Lead on Faultline (`#0096bc`) — flash is BLACK not red | Red (#ff0000) fails contrast on teal; JS should pick #000000 |
| D3 | Lead on Saskatoon (`#ff2100`) — flash is BLACK not red | Red on red is invisible; JS should pick #000000 |
| D4 | Lead on GVRDA (`#000000`) — flash is RED | Red (#ff0000) passes 5.25:1 on black; should be first choice |
| D5 | Lead lost — ★ stops flashing | `.Lead` class removed, animation stops |

### E. Broadcast / OBS integration

| # | Test | How |
|---|------|-----|
| E1 | Overlay loads on OBS Browser Source at 1920×1080 with `?bg=transparent` | Add as browser source, set width 1920 / height 1080 |
| E2 | Green screen background option works | In admin → Background → select Green |
| E3 | Scaling control adjusts overlay size without layout break | Admin → Scaling slider |
| E4 | Multiple browser sources (overlay + admin) don't conflict | Open both in separate browser source windows |

---

## 13. WCAG Audit Summary (all presets)

See `WCAG_AUDIT.md` for the full table. Key findings:

| League | Bar text | Lead flash | Star pass SP | Roster# on bg | Notes |
|--------|----------|------------|--------------|---------------|-------|
| Denver | ⬜ white | ⬜ white | ⬜ white | ⬜ white | All pass ✅ |
| Faultline | ⬛ black | ⬛ black | ⬛ black | ⬜ white | Red flash ❌ on teal — JS picks black ✅ |
| GVRDA | ⬜ white | 🔴 red | ⬜ white | ⬜ white | Black bar — red flash chosen (5.25:1) ✅ |
| Hard Dark | ⬜ white | ⬜ white | ⬜ white | ⬛ black | bg=#b6b6b6 — JS must inject black roster# ✅ |
| Saskatoon | ⬛ black | ⬛ black | ⬛ black | ⬜ white | Red flash ❌ on red — JS picks black ✅ |
| West Sound | ⬜ white | ⬜ white | ⬜ white | ⬜ white | All pass ✅ (white 4.94:1 just above AA) |
| EoD Envy | ⬜ white | ⬜ white | ⬜ white | ⬛ black | Same as Hard Dark ✅ |
| EoD Encore | ⬜ white | ⬜ white | ⬜ white | ⬛ black | Same as Hard Dark ✅ |
