// ─────────────────────────────────────────────
// League colour presets
// fg = main bar colour (full row background + WCAG text auto-picks white/black)
// bg = alt colour (indicator square + jammer box background)
// ─────────────────────────────────────────────
var leaguePresets = {
  Denver:    { name: 'Denver',       fg: '#1f3264', bg: '#000000' },
  Faultline: { name: 'Faultline',    fg: '#0096bc', bg: '#000000' },
  GVRDA:     { name: 'GVRDA',        fg: '#000000', bg: '#ffffff' },
  HardDark:  { name: 'Hard Dark',    fg: '#12325e', bg: '#b6b6b6' },
  Saskatoon: { name: 'Saskatoon',    fg: '#ff2100', bg: '#000000' },
  WestSound: { name: 'West Sound',   fg: '#bf4c0d', bg: '#6a306d' },
  EoDEnvy:   { name: 'EoD Envy',     fg: '#12325e', bg: '#b6b6b6' },
  EoDEncore: { name: 'EoD Encore',   fg: '#12325e', bg: '#b6b6b6' },
};

// ─────────────────────────────────────────────
// WCAG helpers (mirrored from index.js so admin
// can compute contrast without touching the iframe)
// ─────────────────────────────────────────────
function _adminHexToRgb(hex) {
  var clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map(function(c){ return c+c; }).join('');
  return { r: parseInt(clean.slice(0,2),16), g: parseInt(clean.slice(2,4),16), b: parseInt(clean.slice(4,6),16) };
}
function _adminLuminance(rgb) {
  return [rgb.r, rgb.g, rgb.b].reduce(function(acc, v, i) {
    v = v / 255;
    v = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return acc + v * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}
function _adminContrast(hex1, hex2) {
  var l1 = _adminLuminance(_adminHexToRgb(hex1));
  var l2 = _adminLuminance(_adminHexToRgb(hex2));
  return (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
}
function _adminBestText(barHex) {
  return _adminContrast('#ffffff', barHex) >= _adminContrast('#000000', barHex) ? '#ffffff' : '#000000';
}

// ─────────────────────────────────────────────
// Push bar colour into the preview iframe's CSS
// variables so the live preview reflects the choice
// immediately — same logic as index.js URL params.
// ─────────────────────────────────────────────
function pushBarColourToPreview(team, fgHex) {
  var iframe = document.querySelector('#Preview iframe');
  if (!iframe || !iframe.contentDocument) return;
  var root = iframe.contentDocument.documentElement;
  root.style.setProperty('--team' + team + '-bar', fgHex);
  root.style.setProperty('--team' + team + '-text', _adminBestText(fgHex));
}

function applyLeaguePreset(team, leagueKey) {
  if (!leagueKey) return;
  var preset = leaguePresets[leagueKey];
  if (!preset) return;

  WS.Set('ScoreBoard.CurrentGame.Team(' + team + ').Color(overlay.fg)', preset.fg);
  WS.Set('ScoreBoard.CurrentGame.Team(' + team + ').Color(overlay.bg)', preset.bg);

  // Push bar colour + WCAG text into the live preview iframe
  pushBarColourToPreview(team, preset.fg);

  // Update swatch display
  var swFg   = document.getElementById('SwatchT' + team + 'fg');
  var swBg   = document.getElementById('SwatchT' + team + 'bg');
  var swName = document.getElementById('SwatchT' + team + 'name');
  if (swFg)   swFg.style.background = preset.fg;
  if (swBg)   swBg.style.background = preset.bg;
  if (swName) swName.textContent     = preset.name;
}

// Called by the custom hex colour inputs in the League Colours panel
function applyCustomColour(team, fgHex) {
  if (!fgHex || !/^#[0-9a-fA-F]{6}$/.test(fgHex)) return;
  WS.Set('ScoreBoard.CurrentGame.Team(' + team + ').Color(overlay.fg)', fgHex);
  pushBarColourToPreview(team, fgHex);

  // Update swatch
  var swFg   = document.getElementById('SwatchT' + team + 'fg');
  var swName = document.getElementById('SwatchT' + team + 'name');
  if (swFg)   swFg.style.background = fgHex;
  if (swName) swName.textContent     = fgHex;

  // Deselect any preset dropdown
  var sel = document.getElementById('PresetTeam' + team);
  if (sel) sel.value = '';
}

// ─────────────────────────────────────────────
// Original admin JS (unchanged from CRG overlay)
// ─────────────────────────────────────────────
var nextPanel = '';
var currrentPanel = '';

(function () {
  $('#PanelSelect').val('');
  $('#Preview>iframe').css('width', $('#PreviewSize [dim="width"]').val()).css('height', $('#PreviewSize [dim="height"]').val());
})();

function ovaKeyHandler(k, v, elem, e) {
  var tag = e.target.tagName.toLowerCase();
  var c = String.fromCharCode(e.keyCode || e.charCode).toUpperCase();
  if (e.keyCode === 27) {
    $('body').focus();
    e.preventDefault();
    return false;
  }
  if (tag !== 'input' && tag !== 'textarea') {
    $('[data-key="' + c + '"]').each(function () {
      var $t = $(this);
      if ($t.prop('tagName') === 'OPTION') {
        $t.attr('selected', 'selected').parent().trigger('change');
      }
      if ($t.prop('tagName') === 'BUTTON') {
        $t.trigger('click');
      }
    });
    e.preventDefault();
  }
}

function ovaLineups() {
  return (
    isTrue(WS.state['ScoreBoard.Settings.Setting(ScoreBoard.Penalties.UseLT)']) &&
    isTrue(WS.state['ScoreBoard.Settings.Setting(Overlay.Interactive.ShowLineups)'])
  );
}

function ovaNoLineups() {
  return !ovaLineups;
}

function ovaNobody() {
  return ovaNoLineups && !isTrue(WS.state['ScoreBoard.Settings.Setting(Overlay.Interactive.ShowJammers)']);
}

function ovaUpdatePanel(k, v, elem) {
  currrentPanel = v;
  elem.toggleClass('changed', currrentPanel !== nextPanel);
  return currrentPanel !== '';
}

function ovaSelectPanel(k, v) {
  if (v !== nextPanel) {
    nextPanel = v;
    $('#PanelSet').toggleClass('changed', nextPanel !== currrentPanel);
    $('#LowerThirdControls').toggleClass('sbHide', nextPanel !== 'LowerThird');
  }
}

function ovaSelectLowerThird(k, v, elem) {
  const option = elem.children('option[value="' + v + '"]');
  WS.Set('ScoreBoard.Settings.Setting(Overlay.Interactive.LowerThird.Line1)', option.attr('data-line1'));
  WS.Set('ScoreBoard.Settings.Setting(Overlay.Interactive.LowerThird.Line2)', option.attr('data-line2'));
  WS.Set('ScoreBoard.Settings.Setting(Overlay.Interactive.LowerThird.Style)', option.attr('data-style'));
}

function ovaAddKeeper() {
  const line1 = WS.state['ScoreBoard.Settings.Setting(Overlay.Interactive.LowerThird.Line1)'];
  const line2 = WS.state['ScoreBoard.Settings.Setting(Overlay.Interactive.LowerThird.Line2)'];
  const style = WS.state['ScoreBoard.Settings.Setting(Overlay.Interactive.LowerThird.Style)'];

  $('<option>')
    .attr('data-line1', line1)
    .attr('data-line2', line2)
    .attr('data-style', style)
    .attr('value', '_' + Math.random().toString(36).substring(2, 11))
    .text(line1 + '/' + line2 + ' (' + style + ')')
    .appendTo('#Keepers');
}

function ovaGetNextPanel() {
  return nextPanel === currrentPanel ? '' : nextPanel;
}

function ovaDefaultFgIfNull(k, v) {
  return v || '#FFFFFF';
}

function ovaDefaultBgIfNull(k, v) {
  return v || '#333333';
}

function ovaSetPreview(k, v, elem) {
  $('#Preview>iframe').css(elem.attr('dim'), v);
}
