# Version Control System - Phase 1 Implementation
## **Deployment Guide & Testing Checklist**

**Date**: July 24, 2026  
**Phase**: Phase 1 - Core Version Control  
**Status**: ✅ READY FOR DEPLOYMENT

---

## 🎯 **What Was Implemented**

### **1. Database Layer** ✅
- **New Tables Created**:
  - `document_versions` - Complete version history with content, metadata
  - `document_changes` - Detailed line-by-line change tracking
  - `document_relationships` - Cross-document traceability links
  - `version_annotations` - Comments and notes on versions
  
- **documents Table Enhanced**:
  - Added: `is_active`, `parent_version_id`, `created_by`, `change_summary`, `change_reason`, `tags`

- **Auto-Migration**: Schema updates run automatically on server start

### **2. Backend APIs** ✅
**New File**: `backend/src/routes/versionControl.js`

**Endpoints Created**:
```
GET    /api/documents/:doc_id/versions              # Version history
GET    /api/documents/:doc_id/versions/:version     # Get specific version
GET    /api/documents/:doc_id/compare?v1=X&v2=Y     # Compare versions
POST   /api/documents/:doc_id/update                # Create new version
POST   /api/documents/:doc_id/rollback              # Rollback to previous version
POST   /api/documents/:doc_id/versions/:v/tag       # Tag a version
GET    /api/documents/:doc_id/relationships         # Get traceability
POST   /api/documents/relationship                  # Create relationship
POST   /api/versions/:version_id/annotations        # Add annotation
GET    /api/versions/:version_id/annotations        # Get annotations
GET    /api/workflows/:workflow_id/traceability     # Full workflow traceability
```

### **3. Utility Functions** ✅
**New File**: `backend/src/utils/versionControl.js`

**Functions**:
- `createDocumentVersion()` - Create new version with metadata
- `getDocumentVersionHistory()` - Retrieve all versions
- `getDocumentVersion()` - Get specific version content
- `compareDocumentVersions()` - Line-by-line diff
- `rollbackDocumentVersion()` - Restore previous version
- `createDocumentRelationship()` - Link documents for traceability
- `getDocumentRelationships()` - Get related documents
- `addVersionAnnotation()` - Comment on versions
- `getVersionAnnotations()` - Get version comments
- `getWorkflowTraceability()` - Complete workflow version chain

### **4. Frontend Components** ✅
**New Files**:
- `frontend/src/components/VersionHistoryModal.jsx` - Version history UI
- `frontend/src/components/VersionComparison.jsx` - Side-by-side diff viewer

**Features**:
- Timeline-based version history display
- View any version content
- Compare two versions side-by-side
- Rollback with reason input
- Tag versions (approved, tested, etc.)
- Current version highlighting

### **5. Stage Integration** ✅
**Modified Files**:
- `backend/src/routes/stage2.js` - Skill file versioning
- `backend/src/routes/stage3.js` - Test plan versioning

**What Happens Now**:
- Every skill file creation/update creates a version entry
- Every test plan generation creates a version entry
- Change summaries and reasons are captured
- Automatic tagging (initial, generated, regenerated, etc.)

---

## 📦 **Files Changed**

### **New Files Created** (6):
1. `backend/src/db/migrations/001_version_control.sql`
2. `backend/src/utils/versionControl.js`
3. `backend/src/routes/versionControl.js`
4. `frontend/src/components/VersionHistoryModal.jsx`
5. `frontend/src/components/VersionComparison.jsx`
6. `VERSION_CONTROL_PHASE1_DEPLOYMENT.md` (this file)

### **Modified Files** (4):
1. `backend/src/db/database.js` - Added version control tables & auto-migration
2. `backend/src/server.js` - Registered version control routes
3. `backend/src/routes/stage2.js` - Integrated versioning for skill files
4. `backend/src/routes/stage3.js` - Integrated versioning for test plans

---

## 🚀 **Deployment Steps**

