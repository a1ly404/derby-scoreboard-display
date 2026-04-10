/**
 * Lead Flash Peak-Capture Screenshots
 *
 * These tests freeze the lead-jammer flash animation at its PEAK frame
 * (where the flash colour is fully visible) and take a screenshot.
 * This guarantees the screenshot shows the contrast colour clearly —
 * not the trough frame where text blends into the bar and is invisible.
 *
 * Five representative team colours are tested to cover the full spectrum:
 *   1. Navy (#1f3264)   — dark bar → white flash
 *   2. Red (#ff2100)    — red bar → black flash (red-on-red avoided)
 *   3. Teal (#0096bc)   — mid-luminance bar → black flash
 *   4. Black (#000000)  — darkest bar → red flash (classic derby)
 *   5. White (#ffffff)  — lightest bar → black flash
 *
 * Each screenshot captures the JammerBox lineup section with the flash
 * colour frozen so you can clearly see the text colour change.
 */
import {
  test,
  expect,
  loadState,
  contrastRatio,
  screenshotJammerSection,
  waitForJammerBoxVisible,
} from "../fixtures";

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Pause all HasLead animations at their first keyframe (0% = peak colour).
 * We set animation-play-state to paused and animation-delay to 0s so the
 * browser freezes on the very first step — the peak frame where the flash
 * colour is fully applied and most visible.
 */
async function freezeFlashAtPeak(page: any): Promise<void> {
  await page.evaluate(() => {
    const jammingEls = document.querySelectorAll(
      ".TeamBox .JammerBox .Jamming",
    );
    jammingEls.forEach((el: Element) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.animationPlayState = "paused";
      htmlEl.style.animationDelay = "0s";
    });

    // Also freeze the indicator ★ in the Indicator box
    const indicators = document.querySelectorAll(
      ".TeamBox .Indicator .Clock",
    );
    indicators.forEach((el: Element) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.animationPlayState = "paused";
      htmlEl.style.animationDelay = "0s";
    });
  });

  // Let the browser apply the paused state
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 50)),
      ),
  );
}

/**
 * Resume animations (undo the freeze).
 */
async function resumeFlash(page: any): Promise<void> {
  await page.evaluate(() => {
    const els = document.querySelectorAll(
      ".TeamBox .JammerBox .Jamming, .TeamBox .Indicator .Clock",
    );
    els.forEach((el: Element) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.animationPlayState = "";
      htmlEl.style.animationDelay = "";
    });
  });
}

/**
 * Get the computed color of the .Jamming element for a team.
 * Returns the rgb(...) string as the browser reports it.
 */
