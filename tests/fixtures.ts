/**
 * Playwright test fixtures for the Derby overlay test harness.
 *
 * Provides:
 *   - `mockServer` — a MockCRGServer instance (started/stopped per test)
 *   - `overlayPage` — navigated to the overlay under test, connected to mock WS
 *   - `pushState` — helper to push state patches and wait for DOM updates
 */
import { test as base, expect, Page } from "@playwright/test";
import { MockCRGServer } from "./mock-crg-server";
import path from "path";
import fs from "fs";

// Paths — prefer environment variables (set in CI), fall back to local dev layout
const CRG_HTML_DIR =
  process.env.CRG_HTML_DIR || path.resolve(__dirname, "../../scoreboard/html");
const EOD_CUSTOM_DIR =
  process.env.EOD_CUSTOM_DIR ||
  path.resolve(__dirname, "../custom-overlays/eod-custom-overlay");
const STATE_DIR = path.resolve(__dirname, "./state");

/** Overlay name used in the mock server mount and URL path */
const OVERLAY_NAME = "eod-custom-overlay";

/** Load a state JSON file from the state/ directory */
export function loadState(name: string): Record<string, any> {
  // Prevent path traversal: name must be a simple alphanumeric/hyphen/underscore slug
  if (
    typeof name !== "string" ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..")
  ) {
    throw new Error(
      `loadState: unsafe state name '${name}' — must not contain path separators or '..'`,
    );
  }
  const filePath = path.join(STATE_DIR, `${name}.json`);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (err: any) {
    throw new Error(
      `loadState('${name}'): file not found at ${filePath} — ${err.message}`,
    );
  }
  let state: Record<string, any>;
  try {
    state = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(
      `loadState('${name}'): invalid JSON in ${filePath} — ${err.message}`,
    );
  }
  delete state._description;
  return state;
}

/** Compute WCAG contrast ratio between two hex colours (mirrors overlay JS) */
export function contrastRatio(hex1: string, hex2: string): number {
  function hexToRgb(hex: string) {
    const clean = hex.replace("#", "");
    const expanded =
      clean.length === 3
        ? clean
            .split("")
            .map((c) => c + c)
            .join("")
        : clean;
    return {
      r: parseInt(expanded.substring(0, 2), 16),
      g: parseInt(expanded.substring(2, 4), 16),
      b: parseInt(expanded.substring(4, 6), 16),
    };
  }

  function relativeLuminance(rgb: { r: number; g: number; b: number }) {
    const vals = [rgb.r, rgb.g, rgb.b].map((v) => {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2];
  }

  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── Custom fixture types ──────────────────────────────────────
type OverlayFixtures = {
  mockServer: MockCRGServer;
  overlayPage: Page;
  pushState: (patch: Record<string, any>) => Promise<void>;
};

/**
 * Extended Playwright test with overlay fixtures.
 *
 * Usage:
 *   import { test, expect } from '../fixtures';
 *   test('my test', async ({ overlayPage, pushState }) => { ... });
 */
export const test = base.extend<OverlayFixtures>({
  mockServer: async ({}, use) => {
    const initialState = loadState("initial");
    const server = new MockCRGServer({
      crgHtmlDir: CRG_HTML_DIR,
      overlays: {
        [OVERLAY_NAME]: EOD_CUSTOM_DIR,
      },
      initialState,
    });
    await server.start();
    await use(server);
    await server.stop();
  },

  overlayPage: async ({ mockServer, page }, use) => {
    // Navigate to the overlay served by our mock server.
    // The overlay HTML loads CRG's jQuery/core.js/WS.js from /,
    // then WS.Connect() opens a WS to the same host.
    const url = `http://127.0.0.1:${mockServer.port}/custom/${OVERLAY_NAME}/index.html`;
    await page.goto(url);

    // Wait for WS.js to connect and process the initial state snapshot.
    // The overlay removes the 'preload' class from body in WS.AfterLoad().
    await page.waitForFunction(
      () => !document.body.classList.contains("preload"),
      { timeout: 15000 },
    );

    // Give a tiny extra beat for all sbDisplay/sbClass directives to settle
    await page.waitForTimeout(500);

    await use(page);
  },

  pushState: async ({ mockServer, overlayPage }, use) => {
    const push = async (patch: Record<string, any>) => {
      // Remove description field if present
      const cleanPatch = { ...patch };
      delete cleanPatch._description;

      mockServer.pushUpdate(cleanPatch);

      // Wait for the DOM to reflect the WS state update.
      // CRG's WS.js fires callbacks synchronously on message receipt;
      // we wait for the next animation frame + a micro-task to ensure
      // all sbDisplay/sbClass directives have finished rendering.
      await overlayPage.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => setTimeout(resolve, 0)),
          ),
      );
    };
    await use(push);
  },
});

