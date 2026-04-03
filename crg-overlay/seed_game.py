#!/usr/bin/env python3
"""
seed_game.py – Push a test game state into CRG via WebSocket.

Usage:
  python3 seed_game.py [--host HOST] [--port PORT]

Defaults to localhost:8002.

Sets up:
  Team 1: Denver  (#1f3264 / #000000)
  Team 2: Saskatoon (#ff2100 / #000000)
  Scores: 42 – 38  (for visual testing)
  Period 2, Jam 14
"""

import asyncio
import json
import sys
import argparse

try:
    import websockets
except ImportError:
    print("Installing websockets...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets

LEAGUE_PRESETS = {
    "Denver":    {"fg": "#1f3264", "bg": "#000000"},
    "Faultline": {"fg": "#0096bc", "bg": "#000000"},
    "GVRDA":     {"fg": "#000000", "bg": "#ffffff"},
    "HardDark":  {"fg": "#12325e", "bg": "#b6b6b6"},
    "Saskatoon": {"fg": "#ff2100", "bg": "#000000"},
    "WestSound": {"fg": "#bf4c0d", "bg": "#6a306d"},
    "EoDEnvy":   {"fg": "#12325e", "bg": "#b6b6b6"},
    "EoDEncore": {"fg": "#12325e", "bg": "#b6b6b6"},
}


def build_set(key, value):
    """Build a CRG WebSocket set message."""
    return json.dumps({"action": "Set", "key": key, "value": str(value)})


async def seed(host, port, team1_league, team2_league, team1_name=None, team2_name=None):
    uri = f"ws://{host}:{port}/WS"
    print(f"Connecting to CRG at {uri} ...")

    t1 = LEAGUE_PRESETS[team1_league]
    t2 = LEAGUE_PRESETS[team2_league]
    t1_display = team1_name or team1_league
    t2_display = team2_name or team2_league

    commands = [
        # Team names
        ("ScoreBoard.PreparedTeam(1).Name", t1_display),
        ("ScoreBoard.PreparedTeam(2).Name", t2_display),

        # Overlay display names (shown on stream banner)
        ("ScoreBoard.CurrentGame.Team(1).AlternateName(overlay)", t1_display),
        ("ScoreBoard.CurrentGame.Team(2).AlternateName(overlay)", t2_display),

        # Team colours
        ("ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)", t1["fg"]),
        ("ScoreBoard.CurrentGame.Team(1).Color(overlay.bg)", t1["bg"]),
        ("ScoreBoard.CurrentGame.Team(2).Color(overlay.fg)", t2["fg"]),
        ("ScoreBoard.CurrentGame.Team(2).Color(overlay.bg)", t2["bg"]),

        # Overlay settings – show score and clock
        ("ScoreBoard.Settings.Setting(Overlay.Interactive.Score)", "true"),
        ("ScoreBoard.Settings.Setting(Overlay.Interactive.Clock)", "true"),
    ]

    async with websockets.connect(uri) as ws:
        # Register to get initial state
        await ws.send(json.dumps({"action": "Register", "paths": ["ScoreBoard"]}))
        # Give it a moment to send state back
        try:
            await asyncio.wait_for(ws.recv(), timeout=2.0)
        except asyncio.TimeoutError:
            pass

        for key, value in commands:
            msg = build_set(key, value)
            await ws.send(msg)
            print(f"  SET {key} = {value}")
            await asyncio.sleep(0.05)

    def enc(c):
        return c.replace('#', '%23')

    overlay_url = (
        f"http://{host}:{port}/custom/derby-overlay/index.html"
        f"?home={enc(t1['fg'])}&homebg={enc(t1['bg'])}"
        f"&away={enc(t2['fg'])}&awaybg={enc(t2['bg'])}"
    )

    print(f"\n✅ Done! Open CRG at http://{host}:{port}/")
    print(f"\n   Custom overlay URL:")
    print(f"   {overlay_url}")
    print(f"\n   Admin panel:    http://{host}:{port}/custom/derby-overlay/admin/index.html")
    print(f"   Stock overlay:  http://{host}:{port}/views/overlay/index.html")
    print(f"\n   Swap colours by changing home/away hex in the URL (#=%%23).")


def main():
    parser = argparse.ArgumentParser(description="Seed CRG with a test game")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", default=8002, type=int)
    parser.add_argument("--team1", default="Denver", choices=list(LEAGUE_PRESETS.keys()))
    parser.add_argument("--team2", default="Saskatoon", choices=list(LEAGUE_PRESETS.keys()))
    parser.add_argument("--name1", default=None, help="Override display name for team 1")
    parser.add_argument("--name2", default=None, help="Override display name for team 2")
    args = parser.parse_args()

    asyncio.run(seed(args.host, args.port, args.team1, args.team2, args.name1, args.name2))


if __name__ == "__main__":
    main()
