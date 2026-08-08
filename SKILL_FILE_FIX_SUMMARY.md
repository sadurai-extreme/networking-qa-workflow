# Skill File Mismatch Fix

## Problem
When users clicked "Start Workflow" from the dashboard, the skill file generation showed completely different or generic content that didn't match the selected Jira story.

## Root Cause
The workflow creation flow was only saving **minimal Jira story information**:
- ✅ Story ID (e.g., "EXOS-38882")
- ✅ Title (e.g., "NOS API: updates to OSPF")
- ✅ Release (e.g., "33.7")
- ❌ **MISSING**: Description, Type, Status, Priority

When Stage 2 (Skill File Generation) tried to generate the skill file, it received:
```javascript
{
  id: "EXOS-38882",
  title: "NOS API: updates to OSPF",
  description: "",  // EMPTY!
  type: "Feature",  // DEFAULT!
  release: "33.7"
}
```

The LLM had **no actual requirements** from Jira, so it generated generic placeholder content instead of a specific skill file based on the story details.

## Solution

### 1. Updated Database Schema
**File**: `backend/src/db/database.js`

Added three new columns to the `workflows` table:
- `jira_story_description TEXT`
- `jira_story_status TEXT`
- `jira_story_priority TEXT`

Added automatic migration code to add these columns to existing databases without breaking them.

### 2. Updated Backend Workflow Creation
**File**: `backend/src/routes/workflows.js`

Changed workflow creation endpoint to accept and store full story details:

**Before**:
```javascript
const { title, release, storyId } = req.body;
db.prepare(`INSERT INTO workflows (id, title, jira_release, jira_story_id, created_by) VALUES (?, ?, ?, ?, ?)`)
  .run(id, title, release || null, storyId || null, created_by);
```

**After**:
```javascript
const { title, release, storyId, description, type, status, priority } = req.body;
db.prepare(`INSERT INTO workflows (id, title, jira_release, jira_story_id, jira_story_description, jira_story_type, jira_story_status, jira_story_priority, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(id, title, release || null, storyId || null, description || null, type || 'Feature', status || null, priority || null, created_by);
```

### 3. Updated Frontend - HomePage
**File**: `frontend/src/pages/HomePage.jsx`

Changed workflow creation to pass full story object:

**Before**:
```javascript
setNewWorkflowData({
  title: story.title,
  release: selectedRelease,
  storyId: story.id,
});
```

**After**:
```javascript
setNewWorkflowData({
  title: story.title,
  release: selectedRelease,
  storyId: story.id,
  description: story.description || '',
  type: story.type || 'Feature',
  status: story.status || '',
  priority: story.priority || ''
});
```

### 4. Updated Frontend - Store
**File**: `frontend/src/store/index.js`

Changed store to send full story metadata to backend:

**Before**:
```javascript
const payload = { 
  title,
  ...metadata 
};
```

**After**:
```javascript
const payload = { 
  title,
  release: metadata.release,
  storyId: metadata.storyId,
  description: metadata.description || '',
  type: metadata.type || 'Feature',
  status: metadata.status || '',
  priority: metadata.priority || ''
};
```

## Testing Steps

1. **Restart the backend server** to apply database migrations:
   ```powershell
   cd c:\My_Projects\networking-qa-workflow\backend
   npm start
   ```

2. **Refresh the frontend** (already running at http://localhost:5174)

3. **Test the workflow creation**:
   - Login to the dashboard
   - Select a release (e.g., "EXOS 33.7")
   - Click "Start Workflow" on a Jira story
   - Create the workflow
   - Navigate to Stage 2 (Skill File Generation)
   - Click "Generate Skill File"
   - Verify the generated skill file contains specific details from the Jira story description

## Expected Result

After the fix, the skill file generator will receive:
```javascript
{
  id: "EXOS-38882",
  title: "NOS API: updates to OSPF",
  description: "[Full Jira story description with requirements]",
  type: "Feature",
  status: "In Progress",
  priority: "High",
  release: "33.7"
}
```

The LLM will now have full context to generate an accurate, requirement-specific skill file that matches the Jira story details.

## Impact

- ✅ Skill files will now be generated based on actual Jira story requirements
- ✅ No more generic/placeholder skill files
- ✅ Better alignment between Jira stories and test automation
- ✅ Backward compatible - existing workflows won't break (migration handles this)
- ✅ Frontend and backend now send/store complete story metadata

## Files Changed

1. `backend/src/db/database.js` - Database schema + migration
2. `backend/src/routes/workflows.js` - Workflow creation endpoint
3. `frontend/src/pages/HomePage.jsx` - Workflow creation UI
4. `frontend/src/store/index.js` - State management

## Next Steps

1. Restart backend server
2. Test workflow creation with a real Jira story
3. Verify skill file generation shows correct content
4. Monitor for any database migration errors in backend logs
