const db = require('./src/db/database');

console.log('\n=== Documents Table Schema ===');
const schema = db.prepare('SELECT sql FROM sqlite_master WHERE type=? AND name=?').get('table', 'documents');
console.log(schema.sql);

console.log('\n=== Sample Documents ===');
const docs = db.prepare('SELECT id, workflow_id, filename, doc_type, stage_number, LENGTH(content) as content_length FROM documents LIMIT 3').all();
docs.forEach(d => console.log(d));
