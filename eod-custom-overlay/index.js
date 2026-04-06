// ═══════════════════════════════════════════════════════════════
// URL PARAMS
//
// Pass the main bar colour as a hex value (# encoded as %23):
//   index.html?home=%231f3264&away=%23ff2100
//
// Optionally add a second colour for the indicator/jammer box:
//   index.html?home=%231f3264&homebg=%23000000&away=%23ff2100&awaybg=%23000000
//
// The `home`/`away` hex is used for the full score bar background.
// WCAG contrast is checked automatically:
//   - Bar text (team name + score) is set to white or black, whichever passes 4.5:1
//   - Lead jammer flash star colour is also contrast-checked
//
// ═══════════════════════════════════════════════════════════════

(function applyUrlParams() {
  var params = new URLSearchParams(window.location.search);

  function applyTeam(teamNum, fgParam, bgParam) {
    var fg = params.get(fgParam);
    var bg = params.get(bgParam);

    if (fg && isValidHex(fg))
      WS.Set(
        "ScoreBoard.CurrentGame.Team(" + teamNum + ").Color(overlay.fg)",
        fg,
      );
    if (bg && isValidHex(bg))
      WS.Set(
        "ScoreBoard.CurrentGame.Team(" + teamNum + ").Color(overlay.bg)",
        bg,
      );

    if (fg && isValidHex(fg)) {
      // Set the full bar row background via CSS custom property (flat colour, no gradient)
      document.documentElement.style.setProperty(
        "--team" + teamNum + "-bar",
        fg,
      );

      // WCAG: pick white or black text for team name + score against the bar colour
      var textColour =
        contrastRatio("#ffffff", fg) >= 4.5 ? "#ffffff" : "#000000";
      document.documentElement.style.setProperty(
        "--team" + teamNum + "-text",
        textColour,
      );

      // WCAG: pick readable flash colour for the lead jammer star
      wcagCheckLeadFlash(teamNum, fg);
    }

    // WCAG: roster number box text — check against the swatch/bg colour.
    // CRG's sbCss sets color:overlay.fg inline on .Number, which would be
    // the team bar colour (often unreadable). We force white by default in
    // CSS (!important) and only flip to black if white fails 4.5:1 vs the bg.
    // Use URL param if present; WS.Register below will re-check on admin change.
    var bgColour =
      bg ||
      WS.state[
        "ScoreBoard.CurrentGame.Team(" + teamNum + ").Color(overlay.bg)"
      ] ||
      "#000000";
    wcagCheckRosterNumber(teamNum, bgColour);
  }

  applyTeam(1, "home", "homebg");
  applyTeam(2, "away", "awaybg");
  maybeAdjustTeamConflict();
})();

// ── Re-run WCAG checks when the admin panel changes colours via WS ────────────
// Without this, setting overlay.bg via the admin (not the URL) defaults to
// #000000, causing white-on-light-grey roster numbers to fail contrast
// (e.g. Hard Dark / EoD Envy / EoD Encore use bg=#b6b6b6).
WS.Register(
  [
    "ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)",
    "ScoreBoard.CurrentGame.Team(1).Color(overlay.bg)",
    "ScoreBoard.CurrentGame.Team(2).Color(overlay.fg)",
    "ScoreBoard.CurrentGame.Team(2).Color(overlay.bg)",
  ],
  function (k) {
    [1, 2].forEach(function (teamNum) {
      var fg =
        WS.state[
          "ScoreBoard.CurrentGame.Team(" + teamNum + ").Color(overlay.fg)"
        ];
      var bg =
        WS.state[
          "ScoreBoard.CurrentGame.Team(" + teamNum + ").Color(overlay.bg)"
        ];

      if (fg && isValidHex(fg)) {
        document.documentElement.style.setProperty(
          "--team" + teamNum + "-bar",
          fg,
        );
        var textColour =
          contrastRatio("#ffffff", fg) >= 4.5 ? "#ffffff" : "#000000";
        document.documentElement.style.setProperty(
          "--team" + teamNum + "-text",
          textColour,
        );
        wcagCheckLeadFlash(teamNum, fg);
      }

      if (bg) {
        wcagCheckRosterNumber(teamNum, bg);
      }
    });
    maybeAdjustTeamConflict();
  },
);

