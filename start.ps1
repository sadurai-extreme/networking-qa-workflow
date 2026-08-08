# NOS QA Workflow - Start Script
# Run this from c:\My_Projects\networking-qa-workflow\

Write-Host "Starting NOS QA Workflow Tool..." -ForegroundColor Cyan

# Start Backend
Write-Host "Starting Backend on port 5000..." -ForegroundColor Yellow
$backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; npm start" -PassThru

Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting Frontend on port 5173..." -ForegroundColor Yellow
$frontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; npm run dev" -PassThru

Write-Host ""
Write-Host "Tool is starting up!" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:5101" -ForegroundColor White
Write-Host "   Backend:  http://localhost:5100/api/health" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to stop both servers..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
