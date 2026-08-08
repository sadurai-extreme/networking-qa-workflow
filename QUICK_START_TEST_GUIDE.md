# Quick Start Guide - Testing the New Frontend

## 🚀 Starting the Application

### 1. Start Backend
```powershell
cd backend
npm start
```

Expected output:
```
🚀 NOS QA Workflow Backend running on port 5000
```

### 2. Start Frontend (New Terminal)
```powershell
cd frontend
npm run dev
```

Expected output:
```
  VITE v8.0.12  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 3. Open Browser
Navigate to: **http://localhost:5173**

## ✅ Testing the New Features

### Test 1: Main Dashboard

**Expected:**
- ✅ See "NOS QA Workflow Dashboard" header
- ✅ See 4 statistics cards (Active, Completed, Total, Releases)
- ✅ See "Select EXOS Release" dropdown
- ✅ See release options (33.1.0, 34.1.1, 35.1.1, etc.)

**Actions:**
1. Select "EXOS 34.1.1" from dropdown
2. Wait for stories to load (mock data)
3. Verify story table appears with 8 mock stories

**Screenshot locations to verify:**
```
Dashboard
├── Statistics (top)
├── Release Selector (middle)
└── Story Table (with Start QA buttons)
```

### Test 2: Create Workflow from Story

**Steps:**
1. From dashboard, select release "EXOS 34.1.1"
2. Find story "NOS-341101: BGP Routing Configuration API"
3. Click **[Start QA]** button
4. Modal opens with workflow creation form
5. Click **[Start Workflow]**

**Expected:**
- ✅ Navigates to `/workflow/<id>/stage/1`
- ✅ Sidebar shows stages with Stage 1 active
- ✅ Stage 1 page loads
- ✅ Release pre-selected (EXOS 34.1.1)
- ✅ Story pre-selected (BGP story)

**URL should look like:**
```
http://localhost:5173/workflow/abc-123-def-456/stage/1
```

### Test 3: Navigation Between Stages

**Steps:**
1. On Stage 1, verify story is selected
2. Click **[Approve & Continue]** button
3. Wait for navigation

**Expected:**
- ✅ URL changes to `.../stage/2`
- ✅ Sidebar updates: Stage 1 shows ✓, Stage 2 shows ●
- ✅ Progress bar shows "Stage 2 of 9"
- ✅ Stage 2 content loads (Skill File Generation)

**Try clicking sidebar items:**
1. Click "Stage 1" in sidebar
2. Should navigate back to Stage 1
3. Click "Stage 2" in sidebar
4. Should navigate to Stage 2
5. Try clicking "Stage 3" - Should be disabled (grayed out)

### Test 4: Dashboard Navigation

**Steps:**
1. While in any stage page, click **"Dashboard"** in sidebar
2. Click the "🔷 NOS QA Workflow" logo at top

**Expected:**
- ✅ Navigates back to home dashboard (`/`)
- ✅ See your active workflow in "Active Workflows" table
- ✅ Can click **[Resume]** to go back to current stage

### Test 5: Browser Back/Forward

**Steps:**
1. Create workflow, advance to Stage 2
2. Click browser **Back** button
3. Click browser **Forward** button

**Expected:**
- ✅ Back button goes to Stage 1
- ✅ Forward button returns to Stage 2
- ✅ Sidebar updates correctly
- ✅ Progress bar updates correctly

### Test 6: Direct URL Access

**Steps:**
1. Copy workflow URL: `http://localhost:5173/workflow/<your-id>/stage/3`
2. Open in new tab
3. Paste URL and press Enter

**Expected:**
- ✅ Loads Stage 3 directly
- ✅ Sidebar shows correct stage active
- ✅ Workflow data loads correctly
- ✅ Can navigate to other stages

### Test 7: Multiple Workflows

**Steps:**
1. Go to dashboard
2. Create workflow A from story 1
3. Go to dashboard (sidebar)
4. Create workflow B from story 2
5. Go to dashboard again

**Expected:**
- ✅ See 2 workflows in "Active Workflows" table
- ✅ Each shows correct release and current stage
- ✅ Can resume each workflow independently
- ✅ Statistics update (Active: 2)

### Test 8: Admin Features (If Admin User)

**Steps:**
1. Click user menu in sidebar (bottom)
2. Click "Admin Dashboard"

**Expected:**
- ✅ Navigates to `/admin`
- ✅ Shows user management
- ✅ Shows all workflows (not just yours)
- ✅ Can navigate back to dashboard

## 📋 Feature Checklist

Core Features:
- [ ] Main dashboard loads
- [ ] Release selector shows releases
- [ ] Selecting release fetches stories
- [ ] Story table displays correctly
- [ ] "Start QA" creates workflow
- [ ] Workflow creation navigates to Stage 1
- [ ] Sidebar navigation works
- [ ] Stage progression advances workflow
- [ ] Progress bar updates
- [ ] Browser back/forward works
- [ ] Dashboard shows active workflows
- [ ] Resume workflow works
- [ ] Admin dashboard accessible (admin only)
- [ ] User menu functions (logout, change password)

Advanced Features:
- [ ] Multiple workflows can coexist
- [ ] WebSocket updates work (Stage 6, 7, 8)
- [ ] File uploads work (Stage 2, 3)
- [ ] Co-user reviews work (Stage 5, 7)
- [ ] Workflow completion works (Stage 9)
- [ ] Statistics update correctly

