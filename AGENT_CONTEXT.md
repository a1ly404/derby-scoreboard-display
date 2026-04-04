# Derby Overlay — Agent Context

Everything a coding agent needs to continue work on the custom CRG broadcast overlay.

---

## 1. Project Overview

A custom broadcast overlay for the **CRG ScoreBoard** (open-source roller derby scoreboard software). The overlay lives inside the CRG install as a custom HTML view and connects to CRG's WebSocket API to receive live game data.

The overlay displays:
- Team score bar rows (team name, score, jam score, timeouts) with configurable team colours
- A clock box (period/jam clocks, lineup/timeout/intermission clocks)
- Lineup / jammer box showing the five on-track skaters per team
- Panels (roster, penalties, PPJ chart, lower third, upcoming) that animate in/out

---

## 2. Repository

- **GitHub:** `https://github.com/a1ly404/derby-scoreboard-display`
- **Branch:** `main`
- **Latest commit:** `023732e`

### Repo structure

```
crg-overlay/
  index.html      ← overlay page (loaded by CRG at /custom/derby-overlay/index.html)
  index.css       ← all styles (CSS custom properties drive team colours)
  index.js        ← URL param handling + WCAG contrast utilities
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
  -jar /Users/ally.beaumont/Documents/derby/scoreboard/lib/crg-scoreboard.jar \
  -p 8002
```

CRG web UI: `http://localhost:8002`

### File sync — repo → CRG install

The repo `crg-overlay/` directory must be kept in sync with:

```
/Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/
```

Sync command (run from repo root after editing source files):

```bash
cp crg-overlay/index.html  /Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/index.html
cp crg-overlay/index.css   /Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/index.css
cp crg-overlay/index.js    /Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/index.js
cp crg-overlay/admin/index.html /Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/admin/index.html
cp crg-overlay/admin/index.css  /Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/admin/index.css
cp crg-overlay/admin/index.js   /Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/admin/index.js
```

Or to edit in-place (quicker iteration):

```
/Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/
```

Then copy back to repo before committing.

### Overlay URL

```
http://localhost:8002/custom/derby-overlay/index.html
```

With team colours:

```
http://localhost:8002/custom/derby-overlay/index.html?home=%231f3264&away=%23ff2100
```

Admin panel:

```
http://localhost:8002/custom/derby-overlay/admin/index.html
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

---

## 4. Colour System

### URL params → CSS vars

`index.js` reads `?home=hex&away=hex` on load and:

1. Sets `--teamN-bar` CSS custom property on `:root` to the flat hex (overriding the default silver gradient)
2. Runs WCAG contrast check → sets `--teamN-text` to `#ffffff` or `#000000`
3. Calls `wcagCheckLeadFlash(teamNum, barColour)` to pick the best lead star flash colour
4. Optionally accepts `?homebg=hex&awaybg=hex` for the indicator/jammer bg (pushes to CRG state only — the CSS vars handle the main bar)

### CSS custom properties

Defined in `:root` in `index.css`:

```css
:root {
  --team1-bar:  linear-gradient(to bottom, #eee, #ddd 30%, #ccc 60%, #bbb);  /* stock silver */
  --team2-bar:  linear-gradient(to bottom, #bbb, #ccc 30%, #ddd 60%, #eee);  /* stock silver (flipped) */
  --team1-text: #000000;   /* black on silver default */
  --team2-text: #000000;
}
```

When URL params are given, JS overrides these with a flat hex string.

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

## 6. Admin Panel (`admin/index.js`)

### League presets

```js
var leaguePresets = {
  Denver:    { name: 'Denver',     fg: '#1f3264', bg: '#000000' },
  Faultline: { name: 'Faultline',  fg: '#0096bc', bg: '#000000' },
  GVRDA:     { name: 'GVRDA',      fg: '#000000', bg: '#ffffff' },
  HardDark:  { name: 'Hard Dark',  fg: '#12325e', bg: '#b6b6b6' },
  Saskatoon: { name: 'Saskatoon',  fg: '#ff2100', bg: '#000000' },
  WestSound: { name: 'West Sound', fg: '#bf4c0d', bg: '#6a306d' },
  EoDEnvy:   { name: 'EoD Envy',   fg: '#12325e', bg: '#b6b6b6' },
  EoDEncore: { name: 'EoD Encore', fg: '#12325e', bg: '#b6b6b6' },
};
```

`applyLeaguePreset(team, leagueKey)` — pushes `fg`/`bg` to CRG state via `WS.Set`, updates swatches, and calls `pushBarColourToPreview()`.

`applyCustomColour(team, fgHex)` — same as above but for freeform hex input.

`pushBarColourToPreview(team, fgHex)` — sets `--teamN-bar` on the preview `<iframe>`'s root element for instant visual feedback.

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
Default `@keyframes HasLead` flashes white. WCAG check in JS can override per-team with a `<style>` block using a unique `@keyframes HasLead_TN` animation.

### Roster numbers
`.RosterTeam .Team .Skater .Number { color: white !important; }` as default. WCAG check injects black override if needed.

---

## 9. File Locations (absolute)

| File | Path |
|------|------|
| Overlay HTML | `/Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/index.html` |
| Overlay CSS | `/Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/index.css` |
| Overlay JS | `/Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/index.js` |
| Admin HTML | `/Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/admin/index.html` |
| Admin CSS | `/Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/admin/index.css` |
| Admin JS | `/Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/admin/index.js` |
| Repo copy | `/Users/ally.beaumont/Documents/derby/derby-scoreboard-display/crg-overlay/` |
| CRG jar | `/Users/ally.beaumont/Documents/derby/scoreboard/lib/crg-scoreboard.jar` |

---

## 10. Current State (as of commit `023732e`)

- ✅ Team bar rows show team colour (flat hex via `--teamN-bar` CSS var), default to stock silver gradient
- ✅ Bar text (name, score) auto white/black via WCAG 4.5:1 check
- ✅ Indicator square matches team bar (CSS vars with `!important`)
- ✅ JammerBox / lineup box matches team bar
- ✅ Lineup skater text at `font-size: 100%` (readable)
- ✅ Clock box always silver — not team-coloured
- ✅ Clock text is black (`#000000`) on the silver clock bar
- ✅ Roster number text always white, WCAG-flipped to black if needed
- ✅ Lead flash star WCAG-checked per team colour
- ✅ Admin panel: league preset dropdowns + custom hex inputs + live preview iframe
- ✅ `seed_game.py` removed

---

## 11. How to Make Further Changes

1. Edit source files in `/Users/ally.beaumont/Documents/derby/scoreboard/html/custom/derby-overlay/`
2. Test by loading the overlay URL in a browser (hard-refresh after CSS changes: Cmd+Shift+R)
3. Copy changed files back to `/Users/ally.beaumont/Documents/derby/derby-scoreboard-display/crg-overlay/`
4. Commit and push

```bash
cd /Users/ally.beaumont/Documents/derby/derby-scoreboard-display
git add crg-overlay/
git commit -m "your message"
git push origin main
```
