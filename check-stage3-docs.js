const Database = require('better-sqlite3');
const db = new Database('data/qa_workflow.db');
const wfId = '0eb053b8-4346-437e-86b5-00f952e2c08f';

const tp = db.prepare("SELECT id, version, revision_number, filename, created_at FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY version DESC, created_at DESC LIMIT 5").all(wfId);
console.log('TEST PLAN records:'); tp.forEach(r => console.log(JSON.stringify(r)));

const xl = db.prepare("SELECT id, version, filename, created_at FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_excel' ORDER BY version DESC, created_at DESC LIMIT 5").all(wfId);
console.log('EXCEL records:'); xl.forEach(r => console.log(JSON.stringify(r)));

const wd = db.prepare("SELECT id, version, filename, created_at FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_word' ORDER BY version DESC, created_at DESC LIMIT 5").all(wfId);
console.log('WORD records:'); wd.forEach(r => console.log(JSON.stringify(r)));
