# EoD Custom Overlay Repository – Branch Guide

This repository contains two distinct overlays for CRG ScoreBoard, each on its own branch.

## Main Branch: `main`

**EoD Custom Overlay** — Standard broadcast overlay with team-colored bars.

- Team score bars at top left (fully colored, customizable)
- Live score, jammer information, timeouts
- Admin panel for live customization of colors and elements
- Optional auto-update system
- Auto-pulls updates from `main` branch

**URL:** `http://<CRG-IP>:8000/custom/eod-custom-overlay/index.html`

---

## Commentator Branch: `eod-commentator-overlay`

**EoD Commentator Overlay** — Full-screen roster display for booth commentary.

- Split-screen layout: Team 1 on left, Team 2 on right
- Large team names (4.5rem, ALL CAPS)
- Skater numbers in yellow (3.5rem), names in white (1.8rem, ALL CAPS)
- 2-column grid layout per team for readability
- Dark theme (no color customization)
- Optional auto-update system
- Auto-pulls updates from `eod-commentator-overlay` branch

**URL:** `http://<CRG-IP>:8000/custom/eod-commentator-overlay/index.html`

---

## How to Use

### Install the main broadcast overlay:
```bash
git clone https://github.com/a1ly404/eod-custom-overlay.git ~/CRG/html/custom/eod-custom-overlay/
cd ~/CRG/html/custom/eod-custom-overlay/
git checkout main
```

### Install the commentator overlay:
```bash
git clone https://github.com/a1ly404/eod-custom-overlay.git ~/CRG/html/custom/eod-commentator-overlay/
cd ~/CRG/html/custom/eod-commentator-overlay/
git checkout eod-commentator-overlay
```

### Enable auto-updates for either overlay:

Each branch automatically pulls from its own branch:
- `main` updaters watch the `main` branch
- `eod-commentator-overlay` updaters watch the `eod-commentator-overlay` branch

Configure in `updater.config.json`:
```json
{
  "mode": "scheduled",
  "checkIntervalSeconds": 300,
  "branch": "main",        ← For main branch
  "branch": "eod-commentator-overlay"  ← For commentator branch
}
```

---

## File Manifest

Both branches share the same structure:
```
├── index.html                 ← Main overlay file
├── index.css                  ← Styling (different per branch)
├── index.js                   ← Logic (shared base, branch-specific)
├── admin/                     ← Admin panel (main branch only)
├── updater.config.json        ← Update configuration
├── Run-Updater.cmd            ← Windows updater entry
├── Run-Updater.ps1            ← Windows PowerShell script
├── scripts/
│   ├── Update-Overlay.ps1     ← Manual update (PowerShell)
│   ├── Auto-Update-Overlay.ps1 ← Scheduled update (PowerShell)
│   ├── update-overlay.sh      ← Manual update (Bash)
│   └── auto-update-overlay.sh ← Scheduled update (Bash)
└── README.md                  ← Setup guide
```

---

## Technical Details

**Branch-specific differences:**
- `index.css`: Main = team colors + broadcast styling | Commentator = dark theme + roster grid
- `index.html`: Main = score bar + panels | Commentator = full-screen split roster
- `updater.config.json`: Branch name differs per branch
- `admin/`: Main branch only (commentator overlay has no admin panel)

**Shared files:**
- `index.js`: Base event handling (branches may diverge)
- `updater` scripts: Portable, read config for branch name
- `.git/`: Each install gets its own git repo and can pull independently

---

## Support

For questions or issues, check the README in each branch or open an issue on GitHub.
