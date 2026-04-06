param(
    [string]$Branch = "main",
    [string]$Remote = "origin"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoPath = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir = Join-Path $RepoPath "logs/updater"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$LogFile = Join-Path $LogDir ("update-" + (Get-Date -Format "yyyyMMdd") + ".log")

function Write-Log {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

function Invoke-Git {
    param([string[]]$Args)
    $out = (& git @Args) 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Args -join ' ') failed: $out"
    }
    return ($out | Out-String).Trim()
}

try {
    Push-Location $RepoPath

    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw "git not found in PATH"
    }

    if (-not (Test-Path ".git")) {
        throw "This folder is not a git repo: $RepoPath"
    }

    $currentBranch = (Invoke-Git -Args @("rev-parse", "--abbrev-ref", "HEAD"))
    if ($currentBranch -ne $Branch) {
        Write-Log "Current branch is '$currentBranch'; switching to '$Branch'"
        Invoke-Git -Args @("checkout", $Branch) | Out-Null
    }

    Invoke-Git -Args @("fetch", $Remote, $Branch, "--prune") | Out-Null

    $behindRaw = Invoke-Git -Args @("rev-list", "--count", "HEAD..$Remote/$Branch")
    $behind = 0
    if (-not [int]::TryParse($behindRaw, [ref]$behind)) {
        throw "Unable to parse behind count: '$behindRaw'"
    }

    if ($behind -le 0) {
        Write-Log "No updates. Already at latest $Remote/$Branch"
        exit 0
    }

    Write-Log "Found $behind new commit(s). Pulling updates..."
    Invoke-Git -Args @("pull", "--ff-only", $Remote, $Branch) | Out-Null

    $newHead = Invoke-Git -Args @("rev-parse", "--short", "HEAD")
    Write-Log "Update complete. HEAD is now $newHead"
    exit 0
}
catch {
    Write-Log ("ERROR: " + $_.Exception.Message)
    exit 1
}
finally {
    Pop-Location
}
