# derby-scoreboard-display

Single-file live display and test harness for the
[`derby-scoreboard-api`](../derby-scoreboard-api).

Polls `/live` at 200 ms (configurable) with zero build steps.
Open `index.html` directly in a browser — no server, no install.

---

## Quick start

1. Start the API:
   ```
   cd ../derby-scoreboard-api
   python main.py
   ```

2. Open `index.html` in Chrome / Edge / Firefox.

3. Set the **API Base URL** (default `http://localhost:5001`) and click **Connect**.

The display starts polling immediately and auto-saves your URL/interval to localStorage.

---

## What you get

| Section | Purpose |
|---|---|
| Config bar | Set API URL + poll interval, connect / disconnect |
| Health bar | Connection state, SB version, state age, latency avg/p95, error count |
| Disconnect banner | Full-width red banner when `connected=false`, stale-age counter |
| Game meta | Game state badge, period/jam number, jam clock (cyan = running), period clock |
| Team panels | Score, jam score, lead ★ / lost / calloff / star pass badges, power jam badge |
| Skater rows | Position label (swaps on star pass), number, name, box timer bar |
| Alert log | Rate-limited event log (2 s minimum between duplicate alerts) |
| Test harness | 16 live detectors + 12 scenario cards (expand with ▶) |
| Raw inspector | Auto-refreshing /live JSON or manual /raw snapshot |

---

## Box timer display states

| `in_box` | `box_time_remaining_s` | Display |
|---|---|---|
| `false` | `null` | *(nothing)* |
| `true` | `null` | **IN BOX · timer unknown** (reconnected mid-jam — no false→true transition seen) |
| `true` | `> 0` | Countdown + draining bar |
| `true` | `0` | **TIME EXPIRED** (blinking orange — NSO has not yet released skater) |

A `TIME EXPIRED` skater still in the box is the primary **double-penalty indicator**.

---

## Star pass logic

`star_pass=true` on a team means the pivot is now the acting jammer.
The API does **not** swap the jammer/pivot fields — it exposes `star_pass` as a flag.
The display handles the swap visually:

- Pivot row → labelled **JAMMER (SP)**
- Jammer row → labelled **PIVOT (SP)**
- Box timer follows the physical position (`Position(Pivot).PenaltyBox`)

---

## Pre-game livestream checklist

```
[ ] /health returns connected: true and a scoreboard version
[ ] Scores on display match CRG scoreboard screen
[ ] Jam clock counts down and turns cyan when running
[ ] Star pass: SP badge appears, jammer/pivot labels swap
[ ] Box timer: starts at 30s, drains to 0
[ ] Double penalty: send boxed skater back in — timer resets to 30s
[ ] Both jammers in box: two independent timers, "both jammers" detector fires
[ ] Power jam: POWER JAM badge on benefiting team, detector active
[ ] Star pass + pivot boxed: critical alert fires
[ ] API disconnect: red banner, error count increments, no crash
[ ] API restart: banner clears, polling resumes normally
[ ] Latency p95 < 50 ms on localhost (check health bar)
[ ] state_age stays < 1 s during an active jam
[ ] 503 from API (scoreboard disconnected): alert logged, no JS crash
[ ] Period end: game_state badge transitions, period clock shows 0:00
```

---

## Known edge cases the harness watches

| Detector | What it catches |
|---|---|
| Expired box timer | `box_time_remaining_s == 0` while `in_box == true` — NSO may be about to issue a second penalty |
| Both jammers in box | Dual independent timers — neither team has lead |
| Power jam | One jammer in box, other free — power jam badge on benefiting team |
| Star pass + pivot boxed | Acting jammer is in the box — critical state for power jam combination |
| Lead + Lost simultaneously | Should not happen — data integrity check |
| Scoreboard frozen | `state_age_seconds > 3` while `connected: true` |
| Score regression | Score decreased — could be operator correction or a bug |
| Null team name | `team.name == null` — display must not crash |
| Negative jam clock | Indicates a data mapping issue in the API or CRG |
| Jam clock > 2 min | 120 000 ms max expected — overflow or test data |
| Timer unknown | Skater in box when client reconnected — entry time not known until exit+re-entry |