// ═══════════════════════════════════════════════════════════════
// WCAG CONTRAST UTILITIES
//
// The lead jammer indicator flashes red (★) over the team colour
// bar. If the team bar is also red (or very dark/similar hue) the
// flash becomes invisible. This checks the contrast ratio of the
// flash colour against the bar colour (WCAG 2.1) and swaps to a
// high-contrast alternative if it fails the AA threshold (4.5:1).
//
// Flash colours tried in order until one passes:
//   1. White  (#ffffff)
//   2. Yellow (#ffff00)  – useful on dark bars
//   3. Black  (#000000)
// ═══════════════════════════════════════════════════════════════

/** Return true only for 3- or 6-digit hex strings (with or without leading #). */
function isValidHex(hex) {
  return (
    typeof hex === "string" &&
    /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex.trim())
  );
}

function hexToRgb(hex) {
  // Guard: return black on invalid input so NaN never propagates downstream.
  if (!isValidHex(hex)) return { r: 0, g: 0, b: 0 };
  var clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map(function (c) {
        return c + c;
      })
      .join("");
  }
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function relativeLuminance(rgb) {
  var vals = [rgb.r, rgb.g, rgb.b].map(function (v) {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2];
}

function contrastRatio(hex1, hex2) {
  var l1 = relativeLuminance(hexToRgb(hex1));
  var l2 = relativeLuminance(hexToRgb(hex2));
  var lighter = Math.max(l1, l2);
  var darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── Roster number text contrast ───────────────────────────────
// CRG injects color:overlay.fg as an inline style on each .Number
// cell in the roster panel. We override this with CSS !important
// (always white) and only inject a !important black override if
// white fails WCAG 4.5:1 contrast against the swatch background.
var ROSTER_NUM_STYLE_ID = "derby-roster-num-style";

function wcagCheckRosterNumber(teamNum, bgColour) {
  var textColour =
    contrastRatio("#ffffff", bgColour) >= 4.5 ? "#ffffff" : "#000000";

  if (contrastRatio(textColour, bgColour) < 4.5) {
    console.warn(
      "Derby overlay: Team " +
        teamNum +
        " roster number contrast is " +
        contrastRatio(textColour, bgColour).toFixed(2) +
        ":1 against " +
        bgColour +
        ". Neither white nor black passes WCAG AA.",
    );
  }

  var styleId = ROSTER_NUM_STYLE_ID + "-t" + teamNum;
  var existing = document.getElementById(styleId);
  if (existing) existing.remove();

  // Only inject if we need black — white is already the default via CSS
  if (textColour !== "#ffffff") {
    var el = document.createElement("style");
    el.id = styleId;
    el.textContent =
      '.RosterTeam [Team="' +
      teamNum +
      '"] .Number { color: #000000 !important; }';
    document.head.appendChild(el);
  }
}

// ── Lead flash contrast ─────────────────────────────────────────
// Colours are applied via CSS variables --teamN-flash-peak / --teamN-flash-trough
// which are consumed by the @keyframes HasLead_T1 / HasLead_T2 rules in index.css.

function wcagCheckLeadFlash(teamNum, barColour) {
  var candidates = ["#ff0000", "#ffffff", "#ffff00", "#000000"];
  var best = "#ffffff";
  var bestRatio = 0;

  for (var i = 0; i < candidates.length; i++) {
    var ratio = contrastRatio(candidates[i], barColour);
    // WCAG AA large text = 3:1, AA normal = 4.5:1 — we target 4.5
    if (ratio >= 4.5) {
      best = candidates[i];
      break;
    }
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = candidates[i];
    }
  }

  // Warn in console if even the best can't hit AA
  var finalRatio = contrastRatio(best, barColour);
  if (finalRatio < 4.5) {
    console.warn(
      "Derby overlay: Team " +
        teamNum +
        " lead flash contrast is " +
        finalRatio.toFixed(2) +
        ":1 (WCAG AA requires 4.5:1). " +
        "Bar colour: " +
        barColour +
        ", Flash colour: " +
        best,
    );
  }

  // Set CSS variables — the per-team keyframes in index.css read these.
  // peak:   WCAG-checked colour shown at 0%/100% (high contrast against bar)
  // trough: bar colour itself at 50% so text blends in, then pops back
  document.documentElement.style.setProperty(
    "--team" + teamNum + "-flash-peak",
    best,
  );
  document.documentElement.style.setProperty(
    "--team" + teamNum + "-flash-trough",
    barColour,
  );
}

// ── Same-colour team conflict adjustment ─────────────────────────────────────
// When both teams share the same (or very similar) bar colour the two score
// rows are indistinguishable.  This function detects that case (contrast ratio
// between the two bars is < 1.5:1) and automatically lightens the away team
// (T2) bar by ~25% toward white for dark colours, or darkens it by ~25% toward
// black for light colours.  It is called after every colour update so the
// adjustment persists across admin-panel changes.

function blendColours(hex, amount, targetHex) {
  // Blend `hex` toward `targetHex` by `amount` (0 = pure hex, 1 = pure targetHex).
  var c = hexToRgb(hex);
  var t = hexToRgb(targetHex);
  var r = Math.round(c.r + (t.r - c.r) * amount);
  var g = Math.round(c.g + (t.g - c.g) * amount);
  var b = Math.round(c.b + (t.b - c.b) * amount);
  return (
    "#" +
    ("00" + r.toString(16)).slice(-2) +
    ("00" + g.toString(16)).slice(-2) +
    ("00" + b.toString(16)).slice(-2)
  );
}

function maybeAdjustTeamConflict() {
  var t1fg = WS.state["ScoreBoard.CurrentGame.Team(1).Color(overlay.fg)"];
  var t2fg = WS.state["ScoreBoard.CurrentGame.Team(2).Color(overlay.fg)"];
  if (!t1fg || !t2fg) return;

  // Nothing to do if the bars are already distinguishable
  if (contrastRatio(t1fg, t2fg) >= 1.5) return;

  // Dark bar → blend T2 toward white; light bar → blend T2 toward black.
  // Increase the blend amount in steps of 5% until T1 vs adjusted-T2 reaches
  // ≥ 1.5:1 contrast, or we cap out at 50%.  This guarantees the result is
  // always visually distinct even for saturated mid-luminance colours like
  // bright red (#ff2100) where a fixed 25% blend falls short.
  var lum = relativeLuminance(hexToRgb(t2fg));
  var target = lum < 0.3 ? "#ffffff" : "#000000";
  var adjusted;
  for (var amount = 0.25; amount <= 0.55; amount += 0.05) {
    adjusted = blendColours(t2fg, amount, target);
    if (contrastRatio(t1fg, adjusted) >= 1.5) break;
  }

  document.documentElement.style.setProperty("--team2-bar", adjusted);
  var textColour =
    contrastRatio("#ffffff", adjusted) >= 4.5 ? "#ffffff" : "#000000";
  document.documentElement.style.setProperty("--team2-text", textColour);
  wcagCheckLeadFlash(2, adjusted);
}

WS.Register(
  [
    "ScoreBoard.CurrentGame.Clock(Timeout).Running",
    "ScoreBoard.CurrentGame.Clock(*).Name",
    "ScoreBoard.CurrentGame.TimeoutOwner",
    "ScoreBoard.CurrentGame.OfficialReview",
    "ScoreBoard.CurrentGame.Team(*).Timeouts",
    "ScoreBoard.CurrentGame.ClockDuringFinalScore",
  ],
  sbSetActiveTimeout,
);

WS.Register(
  [
    "ScoreBoard.Settings.Setting(Overlay.Interactive.ClockAfterTimeout)",
    "ScoreBoard.CurrentGame.Clock(*).Running",
    "ScoreBoard.CurrentGame.InJam",
  ],
  function (k) {
    _sbClockSelect(
      "ScoreBoard.CurrentGame",
      "Overlay.Interactive.ClockAfterTimeout",
    );
  },
);

WS.Register("ScoreBoard.CurrentGame.Rule(Penalties.NumberToFoulout)");

WS.AfterLoad(function () {
  // Safety net: apply team colours from the initial WS state snapshot.
  // The WS.Register callback above handles delta updates, but AfterLoad
  // ensures colours are applied even if Register fires before the DOM is ready.
  [1, 2].forEach(function (teamNum) {
    var fg =
      WS.state[
        "ScoreBoard.CurrentGame.Team(" + teamNum + ").Color(overlay.fg)"
      ];
    if (fg && isValidHex(fg)) {
      document.documentElement.style.setProperty(
        "--team" + teamNum + "-bar",
        fg,
      );
      var textColour =
        contrastRatio("#ffffff", fg) >= 4.5 ? "#ffffff" : "#000000";
      document.documentElement.style.setProperty(
        "--team" + teamNum + "-text",
        textColour,
      );
      wcagCheckLeadFlash(teamNum, fg);
    }
    var bg =
      WS.state[
        "ScoreBoard.CurrentGame.Team(" + teamNum + ").Color(overlay.bg)"
      ];
    if (bg) wcagCheckRosterNumber(teamNum, bg);
  });
  maybeAdjustTeamConflict();
  $("body").removeClass("preload");
});

function _ovlToggleSetting(s) {
  WS.Set(
    "ScoreBoard.Settings.Setting(Overlay.Interactive." + s + ")",
    !isTrue(
      WS.state["ScoreBoard.Settings.Setting(Overlay.Interactive." + s + ")"],
    ),
  );
}

function _ovlTogglePanel(p) {
  WS.Set(
    "ScoreBoard.Settings.Setting(Overlay.Interactive.Panel)",
    WS.state["ScoreBoard.Settings.Setting(Overlay.Interactive.Panel)"] === p
      ? ""
      : p,
  );
}

function ovlHandleKey(k, v, elem, e) {
  switch (e.which) {
    case 74: // j
      _ovlToggleSetting("ShowJammers");
      break;
    case 76: // l
      _ovlToggleSetting("ShowLineups");
      break;
    case 78: // n
      _ovlToggleSetting("ShowAllNames");
      break;
    case 80: // p
      _ovlToggleSetting("ShowPenaltyClocks");
      break;
    case 67: // c
      _ovlToggleSetting("Clock");
      break;
    case 83: // s
      _ovlToggleSetting("Score");
      break;
    case 48: // 0
      _ovlTogglePanel("PPJBox");
      break;
    case 49: // 1
      _ovlTogglePanel("RosterTeam1");
      break;
    case 50: // 2
      _ovlTogglePanel("RosterTeam2");
      break;
    case 51: // 3
      _ovlTogglePanel("PenaltyTeam1");
      break;
    case 52: // 4
      _ovlTogglePanel("PenaltyTeam2");
      break;
    case 57: // 9
      _ovlTogglePanel("LowerThird");
      break;
    case 85: // u
      _ovlTogglePanel("Upcoming");
      break;
    case 32: // space
      WS.Set("ScoreBoard.Settings.Setting(Overlay.Interactive.Panel)", "");
      break;
  }
}

function ovlToBackground(k, v) {
  return v || "transparent";
}

// ── Team name truncation ──────────────────────────────────────────────────────
// Only truncates to the first word when the name is longer than 28 characters
// (roughly where names start overflowing the 67%-wide Name box at 1080p).
// Short and medium names (e.g. "EoD Envy", "West Sound", "Saskatoon") are
// shown in full. Very long names (e.g. "Denver Roller Derby") → "Denver".
var TEAM_NAME_MAX = 28;
function ovlToFirstWord(k, v) {
  if (!v || v.length <= TEAM_NAME_MAX) return v;
  var firstSpace = v.indexOf(" ");
  return firstSpace === -1 ? v : v.substring(0, firstSpace);
}

function ovlToIndicator(k, v) {
  var prefix = k.substring(0, k.lastIndexOf("."));
  return isTrue(WS.state[prefix + ".StarPass"])
    ? "SP"
    : isTrue(WS.state[prefix + ".Lost"])
      ? ""
      : isTrue(WS.state[prefix + ".Lead"])
        ? "★"
        : "";
}

function ovlIsJamming(k, v, elem) {
  return (
    (isTrue(v) && elem.attr("Position") === "Pivot") ||
    (!isTrue(v) && elem.attr("Position") === "Jammer")
  );
}

function ovlToPpjColumnWidth(k, v, elem) {
  var ne1 = $('.PPJBox [Team="1"] .GraphBlock').length;
  const ne2 = $('.PPJBox [Team="2"] .GraphBlock').length;
  if (ne2 > ne1) {
    ne1 = ne2;
  }
  const wid = parseInt(elem.parent().parent().innerWidth());
  if (ne1 === 0) return 0;
  const newWidth = parseInt(wid / ne1) - 4;
  $(".ColumnWidth").css("width", newWidth);

  return newWidth;
}

function ovlToPpjMargin(k, v, elem) {
  // k is the full WS state key string, e.g. "ScoreBoard.CurrentGame.Team(2)...."
  // Extract the Team number from the key to determine bar direction.
  var teamMatch = /Team\((\d+)\)/.exec(k);
  if (teamMatch && teamMatch[1] === "2") {
    return 0;
  }
  return parseInt(elem.parent().innerHeight()) - v * 4;
}

function ovlToLowerThirdColorFg() {
  return _ovlToLowerThirdColor("overlay.fg");
}

function ovlToLowerThirdColorBg() {
  return _ovlToLowerThirdColor("overlay.bg");
}

function _ovlToLowerThirdColor(type) {
  switch (
    WS.state[
      "ScoreBoard.Settings.Setting(Overlay.Interactive.LowerThird.Style)"
    ]
  ) {
    case "ColourTeam1":
      return (
        WS.state["ScoreBoard.CurrentGame.Team(1).Color(" + type + ")"] || ""
      );
    case "ColourTeam2":
      return (
        WS.state["ScoreBoard.CurrentGame.Team(2).Color(" + type + ")"] || ""
      );
    default:
      return "";
  }
}

function ovlToClockType() {
  var ret = "";
  const to = WS.state["ScoreBoard.CurrentGame.TimeoutOwner"];
  const or = WS.state["ScoreBoard.CurrentGame.OfficialReview"];
  const tc = WS.state["ScoreBoard.CurrentGame.Clock(Timeout).Running"];
  const lc = WS.state["ScoreBoard.CurrentGame.Clock(Lineup).Running"];
  const ic = WS.state["ScoreBoard.CurrentGame.Clock(Intermission).Running"];
  const jc = WS.state["ScoreBoard.CurrentGame.InJam"];

  if (jc) {
    ret = "Jam";
    $(".ClockDescription").css("backgroundColor", "#444");
  } else if (lc) {
    ret = WS.state["ScoreBoard.CurrentGame.Clock(Lineup).Name"];
    $(".ClockDescription").css("backgroundColor", "#444");
  } else if (tc) {
    ret = WS.state["ScoreBoard.CurrentGame.Clock(Timeout).Name"];
    if (to !== "" && to !== "O" && or) {
      ret = "Official Review";
    }
    if (to !== "" && to !== "O" && !or) {
      ret = "Team Timeout";
    }
    if (to === "O") {
      ret = "Official Timeout";
    }
    $(".ClockDescription").css("backgroundColor", "#c0392b");
  } else if (ic) {
    const num = WS.state["ScoreBoard.CurrentGame.Clock(Intermission).Number"];
    const max = WS.state["ScoreBoard.CurrentGame.Rule(Period.Number)"];
    const isOfficial = WS.state["ScoreBoard.CurrentGame.OfficialScore"];
    const showDuringOfficial =
      WS.state["ScoreBoard.CurrentGame.ClockDuringFinalScore"];
    if (isOfficial) {
      if (showDuringOfficial) {
        ret =
          WS.state[
            "ScoreBoard.Settings.Setting(ScoreBoard.Intermission.OfficialWithClock)"
          ];
      } else {
        ret =
          WS.state[
            "ScoreBoard.Settings.Setting(ScoreBoard.Intermission.Official)"
          ];
      }
    } else if (num == 0) {
      ret =
        WS.state[
          "ScoreBoard.Settings.Setting(ScoreBoard.Intermission.PreGame)"
        ];
    } else if (num != max) {
      ret =
        WS.state[
          "ScoreBoard.Settings.Setting(ScoreBoard.Intermission.Intermission)"
        ];
    } else {
      ret =
        WS.state[
          "ScoreBoard.Settings.Setting(ScoreBoard.Intermission.Unofficial)"
        ];
    }

    $(".ClockDescription").css("backgroundColor", "#1a4a8a");
  } else {
    ret = "Coming Up";
    $(".ClockDescription").css("backgroundColor", "#1a4a8a");
  }

  return ret;
}