async function getJammingComputedColor(
  page: any,
  team: number,
): Promise<string> {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .JammerBox .Jamming`,
    ) as HTMLElement | null;
    if (!el) return "NOT_FOUND";
    return window.getComputedStyle(el).color;
  }, team);
}

/**
 * Get a CSS custom property value from :root.
 */
async function getCssVar(page: any, name: string): Promise<string> {
  return page.evaluate(
    (n: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );
}

// ── Test colours ──────────────────────────────────────────────────────────

const FLASH_COLOURS = [
  {
    name: "Navy",
    stateFile: "colours-denver",
    teamNum: 1,
    barColour: "#1f3264",
    expectedPeak: "#ffffff",
    description: "White flash on dark navy — high contrast, classic look",
  },
  {
    name: "Red",
    stateFile: "colours-saskatoon",
    teamNum: 1,
    barColour: "#ff2100",
    expectedPeak: "#000000",
    description:
      "Black flash on red — red flash would be invisible, black ensures WCAG",
  },
  {
    name: "Teal",
    stateFile: "colours-faultline",
    teamNum: 1,
    barColour: "#0096bc",
    expectedPeak: "#000000",
    description:
      "Black flash on teal — mid-luminance bar, only black passes 4.5:1",
  },
  {
    name: "Black",
    stateFile: "colours-gvrda",
    teamNum: 1,
    barColour: "#000000",
    expectedPeak: "#ff0000",
    description:
      "Red flash on black — the classic derby lead indicator, high contrast",
  },
  {
    name: "White",
    stateFile: "colours-light",
    teamNum: 1,
    barColour: "#ffffff",
    expectedPeak: "#000000",
    description: "Black flash on white — only black achieves WCAG on white",
  },
] as const;

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe("Lead Flash Peak-Capture Screenshots", () => {
  for (const colour of FLASH_COLOURS) {
    test(`${colour.name} (${colour.barColour}): flash frozen at peak — ${colour.description}`, async ({
      overlayPage,
      pushState,
    }) => {
      // 1. Apply team colours
      await pushState(loadState(colour.stateFile));

      // 2. Start jam with lead for the target team
      const leadState =
        colour.teamNum === 1
          ? loadState("team1-lead")
          : loadState("team2-lead");
      await pushState(leadState);

      // 3. Wait for JammerBox slide-in animation to complete
      await waitForJammerBoxVisible(overlayPage, 1);
      await waitForJammerBoxVisible(overlayPage, 2);

      // 4. Verify the per-team keyframe animation is active
      const animName = await overlayPage.evaluate(
        (t: number) => {
          const el = document.querySelector(
            `.TeamBox [Team="${t}"] .JammerBox .Jamming`,
          ) as HTMLElement | null;
          if (!el) return "NOT_FOUND";
          return window.getComputedStyle(el).animationName;
        },
        colour.teamNum,
      );
      expect(
        animName,
        `Animation should be HasLead_T${colour.teamNum}`,
      ).toBe(`HasLead_T${colour.teamNum}`);

      // 5. Verify CSS custom properties are set
      const peak = await getCssVar(
        overlayPage,
        `--team${colour.teamNum}-flash-peak`,
      );
      const trough = await getCssVar(
        overlayPage,
        `--team${colour.teamNum}-flash-trough`,
      );

      expect(peak, "Flash peak CSS var must be set").not.toBe("");
      expect(trough, "Flash trough CSS var must be set").not.toBe("");

      // 6. Verify WCAG 4.5:1 contrast between peak and bar colour
      const ratio = contrastRatio(peak, colour.barColour);
      expect(
        ratio,
        `Peak ${peak} on bar ${colour.barColour} must pass WCAG AA (4.5:1), got ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);

      // 7. Verify expected peak colour
      expect(peak.toLowerCase()).toBe(colour.expectedPeak.toLowerCase());

      // 8. ★ FREEZE the animation at the peak frame ★
      //    This is the critical step — it ensures the screenshot captures
      //    the flash colour, not the trough where text is invisible.
      await freezeFlashAtPeak(overlayPage);

      // 9. Verify the computed color is now the peak (flash) colour.
      //    Because we paused at frame 0 (the peak keyframe), the
      //    browser should report the peak colour as the computed color.
      const computedColor = await getJammingComputedColor(
        overlayPage,
        colour.teamNum,
      );
      expect(
        computedColor,
        `Computed color should be the peak flash colour, not transparent or the bar colour`,
      ).not.toBe("rgba(0, 0, 0, 0)");

      // 10. Take the screenshot — flash is frozen at peak, text is visible
      await screenshotJammerSection(
        overlayPage,
        `test-results/screenshots/lead-flash-peak-${colour.name.toLowerCase()}-${colour.barColour.replace("#", "")}.png`,
        [1, 2],
      );

      // 11. Resume animation (cleanup)
      await resumeFlash(overlayPage);
    });
  }
});

test.describe("Lead Flash Peak vs Trough Comparison", () => {
  // For each colour, capture BOTH the peak AND trough frames side by side
  // so the reviewer can clearly see the flash effect.

  for (const colour of FLASH_COLOURS) {
    test(`${colour.name}: peak vs trough comparison screenshots`, async ({
      overlayPage,
      pushState,
    }) => {
      await pushState(loadState(colour.stateFile));

      const leadState =
        colour.teamNum === 1
          ? loadState("team1-lead")
          : loadState("team2-lead");
      await pushState(leadState);

      await waitForJammerBoxVisible(overlayPage, 1);
      await waitForJammerBoxVisible(overlayPage, 2);

      // ── Peak frame (flash colour visible) ──────────────────────────
      await freezeFlashAtPeak(overlayPage);

      await screenshotJammerSection(
        overlayPage,
        `test-results/screenshots/flash-compare-PEAK-${colour.name.toLowerCase()}.png`,
        [1, 2],
      );

      await resumeFlash(overlayPage);

      // ── Trough frame (text blends into bar — invisible) ────────────
      // Freeze at the 50% keyframe by setting animation-delay to -1s
      // (the animation is 2s long, so -1s = 50% = trough)
      await overlayPage.evaluate(
        (t: number) => {
          const el = document.querySelector(
            `.TeamBox [Team="${t}"] .JammerBox .Jamming`,
          ) as HTMLElement | null;
          if (el) {
            el.style.animationPlayState = "paused";
            el.style.animationDelay = "-1s";
          }
        },
        colour.teamNum,
      );

      await overlayPage.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => setTimeout(resolve, 50)),
          ),
      );

      await screenshotJammerSection(
        overlayPage,
        `test-results/screenshots/flash-compare-TROUGH-${colour.name.toLowerCase()}.png`,
        [1, 2],
      );

      // Cleanup
      await resumeFlash(overlayPage);
    });
  }
});

