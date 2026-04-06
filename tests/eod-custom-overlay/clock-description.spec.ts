/**
 * Clock Description — tests for ovlToClockType() in eod-custom-overlay/index.js.
 *
 * ovlToClockType() is bound via sbDisplay to the .ClockDescription element.
 * It sets both the element's text content and its inline backgroundColor
 * based on which game-clock phase is currently active.
 *
 * Covered scenarios (one describe block per clock phase):
 *
 *   1. Default / Coming Up  — no clock running
 *   2. Jam phase            — InJam = true
 *   3. Lineup phase         — Clock(Lineup).Running = true
 *   4. Timeout phases       — Clock(Timeout).Running = true
 *                              a) TimeoutOwner = "O"           → "Official Timeout"
 *                              b) TimeoutOwner = "1", OR=false → "Team Timeout"
 *                              c) TimeoutOwner = "1", OR=true  → "Official Review"
 *   5. Intermission phases  — Clock(Intermission).Running = true
 *                              a) Number = 0                   → "Pre-Game"
 *                              b) Number < Rule(Period.Number) → "Halftime"
 *                              c) Number = Rule(Period.Number), OfficialScore=false → "Unofficial Score"
 *                              d) OfficialScore = true         → "Final Score"
 *
 * Background colours set by ovlToClockType():
 *   Jam / Lineup    : #444     → rgb(68, 68, 68)
 *   Timeout         : #c0392b  → rgb(192, 57, 43)
 *   Intermission /
 *   Coming Up       : #1a4a8a  → rgb(26, 74, 138)
 */
import { test, expect, loadState, screenshotOverlayBar } from '../fixtures';

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Return the trimmed text content of .ClockDescription,
 * or 'NOT_FOUND' if the element is absent.
 */
async function getClockDescriptionText(page: any): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('.ClockDescription') as HTMLElement | null;
    if (!el) return 'NOT_FOUND';
    return el.textContent?.trim() ?? '';
  });
}

/**
 * Return the computed backgroundColor of .ClockDescription as an rgb() string.
 * jQuery sets this as an inline style; getComputedStyle reflects the final value.
 */
async function getClockDescriptionBg(page: any): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('.ClockDescription') as HTMLElement | null;
    if (!el) return 'NOT_FOUND';
    return window.getComputedStyle(el).backgroundColor;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('Default / Coming Up', () => {
  test('shows "Coming Up" when no clock phase is active', async ({ overlayPage }) => {
    // The initial state has InJam=false and all relevant clocks stopped —
    // ovlToClockType falls through to the else branch.
    const text = await getClockDescriptionText(overlayPage);
    expect(text).toBe('Coming Up');

    const bg = await getClockDescriptionBg(overlayPage);
    expect(bg).toBe('rgb(26, 74, 138)');

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/clock-desc-coming-up.png');
  });
});

// ── Jam phase ─────────────────────────────────────────────────────────────

test.describe('Jam phase', () => {
  test('shows "Jam" when InJam is true', async ({ overlayPage, pushState }) => {
    // team1-lead: InJam=true, Clock(Jam).Running=true, Team(1).Lead=true
    await pushState(loadState('team1-lead'));

    const text = await getClockDescriptionText(overlayPage);
    expect(text).toBe('Jam');

    const bg = await getClockDescriptionBg(overlayPage);
    expect(bg).toBe('rgb(68, 68, 68)');

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/clock-desc-jam.png');
  });
});

// ── Lineup phase ──────────────────────────────────────────────────────────

test.describe('Lineup phase', () => {
  test('shows "Lineup" when Clock(Lineup).Running is true', async ({ overlayPage, pushState }) => {
    // jam-end: InJam=false, Clock(Lineup).Running=true — ovlToClockType
    // returns WS.state["ScoreBoard.CurrentGame.Clock(Lineup).Name"] = "Lineup"
    await pushState(loadState('jam-end'));

    const text = await getClockDescriptionText(overlayPage);
    expect(text).toBe('Lineup');

    const bg = await getClockDescriptionBg(overlayPage);
    expect(bg).toBe('rgb(68, 68, 68)');

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/clock-desc-lineup.png');
  });
});

// ── Timeout phases ────────────────────────────────────────────────────────

