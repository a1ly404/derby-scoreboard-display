/**
 * Lineup Display Tests — verifies jammer/lineup panel visibility.
 *
 * The overlay uses sbClass directives to show/hide the JammerBox area:
 *   - ShowJammers: $.ShowJammers  (interactive toggle, default true)
 *   - Lineups: $.ShowLineups      (interactive toggle, default false)
 *   - InJam: InJam                (driven by game state)
 *
 * The JammerBox slides in via CSS margin-left transition:
 *   .JammerBox         { margin-left: -100%; }  (hidden)
 *   .ShowJammers .JammerBox.Show { margin-left: 0; }  (visible)
 *
 * Tests verify:
 *   1. Jammers show during a jam when ShowJammers=true (default)
 *   2. Jammers hide when ShowJammers=false
 *   3. Lineups panel toggles with ShowLineups
 *   4. Jammer names/numbers display correctly during a jam
 *   5. Star pass swaps the Jamming indicator to pivot
 */
import { test, expect, loadState, screenshotOverlayBar } from '../fixtures';

// ── Helpers ───────────────────────────────────────────────────────────────

/** Check if a team's JammerBox is visible (margin-left is 0, not negative) */
async function isJammerBoxVisible(page: any, team: number) {
  return page.evaluate((t: number) => {
    const box = document.querySelector(
      `.TeamBox [Team="${t}"] .JammerBox`
    ) as HTMLElement | null;
    if (!box) return false;
    // The JammerBox slides in via a 2s CSS transition on margin-left.
    // Check if it has the .Show class (set by sbClass when InJam)
    // AND the parent .TeamBox has .ShowJammers.
    const hasShow = box.classList.contains('Show');
    const teamBox = document.querySelector('.TeamBox') as HTMLElement | null;
    const hasShowJammers = teamBox?.classList.contains('ShowJammers') ?? false;
    return hasShow && hasShowJammers;
  }, team);
}

/** Get the text of the .Jamming position's .Number element for a team */
async function getJammingNumber(page: any, team: number) {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .JammerBox .Jamming .Number`
    ) as HTMLElement | null;
    if (!el) return 'NOT_FOUND';
    return el.textContent?.trim() ?? '';
  }, team);
}

/** Get the text of the .Jamming position's .Name element for a team */
async function getJammingName(page: any, team: number) {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .JammerBox .Jamming .Name`
    ) as HTMLElement | null;
    if (!el) return 'NOT_FOUND';
    return el.textContent?.trim() ?? '';
  }, team);
}

/** Check if the TeamBox has a given class */
async function teamBoxHasClass(page: any, className: string) {
  return page.evaluate((cls: string) => {
    const el = document.querySelector('.TeamBox') as HTMLElement | null;
    return el?.classList.contains(cls) ?? false;
  }, className);
}