## 🐛 Common Issues & Solutions

### Issue: Page shows "Loading workflow..."

**Cause:** Workflow not found in database

**Solution:**
1. Check workflow ID in URL is correct
2. Create new workflow from dashboard
3. Check backend console for errors

### Issue: Mock data not showing

**Cause:** Backend not running or CORS issue

**Solution:**
1. Verify backend is running on port 5000
2. Check browser console for errors
3. Visit http://localhost:5000/api/health (should show `{"status":"ok"}`)

### Issue: Navigation doesn't work

**Cause:** React Router issue

**Solution:**
1. Check browser console for errors
2. Verify `BrowserRouter` is wrapping App in `main.jsx`
3. Clear browser cache and reload

### Issue: Sidebar stages not clickable

**Cause:** Not in workflow context or stage locked

**Solution:**
1. Make sure you're viewing a workflow (URL has `/workflow/`)
2. Only current and previous stages are clickable
3. Can't skip ahead to future stages

### Issue: "Failed to fetch releases"

**Cause:** Backend error or Jira not configured

**Solution:**
1. Check backend console for errors
2. System falls back to mock data (this is normal if Jira not configured)
3. To use real Jira, configure `.env` (see JIRA_INTEGRATION_GUIDE.md)

## 🎨 Visual Verification

When testing, verify these visual elements:

### Dashboard Page
- Header with "Welcome back, [Name]"
- 4 colored statistics cards
- Release selector dropdown
- Story table with colored tags
- "Start QA" buttons
- Active workflows section (if any exist)

### Stage Pages
- Progress bar at top showing stage X of 9
- Stage-specific content
- Approve/Reject buttons at bottom
- Sidebar with stage list
- Current stage highlighted

### Sidebar
- Logo at top
- "Dashboard" menu item
- 9 stage menu items
- Visual indicators (✓ for done, ● for active)
- User menu at bottom

### Colors
- Blue: Active items, primary actions
- Green: Completed items, success
- Orange: In progress, warnings
- Gray: Disabled, pending items

## 📊 Mock Data Reference

### Mock Releases
- EXOS 33.1.0
- EXOS 33.1.1
- EXOS 33.2.0
- EXOS 34.1.0
- EXOS 34.1.1 ← Most stories
- EXOS 34.2.0
- EXOS 35.1.0
- EXOS 35.1.1

### Mock Stories (for any release)
1. NOS-XXX01 - BGP Routing Configuration API (API)
2. NOS-XXX02 - VLAN Tagging Feature Enhancement (Feature)
3. NOS-XXX03 - OSPF REST API Implementation (API)
4. NOS-XXX04 - QoS Policy Engine (Feature)
5. NOS-XXX05 - SNMP MIB API Extensions (API)
6. NOS-XXX06 - LLDP Neighbor Discovery (Feature)
7. NOS-XXX07 - ACL Management REST API (API)
8. NOS-XXX08 - Port Mirroring Feature (Feature)

## 🔄 Workflow Test Scenario

Complete end-to-end test:

1. **Dashboard** - Select EXOS 34.1.1
2. **Create** - Click "Start QA" on BGP story
3. **Stage 1** - Verify story selected, click Approve
4. **Stage 2** - Generate skill file (mock), click Approve
5. **Stage 3** - Generate test plan (mock), click Approve
6. **Stage 4** - Classify test cases (mock), click Approve
7. **Stage 5** - Format ISO (mock), assign reviewers, click Approve
8. **Stage 6** - Upload to qTest (mock), click Approve
9. **Stage 7** - Generate TCL scripts (mock), click Approve
10. **Stage 8** - Run regression (mock), wait for completion, click Approve
11. **Stage 9** - View final report, click Complete Workflow
12. **Dashboard** - Verify workflow moved to "Completed" section

Each stage should:
- Load correctly
- Show relevant content
- Have functional approve button
- Navigate to next stage on approval
- Update sidebar checkmarks

## 📝 Logging

Watch these consoles during testing:

**Backend Console:**
```
Client connected: abc123
GET /api/releases 200
GET /api/releases/EXOS%2034.1.1/stories 200
POST /api/workflows 200
GET /api/workflows/abc-123 200
```

**Browser Console (F12):**
- No red errors
- Network requests succeed (200 status)
- State updates logged (if you add console.logs)

## ✨ Success Criteria

You've successfully tested the new frontend if:

✅ All navigation works smoothly
✅ No console errors
✅ Workflow creation works
✅ Stage progression works
✅ Sidebar updates correctly
✅ Browser back/forward works
✅ Dashboard shows workflows
✅ Mock data displays properly
✅ URLs are clean and bookmarkable
✅ User menu functions work

## 🎯 Next Steps After Testing

1. **Update Remaining Stages** - Follow MIGRATION_GUIDE.md
2. **Configure Real Jira** - Follow JIRA_INTEGRATION_GUIDE.md
3. **Add Production Data** - Replace mock data with real integrations
4. **Deploy** - Follow deployment guide (when ready)

## 📚 Related Documentation

- `FRONTEND_REDESIGN_SUMMARY.md` - What was built
- `MIGRATION_GUIDE.md` - How to update stage components
- `JIRA_INTEGRATION_GUIDE.md` - Connect to real Jira
- `DESIGN_MOCKUPS.md` - Visual design reference
- `README.md` - General project overview
