````markdown
# EoD Custom Overlay for CRG ScoreBoard

A custom broadcast overlay for [CRG ScoreBoard](https://github.com/rollerderby/crg).  
Team bar colours update live, text contrast is automatically optimized.  
**Includes optional auto-update feature** — the overlay can pull the latest changes from this repo on a schedule you set.

---

## Quick Start (Drag & Drop Installation)

### Step 1: Download the overlay
Clone or download this entire repository. You'll get a folder called `eod-custom-overlay/`.

### Step 2: Copy into CRG
Copy the **entire `eod-custom-overlay/` folder** into your CRG installation:

```
<CRG root>/html/custom/eod-custom-overlay/
```

Your CRG root is wherever you unzipped CRG — it contains the `lib/crg-scoreboard.jar` file.  
The `html/custom/` folder may not exist yet; create it if needed.

### Step 3: Restart CRG
Start CRG normally (double-click `scoreboard.sh` on Mac/Linux, or the `.bat` / `.exe` on Windows).

✅ **That's it! CRG will find the overlay automatically.**

---

## Open the Admin Panel

In any web browser (on the CRG computer or any device on the same network):

```
http://<CRG-IP>:8000/custom/eod-custom-overlay/admin/index.html
```

The admin panel shows a live preview of the overlay and lets you customize colours and elements.

---

## Give the Overlay URL to Your Stream Operator

For OBS / vMix as a Browser Source:

```
http://<CRG-IP>:8000/custom/eod-custom-overlay/index.html?home=%23HEX&away=%23HEX
```

Replace `HEX` with the team's brand colour (e.g. `%231f3264` for navy `#1f3264`).

> **Default port is 8000.** If your CRG runs on a different port, swap it in the URLs above.

---

## Optional: Auto-Update Setup

The overlay can automatically pull the latest changes from this repository on a schedule. This is **completely optional** — you don't need to do this if you prefer to update manually.

### How it works

- The updater runs **independently** from CRG (not part of the CRG app).
- It pulls changes from GitHub on the schedule you set.
- All update files stay in the `eod-custom-overlay/` folder — **nothing interferes with CRG**.
- CRG only sees the overlay HTML/CSS/JS files; it ignores everything else.

### Enable auto-updates (Windows)

1. **Open `updater.config.json`** in the `eod-custom-overlay/` folder.
2. Set your update mode:

   ```json
   {
     "mode": "scheduled",        ← Change from "manual" to "scheduled"
     "interval_minutes": 60,     ← Update every 60 minutes (change as needed)
     "branch": "main",           ← Branch to pull from (default: main)
     "notify": true              ← Show notifications (optional)
   }
   ```

3. **Double-click `Run-Updater.cmd`** to start the auto-update service.
   - A command window will pop up and run the updater in the background.
   - You can close the window; the service keeps running.

4. **To stop auto-updates**, double-click `Stop-Updater.cmd`.

### Enable auto-updates (Mac/Linux or Git Bash on Windows)

1. **Open `updater.config.json`** and set `mode` to `"scheduled"`.
2. **Open a terminal** in the `eod-custom-overlay/` folder.
3. Run:

   ```bash
   bash scripts/auto-update-overlay.sh
   ```

4. The script will run in the background and pull updates on your schedule.

### Manual updates (no auto-update setup needed)

If you don't want to set up auto-updates, you can still update manually anytime:

**Windows:**  
Double-click `Run-Updater.cmd` whenever you want the latest changes.

**Mac/Linux or Git Bash:**  
```bash
bash scripts/update-overlay.sh
```

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
eod-custom-overlay/
├── index.html              ← Broadcast overlay (load in OBS as Browser Source)
├── index.css               ← Custom styles; bar colours via CSS vars
├── index.js                ← URL param handler + contrast utilities
├── admin/
│   ├── index.html          ← Admin panel (open in browser during the game)
│   ├── index.css           ← Admin panel styles
│   └── index.js            ← League presets + live preview
├── preview.html            ← Preview mode (dev use)
├── updater.config.json     ← Auto-update settings (optional)
├── Run-Updater.cmd         ← Windows: start auto-updates (double-click)
├── Stop-Updater.cmd        ← Windows: stop auto-updates (double-click)
├── scripts/
│   ├── update-overlay.sh   ← Bash: manual update
│   └── auto-update-overlay.sh ← Bash: scheduled auto-update
├── .git/                   ← Git repo (ignore this, CRG doesn't use it)
├── .gitignore              ← Ignore logs and runtime files
└── README.md               ← This file
```

---

## Will this affect my CRG installation?

**No.** CRG only loads:
- `index.html` — the broadcast overlay
- `index.css` — the styles  
- `index.js` — the overlay logic
- `admin/` — the admin panel

CRG completely ignores:
- `.git/` — the Git repository folder
- `.docs/` — internal maintainer documentation (hidden folder)
- `scripts/` — the update scripts
- `updater.config.json` — the update configuration
- `logs/` and `runtime/` — temporary update files
- Everything else

**Result: Plug and play.** Drag the entire `eod-custom-overlay/` folder into `html/custom/`. CRG sees only the overlay. All the updater files are invisible and inert.

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
