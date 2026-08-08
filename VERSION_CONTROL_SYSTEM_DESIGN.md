# Document Version Control & Traceability System
## **Complete Implementation Plan**

**Date**: July 24, 2026  
**Purpose**: Track all document changes across workflow stages with full traceability  
**Components**: Database schema, Backend APIs, Frontend UI

---

## 🎯 **System Overview**

### **What Gets Version Controlled**:
1. **Skill Files** (Stage 2) - Updated based on test results
2. **Test Plans** (Stage 3) - Modified during review
3. **Test Cases** (Stage 4) - Updated after execution
4. **TCL Scripts** (Stage 5) - Refined during automation
5. **QTest Upload Data** (Stage 6) - Tracked for integration

### **Key Features**:
- ✅ **Automatic Versioning**: Every save creates a new version
- ✅ **Change Tracking**: Records who, when, why for each change
- ✅ **Version History**: View all versions with timestamps
- ✅ **Diff Viewing**: Compare any two versions side-by-side
- ✅ **Rollback**: Restore any previous version
- ✅ **Cross-Document Links**: Track relationships (skill v2 → test plan v3)
- ✅ **Audit Trail**: Complete history for compliance
- ✅ **Change Annotations**: Attach notes to each version

---

## 📊 **Database Schema**

### **1. Enhanced `documents` Table**
```sql
-- Already exists with these columns:
- id (PRIMARY KEY)
- workflow_id
- stage_number
- doc_type (skill_file, test_plan, test_case, tcl_script)
- filename
- filepath
- content
- version (INTEGER)
- created_at

-- NEW columns to add:
- is_active (INTEGER DEFAULT 1) - Current active version
- parent_version_id (TEXT) - Links to previous version
- created_by (TEXT) - User who created this version
- change_summary (TEXT) - Brief description of changes
- change_reason (TEXT) - Why was it changed
- tags (TEXT) - Comma-separated tags (reviewed, approved, tested)
```

### **2. New `document_versions` Table** (Complete History)
```sql
CREATE TABLE document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL, -- Links to documents.id
  workflow_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT, -- SHA256 of content for integrity
  file_size INTEGER, -- Size in bytes
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  change_summary TEXT,
  change_reason TEXT,
  change_type TEXT, -- 'create', 'update', 'rollback', 'auto-save'
  parent_version_id TEXT, -- Previous version
  tags TEXT, -- 'draft', 'reviewed', 'approved', 'tested', 'failed'
  metadata TEXT, -- JSON of additional info
  FOREIGN KEY (workflow_id) REFERENCES workflows(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX idx_doc_versions_document_id ON document_versions(document_id);
CREATE INDEX idx_doc_versions_workflow_id ON document_versions(workflow_id);
```

### **3. New `document_changes` Table** (Detailed Change Log)
```sql
CREATE TABLE document_changes (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  change_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  changed_by TEXT NOT NULL,
  change_type TEXT NOT NULL, -- 'line_add', 'line_delete', 'line_modify'
  section TEXT, -- Which section was changed
  old_value TEXT,
  new_value TEXT,
  line_number INTEGER,
  change_description TEXT,
  FOREIGN KEY (version_id) REFERENCES document_versions(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);
CREATE INDEX idx_changes_version_id ON document_changes(version_id);
```

### **4. New `document_relationships` Table** (Cross-Document Links)
```sql
CREATE TABLE document_relationships (
  id TEXT PRIMARY KEY,
  source_doc_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  target_doc_id TEXT NOT NULL,
  target_version TEXT NOT NULL,
  relationship_type TEXT NOT NULL, -- 'derived_from', 'generated_from', 'updated_based_on'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (source_doc_id) REFERENCES documents(id),
  FOREIGN KEY (target_doc_id) REFERENCES documents(id)
);
CREATE INDEX idx_relationships_source ON document_relationships(source_doc_id);
CREATE INDEX idx_relationships_target ON document_relationships(target_doc_id);
```

### **5. New `version_annotations` Table** (Comments on Versions)
```sql
CREATE TABLE version_annotations (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  annotation TEXT NOT NULL,
  annotation_type TEXT, -- 'comment', 'issue', 'suggestion', 'approval'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved INTEGER DEFAULT 0,
  FOREIGN KEY (version_id) REFERENCES document_versions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🔧 **Backend API Endpoints**

### **Version Management**:
```javascript
// Get version history for a document
GET /api/documents/:doc_id/versions
Response: [{version, created_at, created_by, change_summary, tags}]

