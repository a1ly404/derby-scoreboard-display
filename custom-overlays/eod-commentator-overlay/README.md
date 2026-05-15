# EoD Commentator Overlay for CRG ScoreBoard

Full-screen roster display for commentators. Shows all skaters for both teams in a split-screen layout with large, readable numbers and names.

## Installation

Copy the **entire `eod-commentator-overlay/` folder** into your CRG installation:

```
<CRG root>/html/custom/view/eod-commentator-overlay/
```

Then open in a browser or add as a Browser Source in OBS:

```
http://<CRG-IP>:8000/custom/view/eod-commentator-overlay/index.html
```

## What it shows

- Two-column split screen — one half per team
- Team names (large, uppercase, bold)
- All rostered skaters with jersey number (yellow, 3.5rem) and name (white, 1.8rem)
- Dark theme for easy reading on a monitor
- Skaters not in the game are automatically hidden
- Roster updates live via CRG WebSocket — no manual refresh needed

## Related

For the **broadcast score overlay** (team bars, clocks, lead jammer flash), see [`eod-custom-overlay/`](../eod-custom-overlay/).