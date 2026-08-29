# Tea-BTI one-click start (Windows / Docker Desktop)
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -Detached
#   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -SkipBuild
#   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -NoBrowser
[CmdletBinding()]
param(
    [switch]$Detached,
    [switch]$NoBrowser,
    [switch]$SkipBuild,
    [int]$WaitSeconds = 180
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Write-Step([string]$msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg) { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "    [..] $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  Tea-BTI one-click start" -ForegroundColor Green
Write-Host "  Web http://localhost:3000    API http://localhost:8000/docs" -ForegroundColor DarkGray
Write-Host ""

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "docker not found. Install Docker Desktop first." -ForegroundColor Red
    exit 1
}

function Test-DockerEngine {
    docker info *> $null
    return $LASTEXITCODE -eq 0
}

if (-not (Test-DockerEngine)) {
    Write-Step "Docker engine not running, trying to start Docker Desktop..."
    $ddCandidates = @(
        "$env:ProgramFiles/Docker/Docker/Docker Desktop.exe",
        "$env:LOCALAPPDATA/Docker/Docker Desktop.exe"
    )
    $dd = $ddCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if ($dd) {
        [System.Diagnostics.Process]::Start($dd) | Out-Null
        Write-Warn "Started Docker Desktop, waiting for engine (max $WaitSeconds s)..."
    } else {
        Write-Warn "Docker Desktop not auto-found. Please open it manually. Waiting (max $WaitSeconds s)..."
    }
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-DockerEngine) { break }
        Start-Sleep -Seconds 3
    }
    if (-not (Test-DockerEngine)) {
        Write-Host ""
        Write-Host "Docker engine not ready after $WaitSeconds s. Make sure Docker Desktop is running, then retry." -ForegroundColor Red
        exit 1
    }
}
Write-Ok "Docker engine ready"

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env" -Force
    Write-Ok "Created .env from .env.example (voice creds empty -> browser demo mode)"
} else {
    Write-Ok ".env exists, kept as-is"
}

$composeArgs = @("compose", "up")
if ($Detached) { $composeArgs += "-d" }
if (-not $SkipBuild) { $composeArgs += "--build" }

Write-Step "Starting: docker $($composeArgs -join ' ')"

if ($Detached) {
    & docker @composeArgs
    if ($LASTEXITCODE -ne 0) { Write-Host "Start failed, see logs above." -ForegroundColor Red; exit $LASTEXITCODE }

    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $api = Invoke-WebRequest -Uri "http://localhost:8000/healthz" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            $web = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($api.StatusCode -eq 200 -and $web.StatusCode -eq 200) { $ready = $true; break }
        } catch {
            Start-Sleep -Seconds 2
        }
    }

    if ($ready) {
        Write-Ok "Services ready"
        if (-not $NoBrowser) {
            [System.Diagnostics.Process]::Start("http://localhost:3000") | Out-Null
        }
        Write-Host ""
        Write-Host "  Stop: docker compose down" -ForegroundColor DarkGray
    } else {
        Write-Warn "Services started but health check pending. See: docker compose logs -f"
    }
} else {
    Write-Host "  Browser: http://localhost:3000 (Ctrl+C to stop)" -ForegroundColor DarkGray
    & docker @composeArgs
    $code = $LASTEXITCODE
    if ($code -ne 0) { Write-Host "Stopped (exit $code)." -ForegroundColor DarkGray; exit $code }
}