### **Step 1: Backup Current Database**
```powershell
# On remote server 10.127.26.9
ssh root@10.127.26.9
cd ~/networking-qa-workflow/backend/data
cp qa_workflow.db qa_workflow_backup_$(date +%Y%m%d_%H%M%S).db
ls -lh qa_workflow_backup_*
```

### **Step 2: Deploy Backend Changes**
```powershell
# On local machine
scp -r backend/src/db root@10.127.26.9:~/networking-qa-workflow/backend/src/
scp -r backend/src/utils root@10.127.26.9:~/networking-qa-workflow/backend/src/
scp -r backend/src/routes root@10.127.26.9:~/networking-qa-workflow/backend/src/
```

### **Step 3: Restart Backend**
```powershell
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend && source ~/.nvm/nvm.sh && nvm use 16 && pm2 restart all"

# Verify auto-migration ran successfully
ssh root@10.127.26.9 "tail -100 ~/networking-qa-workflow/backend/server.log | grep -E '(Version control|migration|is_active|document_versions)'"
```

### **Step 4: Verify Database Schema**
```powershell
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend && source ~/.nvm/nvm.sh && nvm use 16 && node -e \"
const db = require('./src/db/database');
const tables = db.prepare('SELECT name FROM sqlite_master WHERE type=\\\"table\\\" ORDER BY name').all();
console.log('Tables:', tables.map(t => t.name).join(', '));

const docVersions = db.prepare('SELECT COUNT(*) as count FROM document_versions').get();
console.log('Document versions table exists:', docVersions);

const docCols = db.prepare('PRAGMA table_info(documents)').all();
console.log('Documents columns:', docCols.map(c => c.name).join(', '));
\""
```

### **Step 5: Deploy Frontend Changes**
```powershell
# Copy new components
scp frontend/src/components/VersionHistoryModal.jsx root@10.127.26.9:~/networking-qa-workflow/frontend/src/components/
scp frontend/src/components/VersionComparison.jsx root@10.127.26.9:~/networking-qa-workflow/frontend/src/components/

# Rebuild frontend
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/frontend && source ~/.nvm/nvm.sh && nvm use 16 && npm run build"

# Restart frontend
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/frontend && pm2 restart frontend"
```

### **Step 6: Health Check**
```powershell
ssh root@10.127.26.9 "curl -s http://localhost:5100/api/health && echo '' && ps aux | grep 'node src/server.js' | grep -v grep"
```

---

## ✅ **Testing Checklist**

### **Backend API Testing**

#### **Test 1: Version History**
```bash
# Get existing document
WORKFLOW_ID="your-workflow-id"
DOC_ID=$(ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend && source ~/.nvm/nvm.sh && nvm use 16 && node -e \"
const db = require('./src/db/database');
const doc = db.prepare('SELECT id FROM documents WHERE workflow_id=? LIMIT 1').get('$WORKFLOW_ID');
console.log(doc.id);
\"")

# Get version history
ssh root@10.127.26.9 "curl -s http://localhost:5100/api/documents/$DOC_ID/versions | jq ."
```
**Expected**: JSON with versions array, each with version_number, created_at, created_by, change_summary

#### **Test 2: Create New Version**
```bash
# Update a document
ssh root@10.127.26.9 "curl -X POST http://localhost:5100/api/documents/$DOC_ID/update \
  -H 'Content-Type: application/json' \
  -d '{
    \"content\": \"Updated content for testing\",
    \"change_summary\": \"Test update from CLI\",
    \"change_reason\": \"Testing version control deployment\",
    \"tags\": \"test,cli-update\",
    \"user_id\": \"user-admin\"
  }' | jq ."
```
**Expected**: `{ "success": true, "version": { "version_id": "...", "version_number": 2 } }`

#### **Test 3: Compare Versions**
```bash
# Compare version 1 and 2
ssh root@10.127.26.9 "curl -s 'http://localhost:5100/api/documents/$DOC_ID/compare?v1=1&v2=2' | jq ."
```
**Expected**: JSON with diff array showing added/deleted/modified lines

