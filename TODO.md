# TODO — derby-scoreboard-display

> Tracking file for open work on the EoD custom overlay and Playwright test harness.
> Updated after full context review of `eod-custom-overlay/`, `tests/`, the API repo,
> and PR [#1 (Playwright test harness)](https://github.com/a1ly404/derby-scoreboard-display/pull/1).

---

## 🔴 P0 — Lead Jammer Flash Is Broken (fades to nothing)

**✅ FIXED**

The CSS fallback `@keyframes HasLead` faded text to `color: transparent` at 50%,
making the jammer number/name disappear to nothing instead of blending into the
team bar colour.

### What was done

- **`index.css`** — replaced the single generic `@keyframes HasLead` and its
  catch-all selector with two per-team keyframes (`HasLead_T1`, `HasLead_T2`) that
  read CSS custom properties:
  - `--teamN-flash-peak` (default `#ffffff`) — the high-contrast colour at 0%/100%
  - `--teamN-flash-trough` (default `transparent`) — blends into bar at 50%
  - Per-team selectors: `.TeamBox.InJam [Team="N"].Lead .JammerBox .Jamming`

- **`index.js`** — simplified `wcagCheckLeadFlash(teamNum, barColour)` to set CSS
  variables via `document.documentElement.style.setProperty()` instead of injecting
  `<style>` tags. Also added a `WS.AfterLoad()` safety call that reads initial WS
  state colours and applies them even before WS.Register delta events fire.

- **Verified** against all 8 league colour presets via `league-presets.spec.ts` —
  each preset's trough is now set to the bar colour (not `transparent`), and the
  peak passes WCAG AA 4.5:1.

---

## 🟡 P1 — Screenshots of Lead Flash With Different Team Colours

**✅ ADDRESSED**

Screenshots are now captured automatically by Playwright tests for all colour
combinations. Both T1 and T2 lead states are covered.

### What was done

- **New state files created:**
  - `tests/state/team2-lost.json`
  - `tests/state/team2-calloff.json`
  - `tests/state/colours-denver.json`
  - `tests/state/colours-faultline.json` (teal — black flash)
  - `tests/state/colours-gvrda.json` (black bar — red flash)
  - `tests/state/colours-saskatoon.json` (red bar — black flash)
  - `tests/state/colours-west-sound.json` (burnt orange — borderline white)
  - `tests/state/colours-hard-dark.json` (navy + grey swatch)

- **`league-presets.spec.ts`** — new spec captures screenshots for all 11 presets
  (8 league + 5 existing WCAG combos), both T1 and T2 lead states.

- **`edge-cases.spec.ts`** — captures screenshots for penalty box, official review,
  lineup mode, and all transition states.

### Still to do manually

- [ ] Take actual broadcast screenshots at a live event to compare with Playwright
      captures and confirm visual correctness at 1080p60.
- [ ] Add `toHaveScreenshot()` visual regression baselines once a "known good" state
      is established (run `npx playwright test --update-snapshots` after verifying
      screenshots are correct).

---

## 🔴 P0 — Tests Are False Positives (should fail but pass)

**✅ FIXED**

### Gap 1: `animationName` check ✅
Changed `expect(anim).toMatch(/HasLead/)` → `expect(anim).toMatch(/^HasLead_T1$/)` /
`/^HasLead_T2$/` — pins to the exact per-team keyframe name. Also added
`animationPlayState === 'running'` assertion to confirm the animation is actually
running, not just named.

### Gap 2: WCAG test reads injected `<style>` tag ✅
The `<style>` injection mechanism was removed entirely. WCAG tests now read
`--teamN-flash-peak` and `--teamN-flash-trough` CSS variables directly, which is
more reliable and cannot produce false positives from unmatched selectors.

### Gap 3: "flash stops after jam ends" ✅
After `jam-end`, `lead-flash.spec.ts` now re-reads `animationName` and asserts
it does NOT match `/HasLead/`, confirming the animation actually stopped.

### Gap 4: No visual regression ⚠️ Partial
Screenshots are captured in many tests but still not compared against baselines
with `toHaveScreenshot()`. See "Still to do" under Screenshots above.

### Gap 5: Conditional `if (peakMatch)` ✅
Removed from `wcag-contrast.spec.ts` — the CSS variable approach doesn't need a
regex at all, so the silent-skip risk is gone.

---

## 🟡 P1 — Missing Test Coverage

**✅ FULLY ADDRESSED**

### Tests added

- [x] **Team 2 lost lead** — `lead-flash.spec.ts` (`Team 2 lost lead clears indicator`)
- [x] **Team 2 calloff** — `lead-flash.spec.ts` (`Team 2 calloff keeps lead indicator showing ★`)
- [x] **Rapid state transitions** — `edge-cases.spec.ts` (lead→calloff→jam-end, T1→T2 lead transfer)
- [x] **No-colour-params flash** — `edge-cases.spec.ts` (`Flash Fallback — no explicit colours`)
- [x] **Penalty box in lineup mode** — `edge-cases.spec.ts` (`Penalty Box — Lineup Mode`)
- [x] **Official review state** — `edge-cases.spec.ts` (`Official Review` describe block)
- [x] **Lead flash × all 8 league presets** — `league-presets.spec.ts`
      (also adds regression tests that trough is never `transparent` when colours are set)

### Still to do

- [x] **Intermission / halftime / final score** — `clock-description.spec.ts` covers
      all 10 `ovlToClockType()` return values: Jam, Lineup, Official Timeout, Team Timeout,
      Official Review, Pre-Game, Halftime, Unofficial Score, Final Score, Coming Up.
      Asserts both `.ClockDescription` text and `backgroundColor`.
- [x] **CSS variable rename guard** — `expect(varValue).not.toBe('')` guards added to
      `lineup-flash.spec.ts` Same-Colour Conflict block (`--team1-bar`, `--team2-bar`,
      `--team2-flash-trough`). All other CSS var reads in existing specs already had guards.

### Copilot review items from PR #1

- [x] Mock server throws on missing directories (implemented in `39b6c31`)
- [x] `pushState` DOM settlement — rAF + `setTimeout(0)` (implemented in `39b6c31`)
- [x] CI workflow — removed external `eod-custom-overlay` checkout; `EOD_CUSTOM_DIR`
      now points to `derby-scoreboard-display/eod-custom-overlay` in the current repo
- [x] `ws` message handler — fixed to handle `ws.RawData` union (`Buffer | ArrayBuffer | Buffer[]`)
- [x] `screenshotOverlayBar()` clip width — now accounts for `x` offset:
      `width = Math.min(box.width + margin*2, vw - x)`, uses `page.viewportSize()`
- [x] `dist/` added to `tests/.gitignore`

---

## 🟢 P2 — API Repo Gaps (from CLIENT_FIELD_CROSSWALK.md)

**✅ IMPLEMENTED**

- [x] **Timeout ownership** — `timeout_owner: Optional[str]` in `LiveState`
      (`"1"`, `"2"`, `"O"`, or `None`). Mapped from `TimeoutOwner` CRG key,
      normalised: empty string → `None`.
- [x] **Timeout/review counters** — three new fields on `TeamState`:
      `timeouts_remaining: int`, `official_reviews_remaining: int`,
      `retained_official_review: bool`. Mapped from `Timeouts`, `OfficialReviews`,
      `RetainedOfficialReview` CRG keys.
- [x] **Post-timeout → jam-start phase** — `in_lineup: bool` in `LiveState`,
      driven by `Clock(Lineup).Running`.
- [x] **15 new tests** in `test_client.py` and `test_api.py` covering all new fields,
      default values, update propagation, and `None` normalisation. All 85 tests pass.

---

## 🟢 P2 — Overlay Polish

- [x] `seed_game.py` — `--host` / `--port` CLI args implemented via `argparse`;
      `HOST`, `PORT`, `URI` now read from parsed args instead of being hardcoded constants.
- [x] `tests/package.json` — `test:screenshots` script added
      (`npx playwright test --grep screenshots`).
- [x] `TEAM_NAME_MAX` doubled from 14 → 28: already on `main` via commit `36089ae` ✅
- [ ] Panel `<h1>` headers, PPJ chart bars, lower third `<h5>`, penalty badge colours
      use CRG-injected inline styles — need manual WCAG testing (out of scope for
      automated tests; see WCAG_AUDIT.md §Elements NOT Covered).
- [ ] WCAG 1.4.4 (text resize / zoom) noted as needing test in the audit.
- [ ] Admin preview iframe WCAG regression test (BUG-002 from WCAG_AUDIT.md —
      marked fixed but no automated regression test exists).

---

## 🟢 P2 — Test Infrastructure

- [x] Parameterised lead flash tests across all 8 league colour presets
      (`league-presets.spec.ts`).
- [x] League preset state files created (Denver, Faultline, GVRDA, Hard Dark,
      Saskatoon, West Sound — EoD Envy/Encore share the Hard Dark preset file).
- [x] `test:screenshots` npm script added to `package.json`.
- [ ] Add `toHaveScreenshot()` baseline comparisons (requires first running with
      `--update-snapshots` to generate reference images, then committing them).
- [x] Parallel workers enabled — `fullyParallel: true`, `workers: undefined` in
      `playwright.config.ts`. Suite runtime: 3.2 min → 31 s. Each test creates its
      own MockCRGServer on port 0 so parallelism is safe.
- [x] Intermission state files created: `intermission-pregame.json`,
      `intermission-halftime.json`, `intermission-unofficial.json`,
      `intermission-official.json`.

---

## Reference: Current Branch State

| Repo | Branch | HEAD | Notes |
|------|--------|------|-------|
| `derby-scoreboard-display` | `main` | `12a2607` | PR #1 squash-merged; `tests/orchestrator` branch deleted |
| `derby-scoreboard-api` | `main` | `4158949` | Python 3.9 compat fix for `proxy.py` Union annotation; 92 tests passing |