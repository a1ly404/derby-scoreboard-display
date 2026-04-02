"""
seed_game.py — populate fake rosters and drive a live game on the CRG scoreboard.

Usage:
    python seed_game.py [--host localhost] [--port 8000]

Connects to the CRG WebSocket, sets position AlternateNames/numbers for both
teams, starts Period 1 Jam 1, and automatically re-starts each new jam as soon
as the previous one ends (mimics a real game with back-to-back jams).

Ctrl+C gracefully stops the current jam and exits.
"""
import asyncio
import json
import signal
import sys
import time

import websockets

HOST = "localhost"
PORT = 8000
URI  = f"ws://{HOST}:{PORT}/WS/"

REGISTER_MSG = json.dumps({
    "action": "Register",
    "paths": [
        "ScoreBoard.CurrentGame",
        "ScoreBoard.Version(release)",
    ],
})

# ── Fake skater data ──────────────────────────────────────────────────────────
# AlternateName(overlay) is used by the CRG overlay and IS settable mid-game.
ROSTERS = {
    1: {
        "Jammer":   ("Speed Demon",    "88"),
        "Pivot":    ("Iron Curtain",   "22"),
        "Blocker1": ("Brick Wall",     "11"),
        "Blocker2": ("Crash Test",     "33"),
        "Blocker3": ("Ricochet",       "44"),
    },
    2: {
        "Jammer":   ("Lightning Bolt", "7"),
        "Pivot":    ("Storm Front",    "55"),
        "Blocker1": ("Ground Zero",    "66"),
        "Blocker2": ("Shockwave",      "77"),
        "Blocker3": ("Afterburn",      "99"),
    },
}


def _set(key: str, value) -> str:
    return json.dumps({"action": "Set", "key": key, "value": value})


def _sb(suffix: str) -> str:
    return f"ScoreBoard.CurrentGame.{suffix}"


async def seed(ws):
    print("Connected to CRG scoreboard.")
    await asyncio.sleep(0.5)

    # Set position RosterNumbers (these ARE writable on-track positions)
    for team_n, positions in ROSTERS.items():
        for pos, (name, number) in positions.items():
            await ws.send(_set(_sb(f"Team({team_n}).Position({pos}).RosterNumber"), number))
        print(f"  Team {team_n} numbers set.")

    await asyncio.sleep(0.2)
    await ws.send(_set(_sb("StartJam"), True))
    print("Jam 1 started. Auto-restarts jams. Ctrl+C to stop.")


async def main():
    stop           = asyncio.Event()
    state          = {}          # merged live state
    last_in_jam    = None        # track in_jam transitions
    jam_count      = 0
    last_print     = 0.0
    stopping_jam   = False       # guard against double StopJam

    def _sigint(*_):
        stop.set()

    signal.signal(signal.SIGINT,  _sigint)
    signal.signal(signal.SIGTERM, _sigint)

    try:
        async with websockets.connect(URI, ping_interval=None) as ws:
            await ws.send(REGISTER_MSG)
            await seed(ws)

            while not stop.is_set():
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=0.5)
                    data = json.loads(raw)
                    if "state" not in data:
                        continue

                    # Merge patch into our local state mirror
                    for k, v in data["state"].items():
                        if v is None:
                            state.pop(k, None)
                        else:
                            state[k] = v

                    jam_running = state.get(_sb("Clock(Jam).Running"))
                    in_jam      = state.get(_sb("InJam"))
                    jam_ms      = state.get(_sb("Clock(Jam).Time"), 0)
                    per_ms      = state.get(_sb("Clock(Period).Time"), 0)
                    t1_score    = state.get(_sb("Team(1).Score"), 0)
                    t2_score    = state.get(_sb("Team(2).Score"), 0)

                    # If jam clock expired but in_jam is still True, send StopJam
                    if in_jam and not jam_running and jam_ms == 0 and not stopping_jam and not stop.is_set():
                        stopping_jam = True
                        await asyncio.sleep(0.2)
                        await ws.send(_set(_sb("StopJam"), True))
                        print("\n  → StopJam sent (jam clock expired).")

                    # Auto-restart: fire when in_jam transitions True→False (lineup started)
                    if last_in_jam is True and in_jam is False and not stop.is_set():
                        stopping_jam = False
                        await asyncio.sleep(1.0)   # let lineup clock tick briefly
                        if not stop.is_set():
                            jam_count += 1
                            await ws.send(_set(_sb("StartJam"), True))
                            print(f"  → Jam {jam_count + 1} started automatically.")

                    last_in_jam = in_jam

                    # Status line
                    now = time.monotonic()
                    if now - last_print >= 1.0:
                        last_print = now
                        running_str = "LIVE" if jam_running else "lineup"
                        print(
                            f"\r  [{running_str}]  Jam {jam_ms//1000:>3}s  "
                            f"Period {per_ms//1000:>4}s  "
                            f"Score {t1_score}-{t2_score}   ",
                            end="", flush=True,
                        )

                except asyncio.TimeoutError:
                    pass
                except Exception as e:
                    print(f"\nWS error: {e}")
                    break

            print("\nStopping jam...")
            try:
                await ws.send(_set(_sb("StopJam"), True))
                await asyncio.sleep(0.5)
            except Exception:
                pass

    except OSError as e:
        print(f"\nCould not connect to CRG at {URI}: {e}")
        sys.exit(1)

    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
