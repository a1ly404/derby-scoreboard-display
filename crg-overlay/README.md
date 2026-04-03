# Derby CRG Overlay

A custom broadcast overlay for [CRG ScoreBoard](https://github.com/rollerderby/crg).  
Team bar colours update live, text contrast is WCAG-checked automatically.

---

## How to install on a CRG computer

1. Copy the **entire `crg-overlay/` folder** into your CRG installation at:

   ```
   <CRG root>/html/custom/derby-overlay/
   ```

   Your CRG root is wherever you unzipped CRG — it contains the `lib/crg-scoreboard.jar` file.  
   The `html/custom/` folder may not exist yet; create it if needed.

2. Start CRG normally (double-click `scoreboard.sh` on Mac/Linux, or the `.exe` on Windows).

3. Open the **admin panel** in any browser (on the CRG computer or any device on the same network):

   ```
   http://<CRG-IP>:8000/custom/derby-overlay/admin/index.html
   ```

   The admin panel shows a live preview of the overlay on the right side of the screen.

4. Give the **overlay URL** to your stream operator to load in OBS/vMix as a Browser Source:

   ```
   http://<CRG-IP>:8000/custom/derby-overlay/index.html?home=%23HEX&away=%23HEX
   ```

   Replace `HEX` with the team's brand colour (e.g. `%231f3264` for navy `#1f3264`).

> **Default port is 8000.** If your CRG runs on a different port, swap it in the URLs above.

---

## URL parameters

| Parameter | What it sets | Example |
|-----------|-------------|---------|
| `home` | Team 1 bar colour (full row) | `home=%231f3264` → navy |
| `away` | Team 2 bar colour (full row) | `away=%23ff2100` → red |
| `homebg` | Team 1 indicator square + jammer box colour | `homebg=%23000000` |
| `awaybg` | Team 2 indicator square + jammer box colour | `awaybg=%23000000` |

**`#` must be URL-encoded as `%23`** — so `#ff2100` becomes `%23ff2100`.

Full example:
```
index.html?home=%231f3264&homebg=%23000000&away=%23ff2100&awaybg=%23000000
```

### Automatic contrast

- **Bar text** (team name + score) is automatically set to **white or black**, whichever passes WCAG 4.5:1 contrast against the bar colour.
- **Lead jammer flash** (★) colour is also contrast-checked and auto-selected from `red → white → yellow → black`.
- If no valid colour passes 4.5:1, the best available option is used and a warning is logged to the browser console.

---

## Admin panel walkthrough

Open `http://<CRG-IP>:8000/custom/derby-overlay/admin/index.html`

| Section | What it does |
|---------|-------------|
| **League Colours** | Pick from pre-loaded league presets for T1 or T2. Selecting a league instantly updates the live preview and pushes the colour into CRG. The swatch row below the dropdowns shows the current colours. |
| **Custom hex** | Colour picker + text box for a fully custom bar colour. Use either the colour picker wheel or type a hex like `#ff2100`. Updates the preview live. |
| **Elements** | Toggle the clock, score, jammers, full lineups, skater names, and penalty clocks on/off. Each button shows a green/red indicator for its current state. Keyboard shortcuts are shown in `[brackets]`. |
| **Panels** | Open info panels over the broadcast: Points per Jam, Roster (T1/T2), Penalties (T1/T2), Lower Third, or Upcoming game. Select the panel you want, then click the button to show/hide it. |
| **Team Display** | Directly edit team names and fine-tune `overlay.fg` / `overlay.bg` colours using the built-in CRG colour pickers. The `X` button resets a colour back to default. |
| **Scaling** | Scale the overlay up or down (50–200%) for different stream resolutions. |
| **Background** | Switch the overlay background between transparent (for OBS chroma key) and solid green. |
| **Clock After Timeout** | Choose whether the clock shown after a timeout is the Lineup clock or the Timeout clock. |
| **Preview Size** | Set the preview iframe dimensions to match your stream resolution (default 1920×1080). |

---

## League colour presets

| League | Bar colour | Alt colour |
|--------|-----------|------------|
| Denver | `#1f3264` navy | `#000000` black |
| Faultline | `#0096bc` teal | `#000000` black |
| GVRDA | `#000000` black | `#ffffff` white |
| Hard Dark | `#12325e` dark blue | `#b6b6b6` silver |
| Saskatoon | `#ff2100` red | `#000000` black |
| West Sound | `#bf4c0d` burnt orange | `#6a306d` purple |
| EoD Envy | `#12325e` dark blue | `#b6b6b6` silver |
| EoD Encore | `#12325e` dark blue | `#b6b6b6` silver |

---

## Files

```
crg-overlay/
├── index.html          ← Broadcast overlay (load in OBS as Browser Source)
├── index.css           ← Custom dark styles; bar colours via CSS vars
├── index.js            ← URL param handler + WCAG contrast utilities
├── admin/
│   ├── index.html      ← Admin panel (open in browser during the game)
│   ├── index.css       ← Admin panel styles
│   └── index.js        ← League presets + live preview CSS injection
└── seed_game.py        ← (Dev only) push test game state via WebSocket
```

---

## Running locally for development

Requires Java 17+ and Ant. From the CRG source root:

```bash
# Build CRG jar (first time only)
ant release

# Start CRG on a free port
export PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH
java -jar lib/crg-scoreboard.jar --port=8002

# Seed test data (in a second terminal)
cd html/custom/derby-overlay
python3 seed_game.py
```

Then open `http://localhost:8002/custom/derby-overlay/admin/index.html`.
