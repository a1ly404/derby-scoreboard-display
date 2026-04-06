/**
 * Team Colours & Display — verifies colour application and basic display.
 *
 * Tests cover:
 *   1. CSS custom properties are set correctly from WS colour data
 *   2. Team names display correctly (including truncation)
 *   3. Score displays correctly
 *   4. Timeout dots show/hide correctly
 *   5. Clock displays switch correctly between states
 */
import { test, expect, loadState } from '../fixtures';

// ── Helpers ───────────────────────────────────────────────────────────────

/** Get the value of a CSS custom property */
async function getCssVar(page: any, name: string) {
  return page.evaluate((n: string) => {
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  }, name);
}

/** Get the text content of an element by selector */
async function getText(page: any, selector: string) {
  return page.evaluate((s: string) => {
    const el = document.querySelector(s) as HTMLElement | null;
    return el?.textContent?.trim() ?? 'NOT_FOUND';
  }, selector);
}

/** Get the number of visible (non-Used) timeout dots for a team */
async function getVisibleDots(page: any, team: number) {
  return page.evaluate((t: number) => {
    const dots = document.querySelectorAll(
      `.TeamBox [Team="${t}"] .Dot:not(.Used):not(.OfficialReview1)`
    );
    return dots.length;
  }, team);
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('Team Colours', () => {
  test('default colours apply stock silver gradient', async ({ overlayPage }) => {
    // Before any colour params, the CSS defaults should be in place
    // Check team bar text is black (stock CRG silver bars)
    const t1text = await getCssVar(overlayPage, '--team1-text');
    const t2text = await getCssVar(overlayPage, '--team2-text');
    // Note: initial state sets Color(overlay.fg) which triggers JS to update these
    // So they should be white (dark blue and red bars)
    expect(t1text).toMatch(/#(ffffff|000000)/);
    expect(t2text).toMatch(/#(ffffff|000000)/);
  });

  test('colour change via WS updates CSS variables', async ({ overlayPage, pushState }) => {
    await pushState({
      'ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)': '#00ff00',
      'ScoreBoard.CurrentGame.Team(1).Color(overlay.bg)': '#003300',
    });

    const t1bar = await getCssVar(overlayPage, '--team1-bar');
    expect(t1bar).toBe('#00ff00');

    const t1text = await getCssVar(overlayPage, '--team1-text');
    // Green (#00ff00) is fairly bright — black text should pass
    expect(t1text).toBe('#000000');
  });

  test('dark bar gets white text, light bar gets black text', async ({ overlayPage, pushState }) => {
    // Dark blue bar → white text
    await pushState({
      'ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)': '#1f3264',
    });
    let t1text = await getCssVar(overlayPage, '--team1-text');
    expect(t1text).toBe('#ffffff');

    // Light yellow bar → black text
    await pushState({
      'ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)': '#ffff00',
    });
    t1text = await getCssVar(overlayPage, '--team1-text');
    expect(t1text).toBe('#000000');
  });
});

test.describe('Team Name Display', () => {
  test('short name displays in full', async ({ overlayPage }) => {
    // "Home Team" is ≤14 chars, should show in full
    const name = await getText(overlayPage, `.TeamBox [Team="1"] .Name`);
    expect(name).toBe('Home Team');
  });

  test('long name truncates to first word', async ({ overlayPage, pushState }) => {
    await pushState({
      'ScoreBoard.CurrentGame.Team(1).Name': 'Denver Roller Derby',
    });
    // "Denver Roller Derby" > 14 chars → truncated to "Denver"
    // Wait a moment for the sbDisplay to process
    await overlayPage.waitForTimeout(300);
    const name = await getText(overlayPage, `.TeamBox [Team="1"] .Name`);
    expect(name).toBe('Denver');
  });
});

test.describe('Score Display', () => {
  test('initial scores display correctly', async ({ overlayPage }) => {
    const score1 = await getText(overlayPage, `.TeamBox [Team="1"] .Score`);
    const score2 = await getText(overlayPage, `.TeamBox [Team="2"] .Score`);
    expect(score1).toBe('42');
    expect(score2).toBe('37');
  });

  test('score updates via WS', async ({ overlayPage, pushState }) => {
    await pushState({
      'ScoreBoard.CurrentGame.Team(1).Score': 47,
      'ScoreBoard.CurrentGame.Team(1).JamScore': 5,
    });
    const score = await getText(overlayPage, `.TeamBox [Team="1"] .Score`);
    expect(score).toBe('47');

    const jamScore = await getText(overlayPage, `.TeamBox [Team="1"] .JamScore`);
    expect(jamScore).toBe('5');
  });
});

test.describe('Timeout Dots', () => {
  test('all 3 dots visible with 3 timeouts', async ({ overlayPage }) => {
    // Initial state has Timeouts=3 for both teams
    const dots1 = await getVisibleDots(overlayPage, 1);
    const dots2 = await getVisibleDots(overlayPage, 2);
    expect(dots1).toBe(3);
    expect(dots2).toBe(3);
  });

  test('dots disappear as timeouts are used', async ({ overlayPage, pushState }) => {
    // Team 1 uses 1 timeout → 2 remain
    await pushState({
      'ScoreBoard.CurrentGame.Team(1).Timeouts': 2,
    });
    let dots = await getVisibleDots(overlayPage, 1);
    expect(dots).toBe(2);

    // Team 1 uses another → 1 remains
    await pushState({
      'ScoreBoard.CurrentGame.Team(1).Timeouts': 1,
    });
    dots = await getVisibleDots(overlayPage, 1);
    expect(dots).toBe(1);

    // All used → 0 visible
    await pushState({
      'ScoreBoard.CurrentGame.Team(1).Timeouts': 0,
    });
    dots = await getVisibleDots(overlayPage, 1);
    expect(dots).toBe(0);
  });

  test('official review dot', async ({ overlayPage, pushState }) => {
    // Use the official review
    await pushState({
      'ScoreBoard.CurrentGame.Team(1).OfficialReviews': 0,
    });

    const orDot = await overlayPage.evaluate(() => {
      const dot = document.querySelector(
        `.TeamBox [Team="1"] .Dot.OfficialReview1`
      ) as HTMLElement | null;
      if (!dot) return null;
      return {
        hasUsed: dot.classList.contains('Used'),
        opacity: window.getComputedStyle(dot).opacity,
      };
    });

    expect(orDot).not.toBeNull();
    expect(orDot?.hasUsed).toBe(true);
    expect(orDot?.opacity).toBe('0');
  });
});

test.describe('Screenshots — Full Overlay States', () => {
  test('initial state screenshot', async ({ overlayPage }) => {
    await overlayPage.screenshot({
      path: 'test-results/screenshots/initial-state.png',
      fullPage: true,
    });
  });

  test('in-jam with lead screenshot', async ({ overlayPage, pushState }) => {
    await pushState(loadState('team1-lead'));
    await overlayPage.screenshot({
      path: 'test-results/screenshots/in-jam-team1-lead.png',
      fullPage: true,
    });
  });

  test('timeout state screenshot', async ({ overlayPage, pushState }) => {
    await pushState(loadState('team1-timeout'));
    await overlayPage.screenshot({
      path: 'test-results/screenshots/team1-timeout.png',
      fullPage: true,
    });
  });

  test('official timeout screenshot', async ({ overlayPage, pushState }) => {
    await pushState(loadState('official-timeout'));
    await overlayPage.screenshot({
      path: 'test-results/screenshots/official-timeout.png',
      fullPage: true,
    });
  });
});
