const db = require('./src/db/database');

// Get all table names
console.log('\n=== Database Tables ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
tables.forEach(t => console.log(t.name));

// List all workflows
const workflows = db.prepare('SELECT id, title, current_stage, status, created_at FROM workflows').all();
console.log('\n=== Current Workflows ===');
workflows.forEach(w => {
  console.log(`ID: ${w.id}`);
  console.log(`Title: ${w.title}`);
  console.log(`Current Stage: ${w.current_stage}`);
  console.log(`Status: ${w.status}`);
  console.log(`Created: ${w.created_at}`);
  console.log('---');
});

// Delete all workflows
if (workflows.length > 0) {
  console.log('\nDeleting all workflows...');
  workflows.forEach(w => {
    // Delete all child records in correct order
    try { db.prepare('DELETE FROM audit_trail WHERE workflow_id = ?').run(w.id); } catch(e) { console.log('Skip audit_trail:', e.message); }
    try { db.prepare('DELETE FROM skill_evaluations WHERE workflow_id = ?').run(w.id); } catch(e) { console.log('Skip skill_evaluations:', e.message); }
    try { db.prepare('DELETE FROM review_assignments WHERE workflow_id = ?').run(w.id); } catch(e) { console.log('Skip review_assignments:', e.message); }
    try { db.prepare('DELETE FROM approvals WHERE workflow_id = ?').run(w.id); } catch(e) { console.log('Skip approvals:', e.message); }
    try { db.prepare('DELETE FROM documents WHERE workflow_id = ?').run(w.id); } catch(e) { console.log('Skip documents:', e.message); }
    try { db.prepare('DELETE FROM test_cases WHERE workflow_id = ?').run(w.id); } catch(e) { console.log('Skip test_cases:', e.message); }
    try { db.prepare('DELETE FROM tcl_scripts WHERE workflow_id = ?').run(w.id); } catch(e) { console.log('Skip tcl_scripts:', e.message); }
    try { db.prepare('DELETE FROM regression_results WHERE workflow_id = ?').run(w.id); } catch(e) { console.log('Skip regression_results:', e.message); }
    try { db.prepare('DELETE FROM regression_runs WHERE workflow_id = ?').run(w.id); } catch(e) { console.log('Skip regression_runs:', e.message); }
    try { db.prepare('DELETE FROM stages WHERE workflow_id = ?').run(w.id); } catch(e) { console.log('Skip stages:', e.message); }
    // Finally delete the workflow itself
    db.prepare('DELETE FROM workflows WHERE id = ?').run(w.id);
    console.log(`✓ Deleted workflow: ${w.title} (${w.id})`);
  });
  console.log('\nAll workflows deleted successfully!');
} else {
  console.log('\nNo workflows to delete.');
}
