// Fix the revision 3 test plan that was saved without a version number
const db = require('better-sqlite3')('data/qa_workflow.db');
const wfId = '0eb053b8-4346-437e-86b5-00f952e2c08f';

// Find the test plan with revision_number=3 (no version set)
const r3 = db.prepare("SELECT id, version, revision_number, created_at FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' AND revision_number=3").get(wfId);
console.log('Revision 3 record:', JSON.stringify(r3));

if (r3 && (r3.version === null || r3.version === undefined)) {
  db.prepare("UPDATE documents SET version=3, is_active=1 WHERE id=?").run(r3.id);
  console.log('Fixed: set version=3 and is_active=1 for revision 3 test plan');
} else {
  console.log('No fix needed or record not found');
}

// Verify
const updated = db.prepare("SELECT id, version, revision_number, created_at FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 3").all(wfId);
console.log('\nLatest 3 test plan records after fix:');
updated.forEach(r => console.log(JSON.stringify(r)));
