/**
 * MockCRGServer — a minimal mock of the CRG ScoreBoard WebSocket server.
 *
 * Speaks the same protocol as the real scoreboard:
 *   - Handles "Register" → sends full state snapshot
 *   - Handles "Ping" → sends Pong
 *   - Supports pushUpdate() to send incremental state patches
 *
 * Also serves static files:
 *   - CRG's html/ directory at / (jQuery, core.js, WS.js, etc.)
 *   - Overlay under test at /custom/<overlay-name>/
 *
 * Ported from derby-scoreboard-api/tests/conftest.py MockScoreboardServer.
 */
import { WebSocketServer, WebSocket } from "ws";
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { AddressInfo } from "net";

export interface MockCRGServerOptions {
  /** Path to the CRG scoreboard html/ directory for static files */
  crgHtmlDir: string;
  /** Map of overlay name → overlay source directory to mount at /custom/<name>/ */
  overlays: Record<string, string>;
  /** Initial full state to send on Register */
  initialState: Record<string, any>;
}

export class MockCRGServer {
  private _state: Record<string, any>;
  private _connections: Set<WebSocket> = new Set();
  private _server: http.Server | null = null;
  private _wss: WebSocketServer | null = null;
  private _app: express.Application;
  private _options: MockCRGServerOptions;

  public port: number = 0;

  constructor(options: MockCRGServerOptions) {
    this._options = options;
    this._state = { ...options.initialState };
    this._app = express();

    // Serve CRG static files at /
    if (!fs.existsSync(options.crgHtmlDir)) {
      throw new Error(
        `CRG html directory not found: ${options.crgHtmlDir}\n` +
          "Set the CRG_HTML_DIR environment variable or check your local scoreboard/html path.",
      );
    }
    this._app.use(express.static(options.crgHtmlDir));

    // Mount each overlay at /custom/<name>/
    for (const [name, dir] of Object.entries(options.overlays)) {
      if (!fs.existsSync(dir)) {
        throw new Error(
          `Overlay directory not found: ${dir} (overlay: ${name})\n` +
            "Set the EOD_CUSTOM_DIR environment variable or check your local overlay path.",
        );
      }
      this._app.use(`/custom/${name}`, express.static(dir));
    }
  }

  /** Start the HTTP + WebSocket server on a random free port */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._server = http.createServer(this._app);
      this._wss = new WebSocketServer({ server: this._server, path: "/WS/" });

      this._wss.on("connection", (ws: WebSocket) => {
        this._connections.add(ws);
        ws.on("message", (raw: import("ws").RawData) => {
          let str: string;
          if (typeof raw === "string") {
            str = raw;
          } else if (Buffer.isBuffer(raw)) {
            str = raw.toString("utf-8");
          } else if (raw instanceof ArrayBuffer) {
            str = Buffer.from(raw).toString("utf-8");
          } else {
            // Buffer[] (rare but possible)
            str = Buffer.concat(raw as Buffer[]).toString("utf-8");
          }
          this._handleMessage(ws, str);
        });
        ws.on("close", () => {
          this._connections.delete(ws);
        });
      });

      this._server.listen(0, "127.0.0.1", () => {
        const addr = this._server!.address() as AddressInfo;
        this.port = addr.port;
        resolve();
      });

      this._server.on("error", reject);
    });
  }

  /** Handle an incoming WebSocket message */
  private _handleMessage(ws: WebSocket, raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.action === "Register") {
      // Send full state snapshot
      ws.send(JSON.stringify({ state: this._state }));
      // Send a second message without WS.Device.Id to trigger AfterLoad callbacks
      ws.send(JSON.stringify({ state: {} }));
    } else if (msg.action === "Ping") {
      ws.send(JSON.stringify({ Pong: "" }));
    } else if (msg.action === "Set") {
      // Accept Set commands (from admin panel interactions)
      if (msg.key && msg.value !== undefined) {
        // Reject dangerous keys that could mutate the prototype chain
        const FORBIDDEN_KEYS = new Set([
          "__proto__",
          "constructor",
          "prototype",
        ]);
        if (FORBIDDEN_KEYS.has(msg.key)) return;
        this._state[msg.key] = msg.value;
        this._broadcast({ [msg.key]: msg.value });
      }
    }
  }

  /** Push a state delta to all connected clients */
  pushUpdate(patch: Record<string, any>): void {
    // Merge into internal state
    for (const [key, value] of Object.entries(patch)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype")
        continue;
      if (value === null) {
        delete this._state[key];
      } else {
        this._state[key] = value;
      }
    }
    this._broadcast(patch);
  }

  /** Broadcast a state patch to all connected clients */
  private _broadcast(patch: Record<string, any>): void {
    const payload = JSON.stringify({ state: patch });
    for (const ws of this._connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /** Get current full state */
  getState(): Record<string, any> {
    return { ...this._state };
  }

  /** Reset state to initial */
  reset(): void {
    // Build tombstones for keys that were added after initialisation
    const tombstones: Record<string, null> = {};
    for (const key of Object.keys(this._state)) {
      if (!(key in this._options.initialState)) {
        tombstones[key] = null;
      }
    }
    this._state = { ...this._options.initialState };
    // Send tombstones first, then the fresh initial state
    const resetPayload = { ...tombstones, ...this._options.initialState };
    this._broadcast(resetPayload);
  }

  /** Stop the server */
  async stop(): Promise<void> {
    for (const ws of this._connections) {
      ws.removeAllListeners("close"); // prevent close handler running after clear
      ws.close();
    }
    this._connections.clear();

    return new Promise((resolve) => {
      if (this._wss) {
        this._wss.close();
      }
      if (this._server) {
        this._server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
