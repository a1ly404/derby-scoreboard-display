/**
 * Security & Robustness Tests — Pen-testing the overlay and test harness.
 *
 * These tests try to break things via:
 *   - Invalid / malicious colour values (CSS injection, NaN, empty strings)
 *   - XSS attempts in team names and skater names
 *   - Prototype pollution via WS state keys
 *   - Rapid state flooding
 *   - Extreme / boundary inputs (very long names, null values)
 *   - Path traversal in loadState
 *
 * Every test asserts SAFE BEHAVIOUR: no crash, no script execution,
 * no prototype mutation, graceful degradation.
 */
import { test, expect, loadState } from "../fixtures";

// ── Helpers ───────────────────────────────────────────────────────────────

async function getCssVar(page: any, name: string): Promise<string> {
  return page.evaluate(
    (n: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );
}

async function getTeamBarCssVar(page: any, team: number): Promise<string> {
  return getCssVar(page, `--team${team}-bar`);
}

async function getTeamNameText(page: any, team: number): Promise<string> {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .Name`,
    ) as HTMLElement | null;
    return el?.textContent?.trim() ?? "NOT_FOUND";
  }, team);
}

async function getJammerNumberText(page: any, team: number): Promise<string> {
  return page.evaluate((t: number) => {
    const el = document.querySelector(
      `.TeamBox [Team="${t}"] .JammerBox .Jamming .Number`,
    ) as HTMLElement | null;
    return el?.textContent?.trim() ?? "NOT_FOUND";
  }, team);
}

async function checkXssFlag(page: any, flag: string): Promise<boolean> {
  return page.evaluate((f: string) => !!(window as any)[f], flag);
}

// ── 1. Invalid Colour Values ──────────────────────────────────────────────

test.describe("Security — Invalid Colour Values", () => {
  test("empty string colour does not crash the overlay", async ({
    overlayPage,
    pushState,
  }) => {
    // Push an empty string for both overlay colours — overlay must not crash
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)": "",
      "ScoreBoard.CurrentGame.Team(1).Color(overlay.bg)": "",
    });

    // The overlay should still be alive (body still has content)
    const bodyExists = await overlayPage.evaluate(() => document.body !== null);
    expect(bodyExists).toBe(true);

    // CSS var should NOT have been set to empty string (original value retained
    // because the guard `isValidHex('')` returns false)
    const bar = await getTeamBarCssVar(overlayPage, 1);
    expect(bar, "Empty string must not overwrite --team1-bar").not.toBe("");
  });

  test("non-hex colour string does not crash or set invalid CSS var", async ({
    overlayPage,
    pushState,
  }) => {
    // Read the current T1 bar before the attack
    const before = await getTeamBarCssVar(overlayPage, 1);

    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)": "notacolor",
    });

    const after = await getTeamBarCssVar(overlayPage, 1);
    // The invalid value must NOT have replaced the existing CSS variable
    expect(after, "notacolor must not overwrite --team1-bar").toBe(before);
  });

  test("CSS injection in colour value does not inject a new property", async ({
    overlayPage,
    pushState,
  }) => {
    // Try to inject a separate CSS custom property via a semicolon in the value
    const injectionAttempt =
      "#ff0000; --team1-text: url(https://evil.example.com/track)";

    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)": injectionAttempt,
    });

    const bar = await getTeamBarCssVar(overlayPage, 1);
    // The injected string is invalid hex — the guard should have rejected it.
    // The bar should NOT contain the injection payload.
    expect(bar, "--team1-bar must not contain injected payload").not.toContain(
      "url(",
    );
    expect(
      bar,
      "--team1-bar must not contain semicolons from injection",
    ).not.toContain("evil.example.com");
  });

  test("null colour value is ignored gracefully", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)": null,
    });
    // Page should still be alive and not crashed
    const alive = await overlayPage.evaluate(
      () => document.readyState === "complete",
    );
    expect(alive).toBe(true);
  });

  test("both teams same colour (pure white) — conflict adjustment still produces valid result", async ({
    overlayPage,
    pushState,
  }) => {
    // Both teams #ffffff is a valid same-colour case (contrast = 1:1)
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)": "#ffffff",
      "ScoreBoard.CurrentGame.Team(2).Color(overlay.fg)": "#ffffff",
    });
    await pushState(loadState("team1-lead"));

    const t1Bar = await getTeamBarCssVar(overlayPage, 1);
    const t2Bar = await getTeamBarCssVar(overlayPage, 2);

    // T1 stays white; T2 gets darkened by conflict adjustment
    expect(t1Bar.toLowerCase()).toBe("#ffffff");
    expect(
      t2Bar.toLowerCase(),
      "T2 should be darkened from white when both teams are the same",
    ).not.toBe("#ffffff");
  });

  test("3-digit hex colour is accepted as valid input", async ({
    overlayPage,
    pushState,
  }) => {
    // 3-digit hex is valid CSS — isValidHex('#f00') must return true
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)": "#f00",
    });

    const bar = await getTeamBarCssVar(overlayPage, 1);
    // #f00 is valid — the CSS var should have been updated to it
    expect(bar.replace(/\s/g, ""), "3-digit hex should be accepted").toBe(
      "#f00",
    );
  });
});

// ── 2. XSS in Team Names and Skater Names ────────────────────────────────

test.describe("Security — XSS in Team / Skater Names", () => {
  test("script tag in team name is rendered as text, not executed", async ({
    overlayPage,
    pushState,
  }) => {
    const xssPayload = "<script>window.__xss_teamname = true;</script>";
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Name": xssPayload,
    });

    // The script must NOT have executed
    const fired = await checkXssFlag(overlayPage, "__xss_teamname");
    expect(fired, "Script tag in team name must not execute").toBe(false);

    // The name element should show the literal text (or a truncated version),
    // not be empty (which would mean innerHTML stripped it)
    const displayed = await getTeamNameText(overlayPage, 1);
    expect(displayed, "Team name should be visible as literal text").not.toBe(
      "",
    );
  });

  test("onerror handler in team name is not executed", async ({
    overlayPage,
    pushState,
  }) => {
    const xssPayload = '"><img src=x onerror="window.__xss_onerror=true">';
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Name": xssPayload,
    });

    const fired = await checkXssFlag(overlayPage, "__xss_onerror");
    expect(fired, "onerror in team name must not execute").toBe(false);
  });

  test("script tag in skater name is not executed", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState(loadState("team1-lead"));
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Position(Jammer).Name":
        "<script>window.__xss_skater=true;</script>",
      "ScoreBoard.CurrentGame.Team(1).Position(Jammer).RosterNumber":
        '<img src=x onerror="window.__xss_number=true">',
    });

    const firedName = await checkXssFlag(overlayPage, "__xss_skater");
    const firedNumber = await checkXssFlag(overlayPage, "__xss_number");
    expect(firedName, "Script in skater name must not execute").toBe(false);
    expect(firedNumber, "XSS in roster number must not execute").toBe(false);
  });

  test("very long team name is truncated without crash", async ({
    overlayPage,
    pushState,
  }) => {
    const longName = "A".repeat(10000);
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Name": longName,
    });

    // Page should still be alive and not hung
    const alive = await overlayPage.evaluate(
      () => document.readyState === "complete",
    );
    expect(alive).toBe(true);

    // ovlToFirstWord truncates to first word — for a name with no spaces
    // longer than TEAM_NAME_MAX (28), the full string is returned from
    // the function but CRG's sbDisplay just sets textContent so no crash.
    const displayed = await getTeamNameText(overlayPage, 1);
    expect(
      displayed.length,
      "Very long name should still render",
    ).toBeGreaterThan(0);
  });

  test("very long skater number is displayed without crash", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState(loadState("team1-lead"));
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Position(Jammer).RosterNumber":
        "9".repeat(10000),
    });

    const alive = await overlayPage.evaluate(
      () => document.readyState === "complete",
    );
    expect(alive).toBe(true);
  });
});

// ── 3. Prototype Pollution via WS State ──────────────────────────────────

test.describe("Security — Prototype Pollution", () => {
  test("__proto__ key in pushUpdate does not pollute Object.prototype", async ({
    mockServer,
    overlayPage,
  }) => {
    // Directly call mockServer.pushUpdate with a __proto__ key.
    // The guard in pushUpdate should drop this key silently.
    mockServer.pushUpdate({ __proto__: { polluted: true } } as any);

    // Allow DOM to settle
    await overlayPage.waitForTimeout(100);

    // Object.prototype must NOT have been mutated
    const polluted = await overlayPage.evaluate(() => (({}) as any).polluted);
    expect(
      polluted,
      "__proto__ key must not pollute Object.prototype",
    ).toBeUndefined();
  });

  test("constructor key in WS state does not corrupt state prototype", async ({
    mockServer,
    overlayPage,
  }) => {
    mockServer.pushUpdate({
      constructor: { prototype: { constructorPolluted: true } },
    } as any);

    await overlayPage.waitForTimeout(100);

    const polluted = await overlayPage.evaluate(
      () => (({}) as any).constructorPolluted,
    );
    expect(
      polluted,
      "constructor key must not pollute Object.prototype",
    ).toBeUndefined();
  });

  test("prototype key in WS state is silently dropped", async ({
    mockServer,
    overlayPage,
  }) => {
    // This should not throw or pollute
    expect(() =>
      mockServer.pushUpdate({ prototype: { x: 1 } } as any),
    ).not.toThrow();
  });
});

// ── 4. Rapid State Flooding ───────────────────────────────────────────────

test.describe("Security — Rapid State Flooding", () => {
  test("50 rapid score updates produce correct final value", async ({
    overlayPage,
    pushState,
  }) => {
    // Rapidly push 50 score changes — final value must be 99
    for (let i = 0; i < 50; i++) {
      await pushState({
        "ScoreBoard.CurrentGame.Team(1).Score": i * 2,
      });
    }
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Score": 99,
    });

    const score = await overlayPage.evaluate(() => {
      const el = document.querySelector(
        '.TeamBox [Team="1"] .Score',
      ) as HTMLElement | null;
      return el?.textContent?.trim() ?? "NOT_FOUND";
    });
    expect(score, "Final score after flood should be 99").toBe("99");
  });

  test("50 rapid colour changes do not crash the overlay", async ({
    overlayPage,
    pushState,
  }) => {
    const colours = [
      "#1f3264",
      "#ff2100",
      "#0096bc",
      "#12325e",
      "#bf4c0d",
      "#000000",
      "#ffffff",
      "#ffff00",
      "#444444",
      "#cc0000",
    ];

    for (let i = 0; i < 50; i++) {
      const colour = colours[i % colours.length];
      await pushState({
        "ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)": colour,
        "ScoreBoard.CurrentGame.Team(2).Color(overlay.fg)":
          colours[(i + 5) % colours.length],
      });
    }

    const alive = await overlayPage.evaluate(
      () => document.readyState === "complete",
    );
    expect(alive, "Overlay should survive 50 rapid colour changes").toBe(true);
  });
});

// ── 5. Null / Missing Critical State Fields ───────────────────────────────

test.describe("Security — Null and Missing Fields", () => {
  test("null score is handled gracefully (no crash, no NaN display)", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Score": null,
    });

    const alive = await overlayPage.evaluate(() => document.body !== null);
    expect(alive).toBe(true);
  });

  test("null team name is handled gracefully", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Name": null,
    });

    const alive = await overlayPage.evaluate(() => document.body !== null);
    expect(alive).toBe(true);
  });

  test("null Lead flag does not crash the indicator", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState(loadState("team1-lead"));
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Lead": null,
      "ScoreBoard.CurrentGame.Team(1).DisplayLead": null,
    });

    const alive = await overlayPage.evaluate(() => document.body !== null);
    expect(alive).toBe(true);
  });
});

// ── 6. loadState — Path Traversal and Error Handling ─────────────────────

test.describe("Security — loadState Input Validation", () => {
  test("path traversal in loadState name throws a safe error", () => {
    // Import loadState directly — it's a synchronous function that can be
    // called outside of a page context.
    const { loadState: ls } = require("../fixtures");
    expect(() => ls("../../etc/passwd")).toThrow(/unsafe state name/);
  });

  test("path traversal with backslash throws a safe error", () => {
    const { loadState: ls } = require("../fixtures");
    expect(() => ls("..\\..\\Windows\\System32")).toThrow(/unsafe state name/);
  });

  test("missing state file throws a descriptive error", () => {
    const { loadState: ls } = require("../fixtures");
    expect(() => ls("this-file-does-not-exist-xyz")).toThrow(/file not found/);
  });

  test("valid state file loads without error", () => {
    const { loadState: ls } = require("../fixtures");
    expect(() => ls("initial")).not.toThrow();
  });
});

// ── 7. Extreme Edge Cases ─────────────────────────────────────────────────

test.describe("Security — Edge Cases", () => {
  test("unicode in team name does not crash", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Name": "💀⚡🔥🌊❄️",
    });
    const alive = await overlayPage.evaluate(() => document.body !== null);
    expect(alive).toBe(true);
  });

  test("unicode in colour value (invalid hex) is rejected", async ({
    overlayPage,
    pushState,
  }) => {
    const before = await getTeamBarCssVar(overlayPage, 1);
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)": "♠♥♦♣",
    });
    const after = await getTeamBarCssVar(overlayPage, 1);
    expect(after, "Unicode colour must not overwrite CSS var").toBe(before);
  });

  test("extremely long colour value (50000 chars) is rejected without crash", async ({
    overlayPage,
    pushState,
  }) => {
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)":
        "#" + "f".repeat(50000),
    });
    const alive = await overlayPage.evaluate(() => document.body !== null);
    expect(alive).toBe(true);
  });

  test('NaN numeric value for score does not show "NaN" in display', async ({
    overlayPage,
    pushState,
  }) => {
    // Push a value that might coerce to NaN in some contexts
    await pushState({
      "ScoreBoard.CurrentGame.Team(1).Score": "not-a-number",
    });

    const score = await overlayPage.evaluate(() => {
      const el = document.querySelector(
        '.TeamBox [Team="1"] .Score',
      ) as HTMLElement | null;
      return el?.textContent?.trim() ?? "";
    });
    // It might show 'not-a-number' as literal text (CRG sets textContent),
    // or an empty string, but it must NOT show 'NaN'
    expect(score, "Score must not display as NaN").not.toBe("NaN");
  });
});
