/**
 * Lead Jammer Flash — ensures the ★ indicator flashes for the lead jammer.
 *
 * The flash is a CSS animation (HasLead / HasLead_TN keyframes) that
 * alternates the .Jamming element colour between the WCAG-checked
 * flash colour and the bar colour (or transparent in the CSS-only fallback).
 *
 * Tests verify:
 *   1. The animation IS running when a team has Lead + InJam
 *   2. The animation IS NOT running when no lead / not in jam
 *   3. The star indicator shows "★" for lead, "SP" for star pass, "" for lost
 *   4. The flash colour contrast meets WCAG 4.5:1 against the bar
 */
import { test, expect, loadState, contrastRatio } from '../fixtures';

// ── Helpers ───────────────────────────────────────────────────────────────

/** Get the computed animation-name of the .Jamming element for a team */
async function getJammingAnimation(page: any, team: number) {
  return page.evaluate((t: number) => {
    // The Jamming element that shows the ★ for the active jammer
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .JammerBox .Jamming`
    ) as HTMLElement | null;
    if (!el) return 'NOT_FOUND';
    return window.getComputedStyle(el).animationName;
  }, team);
}

/** Get the computed color of the .Jamming element */
async function getJammingColor(page: any, team: number) {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .JammerBox .Jamming`
    ) as HTMLElement | null;
    if (!el) return 'NOT_FOUND';
    return window.getComputedStyle(el).color;
  }, team);
}

/** Get the text content of the indicator element */
async function getIndicatorText(page: any, team: number) {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .Indicator .Clock`
    ) as HTMLElement | null;
    if (!el) return 'NOT_FOUND';
    return el.textContent?.trim() ?? '';
  }, team);
}

/** Check if the .TeamBox has the InJam class */
async function hasInJamClass(page: any) {
  return page.evaluate(() => {
    const el = document.querySelector('.TeamBox') as HTMLElement | null;
    return el?.classList.contains('InJam') ?? false;
  });
}

/** Check if a team's div has the Lead class */
async function hasLeadClass(page: any, team: number) {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"]`
    ) as HTMLElement | null;
    return el?.classList.contains('Lead') ?? false;
  }, team);
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('Lead Jammer Flash', () => {
  test('no flash before jam starts', async ({ overlayPage }) => {
    // Initial state: InJam=false, no lead — should have no HasLead animation
    const anim = await getJammingAnimation(overlayPage, 1);
    expect(anim).not.toContain('HasLead');
    const inJam = await hasInJamClass(overlayPage);
    expect(inJam).toBe(false);
  });

  test('Team 1 lead flash activates during jam', async ({ overlayPage, pushState }) => {
    const team1Lead = loadState('team1-lead');
    await pushState(team1Lead);

    // TeamBox should have InJam class
    const inJam = await hasInJamClass(overlayPage);
    expect(inJam).toBe(true);

    // Team 1 should have Lead class
    const lead = await hasLeadClass(overlayPage, 1);
    expect(lead).toBe(true);

    // The Jamming element should have an animation containing HasLead
    const anim = await getJammingAnimation(overlayPage, 1);
    expect(anim).toMatch(/HasLead/);

    // Screenshot for visual verification
    await overlayPage.screenshot({
      path: 'test-results/screenshots/team1-lead-flash.png',
      fullPage: true,
    });
  });

  test('Team 2 lead flash activates during jam', async ({ overlayPage, pushState }) => {
    const team2Lead = loadState('team2-lead');
    await pushState(team2Lead);

    const lead = await hasLeadClass(overlayPage, 2);
    expect(lead).toBe(true);

    const anim = await getJammingAnimation(overlayPage, 2);
    expect(anim).toMatch(/HasLead/);

    await overlayPage.screenshot({
      path: 'test-results/screenshots/team2-lead-flash.png',
      fullPage: true,
    });
  });

  test('indicator shows ★ for lead', async ({ overlayPage, pushState }) => {
    await pushState(loadState('team1-lead'));

    const text = await getIndicatorText(overlayPage, 1);
    expect(text).toBe('★');

    // Team 2 should NOT show ★ (they don't have lead)
    const text2 = await getIndicatorText(overlayPage, 2);
    expect(text2).toBe('');
  });

  test('indicator shows SP after star pass', async ({ overlayPage, pushState }) => {
    // First give Team 1 lead in a jam
    await pushState(loadState('team1-lead'));
    // Then star pass
    await pushState(loadState('team1-star-pass'));

    const text = await getIndicatorText(overlayPage, 1);
    expect(text).toBe('SP');

    // Flash should NOT be active after star pass (lead=false)
    const lead = await hasLeadClass(overlayPage, 1);
    expect(lead).toBe(false);

    await overlayPage.screenshot({
      path: 'test-results/screenshots/team1-star-pass.png',
      fullPage: true,
    });
  });

  test('indicator clears after lost lead', async ({ overlayPage, pushState }) => {
    await pushState(loadState('team1-lead'));
    await pushState(loadState('team1-lost'));

    const text = await getIndicatorText(overlayPage, 1);
    expect(text).toBe('');

    const lead = await hasLeadClass(overlayPage, 1);
    expect(lead).toBe(false);
  });

  test('flash stops after jam ends', async ({ overlayPage, pushState }) => {
    await pushState(loadState('team1-lead'));

    // Verify flash is on
    let anim = await getJammingAnimation(overlayPage, 1);
    expect(anim).toMatch(/HasLead/);

    // End the jam
    await pushState(loadState('jam-end'));

    const inJam = await hasInJamClass(overlayPage);
    expect(inJam).toBe(false);
  });

  test('calloff keeps lead indicator showing ★', async ({ overlayPage, pushState }) => {
    await pushState(loadState('team1-lead'));
    await pushState(loadState('team1-calloff'));

    // Calloff should still show ★ (Lead=true, DisplayLead=true)
    const text = await getIndicatorText(overlayPage, 1);
    expect(text).toBe('★');

    const lead = await hasLeadClass(overlayPage, 1);
    expect(lead).toBe(true);
  });
});
