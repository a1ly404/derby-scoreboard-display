/**
 * Playwright test fixtures for the Derby overlay test harness.
 *
 * Provides:
 *   - `mockServer` — a MockCRGServer instance (started/stopped per test)
 *   - `overlayPage` — navigated to the overlay under test, connected to mock WS
 *   - `pushState` — helper to push state patches and wait for DOM updates
 */
import { test as base, expect, Page } from '@playwright/test';
import { MockCRGServer } from './mock-crg-server';
import path from 'path';
import fs from 'fs';

// Paths
const CRG_HTML_DIR = path.resolve(__dirname, '../../scoreboard/html');
const EOD_CUSTOM_DIR = path.resolve(__dirname, '../eod-custom-overlay');
const STATE_DIR = path.resolve(__dirname, './state');

/** Load a state JSON file from the state/ directory */
export function loadState(name: string): Record<string, any> {
  const filePath = path.join(STATE_DIR, `${name}.json`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const state = JSON.parse(raw);
  // Remove description field
  delete state._description;
  return state;
}

/** Compute WCAG contrast ratio between two hex colours (mirrors overlay JS) */
export function contrastRatio(hex1: string, hex2: string): number {
  function hexToRgb(hex: string) {
    const clean = hex.replace('#', '');
    const expanded = clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean;
    return {
      r: parseInt(expanded.substring(0, 2), 16),
      g: parseInt(expanded.substring(2, 4), 16),
      b: parseInt(expanded.substring(4, 6), 16),
    };
  }

  function relativeLuminance(rgb: { r: number; g: number; b: number }) {
    const vals = [rgb.r, rgb.g, rgb.b].map(v => {
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
    const initialState = loadState('initial');
    const server = new MockCRGServer({
      crgHtmlDir: CRG_HTML_DIR,
      overlays: {
        'eod-custom-overlay': EOD_CUSTOM_DIR,
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
    const url = `http://127.0.0.1:${mockServer.port}/custom/eod-custom-overlay/index.html`;
    await page.goto(url);

    // Wait for WS.js to connect and process the initial state snapshot.
    // The overlay removes the 'preload' class from body in WS.AfterLoad().
    await page.waitForFunction(
      () => !document.body.classList.contains('preload'),
      { timeout: 15000 }
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

      // Wait for the DOM to process the update.
      // CRG's WS.js processes updates synchronously on message receipt,
      // then jQuery applies DOM changes. A short wait covers render.
      await overlayPage.waitForTimeout(300);
    };
    await use(push);
  },
});

export { expect };
