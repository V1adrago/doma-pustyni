$ErrorActionPreference = "SilentlyContinue"
$gameDir = "C:\Users\vvb\Desktop\doma-pustyni"
$cfExe   = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$cfLog   = "$env:TEMP\doma_pustyni_cf.log"

$host.UI.RawUI.WindowTitle     = "Doma Pustyni - Launcher"
$host.UI.RawUI.BackgroundColor = "Black"
$host.UI.RawUI.ForegroundColor = "White"
Clear-Host

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor DarkYellow
Write-Host "         DOMA PUSTYNI  -  Launcher          " -ForegroundColor Yellow
Write-Host "  ==========================================" -ForegroundColor DarkYellow
Write-Host ""

# 1. Stop old processes
$portLine = netstat -ano | Select-String "0\.0\.0\.0:3000\s.*LISTENING"
if ($portLine) {
    $oldPid = ($portLine.ToString().Trim() -split '\s+')[-1]
    Write-Host "  Stopping old server (PID $oldPid)..." -ForegroundColor DarkGray
    Stop-Process -Id $oldPid -Force
    Start-Sleep -Seconds 1
}
Get-Process -Name cloudflared | Stop-Process -Force

# 2. Start server
Write-Host "  [1/3] Starting server..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c cd /d `"$gameDir`" && npm run host" `
    -WindowStyle Minimized

# Wait for port 3000
$up = $false
for ($i = 1; $i -le 25; $i++) {
    Start-Sleep -Seconds 1
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("localhost", 3000)
        $tcp.Close()
        $up = $true
        break
    } catch {}
    Write-Host ("  Waiting for server... " + $i + "s   ") -ForegroundColor DarkGray
    [Console]::SetCursorPosition(0, [Console]::CursorTop - 1)
}

if (-not $up) {
    Write-Host "  ERROR: server did not start in 25s." -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}
Write-Host "  [1/3] Server is running!              " -ForegroundColor Green

# 3. Cloudflare tunnel — use unique log file per run to avoid lock conflicts
$cfLog = "$env:TEMP\doma_cf_$([System.Diagnostics.Process]::GetCurrentProcess().Id).log"
$cfProc = Start-Process -FilePath $cfExe `
    -ArgumentList "tunnel --url http://localhost:3000" `
    -RedirectStandardError $cfLog `
    -PassThru -NoNewWindow

Write-Host "  [2/3] Opening Cloudflare tunnel..." -ForegroundColor Yellow
$tunnelUrl = $null
for ($i = 1; $i -le 20; $i++) {
    Start-Sleep -Seconds 1
    # Get-Content handles locked files; -Raw joins all lines
    $txt = (Get-Content $cfLog -Raw -ErrorAction SilentlyContinue) + ""
    if ($txt -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
        $tunnelUrl = $Matches[0]
        break
    }
}

if ($tunnelUrl) {
    Write-Host "  [2/3] Tunnel ready!                   " -ForegroundColor Green
} else {
    Write-Host "  [2/3] Tunnel timeout (continuing)     " -ForegroundColor DarkYellow
}

# 4. Open browser — use tunnel URL so invite links are public
Write-Host "  [3/3] Opening browser..." -ForegroundColor Yellow
if ($tunnelUrl) {
    Start-Process $tunnelUrl
} else {
    Start-Process "http://localhost:3000"
}
Write-Host "  [3/3] Done!                           " -ForegroundColor Green

# Result
Write-Host ""
Write-Host "  +------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |  Local  :  http://localhost:3000         |" -ForegroundColor White
if ($tunnelUrl) {
    $line = "  |  Online :  " + $tunnelUrl
    $line = $line.PadRight(45) + "|"
    Write-Host $line -ForegroundColor Yellow
    $tunnelUrl | Set-Clipboard
    Write-Host "  |  (URL copied to clipboard!)             |" -ForegroundColor DarkGray
} else {
    Write-Host "  |  Tunnel unavailable                      |" -ForegroundColor DarkYellow
}
Write-Host "  +------------------------------------------+" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Close this window to stop server + tunnel." -ForegroundColor DarkGray
Write-Host ""

try { Read-Host "  [ Press Enter to stop ]" } catch {}

# Cleanup
Write-Host "  Stopping..." -ForegroundColor DarkGray
if ($cfProc) { $cfProc | Stop-Process -Force }
$portLine2 = netstat -ano | Select-String "0\.0\.0\.0:3000\s.*LISTENING"
if ($portLine2) {
    $pid2 = ($portLine2.ToString().Trim() -split '\s+')[-1]
    Stop-Process -Id $pid2 -Force
}
Write-Host "  Done." -ForegroundColor Green
Start-Sleep -Seconds 2