test.describe('Timeout phases', () => {
  test('shows "Official Timeout" when TimeoutOwner is "O"', async ({ overlayPage, pushState }) => {
    // official-timeout: Clock(Timeout).Running=true, TimeoutOwner="O"
    await pushState(loadState('official-timeout'));

    const text = await getClockDescriptionText(overlayPage);
    expect(text).toBe('Official Timeout');

    // Timeout branch uses red background (#c0392b)
    const bg = await getClockDescriptionBg(overlayPage);
    expect(bg).toBe('rgb(192, 57, 43)');

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/clock-desc-official-timeout.png');
  });

  test('shows "Team Timeout" when TimeoutOwner is "1" and OfficialReview is false', async ({ overlayPage, pushState }) => {
    // team1-timeout: Clock(Timeout).Running=true, TimeoutOwner="1", OfficialReview not set (false)
    await pushState(loadState('team1-timeout'));

    const text = await getClockDescriptionText(overlayPage);
    expect(text).toBe('Team Timeout');

    const bg = await getClockDescriptionBg(overlayPage);
    expect(bg).toBe('rgb(192, 57, 43)');

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/clock-desc-team-timeout.png');
  });

  test('shows "Official Review" when TimeoutOwner is "1" and OfficialReview is true', async ({ overlayPage, pushState }) => {
    // team1-official-review: Clock(Timeout).Running=true, TimeoutOwner="1", OfficialReview=true
    await pushState(loadState('team1-official-review'));

    const text = await getClockDescriptionText(overlayPage);
    expect(text).toBe('Official Review');

    const bg = await getClockDescriptionBg(overlayPage);
    expect(bg).toBe('rgb(192, 57, 43)');

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/clock-desc-official-review.png');
  });
});

// ── Intermission phases ───────────────────────────────────────────────────

test.describe('Intermission phases', () => {
  // All intermission tests share the same background colour (#1a4a8a).
  // The text is driven by Clock(Intermission).Number vs Rule(Period.Number)
  // and the OfficialScore flag. Rule(Period.Number) = 2 from initial.json.

  test('shows "Pre-Game" when Clock(Intermission).Number is 0', async ({ overlayPage, pushState }) => {
    // intermission-pregame: Clock(Intermission).Running=true, Number=0
    // ovlToClockType: num==0 → Setting(ScoreBoard.Intermission.PreGame) = "Pre-Game"
    await pushState(loadState('intermission-pregame'));

    const text = await getClockDescriptionText(overlayPage);
    expect(text).toBe('Pre-Game');

    const bg = await getClockDescriptionBg(overlayPage);
    expect(bg).toBe('rgb(26, 74, 138)');

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/clock-desc-intermission-pregame.png');
  });

  test('shows "Halftime" when Clock(Intermission).Number is less than Rule(Period.Number)', async ({ overlayPage, pushState }) => {
    // intermission-halftime: Clock(Intermission).Running=true, Number=1
    // Rule(Period.Number) = 2 (from initial.json) → num(1) != max(2)
    // → Setting(ScoreBoard.Intermission.Intermission) = "Halftime"
    await pushState(loadState('intermission-halftime'));

    const text = await getClockDescriptionText(overlayPage);
    expect(text).toBe('Halftime');

    const bg = await getClockDescriptionBg(overlayPage);
    expect(bg).toBe('rgb(26, 74, 138)');

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/clock-desc-intermission-halftime.png');
  });

  test('shows "Unofficial Score" when Number equals Rule(Period.Number) and OfficialScore is false', async ({ overlayPage, pushState }) => {
    // intermission-unofficial: Clock(Intermission).Running=true, Number=2, OfficialScore=false
    // Rule(Period.Number) = 2 → num(2) == max(2), not isOfficial
    // → else branch → Setting(ScoreBoard.Intermission.Unofficial) = "Unofficial Score"
    await pushState(loadState('intermission-unofficial'));

    const text = await getClockDescriptionText(overlayPage);
    expect(text).toBe('Unofficial Score');

    const bg = await getClockDescriptionBg(overlayPage);
    expect(bg).toBe('rgb(26, 74, 138)');

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/clock-desc-intermission-unofficial.png');
  });

  test('shows "Final Score" when OfficialScore is true', async ({ overlayPage, pushState }) => {
    // intermission-official: Clock(Intermission).Running=true, Number=2, OfficialScore=true
    // isOfficial=true, ClockDuringFinalScore=false (from initial)
    // → Setting(ScoreBoard.Intermission.Official) = "Final Score"
    await pushState(loadState('intermission-official'));

    const text = await getClockDescriptionText(overlayPage);
    expect(text).toBe('Final Score');

    const bg = await getClockDescriptionBg(overlayPage);
    expect(bg).toBe('rgb(26, 74, 138)');

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/clock-desc-intermission-official.png');
  });
});
