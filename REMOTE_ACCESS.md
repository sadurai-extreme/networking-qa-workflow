# NOS QA Workflow Dashboard - Remote Access

## Dashboard URLs
- **Frontend**: http://10.127.26.9:5101
- **Backend API**: http://10.127.26.9:5100/api
- **WebSocket**: http://10.127.26.9:5100

## Server Details
- **IP**: 10.127.26.9
- **User**: root
- **Password**: extreme@123

## Quick Access Commands

### Check Dashboard Status
```powershell
ssh root@10.127.26.9 "netstat -tlnp | grep -E '5100|5101'"
```

### View Backend Logs
```powershell
ssh root@10.127.26.9 "tail -50 ~/networking-qa-workflow/backend/backend.log"
```

### View Frontend Logs
```powershell
ssh root@10.127.26.9 "tail -50 ~/networking-qa-workflow/frontend/frontend.log"
```

### Restart Dashboard
```powershell
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend && pm2 restart all"
```

### SSH Connect (Interactive)
```powershell
ssh root@10.127.26.9
```

## Helper Script
Use the provided helper script for easier access:
```powershell
.\ssh-connect.ps1                    # Interactive session
.\ssh-connect.ps1 "your command"     # Run command
```

## Current Status (as of 2026-07-16)
✅ **Backend**: Running on port 5100 (PID 32193)
✅ **Frontend**: Running on port 5101 (PID 29938)
