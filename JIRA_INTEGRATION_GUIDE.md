# Jira / PLM Structure Board Integration Guide

## Overview

This guide explains how to integrate the NOS QA Workflow tool with your Atlassian Jira instance to fetch releases and stories, similar to your existing PLM structure board at `http://10.69.20.104/featureTracker/testDash.html`.

## Architecture

```
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│   Frontend       │          │   Backend        │          │   Jira API       │
│   (React)        │          │   (Node.js)      │          │   (Atlassian)    │
│                  │          │                  │          │                  │
│  HomePage.jsx    │  HTTP    │  /api/releases   │  HTTPS   │  /rest/api/2/    │
│  - Release       │ ────────>│  - GET /         │ ────────>│  project/NOS/    │
│    selector      │          │  - GET /:id/     │          │  versions        │
│  - Story table   │<────────│    stories       │<────────│  search          │
│  - Start QA btn  │          │                  │          │                  │
└──────────────────┘          └──────────────────┘          └──────────────────┘
```

## Step-by-Step Configuration

### 1. Get Jira API Token

**Option A: Personal API Token (Recommended for testing)**

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Enter a label (e.g., "NOS QA Workflow Tool")
4. Click **Create**
5. Copy the token (you won't be able to see it again!)

**Option B: Service Account (Recommended for production)**

1. Create a service account user in Jira
2. Grant it read-only access to the NOS project
3. Generate API token for that user

### 2. Find Your Jira Base URL

Your Jira base URL is typically:
- **Cloud**: `https://your-company.atlassian.net`
- **Server/Data Center**: `http://10.69.20.104:8080` (if self-hosted)

To find it:
1. Log into Jira
2. Look at the URL in your browser
3. Copy everything before `/browse/` or `/secure/`

Example:
- URL: `https://acme.atlassian.net/browse/NOS-123`
- Base URL: `https://acme.atlassian.net`

### 3. Identify Your Project Key

Your project key is the prefix before the issue number:
- Issue: `NOS-3411`
- Project Key: `NOS`

To verify:
1. Go to Jira Project Settings
2. Look for "Key" field (usually top of settings page)

### 4. Configure Backend Environment

Edit `backend/.env`:

```env
# Jira Integration
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_API_TOKEN=your_api_token_from_step_1
JIRA_PROJECT=NOS

# If using Jira Server/Data Center (self-hosted)
# JIRA_BASE_URL=http://10.69.20.104:8080
```

### 5. Test Connection

Run this command to test your Jira connection:

```powershell
# Windows PowerShell
cd backend
$env:JIRA_BASE_URL="https://your-company.atlassian.net"
$env:JIRA_API_TOKEN="your_token"
$env:JIRA_PROJECT="NOS"

# Test releases endpoint
curl -H "Authorization: Bearer $env:JIRA_API_TOKEN" "$env:JIRA_BASE_URL/rest/api/2/project/$env:JIRA_PROJECT/versions"
```

Expected response:
```json
[
  {
    "id": "10001",
    "name": "EXOS 34.1.1",
    "archived": false,
    "released": false,
    "releaseDate": "2026-12-31"
  },
  ...
]
```

### 6. Restart Backend

```powershell
cd backend
npm start
```

You should see:
```
🚀 NOS QA Workflow Backend running on port 5000
```

### 7. Test in Frontend

1. Open http://localhost:5173
2. You should see your real Jira releases in the dropdown
3. Select a release
4. Stories from that release should appear in the table

## API Endpoints

### GET `/api/releases`

Fetches all EXOS releases (fixVersions) from Jira.

**Jira API Call:**
```
GET /rest/api/2/project/NOS/versions
Authorization: Bearer <token>
```

**Returns:**
```json
[
  {
    "id": "10001",
    "name": "EXOS 34.1.1",
    "description": "EXOS Release 34.1.1",
    "releaseDate": "2026-12-31",
    "startDate": "2026-09-01"
  }
]
```

### GET `/api/releases/:release/stories`

Fetches all stories for a specific release using JQL.

**Jira API Call:**
```
GET /rest/api/2/search
  ?jql=project = NOS AND fixVersion = "EXOS 34.1.1" AND issuetype = Story
  &fields=summary,description,status,priority,assignee,labels
  &maxResults=500
Authorization: Bearer <token>
```

**Returns:**
```json
[
  {
    "id": "NOS-3411",
    "title": "BGP Routing Configuration API",
    "description": "Implement BGP neighbor management endpoints...",
    "status": "Open",
    "priority": "High",
    "assignee": "John Doe",
    "labels": ["api", "bgp", "routing"],
    "type": "NOS API Endpoint"
  }
]
```

## Story Type Detection

The system automatically classifies stories as either:
- **NOS API Endpoint** 🔌 - For API/endpoint stories
- **Feature Functionality** ⚙️ - For feature stories

Detection logic:
```javascript
function detectStoryType(title, description, labels) {
  const text = `${title} ${description}`.toLowerCase();
  
  // Check for API keywords
  if (text.includes('api') || 
      text.includes('endpoint') || 
      text.includes('rest') ||
      labels.includes('api')) {
    return 'NOS API Endpoint';
  }
  
  // Default to Feature
  return 'Feature Functionality';
}
```

## Connecting to Your PLM Structure Board

If you want to integrate with your existing PLM structure board at `http://10.69.20.104/featureTracker/testDash.html`:

### Option 1: Use Same Jira Connection

If your board uses the same Jira instance, just configure the Jira credentials above. The workflow tool will fetch the same data.

### Option 2: Query Your Board's API

If your board has its own API:

1. Create a new service in `backend/src/services/plm-board.js`:

```javascript
const fetch = require('node-fetch');

const PLM_BOARD_URL = process.env.PLM_BOARD_URL || 'http://10.69.20.104/featureTracker';

async function fetchReleasesFromPLM() {
  const response = await fetch(`${PLM_BOARD_URL}/api/releases`);
  return response.json();
}

async function fetchStoriesFromPLM(release) {
  const response = await fetch(`${PLM_BOARD_URL}/api/releases/${release}/stories`);
  return response.json();
}

module.exports = { fetchReleasesFromPLM, fetchStoriesFromPLM };
```

2. Update `backend/src/routes/releases.js` to use your board's API instead of Jira.

### Option 3: Direct Database Access

If your PLM board uses a database, you can query it directly:

```javascript
// Add to backend/src/services/plm-database.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.PLM_DB_HOST || '10.69.20.104',
  user: process.env.PLM_DB_USER,
  password: process.env.PLM_DB_PASSWORD,
  database: process.env.PLM_DB_NAME || 'feature_tracker'
});

async function getReleasesFromDB() {
  const [rows] = await pool.query('SELECT * FROM releases WHERE active = 1');
  return rows;
}
```

## Troubleshooting

### Issue: "Jira API error" or "Failed to fetch releases"

**Check:**
1. JIRA_BASE_URL is correct (no trailing slash)
2. JIRA_API_TOKEN is valid (not expired)
3. JIRA_PROJECT exists and you have access
4. Network connectivity to Jira instance

**Test:**
```powershell
curl -H "Authorization: Bearer YOUR_TOKEN" "YOUR_BASE_URL/rest/api/2/myself"
```

Should return your user info.

### Issue: "No stories found"

**Check:**
1. Stories exist in Jira for that release
2. Stories have correct fixVersion set
3. Stories are not Closed/Cancelled
4. Your API token has read access to those stories

**Test JQL manually:**
```
project = NOS AND fixVersion = "EXOS 34.1.1" AND issuetype = Story
```

### Issue: CORS errors in browser

**Solution:**
Backend already has CORS enabled. If you still see errors:

1. Check `backend/src/server.js`:
```javascript
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:5173' 
}));
```

2. Make sure frontend is running on port 5173

### Issue: Mock data still showing

**Check:**
1. Backend `.env` has correct Jira credentials
2. Backend restarted after updating `.env`
3. No errors in backend console

The system falls back to mock data if Jira API fails.

## Production Deployment

For production:

1. **Use Service Account**: Don't use personal API tokens
2. **Store Credentials Securely**: Use Azure Key Vault or similar
3. **Add Rate Limiting**: Jira APIs have rate limits
4. **Cache Responses**: Cache release/story data for 5-10 minutes
5. **Add Logging**: Log all Jira API calls for debugging
6. **Handle Errors Gracefully**: Show user-friendly error messages

Example caching:
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

async function fetchReleases() {
  const cached = cache.get('releases');
  if (cached) return cached;
  
  const releases = await fetchFromJira();
  cache.set('releases', releases);
  return releases;
}
```

## Security Notes

⚠️ **Never commit your API token to Git!**

✅ **Do:**
- Use `.env` files (already in `.gitignore`)
- Use environment variables in production
- Use service accounts with minimal permissions
- Rotate tokens regularly

❌ **Don't:**
- Hardcode tokens in source code
- Commit `.env` files
- Share tokens in chat/email
- Use admin accounts for API access

## Support

If you encounter issues:

1. Check backend console for error messages
2. Check browser console for network errors
3. Test Jira API directly with curl
4. Verify credentials and permissions
5. Check firewall/network settings if self-hosted

For Jira API documentation:
https://developer.atlassian.com/cloud/jira/platform/rest/v2/
