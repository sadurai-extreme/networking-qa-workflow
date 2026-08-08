# SSH Connection Helper for NOS QA Workflow Remote Server
# Usage: 
#   .\ssh-connect.ps1                    - Interactive SSH session
#   .\ssh-connect.ps1 "your command"     - Execute command and return

param(
    [string]$Command = ""
)

$SERVER = "10.127.26.9"
$USER = "root"

if ($Command -eq "") {
    # Interactive SSH session
    Write-Host "Connecting to NOS QA Dashboard Server ($SERVER)..." -ForegroundColor Cyan
    ssh $USER@$SERVER
} else {
    # Execute command and return
    ssh $USER@$SERVER $Command
}

# Quick access functions:
# Get-RemoteStatus - Check dashboard status
# Restart-RemoteDashboard - Restart both frontend and backend
# Get-RemoteLogs - View recent logs

function Get-RemoteStatus {
    Write-Host "Checking dashboard status on $SERVER..." -ForegroundColor Yellow
    ssh $USER@$SERVER "netstat -tlnp | grep -E '5100|5101'"
    ssh $USER@$SERVER "ps aux | grep -E 'node|npm' | grep -v grep"
}

function Restart-RemoteDashboard {
    Write-Host "Restarting dashboard on $SERVER..." -ForegroundColor Yellow
    ssh $USER@$SERVER "cd ~/networking-qa-workflow && pkill -f 'node src/server.js' && pkill -f 'serve dist' && sleep 2 && cd backend && nohup node src/server.js > backend.log 2>&1 & cd ../frontend && nohup npx serve dist -l 5101 > frontend.log 2>&1 &"
    Write-Host "Dashboard restarted. Waiting 3 seconds..." -ForegroundColor Green
    Start-Sleep -Seconds 3
    Get-RemoteStatus
}

function Get-RemoteLogs {
    param([string]$Service = "backend")
    Write-Host "Fetching $Service logs from $SERVER..." -ForegroundColor Yellow
    if ($Service -eq "backend") {
        ssh $USER@$SERVER "tail -50 ~/networking-qa-workflow/backend/backend.log"
    } else {
        ssh $USER@$SERVER "tail -50 ~/networking-qa-workflow/frontend/frontend.log"
    }
}
