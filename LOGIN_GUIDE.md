# NOS QA Workflow Dashboard - Login Guide

## 🔐 Admin Login Credentials

**Username**: `extreme`  
**Password**: `extreme`

**Alternative**: You can also login with email:
- Email: `extreme@nosqa.local`
- Password: `extreme`

## 🌐 Dashboard Access

**Frontend URL**: http://10.127.26.9:5101  
**Backend API**: http://10.127.26.9:5100/api  
**Health Check**: http://10.127.26.9:5100/api/health

## ✅ Verified Working

- ✅ Backend authentication endpoint is working
- ✅ Database has admin user properly configured
- ✅ Password hash is correct
- ✅ Frontend is built and deployed
- ✅ API URL is correctly configured (http://10.127.26.9:5100/api)
- ✅ Both services are running:
  - Backend (Port 5100)
  - Frontend (Port 5101)

## 🔧 Troubleshooting

### If Login Still Doesn't Work:

1. **Clear Browser Cache**
   - Press `Ctrl + Shift + Delete` (Windows/Linux) or `Cmd + Shift + Delete` (Mac)
   - Clear cached images and files
   - Reload the page with `Ctrl + F5` (hard reload)

2. **Check Browser Console**
   - Press `F12` to open Developer Tools
   - Go to "Console" tab
   - Look for any red error messages
   - Check "Network" tab to see if the login request reaches the backend

3. **Verify Network Access**
   - Make sure you can ping `10.127.26.9`
   - Try accessing the backend directly: http://10.127.26.9:5100/api/health
   - Should return: `{"status":"ok","timestamp":"..."}`

4. **Check CORS Issues**
   - If you see CORS errors in browser console, the backend needs to allow your IP
   - Backend currently allows all origins

5. **Test Login via Command Line** (to verify backend works):
   ```powershell
   $body = @{ username = "extreme"; password = "extreme" } | ConvertTo-Json
   Invoke-WebRequest -Uri "http://10.127.26.9:5100/api/auth/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
   ```

6. **Restart Services** (if needed):
   ```powershell
   ssh root@10.127.26.9 "/tmp/restart-dashboard.sh"
   ```

## 📝 Additional Users

All users default password is: `extreme`

To create new users:
- Login as admin
- Go to Admin Dashboard
- Click "Create User"

## 🔄 Password Change

After first login, you can change your password:
- Click on your username in the top right
- Select "Change Password"

## 🆘 Support

If you still have issues:
1. Check backend logs: `ssh root@10.127.26.9 "tail -50 ~/networking-qa-workflow/backend/backend.log"`
2. Check frontend logs: `ssh root@10.127.26.9 "tail -50 ~/networking-qa-workflow/frontend/frontend.log"`
3. Verify database: `ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend && node check-db.js"`
