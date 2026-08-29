# Tea-BTI one-click start (Windows / Docker Desktop)
# 单实例保证：重复执行只会复用/启动同一组容器，不会产生多个实例。
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1            # 前台（首次启动时跟随日志）
#   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -Detached  # 后台 + 自动打开浏览器
#   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -SkipBuild # 不重新构建镜像
#   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -ForceRebuild # 强制重建镜像与容器
[CmdletBinding()]
param(
    [switch]$Detached,
    [switch]$NoBrowser,
    [switch]$SkipBuild,
    [switch]$ForceRebuild,
    [int]$WaitSeconds = 180
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Write-Step([string]$msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg) { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "    [..] $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  Tea-BTI one-click start (single instance)" -ForegroundColor Green
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

function Test-Health {
    try {
        $api = Invoke-WebRequest -Uri "http://localhost:8000/healthz" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        $web = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        return ($api.StatusCode -eq 200 -and $web.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Open-Browser {
    if (-not $NoBrowser) {
        [System.Diagnostics.Process]::Start("http://localhost:3000") | Out-Null
    }
}

# ---- 单实例判断 ----
$runningIds = @(docker compose ps --status running -q 2>$null)
$existingIds = @(docker compose ps -q 2>$null)

# 已有运行中的实例：直接复用，不重复启动 / 不重复构建
if ($runningIds.Count -gt 0 -and -not $ForceRebuild) {
    Write-Step "检测到服务已在运行（$($runningIds.Count) 个容器），保持单实例并复用"
    if ($Detached) {
        if (Test-Health) {
            Write-Ok "Services already ready"
            Open-Browser
            Write-Host "  Stop: docker compose down" -ForegroundColor DarkGray
        } else {
            Write-Warn "容器在运行但健康检查未通过，查看日志: docker compose logs -f"
        }
    } else {
        Write-Host "  服务已在运行，attach 日志 (Ctrl+C 退出，服务继续运行)" -ForegroundColor DarkGray
        & docker compose logs -f
    }
    exit 0
}

# 强制重建：先 down 掉旧容器，避免同名实例残留
if ($ForceRebuild) {
    Write-Step "Force rebuild: 先移除旧容器，再重建"
    & docker compose down
    & docker compose up -d --build --force-recreate
    if ($LASTEXITCODE -ne 0) { Write-Host "Start failed, see logs above." -ForegroundColor Red; exit $LASTEXITCODE }
} elseif ($existingIds.Count -gt 0) {
    # 有已存在的容器（已停止）：复用启动，绝不新建副本
    Write-Step "检测到已停止的实例（$($existingIds.Count) 个容器），复用启动，不重建"
    & docker compose up -d --no-recreate
    if ($LASTEXITCODE -ne 0) { Write-Host "Start failed, see logs above." -ForegroundColor Red; exit $LASTEXITCODE }
} else {
    # 首次启动
    $composeArgs = @("compose", "up")
    if ($Detached) { $composeArgs += "-d" }
    if (-not $SkipBuild) { $composeArgs += "--build" }
    Write-Step "首次启动: docker $($composeArgs -join ' ')"

    if ($Detached) {
        & docker @composeArgs
        if ($LASTEXITCODE -ne 0) { Write-Host "Start failed, see logs above." -ForegroundColor Red; exit $LASTEXITCODE }
    } else {
        Write-Host "  Browser: http://localhost:3000 (Ctrl+C to stop)" -ForegroundColor DarkGray
        & docker @composeArgs
        $code = $LASTEXITCODE
        if ($code -ne 0) { Write-Host "Stopped (exit $code)." -ForegroundColor DarkGray; exit $code }
        exit 0
    }
}

# 后台模式：健康检查 + 浏览器
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    if (Test-Health) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if ($ready) {
    Write-Ok "Services ready (single instance)"
    Open-Browser
    Write-Host ""
    Write-Host "  Stop: docker compose down" -ForegroundColor DarkGray
} else {
    Write-Warn "Services started but health check pending. See: docker compose logs -f"
}