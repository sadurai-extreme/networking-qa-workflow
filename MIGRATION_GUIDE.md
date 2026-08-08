# Frontend Redesign - Migration Guide

## Overview
The frontend has been redesigned with separate pages for each stage and a main dashboard with release selection and Jira integration.

## Key Changes

### 1. **Routing Architecture**
- Added React Router with separate routes for each page
- Each stage now has its own route: `/workflow/:workflowId/stage/:stageNumber`
- Home dashboard: `/`
- Admin dashboard: `/admin`

### 2. **New Navigation System**
- Created `useWorkflowNavigation` hook for stage navigation
- Stages can now navigate programmatically between stages
- Sidebar menu items are now clickable and navigate between stages

### 3. **Main Dashboard Page**
- New `HomePage.jsx` with release selector
- Integrated with Jira API to fetch stories by release
- Displays active and completed workflows
- Statistics cards showing workflow metrics
- "Start QA" button for each story to create workflows

### 4. **Backend Changes**
- New `/api/releases` endpoint to fetch EXOS releases
- New `/api/releases/:release/stories` endpoint to fetch stories for a release
- Workflows now store `jira_release` and `jira_story_id` metadata
- Mock data fallback when Jira is not configured

## How to Update Stage Components

### Before (Old Pattern):
```jsx
import { useWorkflowStore } from '../../store';

export default function Stage2() {
  const { workflow, advanceStage } = useWorkflowStore();
  
  const handleApprove = async () => {
    // ... do work
    await advanceStage();
  };
}
```

### After (New Pattern):
```jsx
import { useWorkflowStore } from '../../store';
import { useWorkflowNavigation } from '../../hooks/useWorkflowNavigation';

export default function Stage2() {
  const { workflow } = useWorkflowStore();
  const { goToNextStage, workflowId } = useWorkflowNavigation();
  
  const handleApprove = async () => {
    // ... do work
    await goToNextStage(); // This advances AND navigates
  };
}
```

## useWorkflowNavigation Hook API

```jsx
const {
  workflowId,        // Current workflow ID from URL params
  workflow,          // Current workflow object from store
  goToStage,         // Navigate to specific stage: goToStage(3)
  goToNextStage,     // Advance workflow and navigate to next stage
  goToDashboard,     // Navigate to home dashboard
  goToAdmin,         // Navigate to admin dashboard
} = useWorkflowNavigation();
```

## Stage Components to Update

Update the following stage components to use the new navigation hook:

- [x] Stage1.jsx - ✅ **DONE** (Reference implementation)
- [ ] Stage2.jsx - Replace `advanceStage()` with `goToNextStage()`
- [ ] Stage3.jsx - Replace `advanceStage()` with `goToNextStage()`
- [ ] Stage4.jsx - Replace `advanceStage()` with `goToNextStage()`
- [ ] Stage5.jsx - Replace `advanceStage()` with `goToNextStage()` + Fix useUserStore import
- [ ] Stage6.jsx - Replace `advanceStage()` with `goToNextStage()`
- [ ] Stage7.jsx - Replace `advanceStage()` with `goToNextStage()`
- [ ] Stage8.jsx - Replace `advanceStage()` with `goToNextStage()`
- [ ] Stage9.jsx - Update complete workflow flow to navigate to dashboard

## Testing Checklist

After updating all components, test:

1. ✅ Navigation from dashboard to workflows
2. ✅ Creating new workflows from release stories
3. ✅ Clicking sidebar menu items navigates between stages
4. ✅ Advancing stages navigates to next stage automatically
5. ⬜ All approval flows work correctly
6. ⬜ WebSocket updates work in new routing context
7. ⬜ Admin dashboard accessible and functional
8. ⬜ Workflow completion redirects to dashboard

## Environment Variables

Add to `backend/.env`:
```env
JIRA_PROJECT=NOS
```

## Jira Integration

The system now integrates with Jira to:
1. Fetch all available EXOS releases (fixVersions)
2. Fetch stories for a specific release using JQL
3. Auto-detect story type (API vs Feature) based on title/description/labels
4. Create workflows pre-populated with release and story metadata

## Benefits

✅ Better user experience with separate pages for each stage
✅ Easier navigation between stages
✅ Main dashboard provides overview of all workflows
✅ Direct integration with Jira releases and stories
✅ Cleaner URL structure with meaningful routes
✅ Better browser history support (back/forward navigation)
✅ Easier to bookmark specific stages
✅ More scalable architecture for future features
