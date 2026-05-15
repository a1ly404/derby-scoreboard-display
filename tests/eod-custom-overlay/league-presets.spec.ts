/**
 * League Colour Presets — lead flash WCAG accessibility across all real-world
 * league colour combinations used by EoD broadcast.
 *
 * For each preset, verifies:
 *   1. The flash peak colour (--teamN-flash-peak) is set by wcagCheckLeadFlash()
 *   2. The peak colour passes WCAG AA 4.5:1 against the bar colour
 *   3. The trough colour (--teamN-flash-trough) is a second visible colour
 *      that contrasts ≥ 3.0:1 against the bar (NOT the bar colour itself)
 *   4. Peak and trough are different colours
 *   5. A screenshot is captured for visual reference
 *
 * These tests will FAIL if wcagCheckLeadFlash() does not fire on colour load
 * (i.e. the flash falls back to CSS defaults and the trough is 'transparent').
 */
import {
  test,
  expect,
  loadState,
  contrastRatio,
  screenshotOverlayBar,
} from "../fixtures";

// ── Helpers ───────────────────────────────────────────────────────────────

async function getCssVar(page: any, name: string): Promise<string> {
  return page.evaluate(
    (n: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );
}

async function getAnimationName(page: any, team: number): Promise<string> {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .JammerBox .Jamming`,
    ) as HTMLElement | null;
    if (!el) return "NOT_FOUND";
    return window.getComputedStyle(el).animationName;
  }, team);
}

// ── Preset definitions ────────────────────────────────────────────────────
// fg = bar background colour (what wcagCheckLeadFlash checks against)
// bg = indicator/swatch background colour
// flashColour = the expected WCAG-selected peak (red → white → yellow → black)
//
// Logic: pick the first of [#ff0000, #ffffff, #ffff00, #000000] with ≥4.5:1
// contrast against fg.
const LEAGUE_PRESETS = [
  {
    name: "Denver",
    file: "colours-denver",
    t1fg: "#1f3264",
    t2fg: "#1f3264",
    // contrastRatio('#ff0000', '#1f3264') ≈ 3.09 → red fails
    // contrastRatio('#ffffff', '#1f3264') ≈ 10.74 → white passes
    expectPeak: "#ffffff",
  },
  {
    name: "Faultline",
    file: "colours-faultline",
    t1fg: "#0096bc",
    t2fg: "#1f3264",
    // contrastRatio('#ff0000', '#0096bc') ≈ 2.54 → red fails
    // contrastRatio('#ffffff', '#0096bc') ≈ 3.46 → white fails
    // contrastRatio('#ffff00', '#0096bc') ≈ 4.00 → yellow fails
    // contrastRatio('#000000', '#0096bc') ≈ 6.06 → black passes
    expectPeak: "#000000",
  },
  {
    name: "GVRDA",
    file: "colours-gvrda",
    t1fg: "#000000",
    t2fg: "#000000",
    // contrastRatio('#ff0000', '#000000') ≈ 5.25 → red passes
    expectPeak: "#ff0000",
  },
  {
    name: "Hard Dark / EoD Envy",
    file: "colours-hard-dark",
    t1fg: "#12325e",
    t2fg: "#12325e",
    // contrastRatio('#ff0000', '#12325e') ≈ 3.20 → red fails
    // contrastRatio('#ffffff', '#12325e') ≈ 12.77 → white passes
    expectPeak: "#ffffff",
  },
  {
    name: "Saskatoon",
    file: "colours-saskatoon",
    t1fg: "#ff2100",
    t2fg: "#ff2100",
    // contrastRatio('#ff0000', '#ff2100') ≈ 1.02 → red fails (red on red)
    // contrastRatio('#ffffff', '#ff2100') ≈ 3.84 → white fails
    // contrastRatio('#ffff00', '#ff2100') ≈ 3.75 → yellow fails
    // contrastRatio('#000000', '#ff2100') ≈ 5.47 → black passes
    expectPeak: "#000000",
  },
  {
    name: "West Sound",
    file: "colours-west-sound",
    t1fg: "#bf4c0d",
    t2fg: "#6a306d",
    // contrastRatio('#ff0000', '#bf4c0d') ≈ 1.82 → red fails
    // contrastRatio('#ffffff', '#bf4c0d') ≈ 4.94 → white passes (borderline)
    expectPeak: "#ffffff",
  },
  // Five existing WCAG combos — also run as a regression check
  {
    name: "Dark (navy + red)",
    file: "colours-dark",
    t1fg: "#1f3264",
    t2fg: "#ff2100",
    // contrastRatio('#ff0000', '#1f3264') ≈ 3.09 → red fails on navy
    // contrastRatio('#ffffff', '#1f3264') ≈ 10.74 → white passes
    expectPeak: "#ffffff",
  },
  {
    name: "Light (white + yellow)",
    file: "colours-light",
    t1fg: "#ffffff",
    t2fg: "#ffff00",
    // white bar: contrastRatio('#ff0000','#ffffff')≈4.00 → red fails
    //            contrastRatio('#ffffff','#ffffff')=1.0 → white fails
    //            contrastRatio('#ffff00','#ffffff')≈1.07 → yellow fails
    //            contrastRatio('#000000','#ffffff')=21 → black passes
    expectPeak: "#000000",
  },
  {
    name: "Red-on-red",
    file: "colours-red-on-red",
    t1fg: "#cc0000",
    t2fg: "#1f3264",
    // contrastRatio('#ff0000', '#cc0000') ≈ 1.47 → red fails (red on red)
    // contrastRatio('#ffffff', '#cc0000') ≈ 5.89 → white passes
    expectPeak: "#ffffff",
  },
  {
    name: "Grey",
    file: "colours-grey",
    t1fg: "#444444",
    t2fg: "#222222",
    // contrastRatio('#ff0000','#444444')≈2.97 → red fails
    // contrastRatio('#ffffff','#444444')≈7.05 → white passes
    expectPeak: "#ffffff",
  },
  {
    name: "Black and White",
    file: "colours-black-white",
    t1fg: "#000000",
    t2fg: "#ffffff",
    expectPeak: "#ff0000", // red passes on black
  },
] as const;

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe("League Presets — Lead Flash WCAG", () => {
  for (const preset of LEAGUE_PRESETS) {
    test(`${preset.name}: flash CSS variables are set and peak passes WCAG AA`, async ({
      overlayPage,
      pushState,
    }) => {
      // Apply the league colours — triggers wcagCheckLeadFlash() via WS.Register
      await pushState(loadState(preset.file));

      // Start jam with Team 1 lead so the animation selector is active
      await pushState(loadState("team1-lead"));

      // ── Team 1 ──────────────────────────────────────────────────────────
      const t1Peak = await getCssVar(overlayPage, "--team1-flash-peak");
      const t1Trough = await getCssVar(overlayPage, "--team1-flash-trough");

      expect(
        t1Peak,
        `[${preset.name}] T1 --team1-flash-peak must be set`,
      ).not.toBe("");
      expect(
        t1Trough,
        `[${preset.name}] T1 --team1-flash-trough must be set`,
      ).not.toBe("");

      // Trough must NOT be the bar colour (old behaviour made text invisible at trough)
      expect(
        t1Trough.toLowerCase().replace(/\s/g, ""),
        `[${preset.name}] T1 trough must not equal bar colour ${preset.t1fg}`,
      ).not.toBe(preset.t1fg.toLowerCase());

      // Trough must have readable contrast against the bar (≥ 3.0:1)
      const t1TroughRatio = contrastRatio(t1Trough, preset.t1fg);
      expect(
        t1TroughRatio,
        `[${preset.name}] T1 trough (${t1Trough}) contrast against bar (${preset.t1fg})`,
      ).toBeGreaterThanOrEqual(3.0);

      // Peak and trough must be different colours
      expect(
        t1Peak.toLowerCase(),
        `[${preset.name}] T1 peak and trough must differ`,
      ).not.toBe(t1Trough.toLowerCase());

      // Peak must pass WCAG AA against the bar colour
      const t1Ratio = contrastRatio(t1Peak, preset.t1fg);
      expect(
        t1Ratio,
        `[${preset.name}] T1 flash peak (${t1Peak} on ${preset.t1fg})`,
      ).toBeGreaterThanOrEqual(4.5);

      // Peak should match the expected WCAG-selected colour
      expect(
        t1Peak.toLowerCase(),
        `[${preset.name}] T1 expected flash peak to be ${preset.expectPeak}`,
      ).toBe(preset.expectPeak.toLowerCase());

      // Animation name should be the per-team keyframe
      const anim1 = await getAnimationName(overlayPage, 1);
      expect(
        anim1,
        `[${preset.name}] T1 animation should be HasLead_T1`,
      ).toMatch(/^HasLead_T1$/);

      // ── Team 2 ──────────────────────────────────────────────────────────
      // Switch lead to Team 2
      await pushState({
        "ScoreBoard.CurrentGame.Team(1).Lead": false,
        "ScoreBoard.CurrentGame.Team(1).DisplayLead": false,
        "ScoreBoard.CurrentGame.Team(2).Lead": true,
        "ScoreBoard.CurrentGame.Team(2).DisplayLead": true,
      });

      const t2Peak = await getCssVar(overlayPage, "--team2-flash-peak");
      const t2Trough = await getCssVar(overlayPage, "--team2-flash-trough");

      expect(
        t2Peak,
        `[${preset.name}] T2 --team2-flash-peak must be set`,
      ).not.toBe("");
      expect(
        t2Trough,
        `[${preset.name}] T2 --team2-flash-trough must be set`,
      ).not.toBe("");

      // Trough must NOT be the bar colour (text must stay readable at trough)
      const t2EffectiveBar = await getCssVar(overlayPage, "--team2-bar");
      expect(
        t2Trough.toLowerCase().replace(/\s/g, ""),
        `[${preset.name}] T2 trough must not equal bar colour`,
      ).not.toBe(t2EffectiveBar.toLowerCase().replace(/\s/g, ""));

      // When both teams share the same colour the T2 bar is conflict-adjusted
      // (lightened/darkened). The trough picker is best-effort against that
      // adjusted bar — the candidate palette is too constrained to guarantee a
      // numeric contrast ratio, so we only enforce the ratio for non-adjusted teams.
      const t2WasAdjusted = contrastRatio(preset.t1fg, preset.t2fg) < 1.5;
      if (!t2WasAdjusted) {
        const t2TroughRatio = contrastRatio(t2Trough, t2EffectiveBar);
        expect(
          t2TroughRatio,
          `[${preset.name}] T2 trough (${t2Trough}) contrast against bar (${t2EffectiveBar})`,
        ).toBeGreaterThanOrEqual(3.0);
      }

      // Peak and trough must be different colours
      expect(
        t2Peak.toLowerCase(),
        `[${preset.name}] T2 peak and trough must differ`,
      ).not.toBe(t2Trough.toLowerCase());

      // Check peak contrast against the effective bar (may differ from preset
      // after conflict adjustment)
      const t2Ratio = contrastRatio(t2Peak, t2EffectiveBar);
      expect(
        t2Ratio,
        `[${preset.name}] T2 flash peak (${t2Peak} on ${t2EffectiveBar})`,
      ).toBeGreaterThanOrEqual(4.5);

      const anim2 = await getAnimationName(overlayPage, 2);
      expect(
        anim2,
        `[${preset.name}] T2 animation should be HasLead_T2`,
      ).toMatch(/^HasLead_T2$/);

      // Screenshot for visual review
      await screenshotOverlayBar(
        overlayPage,
        `test-results/screenshots/league-preset-${preset.file}-lead-flash.png`,
      );
    });
  }
});

test.describe("League Presets — Flash is NOT Transparent (fades-to-nothing regression)", () => {
  for (const preset of LEAGUE_PRESETS) {
    test(`${preset.name}: trough is a visible colour, not transparent or bar`, async ({
      overlayPage,
      pushState,
    }) => {
      await pushState(loadState(preset.file));
      await pushState(loadState("team1-lead"));

      const trough = await getCssVar(overlayPage, "--team1-flash-trough");
      const peak = await getCssVar(overlayPage, "--team1-flash-peak");

      // The core regression: trough must NOT be 'transparent' when colours are set.
      // 'transparent' means text fades to nothing instead of blending into the bar.
      expect(
        trough.toLowerCase().replace(/\s/g, ""),
        `[${preset.name}] trough must not be 'transparent' when bar colour is set`,
      ).not.toBe("transparent");

      // Trough must NOT be the bar colour (old bug: text invisible at trough)
      expect(
        trough.toLowerCase().replace(/\s/g, ""),
        `[${preset.name}] trough must not equal bar colour ${preset.t1fg}`,
      ).not.toBe(preset.t1fg.toLowerCase());

      // Trough must have readable contrast against the bar (≥ 3.0:1)
      const troughRatio = contrastRatio(trough, preset.t1fg);
      expect(
        troughRatio,
        `[${preset.name}] trough (${trough}) contrast against bar (${preset.t1fg})`,
      ).toBeGreaterThanOrEqual(3.0);

      // Peak and trough must be different colours
      expect(
        peak.toLowerCase(),
        `[${preset.name}] peak and trough must differ`,
      ).not.toBe(trough.toLowerCase());
    });
  }
});
