$ErrorActionPreference = "Stop"

$RepoPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptsDir = Join-Path $RepoPath "scripts"
$ConfigPath = Join-Path $RepoPath "updater.config.json"
$AutoScript = Join-Path $ScriptsDir "Auto-Update-Overlay.ps1"
$ManualScript = Join-Path $ScriptsDir "Update-Overlay.ps1"

function Get-UpdaterConfig {
    if (-not (Test-Path $ConfigPath)) {
        throw "Missing config file: $ConfigPath"
    }
    $json = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
    if (-not $json.mode) { $json | Add-Member -NotePropertyName mode -NotePropertyValue "manual" }
    if (-not $json.branch) { $json | Add-Member -NotePropertyName branch -NotePropertyValue "main" }
    if (-not $json.remote) { $json | Add-Member -NotePropertyName remote -NotePropertyValue "origin" }
    if (-not $json.checkIntervalSeconds) { $json | Add-Member -NotePropertyName checkIntervalSeconds -NotePropertyValue 120 }
    return $json
}

try {
    $cfg = Get-UpdaterConfig
    $mode = $cfg.mode.ToLowerInvariant()

    if ($mode -eq "auto") {
        Write-Host "Starting AUTO mode updater for $($cfg.remote)/$($cfg.branch) every $($cfg.checkIntervalSeconds) seconds"
        & powershell -NoProfile -ExecutionPolicy Bypass -File $AutoScript -Branch $cfg.branch -Remote $cfg.remote -CheckIntervalSeconds ([int]$cfg.checkIntervalSeconds
)
    }
    elseif ($mode -eq "manual") {
        Write-Host "Running MANUAL one-time update for $($cfg.remote)/$($cfg.branch)"
        & powershell -NoProfile -ExecutionPolicy Bypass -File $ManualScript -Branch $cfg.branch -Remote $cfg.remote
    }
    else {
        throw "Unsupported mode '$($cfg.mode)'. Use 'manual' or 'auto'."
    }

    exit $LASTEXITCODE
}
catch {
    Write-Host ("Updater failed: " + $_.Exception.Message)
    exit 1
}
