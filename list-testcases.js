const db = require('better-sqlite3')('data/qa_workflow.db');
const r = db.prepare("SELECT content FROM documents WHERE workflow_id='0eb053b8-4346-437e-86b5-00f952e2c08f' AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1").get();
const lines = r.content.split('\n').filter(l => /^#### [0-9]/.test(l));
console.log(lines.join('\n'));
console.log('\nTotal test cases:', lines.length);
