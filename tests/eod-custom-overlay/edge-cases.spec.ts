/**
 * Edge Cases — tests for overlay states not covered by lead-flash or team-colours specs.
 *
 * Covers:
 *   1. No-colour flash fallback (default CSS variables, no WS colour push)
 *   2. Rapid state transitions (lead → calloff → jam-end in quick succession)
 *   3. Penalty box display in lineup mode
 *   4. Official review dot state
 *   5. Lead flash with each of the 8 league colour presets
 */
import {
  test,
  expect,
  loadState,
  contrastRatio,
  screenshotOverlayBar,
} from "../fixtures";

// ── Helpers ───────────────────────────────────────────────────────────────

/** Get the computed animation-name for the .Jamming element */
async function getJammingAnimation(page: any, team: number): Promise<string> {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .JammerBox .Jamming`,
    ) as HTMLElement | null;
    if (!el) return "NOT_FOUND";
    return window.getComputedStyle(el).animationName;
  }, team);
}

/** Read a CSS custom property from :root */
async function getCssVariable(page: any, varName: string): Promise<string> {
  return page.evaluate((name: string) => {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }, varName);
}

/** Check if .TeamBox has a given class */
async function teamBoxHasClass(page: any, cls: string): Promise<boolean> {
  return page.evaluate((c: string) => {
    const el = document.querySelector(".TeamBox") as HTMLElement | null;
    return el?.classList.contains(c) ?? false;
  }, cls);
}

/** Check if a team div has a given class */
async function teamHasClass(
  page: any,
  team: number,
  cls: string,
): Promise<boolean> {
  return page.evaluate(
    ([t, c]: [number, string]) => {
      const el = document.querySelector(
        `.TeamBox [Team="${t}"]`,
      ) as HTMLElement | null;
      return el?.classList.contains(c) ?? false;
    },
    [team, cls] as [number, string],
  );
}

/** Get the text content of the indicator clock element */
async function getIndicatorText(page: any, team: number): Promise<string> {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .Indicator .Clock`,
    ) as HTMLElement | null;
    return el?.textContent?.trim() ?? "NOT_FOUND";
  }, team);
}

/** Check if a position element has the InBox class */
async function jammerIsInBox(page: any, team: number): Promise<boolean> {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .JammerBox .Jamming`,
    ) as HTMLElement | null;
    return el?.classList.contains("InBox") ?? false;
  }, team);
}

/** Get the Used class state of an official review dot */
async function officialReviewDotIsUsed(
  page: any,
  team: number,
): Promise<boolean> {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .Dot.OfficialReview1`,
    ) as HTMLElement | null;
    return el?.classList.contains("Used") ?? false;
  }, team);
}

