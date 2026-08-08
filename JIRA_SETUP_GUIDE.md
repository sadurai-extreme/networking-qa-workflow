# Jira Integration Setup Guide

## Overview
This guide helps you configure the NOS QA Workflow Tool to fetch stories from your Extreme Networks Jira instance.

## Jira Configuration Details

Based on your links:
- **Jira Base URL**: `https://extremenetworks.atlassian.net`
- **Project Key**: `EXOS`
- **Board ID**: 933
- **Example Version**: EXOS 34.1.1 (Version ID: 21144)

## Step 1: Generate Jira API Token

### Option A: Using Atlassian API Token (Recommended)

1. **Log in to Atlassian**:
   - Go to: https://id.atlassian.com/manage-profile/security/api-tokens
   - Sign in with your Extreme Networks email

2. **Create API Token**:
   - Click "Create API token"
   - Label: `NOS QA Workflow Tool`
   - Click "Create"
   - **Copy the token immediately** (you won't see it again!)

3. **Store the token securely**:
   ```
   Token format: ATATTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Option B: Using Personal Access Token (Alternative)

1. Go to: https://extremenetworks.atlassian.net/plugins/servlet/ac/com.atlassian.jira.jira-data-center-identity-app/manage-user-access-tokens
2. Click "Create token"
3. Name: `NOS QA Workflow`
4. Expiry: Choose appropriate duration
5. Copy the token

## Step 2: Update Backend Configuration

Edit `backend/.env`:

```env
# Jira Configuration for Extreme Networks
JIRA_BASE_URL=https://extremenetworks.atlassian.net
JIRA_PROJECT=EXOS
JIRA_EMAIL=your-email@extremenetworks.com
JIRA_API_TOKEN=ATATT3xFfGF0abc123xyz...your-token-here

# Other settings remain the same
PORT=5000
FRONTEND_URL=http://localhost:5173
```

**Important Notes:**
- Replace `your-email@extremenetworks.com` with your actual Extreme Networks email
- Replace the `JIRA_API_TOKEN` with your actual token from Step 1
- Keep the token secure - never commit it to Git!

## Step 3: Test the Connection

### Using curl (Command Line Test)

```bash
# Test 1: Fetch EXOS project versions
curl -X GET \
  -H "Authorization: Basic <base64-encoded-email:token>" \
  -H "Content-Type: application/json" \
  "https://extremenetworks.atlassian.net/rest/api/2/project/EXOS/versions"

# Test 2: Fetch stories for EXOS 34.1.1
curl -X GET \
  -H "Authorization: Basic <base64-encoded-email:token>" \
  -H "Content-Type: application/json" \
  "https://extremenetworks.atlassian.net/rest/api/2/search?jql=project%20%3D%20EXOS%20AND%20fixVersion%20%3D%20%22EXOS%2034.1.1%22&maxResults=10"
```

**To create the Base64 encoded auth:**
```bash
# PowerShell
$auth = "your-email@extremenetworks.com:ATATT3xFfGF0..."
$base64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($auth))
Write-Output $base64
```

### Using the Backend API

1. Start the backend:
   ```bash
   cd backend
   npm start
   ```

2. Test the releases endpoint:
   ```bash
   curl http://localhost:5000/api/releases
   ```

3. Test the stories endpoint:
   ```bash
   curl http://localhost:5000/api/releases/EXOS%2034.1.1/stories
   ```

**Expected Output:**
```json
[
  {
    "id": "EXOS-12345",
    "title": "BGP Routing Configuration API",
    "description": "...",
    "status": "Open",
    "priority": "High",
    "type": "NOS API Endpoint",
    "labels": ["api", "bgp"]
  },
  ...
]
```

## Step 4: Verify in the Application

1. **Start both servers**:
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm start

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

2. **Open the dashboard**: http://localhost:5173/

3. **Select a release**: Choose "EXOS 34.1.1" from the dropdown

4. **Verify stories load**: You should see stories like:
   - EXOS-341101: BGP Routing Configuration API
   - EXOS-341102: VLAN Tagging Feature Enhancement
   - etc.

## Troubleshooting

### Issue 1: "Jira API error: 401 Unauthorized"

**Cause**: Invalid credentials or token

**Solution**:
1. Verify your email is correct in `.env`
2. Regenerate your API token
3. Make sure token is not expired
4. Check for extra spaces in the token

### Issue 2: "Jira API error: 403 Forbidden"

**Cause**: Insufficient permissions

**Solution**:
1. Verify you have access to the EXOS project
2. Ask your Jira admin to grant "Browse Projects" permission
3. Verify you can view the board at: https://extremenetworks.atlassian.net/jira/software/c/projects/EXOS/boards/933

### Issue 3: No stories returned (empty array)

**Cause**: JQL query not matching your Jira setup

**Solution**:
1. Check the version name format in Jira (might be "EXOS 34.1.1" or "34.1.1")
2. Test the JQL in Jira's issue search:
   ```
   project = EXOS AND fixVersion = "EXOS 34.1.1"
   ```
3. Adjust the JQL in `backend/src/routes/releases.js` if needed

### Issue 4: "Cannot find module" or other backend errors

**Solution**:
1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Check Node.js version (should be 18+)
3. Restart the backend server

## JQL Query Reference

The backend uses this JQL to fetch stories:

```jql
project = EXOS 
AND fixVersion = "EXOS 34.1.1" 
AND issuetype IN (Story, Task) 
AND status NOT IN (Closed, Cancelled, Done) 
ORDER BY priority DESC, created DESC
```

You can customize this in `backend/src/routes/releases.js`:
- Add more issue types: `AND issuetype IN (Story, Task, Bug)`
- Include completed stories: Remove the status filter
- Filter by labels: `AND labels IN (api, feature)`
- Limit to assigned stories: `AND assignee = currentUser()`

## Custom Fields

Jira custom fields (if your Jira uses them):
- `customfield_10001`: Epic Link
- `customfield_10002`: Story Points
- `customfield_10016`: Sprint

To find your custom field IDs:
1. Go to Jira Settings → Issues → Custom Fields
2. Click on a field and note the ID from the URL
3. Update the fields in `backend/src/routes/releases.js`

## Security Best Practices

1. **Never commit tokens to Git**:
   - `.env` is already in `.gitignore`
   - Always use environment variables

2. **Use token rotation**:
   - Regenerate tokens every 90 days
   - Revoke old tokens after generating new ones

3. **Limit token scope**:
   - Use tokens with minimum required permissions
   - Read-only access is sufficient for this app

4. **Use HTTPS**:
   - Always use `https://` for Jira base URL
   - Never downgrade to `http://`

## API Rate Limits

Atlassian Jira Cloud rate limits:
- **Read operations**: 60 requests per minute
- **Search operations**: 20 requests per minute

The app handles this by:
- Caching responses
- Using mock data as fallback
- Implementing exponential backoff (future enhancement)

## Support

If you encounter issues:

1. **Check backend logs**: Look for detailed error messages in the terminal
2. **Enable debug mode**: Set `DEBUG=true` in `.env`
3. **Test directly in Jira**: Verify the JQL works in Jira's search bar
4. **Contact Jira admin**: For permission or configuration issues

## Additional Resources

- [Jira REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v2/)
- [JQL Reference](https://support.atlassian.com/jira-service-management-cloud/docs/use-advanced-search-with-jira-query-language-jql/)
- [Atlassian API Tokens](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)
