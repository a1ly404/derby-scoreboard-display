# derby-scoreboard-display

Custom broadcast overlays for [CRG ScoreBoard](https://github.com/rollerderby/scoreboard) and a standalone live polling display for the [`derby-scoreboard-api`](https://github.com/a1ly404/derby-scoreboard-api).

---

## Repository structure

```
derby-scoreboard-display/
├── custom-overlays/               ← Git submodules — one folder per overlay
│   └── eod-custom-overlay/        ← github.com/a1ly404/eod-custom-overlay (submodule)
├── tests/                         ← Playwright test harness (mock WS server, fixtures)
│   ├── eod-custom-overlay/        ← Spec files for the EoD custom overlay
│   ├── state/                     ← JSON state fixtures (29 game-state snapshots)
│   ├── screenshots/               ← Baseline screenshot PNGs
│   ├── fixtures.ts                ← Shared Playwright fixtures & helpers
│   ├── mock-crg-server.ts         ← Mock CRG WebSocket + HTTP server
│   ├── playwright.config.ts
│   └── package.json
├── .github/workflows/
│   ├── overlay-tests.yml          ← CI: run overlay tests on push/PR to main
│   └── commentator-tests.yml      ← Manual dispatch: test commentator branch overlay
├── index.html                     ← Standalone polling display (for derby-scoreboard-api)
├── seed_game.py                   ← Seed a CRG game with test data
└── README.md
```

---

## Custom overlays

Overlays live under `custom-overlays/` as **git submodules**. Each overlay is its own repo with its own release cycle and auto-updater. This makes it easy to:

- Add new overlays without cluttering the main repo
- Drag-and-drop any overlay folder into CRG's `html/custom/` directory
- Test overlays in isolation or together

### EoD Custom Overlay

The primary broadcast overlay. Full documentation lives in the submodule's own README.

```bash
# The submodule is pulled automatically on clone:
git clone --recurse-submodules https://github.com/a1ly404/derby-scoreboard-display.git

# Or if you already cloned without submodules:
git submodule update --init --recursive
```

**Install into CRG:** Copy (or symlink) the overlay folder into your CRG installation:

```bash
cp -r custom-overlays/eod-custom-overlay /path/to/scoreboard/html/custom/eod-custom-overlay
```

Then open: `http://<CRG-IP>:8000/custom/eod-custom-overlay/index.html`

### Switching branches (main vs commentator)

The `eod-custom-overlay` repo has multiple branches for different overlay variants:

| Branch | Overlay | Purpose |
|--------|---------|---------|
| `main` | EoD Custom Overlay | Standard team-bar broadcast overlay with scores, clocks, jammers |
| `eod-commentator-overlay` | EoD Commentator Overlay | Full-screen roster display for booth commentary |

To switch the submodule to a different branch:

```bash
cd custom-overlays/eod-custom-overlay
git fetch origin
git checkout eod-commentator-overlay   # or: git checkout main
cd ../..
```

> **Note:** The two branches have intentionally different `index.html`, `index.css`, and `index.js` files. They are not meant to be merged — they represent separate overlay applications that share the same repo and auto-update infrastructure.

### Adding a new custom overlay

To add another overlay as a submodule:

```bash
git submodule add https://github.com/<user>/<overlay-repo>.git custom-overlays/<overlay-name>
```

Then copy the folder into CRG's `html/custom/` directory as above.

---

## Standalone polling display

`index.html` in the repo root is a zero-build-step live display that polls the [`derby-scoreboard-api`](https://github.com/a1ly404/derby-scoreboard-api) HTTP endpoint.

1. Start the API:
   ```bash
   cd ../derby-scoreboard-api
   python main.py
   ```

2. Open `index.html` in any browser.

3. Set the **API Base URL** (default `http://localhost:5001`) and click **Connect**.

---

## Testing

The `tests/` directory contains a Playwright test harness that verifies overlay behaviour without needing a running CRG scoreboard. It uses a **mock CRG WebSocket server** (`mock-crg-server.ts`) that implements the CRG state protocol.

### Prerequisites

- Node.js 22+
- The CRG ScoreBoard `html/` directory (for jQuery, `core.js`, `WS.js`)

### Running tests locally

```bash
cd tests
npm ci
npx playwright install --with-deps chromium

# Point at your local CRG html/ and the overlay under test:
CRG_HTML_DIR=../../scoreboard/html \
EOD_CUSTOM_DIR=../custom-overlays/eod-custom-overlay \
npx playwright test
```

If `CRG_HTML_DIR` / `EOD_CUSTOM_DIR` are not set, the test harness falls back to:

| Variable | Default fallback |
|----------|-----------------|
| `CRG_HTML_DIR` | `../../scoreboard/html` |
| `EOD_CUSTOM_DIR` | `../custom-overlays/eod-custom-overlay` |

### Test coverage

| Spec file | What it tests |
|-----------|---------------|
| `clock-description.spec.ts` | Clock phase text & colours (Jam, Lineup, Timeout, etc.) |
| `edge-cases.spec.ts` | Flash fallback, rapid state transitions, penalty box, official review |
| `lead-flash.spec.ts` | Lead-jammer ★ flash animation, star pass, calloff |
| `league-presets.spec.ts` | WCAG AA 4.5:1 contrast for 11 real-world league colour presets |
| `lineup-flash.spec.ts` | Jammer box slide-in, lineup lead flash, star pass swap |
| `lineups.spec.ts` | ShowJammers / ShowLineups toggles, jammer numbers & names |
| `security.spec.ts` | XSS prevention, CSS injection, prototype pollution, input flooding |
| `team-colours.spec.ts` | CSS custom properties, text contrast, team names, scores, timeouts |
| `wcag-contrast.spec.ts` | WCAG AA contrast checks across multiple colour combinations |

### CI

Tests run automatically via GitHub Actions on every push and PR to `main`. The workflow:

1. Checks out this repo with submodules
2. Checks out `rollerderby/scoreboard` for the CRG HTML files
3. Runs the full Playwright suite
4. Uploads screenshots, test reports, and videos as artifacts

See `.github/workflows/overlay-tests.yml`.

To test the commentator overlay branch, use the manual dispatch workflow at `.github/workflows/commentator-tests.yml`.

---

## Related repos

| Repo | Purpose |
|------|---------|
| [`eod-custom-overlay`](https://github.com/a1ly404/eod-custom-overlay) | The overlay source (submodule in this repo) |
| [`derby-scoreboard-api`](https://github.com/a1ly404/derby-scoreboard-api) | Python CRG WebSocket → HTTP proxy |
| [`derby-stat-tracker`](https://github.com/a1ly404/derby-stat-tracker) | Monorepo: stat tracker web app, live tracker, live bridge service |
| [`scoreboard`](https://github.com/rollerderby/scoreboard) | CRG ScoreBoard (upstream) |