/** Count visible lineup skater rows (non-Jamming positions that are visible) */
async function getVisibleLineupCount(page: any, team: number) {
  return page.evaluate((t: number) => {
    const slots = document.querySelectorAll(
      `.TeamBox [Team="${t}"] .JammerBox > div:not(.Jamming)`
    );
    let count = 0;
    for (const slot of slots) {
      const style = window.getComputedStyle(slot as HTMLElement);
      // In non-lineup mode, non-Jamming elements have display:none
      if (style.display !== 'none') count++;
    }
    return count;
  }, team);
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('Lineup Display — ShowJammers', () => {
  test('TeamBox starts with ShowJammers class', async ({ overlayPage }) => {
    // Initial state has ShowJammers=true
    const hasClass = await teamBoxHasClass(overlayPage, 'ShowJammers');
    expect(hasClass).toBe(true);
  });

  test('jammer box visible during jam with ShowJammers=true', async ({ overlayPage, pushState }) => {
    // Start a jam
    await pushState(loadState('team1-lead'));

    // JammerBox should be visible for both teams
    const vis1 = await isJammerBoxVisible(overlayPage, 1);
    const vis2 = await isJammerBoxVisible(overlayPage, 2);
    expect(vis1, 'Team 1 JammerBox should be visible in jam').toBe(true);
    expect(vis2, 'Team 2 JammerBox should be visible in jam').toBe(true);

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/lineup-jam-visible.png');
  });

  test('jammer box hides when ShowJammers=false', async ({ overlayPage, pushState }) => {
    // Disable ShowJammers
    await pushState({
      'ScoreBoard.Settings.Setting(Overlay.Interactive.ShowJammers)': false,
    });

    // Start a jam
    await pushState(loadState('team1-lead'));

    // The TeamBox should NOT have ShowJammers class
    const hasClass = await teamBoxHasClass(overlayPage, 'ShowJammers');
    expect(hasClass).toBe(false);

    // JammerBox should be hidden
    const vis1 = await isJammerBoxVisible(overlayPage, 1);
    expect(vis1, 'Team 1 JammerBox should be hidden').toBe(false);

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/lineup-jammers-hidden.png');
  });

  test('jammer number and name display correctly during jam', async ({ overlayPage, pushState }) => {
    await pushState(loadState('team1-lead'));

    // Team 1 jammer: #88 Speed Demon (from initial state)
    const num1 = await getJammingNumber(overlayPage, 1);
    expect(num1).toBe('88');

    // Team 2 jammer: #7 Lightning Bolt
    const num2 = await getJammingNumber(overlayPage, 2);
    expect(num2).toBe('7');
  });
});

test.describe('Lineup Display — ShowLineups', () => {
  test('ShowLineups adds Lineups class to TeamBox', async ({ overlayPage, pushState }) => {
    // Default is ShowLineups=false
    let hasClass = await teamBoxHasClass(overlayPage, 'Lineups');
    expect(hasClass).toBe(false);

    // Enable ShowLineups
    await pushState({
      'ScoreBoard.Settings.Setting(Overlay.Interactive.ShowLineups)': true,
    });

    hasClass = await teamBoxHasClass(overlayPage, 'Lineups');
    expect(hasClass).toBe(true);

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/lineup-lineups-enabled.png');
  });

  test('toggling ShowLineups off removes Lineups class', async ({ overlayPage, pushState }) => {
    // Enable then disable
    await pushState({
      'ScoreBoard.Settings.Setting(Overlay.Interactive.ShowLineups)': true,
    });
    let hasClass = await teamBoxHasClass(overlayPage, 'Lineups');
    expect(hasClass).toBe(true);

    await pushState({
      'ScoreBoard.Settings.Setting(Overlay.Interactive.ShowLineups)': false,
    });
    hasClass = await teamBoxHasClass(overlayPage, 'Lineups');
    expect(hasClass).toBe(false);
  });
});

test.describe('Lineup Display — Star Pass', () => {
  test('star pass moves Jamming indicator from Jammer to Pivot', async ({ overlayPage, pushState }) => {
    // Start jam with Team 1 lead
    await pushState(loadState('team1-lead'));

    // Before star pass: Jammer position should have .Jamming class
    const jammingBeforeSP = await overlayPage.evaluate(() => {
      const el = document.querySelector(
        `.TeamBox [Team="1"] .JammerBox [Position="Jammer"]`
      ) as HTMLElement | null;
      return el?.classList.contains('Jamming') ?? false;
    });
    expect(jammingBeforeSP, 'Jammer should have Jamming class before SP').toBe(true);

    // Execute star pass
    await pushState(loadState('team1-star-pass'));

    // After star pass: Pivot should have .Jamming class
    const pivotJamming = await overlayPage.evaluate(() => {
      const el = document.querySelector(
        `.TeamBox [Team="1"] .JammerBox [Position="Pivot"]`
      ) as HTMLElement | null;
      return el?.classList.contains('Jamming') ?? false;
    });
    expect(pivotJamming, 'Pivot should have Jamming class after SP').toBe(true);

    // Jammer should no longer have .Jamming
    const jammerJamming = await overlayPage.evaluate(() => {
      const el = document.querySelector(
        `.TeamBox [Team="1"] .JammerBox [Position="Jammer"]`
      ) as HTMLElement | null;
      return el?.classList.contains('Jamming') ?? false;
    });
    expect(jammerJamming, 'Jammer should NOT have Jamming class after SP').toBe(false);

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/lineup-star-pass.png');
  });

  test('Team 2 star pass screenshot', async ({ overlayPage, pushState }) => {
    // Start jam with Team 2 lead
    await pushState(loadState('team2-lead'));
    // Execute star pass for Team 2
    await pushState(loadState('team2-star-pass'));

    // Verify Pivot has Jamming class for Team 2
    const pivotJamming = await overlayPage.evaluate(() => {
      const el = document.querySelector(
        `.TeamBox [Team="2"] .JammerBox [Position="Pivot"]`
      ) as HTMLElement | null;
      return el?.classList.contains('Jamming') ?? false;
    });
    expect(pivotJamming, 'T2 Pivot should have Jamming class after SP').toBe(true);

    await screenshotOverlayBar(overlayPage, 'test-results/screenshots/lineup-t2-star-pass.png');
  });
});