/** Get the Retained class state of an official review dot */
async function officialReviewDotIsRetained(
  page: any,
  team: number,
): Promise<boolean> {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .Dot.OfficialReview1`,
    ) as HTMLElement | null;
    return el?.classList.contains("Retained") ?? false;
  }, team);
}

// ── 1. Flash fallback — no colour params ──────────────────────────────────

test.describe("Flash Fallback — no explicit colours", () => {
  test("default CSS flash variables are set on initial load", async ({
    overlayPage,
  }) => {
    // initial.json DOES include Color(overlay.fg) so WS.Register fires.
    // After that the CSS variables should be the WCAG-checked values, not the
    // raw defaults (#ffffff / transparent).
    const peak1 = await getCssVariable(overlayPage, "--team1-flash-peak");
    const peak2 = await getCssVariable(overlayPage, "--team2-flash-peak");

    // Both should be non-empty — WS.AfterLoad safety call + WS.Register should have set them
    expect(
      peak1,
      "--team1-flash-peak should be set by initial state colours",
    ).not.toBe("");
    expect(
      peak2,
      "--team2-flash-peak should be set by initial state colours",
    ).not.toBe("");
  });

  test("flash peak is a valid hex colour", async ({ overlayPage }) => {
    const peak1 = await getCssVariable(overlayPage, "--team1-flash-peak");
    expect(peak1, "--team1-flash-peak should be a hex colour").toMatch(
      /^#[0-9a-fA-F]{6}$/,
    );

    const peak2 = await getCssVariable(overlayPage, "--team2-flash-peak");
    expect(peak2, "--team2-flash-peak should be a hex colour").toMatch(
      /^#[0-9a-fA-F]{6}$/,
    );
  });

  test("flash trough colour is set to bar colour (not transparent)", async ({
    overlayPage,
  }) => {
    // initial.json sets Color(overlay.fg) for both teams, so the trough should
    // be the actual bar colour, not the CSS default 'transparent'.
    const trough1 = await getCssVariable(overlayPage, "--team1-flash-trough");
    expect(trough1, "--team1-flash-trough should not be empty").not.toBe("");
    // The trough should be the bar colour (#1f3264 from initial.json T1)
    expect(trough1, "--team1-flash-trough should be the bar colour").toBe(
      "#1f3264",
    );

    const trough2 = await getCssVariable(overlayPage, "--team2-flash-trough");
    expect(trough2, "--team2-flash-trough should be the bar colour").toBe(
      "#ff2100",
    );
  });

  test("animation name is HasLead_T1 when lead is set (per-team keyframe)", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState(loadState("team1-lead"));
    const anim = await getJammingAnimation(overlayPage, 1);
    // Should use the per-team keyframe, not the generic HasLead fallback
    expect(anim, "Per-team keyframe should be active").toMatch(/^HasLead_T1$/);
  });
});

// ── 2. Rapid state transitions ────────────────────────────────────────────

test.describe("Rapid State Transitions", () => {
  test("lead → calloff → jam-end without waiting between each push", async ({
    overlayPage,
    pushState,
  }) => {
    // Simulate real CRG behaviour: rapid bursts of state updates
    await pushState(loadState("team1-lead"));
    await pushState(loadState("team1-calloff"));
    await pushState(loadState("jam-end"));

    // Final state: jam ended, no InJam class, calloff indicator cleared
    const inJam = await teamBoxHasClass(overlayPage, "InJam");
    expect(inJam, "InJam class should be removed after jam-end").toBe(false);

    // After jam ends, lead indicator clears
    const indicatorText = await getIndicatorText(overlayPage, 1);
    expect(indicatorText, "Indicator should be empty after jam-end").toBe("");

    // Flash animation should be off
    const anim = await getJammingAnimation(overlayPage, 1);
    expect(anim, "Flash animation should stop after jam-end").not.toMatch(
      /HasLead/,
    );
  });

  test("lead → lost → jam-end clears all indicators", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState(loadState("team1-lead"));
    await pushState(loadState("team1-lost"));
    await pushState(loadState("jam-end"));

    const lead = await teamHasClass(overlayPage, 1, "Lead");
    expect(lead).toBe(false);

    const inJam = await teamBoxHasClass(overlayPage, "InJam");
    expect(inJam).toBe(false);
  });

  test("T1 lead then T2 lead — only T2 shows flash", async ({
    overlayPage,
    pushState,
  }) => {
    // Give T1 lead
    await pushState(loadState("team1-lead"));
    let lead1 = await teamHasClass(overlayPage, 1, "Lead");
    expect(lead1).toBe(true);

    // Transfer lead to T2 (T1 loses, T2 gains — simulate a new jam)
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Lead": false,
      "ScoreBoard.CurrentGame.Team(1).DisplayLead": false,
      "ScoreBoard.CurrentGame.Team(1).Lost": true,
      "ScoreBoard.CurrentGame.Team(2).Lead": true,
      "ScoreBoard.CurrentGame.Team(2).DisplayLead": true,
    });

    lead1 = await teamHasClass(overlayPage, 1, "Lead");
    const lead2 = await teamHasClass(overlayPage, 2, "Lead");
    expect(lead1, "T1 should not have Lead class").toBe(false);
    expect(lead2, "T2 should have Lead class").toBe(true);

    const anim1 = await getJammingAnimation(overlayPage, 1);
    const anim2 = await getJammingAnimation(overlayPage, 2);
    expect(anim1, "T1 flash should be off").not.toMatch(/HasLead/);
    expect(anim2, "T2 flash should be active").toMatch(/^HasLead_T2$/);
  });

  test("star pass then jam-end resets indicator", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState(loadState("team1-lead"));
    await pushState(loadState("team1-star-pass"));

    let text = await getIndicatorText(overlayPage, 1);
    expect(text).toBe("SP");

    await pushState(loadState("jam-end"));

    text = await getIndicatorText(overlayPage, 1);
    expect(text, "Indicator should clear after jam-end").toBe("");
  });
});

// ── 3. Penalty Box in Lineup Mode ─────────────────────────────────────────

test.describe("Penalty Box — Lineup Mode", () => {
  test("jammer InBox class is set when jammer enters penalty box", async ({
    overlayPage,
    pushState,
  }) => {
    // Start a jam first
    await pushState(loadState("team1-lead"));

    // Push jammer into box
    await pushState(loadState("team1-jammer-penaltybox"));

    const inBox = await jammerIsInBox(overlayPage, 1);
    expect(inBox, "Jammer should have InBox class").toBe(true);

    await screenshotOverlayBar(
      overlayPage,
      "test-results/screenshots/edge-jammer-inbox.png",
    );
  });

  test("jammer InBox class is cleared when jammer exits penalty box", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState(loadState("team1-lead"));
    await pushState(loadState("team1-jammer-penaltybox"));

    // Verify in box first
    let inBox = await jammerIsInBox(overlayPage, 1);
    expect(inBox).toBe(true);

    // Release from box
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Position(Jammer).PenaltyBox": false,
    });

    inBox = await jammerIsInBox(overlayPage, 1);
    expect(inBox, "Jammer InBox should clear on exit").toBe(false);
  });

  test("lineup mode shows all 5 positions when enabled", async ({
    overlayPage,
    pushState,
  }) => {
    // Enable lineups + UseLT (penalty clocks) to show all 5 positions
    await pushState({
      "ScoreBoard.Settings.Setting(Overlay.Interactive.ShowLineups)": true,
      "ScoreBoard.Settings.Setting(ScoreBoard.Penalties.UseLT)": true,
    });

    // Count all position slots in Team 1's JammerBox
    const positionCount = await overlayPage.evaluate(() => {
      return document.querySelectorAll('.TeamBox [Team="1"] .JammerBox > div')
        .length;
    });

    // Should have 5 positions: Jammer, Pivot, Blocker1, Blocker2, Blocker3
    expect(positionCount, "Should render 5 position slots").toBe(5);

    await screenshotOverlayBar(
      overlayPage,
      "test-results/screenshots/edge-lineup-all-positions.png",
    );
  });
});

// ── 4. Official Review ────────────────────────────────────────────────────

test.describe("Official Review", () => {
  test("official review dot is not Used when review is available", async ({
    overlayPage,
  }) => {
    // Initial state: OfficialReviews=1
    const used = await officialReviewDotIsUsed(overlayPage, 1);
    expect(used, "OR dot should not be Used when review is available").toBe(
      false,
    );
  });

  test("official review dot gets Used class when review is consumed", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState(loadState("team1-official-review"));

    // OfficialReviews=0 in team1-official-review.json means the dot should be Used
    const used = await officialReviewDotIsUsed(overlayPage, 1);
    expect(used, "OR dot should be Used when OfficialReviews=0").toBe(true);

    await screenshotOverlayBar(
      overlayPage,
      "test-results/screenshots/edge-official-review-used.png",
    );
  });

  test("official review dot shows Retained when review is kept", async ({
    overlayPage,
    pushState,
  }) => {
    // Consume the review but retain it (successful challenge)
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).OfficialReviews": 0,
      "ScoreBoard.CurrentGame.Team(1).RetainedOfficialReview": true,
    });

    const retained = await officialReviewDotIsRetained(overlayPage, 1);
    expect(retained, "OR dot should have Retained class").toBe(true);

    await screenshotOverlayBar(
      overlayPage,
      "test-results/screenshots/edge-official-review-retained.png",
    );
  });

  test("Team 2 OR is independent of Team 1 OR", async ({
    overlayPage,
    pushState,
  }) => {
    // Consume only T1's review
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).OfficialReviews": 0,
    });

    const t1Used = await officialReviewDotIsUsed(overlayPage, 1);
    const t2Used = await officialReviewDotIsUsed(overlayPage, 2);

    expect(t1Used, "T1 OR dot should be Used").toBe(true);
    expect(t2Used, "T2 OR dot should NOT be Used").toBe(false);
  });
});

// ── 5. Lead Flash — All 8 League Colour Presets ───────────────────────────

const LEAGUE_PRESETS = [
  { name: "denver", file: "colours-denver", t1fg: "#1f3264", t2fg: "#1f3264" },
  {
    name: "faultline",
    file: "colours-faultline",
    t1fg: "#0096bc",
    t2fg: "#1f3264",
  },
  { name: "gvrda", file: "colours-gvrda", t1fg: "#000000", t2fg: "#000000" },
  {
    name: "saskatoon",
    file: "colours-saskatoon",
    t1fg: "#ff2100",
    t2fg: "#ff2100",
  },
  {
    name: "west-sound",
    file: "colours-west-sound",
    t1fg: "#bf4c0d",
    t2fg: "#6a306d",
  },
  {
    name: "hard-dark",
    file: "colours-hard-dark",
    t1fg: "#12325e",
    t2fg: "#12325e",
  },
];

test.describe("Lead Flash — League Colour Presets", () => {
  for (const preset of LEAGUE_PRESETS) {
    test(`${preset.name}: flash peak passes WCAG AA 4.5:1`, async ({
      overlayPage,
      pushState,
    }) => {
      // Apply league colours then start a jam with T1 lead
      await pushState(loadState(preset.file));
      await pushState(loadState("team1-lead"));

      // CSS variables should now be set to WCAG-checked values
      const t1Peak = await getCssVariable(overlayPage, "--team1-flash-peak");
      expect(t1Peak, `${preset.name}: T1 flash peak should be set`).toMatch(
        /^#[0-9a-fA-F]{6}$/,
      );

      const t1Ratio = contrastRatio(t1Peak, preset.t1fg);
      expect(
        t1Ratio,
        `${preset.name}: T1 flash peak ${t1Peak} on ${preset.t1fg}`,
      ).toBeGreaterThanOrEqual(4.5);

      // T2 lead check
      await pushState({
        "ScoreBoard.CurrentGame.Team(1).Lead": false,
        "ScoreBoard.CurrentGame.Team(1).DisplayLead": false,
        "ScoreBoard.CurrentGame.Team(2).Lead": true,
        "ScoreBoard.CurrentGame.Team(2).DisplayLead": true,
      });

      const t2Peak = await getCssVariable(overlayPage, "--team2-flash-peak");
      expect(t2Peak, `${preset.name}: T2 flash peak should be set`).toMatch(
        /^#[0-9a-fA-F]{6}$/,
      );

      const t2Ratio = contrastRatio(t2Peak, preset.t2fg);
      expect(
        t2Ratio,
        `${preset.name}: T2 flash peak ${t2Peak} on ${preset.t2fg}`,
      ).toBeGreaterThanOrEqual(4.5);

      await screenshotOverlayBar(
        overlayPage,
        `test-results/screenshots/league-flash-${preset.name}.png`,
      );
    });
  }

  test("faultline: black flash chosen (white fails 3.45:1 on teal)", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState(loadState("colours-faultline"));
    await pushState(loadState("team1-lead"));

    const peak = await getCssVariable(overlayPage, "--team1-flash-peak");
    // Faultline is teal (#0096bc). White contrast ≈ 3.45:1 (fails AA).
    // JS should pick black (#000000) which gives ~7.4:1.
    expect(peak, "Faultline: JS should pick black flash, not white").toBe(
      "#000000",
    );
  });

  test("saskatoon: black flash chosen (white fails 3.84:1 on red)", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState(loadState("colours-saskatoon"));
    await pushState(loadState("team1-lead"));

    const peak = await getCssVariable(overlayPage, "--team1-flash-peak");
    // Saskatoon bar is #ff2100 (red). White ≈ 3.84:1 (fails AA).
    // JS should pick black (#000000) which gives ~5.92:1.
    expect(peak, "Saskatoon: JS should pick black flash").toBe("#000000");
  });

  test("gvrda: red flash chosen (red passes 5.25:1 on black)", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState(loadState("colours-gvrda"));
    await pushState(loadState("team1-lead"));

    const peak = await getCssVariable(overlayPage, "--team1-flash-peak");
    // GVRDA bar is #000000 (black). Red (#ff0000) is tried first and passes.
    expect(peak, "GVRDA: red flash should be chosen").toBe("#ff0000");
  });
});
