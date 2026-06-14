# Maeven CRM Environment Startup Script
# Run this script in PowerShell to launch all services concurrently in separate windows.

Write-Host "Initializing Maeven CRM Platform..." -ForegroundColor Yellow

# 1. Start CRM Backend (Port 8000)
Write-Host "Launching CRM Backend on http://localhost:8000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd crm-backend; uvicorn main:app --port 8000 --reload"

# 2. Start Channel Stub Simulator (Port 8001)
Write-Host "Launching Async Messaging Gateway Stub on http://localhost:8001..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd channel-stub; uvicorn main:app --port 8001 --reload"

# 3. Start Next.js Frontend Client (Port 3000)
Write-Host "Launching Next.js Frontend Client on http://localhost:3000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "All processes spawned successfully! Monitor the opened console windows for service logs." -ForegroundColor Green
