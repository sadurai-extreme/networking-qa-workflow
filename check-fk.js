const db = require('./src/db/database');

// Get a workflow ID
const workflow = db.prepare('SELECT id FROM workflows WHERE status = ? LIMIT 1').get('active');
if (!workflow) {
  console.log('No active workflows found');
  process.exit(0);
}

console.log('Checking foreign keys for workflow:', workflow.id);

// Check all tables for references
const tables = [
  'stages', 'documents', 'approvals', 'review_assignments', 'test_cases', 
  'regression_runs', 'skill_evaluations', 'audit_trail', 'chat_sessions',
  'document_versions', 'document_changes', 'document_relationships', 'version_annotations'
];

tables.forEach(table => {
  try {
    const query = `SELECT COUNT(*) as count FROM ${table} WHERE workflow_id = ?`;
    const result = db.prepare(query).get(workflow.id);
    if (result.count > 0) {
      console.log(`  ${table}: ${result.count} records`);
    }
  } catch (e) {
    // Table might not have workflow_id column
  }
});