// Get specific version content
GET /api/documents/:doc_id/versions/:version_number
Response: {id, content, metadata, created_by, created_at}

// Compare two versions (diff)
GET /api/documents/:doc_id/compare?v1=1&v2=3
Response: {diff: [{type: 'add|delete|modify', line, content}]}

// Rollback to specific version
POST /api/documents/:doc_id/rollback
Body: {version_number, reason}
Response: {new_version, success}

// Update document (creates new version)
PUT /api/documents/:doc_id
Body: {content, change_summary, change_reason, tags}
Response: {version_number, version_id}

// Tag a version
POST /api/documents/:doc_id/versions/:version/tag
Body: {tag: 'approved' | 'tested' | 'failed'}

// Get document relationships (traceability)
GET /api/documents/:doc_id/relationships
Response: [{related_doc, relationship_type, version}]

// Add annotation to version
POST /api/versions/:version_id/annotations
Body: {annotation, type}
```

### **Workflow Version Snapshot**:
```javascript
// Create snapshot of all documents at current stage
POST /api/workflows/:workflow_id/snapshot
Body: {stage, description}
Response: {snapshot_id, documents: [{doc_type, version}]}

// Get workflow version history
GET /api/workflows/:workflow_id/version-history
Response: [{stage, timestamp, documents, changes}]
```

---

## 💻 **Frontend UI Components**

### **1. Version History Modal**:
```jsx
<VersionHistoryModal>
  <Timeline>
    {versions.map(v => (
      <TimelineItem>
        <Version>v{v.version}</Version>
        <Timestamp>{v.created_at}</Timestamp>
        <User>{v.created_by}</User>
        <ChangeSummary>{v.change_summary}</ChangeSummary>
        <Tags>{v.tags.map(tag => <Tag>{tag}</Tag>)}</Tags>
        <Actions>
          <Button onClick={viewVersion}>View</Button>
          <Button onClick={compareVersion}>Compare</Button>
          <Button onClick={rollbackVersion}>Rollback</Button>
        </Actions>
      </TimelineItem>
    ))}
  </Timeline>
</VersionHistoryModal>
```

### **2. Version Comparison View**:
```jsx
<VersionCompareView>
  <Split>
    <LeftPanel>
      <Header>Version {v1} ({date1})</Header>
      <CodeDiff 
        value={content1} 
        highlights={deletedLines}
        style="deleted"
      />
    </LeftPanel>
    <RightPanel>
      <Header>Version {v2} ({date2})</Header>
      <CodeDiff 
        value={content2} 
        highlights={addedLines}
        style="added"
      />
    </RightPanel>
  </Split>
  <DiffSummary>
    {added} lines added, {deleted} lines deleted, {modified} lines modified
  </DiffSummary>
</VersionCompareView>
```

### **3. Document Edit with Version Control**:
```jsx
<DocumentEditor>
  <Header>
    <Title>{docType} - Version {currentVersion}</Title>
    <VersionBadge>{isActive ? 'Active' : 'Historical'}</VersionBadge>
    <Button onClick={showVersionHistory}>Version History</Button>
  </Header>
  
  <Editor value={content} onChange={handleChange} />
  
  <SavePanel>
    <Input 
      placeholder="Change summary (required)"
      value={changeSummary}
      onChange={setChangeSummary}
    />
    <TextArea 
      placeholder="Why are you making this change?"
      value={changeReason}
      onChange={setChangeReason}
    />
    <TagSelect>
      <Option>draft</Option>
      <Option>reviewed</Option>
      <Option>approved</Option>
    </TagSelect>
    <Button 
      onClick={saveNewVersion}
      disabled={!changeSummary}
    >
      Save as Version {currentVersion + 1}
    </Button>
  </SavePanel>
