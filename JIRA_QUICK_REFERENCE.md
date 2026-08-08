# Quick Reference: Jira Integration

## 📋 Your Jira Configuration

Based on your links, I've configured the system for:

### Jira Instance Details
```
Base URL:    https://extremenetworks.atlassian.net
Project:     EXOS (not NOS!)
Board ID:    933
```

### Example from your links:
- **PLM Dashboard**: http://10.69.20.104/featureTracker/apiDash.html?releaseName=EXOS%2034.1.1
- **Jira Board**: https://extremenetworks.atlassian.net/.../boards/933/timeline?version=21144
- **Release**: EXOS 34.1.1 (Version ID: 21144)
- **Expected Stories**: ~29 stories

## 🚀 Quick Setup (3 Steps)

### 1️⃣ Get Your API Token
1. Visit: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Label: `NOS QA Workflow`
4. Copy the token (starts with `ATATT...`)

### 2️⃣ Update .env File
Edit `backend/.env`:
```env
JIRA_BASE_URL=https://extremenetworks.atlassian.net
JIRA_PROJECT=EXOS
JIRA_EMAIL=your-email@extremenetworks.com
JIRA_API_TOKEN=ATATT3xFfGF0abc123...paste-your-token-here
```

### 3️⃣ Test the Connection
```bash
cd backend
node test-jira-connection.js
```

You should see:
```
✓ Connected successfully!
✓ Project found: EXOS
✓ Found X EXOS versions
✓ Found 29 stories for EXOS 34.1.1
✅ All tests passed!
```

## 🔍 How It Works

### Fetching Releases
The backend calls:
```
GET https://extremenetworks.atlassian.net/rest/api/2/project/EXOS/versions
```

Returns all EXOS versions like:
- EXOS 33.1.0
- EXOS 34.1.1 (ID: 21144)
- EXOS 35.1.0

### Fetching Stories
The backend uses JQL query:
```jql
project = EXOS 
AND fixVersion = "EXOS 34.1.1" 
AND issuetype IN (Story, Task) 
AND status NOT IN (Closed, Cancelled, Done)
ORDER BY priority DESC
```

API Call:
```
GET https://extremenetworks.atlassian.net/rest/api/2/search?jql=...
```

Returns stories with:
- Story ID (e.g., EXOS-341101)
- Title, Description
- Status, Priority
- Labels, Assignee
- Custom fields (Story Points, Epic, Sprint)

## 🎯 Authentication

The system uses **Basic Authentication**:
```
Authorization: Basic base64(email:token)
```

Example:
```
Email: john.doe@extremenetworks.com
Token: ATATT3xFfGF0abc123xyz
Auth Header: Basic am9obi5kb2VAZXh0cmVtZW5ldHdvcmtzLmNvbTpBVEFUVDN4RmZHRjBhYmMxMjN4eXo=
```

## 📊 Story Classification

The backend automatically detects story type:

**NOS API Endpoint** (Blue 🔌)
- Keywords: "api", "endpoint", "rest", "cli"
- Example: "BGP Routing Configuration API"

**Feature Functionality** (Green ⚙️)
- Keywords: "feature", "functionality", "enhancement"
- Example: "VLAN Tagging Feature Enhancement"

## 🧪 Testing

### Test 1: Backend API
```bash
# Start backend
cd backend
npm start

# Test releases endpoint
curl http://localhost:5000/api/releases

# Test stories endpoint
curl http://localhost:5000/api/releases/EXOS%2034.1.1/stories
```

### Test 2: Full Application
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm run dev

# Open browser: http://localhost:5173/
```

1. Select "EXOS 34.1.1" from dropdown
2. Should see ~29 stories loaded
3. Click "Start QA" on any story
4. Workflow starts at Stage 2

## ⚠️ Common Issues

### Issue: 401 Unauthorized
**Fix**: Check your API token and email in `.env`

### Issue: 403 Forbidden
**Fix**: Ask Jira admin for "Browse Projects" permission on EXOS

### Issue: No stories found
**Fix**: Check if version name matches exactly (try "EXOS 34.1.1" vs "34.1.1")

### Issue: "Jira API error"
**Fix**: Run `node test-jira-connection.js` to diagnose

## 📝 Files Modified

✅ `backend/.env` - Updated with correct Jira settings
✅ `backend/src/routes/releases.js` - Enhanced with Basic Auth and logging
✅ `backend/test-jira-connection.js` - New test script
✅ `JIRA_SETUP_GUIDE.md` - Comprehensive setup guide

## 🎓 Next Steps

1. **Get your API token** from Atlassian
2. **Update `.env`** with your credentials
3. **Run test script**: `node backend/test-jira-connection.js`
4. **Restart servers** if already running
5. **Test in browser**: Select EXOS 34.1.1 and view stories

## 📚 Additional Resources

- [Full Setup Guide](./JIRA_SETUP_GUIDE.md)
- [Jira REST API Docs](https://developer.atlassian.com/cloud/jira/platform/rest/v2/)
- [JQL Reference](https://support.atlassian.com/jira-service-management-cloud/docs/use-advanced-search-with-jira-query-language-jql/)

## 🔐 Security Reminder

- Never commit your API token to Git
- `.env` is already in `.gitignore`
- Rotate tokens every 90 days
- Use read-only permissions when possible