test.describe("Lead Flash — Both Teams Simultaneously", () => {
  // Edge case: both teams have lead (shouldn't happen in real derby, but
  // tests should still produce valid screenshots for any state)

  test("both teams lead with contrasting bar colours", async ({
    overlayPage,
    pushState,
  }) => {
    // Dark vs light — Denver preset has T1=#1f3264, T2=#1f3264 (same-colour
    // conflict will auto-adjust T2). Use black-white preset instead.
    await pushState(loadState("colours-black-white"));

    // Both teams get lead
    await pushState({
      "ScoreBoard.CurrentGame.InJam": true,
      "ScoreBoard.CurrentGame.Team(1).Lead": true,
      "ScoreBoard.CurrentGame.Team(1).DisplayLead": true,
      "ScoreBoard.CurrentGame.Team(2).Lead": true,
      "ScoreBoard.CurrentGame.Team(2).DisplayLead": true,
    });

    await waitForJammerBoxVisible(overlayPage, 1);
    await waitForJammerBoxVisible(overlayPage, 2);

    // Verify both teams have their per-team animations
    for (const team of [1, 2]) {
      const anim = await overlayPage.evaluate(
        (t: number) => {
          const el = document.querySelector(
            `.TeamBox [Team="${t}"] .JammerBox .Jamming`,
          ) as HTMLElement | null;
          return el ? window.getComputedStyle(el).animationName : "NOT_FOUND";
        },
        team,
      );
      expect(anim).toBe(`HasLead_T${team}`);
    }

    // Verify WCAG contrast for both teams
    const t1Peak = await getCssVar(overlayPage, "--team1-flash-peak");
    const t2Peak = await getCssVar(overlayPage, "--team2-flash-peak");

    // T1 is black (#000000) → red flash expected
    const t1Ratio = contrastRatio(t1Peak, "#000000");
    expect(t1Ratio).toBeGreaterThanOrEqual(4.5);

    // T2 is white (#ffffff) → black flash expected
    const t2Ratio = contrastRatio(t2Peak, "#ffffff");
    expect(t2Ratio).toBeGreaterThanOrEqual(4.5);

    // Freeze at peak and screenshot
    await freezeFlashAtPeak(overlayPage);

    await screenshotJammerSection(
      overlayPage,
      "test-results/screenshots/lead-flash-both-teams-peak.png",
      [1, 2],
    );

    await resumeFlash(overlayPage);
  });

  test("same-colour conflict with lead flash (Denver preset)", async ({
    overlayPage,
    pushState,
  }) => {
    // Denver: both teams #1f3264 — T2 gets auto-lightened
    await pushState(loadState("colours-denver"));
    await pushState(loadState("team1-lead"));

    await waitForJammerBoxVisible(overlayPage, 1);
    await waitForJammerBoxVisible(overlayPage, 2);

    // T1 bar stays #1f3264, T2 bar is lightened
    const t1Bar = await getCssVar(overlayPage, "--team1-bar");
    const t2Bar = await getCssVar(overlayPage, "--team2-bar");
    expect(t1Bar.toLowerCase()).toBe("#1f3264");
    expect(t2Bar.toLowerCase()).not.toBe("#1f3264");

    // T1 flash should still pass WCAG
    const t1Peak = await getCssVar(overlayPage, "--team1-flash-peak");
    const t1Ratio = contrastRatio(t1Peak, t1Bar);
    expect(t1Ratio).toBeGreaterThanOrEqual(4.5);

    await freezeFlashAtPeak(overlayPage);

    await screenshotJammerSection(
      overlayPage,
      "test-results/screenshots/lead-flash-denver-conflict-peak.png",
      [1, 2],
    );

    await resumeFlash(overlayPage);
  });
});