</DocumentEditor>
```

### **4. Workflow Traceability Dashboard**:
```jsx
<TraceabilityDashboard>
  <FlowDiagram>
    <Stage name="Skill File">
      <Document>skill-v1.md</Document>
      <Arrow />
      <Document>skill-v2.md</Document>
      <ChangeNote>Updated based on test results</ChangeNote>
    </Stage>
    
    <Stage name="Test Plan">
      <Document>testplan-v1.md</Document>
      <RelationshipLink from="skill-v2.md" />
      <Arrow />
      <Document>testplan-v2.md</Document>
      <ChangeNote>Regenerated with review comments</ChangeNote>
    </Stage>
    
    <Stage name="Test Cases">
      <Document>testcases-v1.json</Document>
      <RelationshipLink from="testplan-v2.md" />
      <Arrow />
      <Document>testcases-v2.json</Document>
      <ChangeNote>Updated after execution failures</ChangeNote>
    </Stage>
  </FlowDiagram>
  
  <VersionTable>
    <Row>
      <Cell>Skill File</Cell>
      <Cell>v2</Cell>
      <Cell>Stage 2</Cell>
      <Cell>John Doe</Cell>
      <Cell>2026-07-23</Cell>
      <Cell><Tag>approved</Tag></Cell>
    </Row>
    <Row>
      <Cell>Test Plan</Cell>
      <Cell>v2</Cell>
      <Cell>Stage 3</Cell>
      <Cell>Jane Smith</Cell>
      <Cell>2026-07-24</Cell>
      <Cell><Tag>tested</Tag><Tag>failed</Tag></Cell>
    </Row>
  </VersionTable>
</TraceabilityDashboard>
```

---

## 🔄 **Workflow Integration**

### **Stage 2: Skill File Updates**:
```javascript
// After test execution reveals issues
async function updateSkillFileBasedOnTestResults(workflow_id, test_results) {
  const currentSkill = await getActiveSkillFile(workflow_id);
  
  // Generate updated skill file
  const updatedContent = await regenerateSkillWithFeedback(
    currentSkill.content,
    test_results
  );
  
  // Create new version
  const newVersion = await createDocumentVersion({
    document_id: currentSkill.id,
    workflow_id,
    content: updatedContent,
    created_by: user_id,
    change_summary: 'Updated based on test execution results',
    change_reason: `Tests revealed: ${test_results.issues.join(', ')}`,
    change_type: 'update',
    parent_version_id: currentSkill.version_id,
    tags: 'draft,needs-review'
  });
  
  // Link to test execution
  await createDocumentRelationship({
    source_doc_id: newVersion.id,
    source_version: newVersion.version,
    target_doc_id: test_results.doc_id,
    target_version: test_results.version,
    relationship_type: 'updated_based_on',
    notes: 'Skill file updated to address test failures'
  });
  
  return newVersion;
}
```

### **Stage 3: Test Plan Updates**:
```javascript
// After test case review/feedback
async function updateTestPlanBasedOnReview(workflow_id, review_comments) {
  const currentTestPlan = await getActiveTestPlan(workflow_id);
  
  // Regenerate with comments
  const updatedContent = await regenerateTestPlanWithComments(
    currentTestPlan.content,
    review_comments
  );
  
  const newVersion = await createDocumentVersion({
    document_id: currentTestPlan.id,
    workflow_id,
    content: updatedContent,
    created_by: user_id,
    change_summary: 'Addressed review comments',
    change_reason: review_comments,
    change_type: 'update',
    parent_version_id: currentTestPlan.version_id,
    tags: 'revised,awaiting-approval'
  });
  
  return newVersion;
}
```

### **Stage 4-6: Iterative Updates**:
```javascript
// Generic update function for any document type
async function updateDocument(doc_id, updates) {
  const current = await getDocument(doc_id);
  
  // Calculate diff
  const changes = calculateDiff(current.content, updates.content);
  
  // Create new version
  const newVersion = await createDocumentVersion({
    document_id: doc_id,
    workflow_id: current.workflow_id,
    content: updates.content,
    created_by: updates.user_id,
    change_summary: updates.summary,
    change_reason: updates.reason,
    change_type: 'update',
    parent_version_id: current.version_id,
    tags: updates.tags
  });
  
  // Log detailed changes
  for (const change of changes) {
    await logDocumentChange({
      version_id: newVersion.id,
      workflow_id: current.workflow_id,
      changed_by: updates.user_id,
      change_type: change.type,
      section: change.section,
      old_value: change.old,
      new_value: change.new,
      line_number: change.line
    });
  }
  
  return newVersion;
}
```

---

## 📈 **Traceability Matrix**

### **Example Traceability Flow**:
```
Skill File v1 (Stage 2 - Initial)
    ↓ generated_from
