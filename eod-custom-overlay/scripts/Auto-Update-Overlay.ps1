param(
    [string]$Branch = "main",
    [string]$Remote = "origin",
    [int]$CheckIntervalSeconds = 120,
    [switch]$RunOnce
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoPath = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UpdateScript = Join-Path $ScriptsDir "Update-Overlay.ps1"
$LogDir = Join-Path $RepoPath "logs/autoupdater"
$RuntimeDir = Join-Path $RepoPath "runtime"
$LockFile = Join-Path $RuntimeDir "autoupdate.lock"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
$LogFile = Join-Path $LogDir ("autoupdate-" + (Get-Date -Format "yyyyMMdd") + ".log")

function Write-Log {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

function Acquire-Lock {
    if (Test-Path $LockFile) { return $false }
    Set-Content -Path $LockFile -Value $PID -Encoding utf8 -NoNewline
    return $true
}

function Release-Lock {
    if (Test-Path $LockFile) {
        Remove-Item -Path $LockFile -Force -ErrorAction SilentlyContinue
    }
}

function Run-Update {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $UpdateScript -Branch $Branch -Remote $Remote
    if ($LASTEXITCODE -ne 0) {
        throw "Update-Overlay.ps1 failed with exit code $LASTEXITCODE"
    }
}

try {
    if (-not (Test-Path $UpdateScript)) {
        throw "Missing updater script: $UpdateScript"
    }

    if (-not (Acquire-Lock)) {
        Write-Log "Another auto-update process is already running. Exiting."
        exit 0
    }

    if ($RunOnce) {
        Run-Update
        exit 0
    }

    Write-Log "Starting watcher for $Remote/$Branch every $CheckIntervalSeconds seconds"
    while ($true) {
        try {
            Run-Update
        }
        catch {
            Write-Log ("Watcher iteration error: " + $_.Exception.Message)
        }
        Start-Sleep -Seconds $CheckIntervalSeconds
    }
}
catch {
    Write-Log ("ERROR: " + $_.Exception.Message)
    exit 1
}
finally {
    Release-Lock
}