#### **Test 4: Rollback**
```bash
# Rollback to version 1
ssh root@10.127.26.9 "curl -X POST http://localhost:5100/api/documents/$DOC_ID/rollback \
  -H 'Content-Type: application/json' \
  -d '{
    \"version_number\": 1,
    \"reason\": \"Testing rollback functionality\",
    \"user_id\": \"user-admin\"
  }' | jq ."
```
**Expected**: `{ "success": true, "message": "Rolled back to version 1", "version": { "version_number": 3 } }`

#### **Test 5: Traceability**
```bash
# Get workflow traceability
ssh root@10.127.26.9 "curl -s http://localhost:5100/api/workflows/$WORKFLOW_ID/traceability | jq ."
```
**Expected**: JSON showing all documents, their versions, and relationships

### **Stage Integration Testing**

#### **Test 6: Skill File Generation Creates Version**
1. Navigate to Stage 2 in frontend
2. Generate a skill file
3. Check database:
```bash
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend && source ~/.nvm/nvm.sh && nvm use 16 && node -e \"
const db = require('./src/db/database');
const doc = db.prepare('SELECT * FROM documents WHERE doc_type=\\\"skill_file\\\" ORDER BY created_at DESC LIMIT 1').get();
console.log('Document:', doc.id, 'Version:', doc.version);

const versions = db.prepare('SELECT * FROM document_versions WHERE document_id=?').all(doc.id);
console.log('Version history entries:', versions.length);
versions.forEach(v => console.log('  v' + v.version_number + ':', v.change_summary));
\""
```
**Expected**: 1 document entry, 1 version entry with change_summary "Initial skill file generation"

#### **Test 7: Skill File Regeneration Creates New Version**
1. In Stage 2, click "Regenerate" with user feedback
2. Check version count increased:
```bash
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend && source ~/.nvm/nvm.sh && nvm use 16 && node -e \"
const db = require('./src/db/database');
const doc = db.prepare('SELECT * FROM documents WHERE doc_type=\\\"skill_file\\\" ORDER BY created_at DESC LIMIT 1').get();
const versions = db.prepare('SELECT * FROM document_versions WHERE document_id=?').all(doc.id);
console.log('Total versions:', versions.length);
versions.forEach(v => console.log('  v' + v.version_number + ':', v.change_summary, '|', v.tags));
\""
```
**Expected**: 2+ versions, latest tagged with "regenerated,user-feedback"

#### **Test 8: Test Plan Generation Creates Version**
1. Navigate to Stage 3
2. Generate test plan
3. Verify version entry:
```bash
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend && source ~/.nvm/nvm.sh && nvm use 16 && node -e \"
const db = require('./src/db/database');
const doc = db.prepare('SELECT * FROM documents WHERE doc_type=\\\"test_plan\\\" ORDER BY created_at DESC LIMIT 1').get();
console.log('Document:', doc.id, 'Version:', doc.version, 'Summary:', doc.change_summary);

const versions = db.prepare('SELECT * FROM document_versions WHERE document_id=?').all(doc.id);
console.log('Version entries:', versions.length);
\""
```
**Expected**: test_plan document with version=1, version entry with change_summary

### **Frontend UI Testing**

#### **Test 9: Version History Modal** (Manual)
1. Open any workflow with skill file or test plan
2. Look for "Version History" button (you may need to add it to Stage 2/3 UI)
3. Click button → Modal should open
4. Verify:
   - Timeline with versions displayed
   - Version numbers, dates, users visible
   - Tags shown (initial, generated, etc.)
   - "View", "Rollback" buttons present

#### **Test 10: Version Comparison** (Manual)
1. In Version History Modal, click "Compare Versions"
2. Select 2 versions
3. Click "Compare Selected"
4. New tab opens with side-by-side diff
5. Verify:
   - Statistics (added/deleted/modified)
   - Color-coded changes
   - Line numbers visible

#### **Test 11: Rollback with Reason** (Manual)
1. In Version History Modal, click "Rollback" on an older version
2. Modal appears asking for reason
3. Enter reason, click "Rollback"
4. Success message appears
5. Version history refreshes showing new version