Test Plan v1 (Stage 3 - Initial)
    ↓ generated_from
Test Cases v1 (Stage 4 - Initial)
    ↓ executed_in
Test Execution Results
    ↓ revealed_issues
Skill File v2 (Stage 2 - Updated)
    ↓ triggered_regeneration
Test Plan v2 (Stage 3 - Regenerated)
    ↓ generated_from
Test Cases v2 (Stage 4 - Updated)
    ↓ generated_scripts
TCL Scripts v1 (Stage 5 - Initial)
    ↓ uploaded_to
QTest Integration (Stage 6)
```

### **Traceability Query Example**:
```javascript
// Get full traceability chain
GET /api/workflows/:workflow_id/traceability

Response:
{
  "workflow_id": "abc-123",
  "jira_story": "EXOS-39369",
  "document_chain": [
    {
      "stage": 2,
      "doc_type": "skill_file",
      "versions": [
        {
          "version": 1,
          "created_at": "2026-07-20",
          "created_by": "John",
          "change": "Initial generation",
          "derived_from": null
        },
        {
          "version": 2,
          "created_at": "2026-07-24",
          "created_by": "Jane",
          "change": "Updated based on test results",
          "derived_from": "test_cases_v1_execution"
        }
      ]
    },
    {
      "stage": 3,
      "doc_type": "test_plan",
      "versions": [
        {
          "version": 1,
          "created_at": "2026-07-21",
          "derived_from": "skill_file_v1"
        },
        {
          "version": 2,
          "created_at": "2026-07-24",
          "derived_from": "skill_file_v2"
        }
      ]
    }
  ]
}
```

---

## 🚀 **Implementation Priority**

### **Phase 1: Core Version Control** (Week 1)
- [ ] Database schema updates
- [ ] Basic version creation API
- [ ] Version history viewing
- [ ] Simple rollback

### **Phase 2: Change Tracking** (Week 2)
- [ ] Diff calculation
- [ ] Change logging
- [ ] Comparison UI

### **Phase 3: Traceability** (Week 3)
- [ ] Document relationships
- [ ] Traceability dashboard
- [ ] Cross-document links

### **Phase 4: Advanced Features** (Week 4)
- [ ] Annotations/comments
- [ ] Version tagging
- [ ] Workflow snapshots
- [ ] Export/reporting

---

## 💡 **Usage Examples**

### **Scenario 1: Test Failure Triggers Update**
1. Test cases v1 executed → 5 tests failed
2. QA reviews failures → identifies CLI syntax issue in skill file
3. QA updates skill file → creates skill file v2
   - Change summary: "Fixed CLI syntax for rate-limiting commands"
   - Change reason: "Test cases TC-001 to TC-005 failed due to incorrect syntax"
   - Tags: draft, needs-verification
4. System regenerates test plan v2 from skill file v2
   - Relationship: test_plan_v2 ← derived_from ← skill_file_v2
5. New test cases v2 generated
6. Traceability: Complete chain from failure → fix → re-test

### **Scenario 2: Review Comment Integration**
1. Test plan v1 generated
2. Senior QA reviews → adds comments
3. System regenerates test plan v2
   - Change summary: "Addressed review comments"
   - Change reason: "Added boundary value tests, corrected IXIA parameters"
4. Version comparison shows exactly what changed
5. Annotations preserved for audit

### **Scenario 3: Rollback After Bad Update**
1. Skill file v3 introduced errors
2. Test plan v4 generated from v3 → fails validation
3. QA rolls back skill file to v2
   - New version v4 created (copy of v2)
   - Change reason: "Rollback due to validation failures in v3"
4. Test plan regenerated from skill file v4
5. Traceability shows rollback in audit trail

---

## 📚 **Benefits**

1. **Complete Audit Trail**: Every change tracked with who/when/why
2. **Regulatory Compliance**: Full traceability for certification
3. **Error Recovery**: Easy rollback to working versions
4. **Change Impact**: See exactly what changed between versions
5. **Team Collaboration**: Multiple people can review/comment
6. **Quality Assurance**: Tag versions as tested/approved
7. **Root Cause Analysis**: Trace bugs back to original changes
8. **Knowledge Transfer**: New team members understand evolution

---

**Ready to implement?** This gives you enterprise-grade version control with full traceability across your entire workflow!