export { expect };

/**
 * Wait for a team's JammerBox to finish sliding in.
 *
 * The JammerBox has a 2-second CSS `transition: margin-left 2s` that fires
 * whenever `InJam` becomes true and `ShowJammers` is active.  Screenshots
 * taken before the transition completes will show the box mid-slide or fully
 * hidden.  This helper polls `computedStyle.marginLeft` until it reaches
 * '0px' (or times out after 5 s).
 */
export async function waitForJammerBoxVisible(
  page: Page,
  team: number,
): Promise<void> {
  await page.waitForFunction(
    (t: number) => {
      const el = document.querySelector(
        `.TeamBox [Team="${t}"] .JammerBox`,
      ) as HTMLElement | null;
      if (!el) return false;
      return window.getComputedStyle(el).marginLeft === "0px";
    },
    team,
    { timeout: 5000 },
  );
}

/**
 * Screenshot the full TeamBox panel including the JammerBox (lineup section).
 *
 * Unlike screenshotOverlayBar() which clips to PanelWrapperTop, this helper
 * waits for both teams' JammerBoxes to finish their slide-in transition and
 * then takes a full-width crop of the overlay bar row at a fixed height that
 * includes the jammer number cells extending to the right of the score bar.
 *
 * Use this whenever you need to verify the lead-flash animation is visible on
 * the *jammer number* in the lineup section, not just the ★ Indicator badge.
 */
export async function screenshotJammerSection(
  page: Page,
  filePath: string,
  teams: number[] = [1, 2],
): Promise<void> {
  // Wait for all requested teams' JammerBoxes to finish sliding in
  for (const team of teams) {
    try {
      await waitForJammerBoxVisible(page, team);
    } catch {
      // If the transition never completes (e.g. ShowJammers is off) just
      // continue — we still want a screenshot for debugging purposes.
    }
  }

  // Clip to the TeamBox element which contains both score bars + JammerBoxes
  const viewport = page.viewportSize();
  const vw = viewport?.width ?? 1920;
  const vh = viewport?.height ?? 1080;

  const teamBox = await page.$(".TeamBox");
  if (teamBox) {
    const box = await teamBox.boundingBox();
    if (box) {
      const margin = 12;
      const x = Math.max(0, box.x - margin);
      const y = Math.max(0, box.y - margin);
      const width = Math.min(box.width + margin * 2, vw - x);
      const height = Math.min(box.height + margin * 2, vh - y);

      if (width > 0 && height > 0) {
        await page.screenshot({
          path: filePath,
          clip: { x, y, width, height },
        });
        return;
      }
    }
  }

  // Fallback: upper quarter of the viewport
  await page.screenshot({
    path: filePath,
    clip: { x: 0, y: 0, width: vw, height: Math.min(200, vh) },
  });
}

/**
 * Take a screenshot clipped to the overlay bar area only (TeamBox + ClockBox).
 * Excludes the wider penalty board / roster panels below.
 */
export async function screenshotOverlayBar(
  page: Page,
  filePath: string,
): Promise<void> {
  const viewport = page.viewportSize();
  const vw = viewport?.width ?? 1920;
  const vh = viewport?.height ?? 1080;

  const wrapper = await page.$(".PanelWrapperTop");
  if (wrapper) {
    const box = await wrapper.boundingBox();
    if (box) {
      const margin = 8;
      const x = Math.max(0, box.x - margin);
      const y = Math.max(0, box.y - margin);
      const width = Math.min(box.width + margin * 2, vw - x);
      const height = Math.min(box.height + margin * 2, vh - y);

      if (width > 0 && height > 0) {
        await page.screenshot({
          path: filePath,
          clip: { x, y, width, height },
        });
        return;
      }
    }
  }
  // Fallback: top strip of the viewport
  await page.screenshot({
    path: filePath,
    clip: { x: 0, y: 0, width: vw, height: Math.min(120, vh) },
  });
}