---

## 🎨 **Frontend Integration Guide**

The Version History Modal is created but not yet integrated into Stage 2 and Stage 3 UI. Here's how to add it:

### **Add to Stage 2 (Skill File)**
```jsx
// In frontend/src/components/stages/Stage2.jsx
import VersionHistoryModal from '../VersionHistoryModal';

// Add state
const [versionHistoryVisible, setVersionHistoryVisible] = useState(false);
const [currentDocumentId, setCurrentDocumentId] = useState(null);

// Add button near skill file display
<Button 
  icon={<HistoryOutlined />} 
  onClick={() => {
    setCurrentDocumentId(skillFileDocId); // Get from your state
    setVersionHistoryVisible(true);
  }}
>
  Version History
</Button>

// Add modal component
<VersionHistoryModal
  visible={versionHistoryVisible}
  onClose={() => setVersionHistoryVisible(false)}
  documentId={currentDocumentId}
  workflowId={workflowId}
/>
```

### **Add to Stage 3 (Test Plan)**
```jsx
// In frontend/src/components/stages/Stage3.jsx
import VersionHistoryModal from '../VersionHistoryModal';

// Same pattern as Stage 2
// Add button, state, and modal component
```

---

## 📊 **Database Schema Verification**

After deployment, verify schema:

```sql
-- Check new tables exist
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'document%';
-- Expected: document_versions, document_changes, document_relationships

-- Check new columns in documents table
PRAGMA table_info(documents);
-- Expected: is_active, parent_version_id, created_by, change_summary, change_reason, tags

-- Check indexes created
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';
-- Expected: idx_doc_versions_document_id, idx_doc_versions_workflow_id, etc.
```

---

## 🐛 **Troubleshooting**

### **Issue: "table document_versions already exists"**
**Solution**: Tables were already created by auto-migration. This is normal, ignore error.

### **Issue: Version History Modal shows empty**
**Cause**: No document_id passed or document has no versions yet
**Solution**: 
1. Check console for errors
2. Verify `documentId` prop is valid
3. Check API endpoint returns data: `curl http://localhost:5100/api/documents/{doc_id}/versions`

### **Issue: Version comparison shows no changes**
**Cause**: Versions are identical
**Solution**: Normal if content didn't change. Try comparing non-adjacent versions.

### **Issue: Rollback creates version but content doesn't change**
**Cause**: Rollback creates v3 as copy of v1 (by design)
**Solution**: This is correct behavior. The new version preserves rollback history.

### **Issue: Auto-migration errors on startup**
**Cause**: Column already exists from previous attempt
**Solution**: Migration is idempotent - errors are caught and logged but don't crash server

---

## 📈 **Success Metrics**

After deployment, you should see:

1. **Database**: 4 new tables, 6 new columns in documents
2. **API Endpoints**: 11 new endpoints responding
3. **Version Entries**: Every new skill file/test plan creates version entry
4. **Frontend**: Version History Modal opens and displays data
5. **Comparison**: Side-by-side diff shows changes correctly
6. **Rollback**: Creates new version successfully
7. **Traceability**: API returns complete document chain

---

## 🎉 **Phase 1 Complete!**

### **What You Can Do Now**:
- ✅ View complete version history for any document
- ✅ See who changed what and when
- ✅ Compare any two versions side-by-side
- ✅ Rollback to any previous version
- ✅ Add tags to versions (approved, tested, etc.)
- ✅ Track reasons for changes
- ✅ Complete audit trail

### **What's Next (Phase 2)**:
- Enhanced diff algorithm (word-level, not just line-level)
- Visual diff highlighting in UI
- Detailed change tracking (section-by-section)
- Relationship mapping visualization
- Export version history report
- Bulk version operations

### **What's Next (Phase 3)**:
- Traceability dashboard with flowchart
- Cross-stage document linking
- Workflow snapshots
- Advanced filtering and search
- Version approval workflow
- Integration with external systems

---

**🚀 Ready to deploy? Follow Steps 1-6 above!**
