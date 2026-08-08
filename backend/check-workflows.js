const db = require('./src/db/database');

const allWorkflows = db.prepare('SELECT id, title, status FROM workflows').all();
console.log('Total workflows:', allWorkflows.length);
allWorkflows.forEach(w => console.log('  -', w.id, '|', w.title, '|', w.status));

const activeWorkflows = db.prepare('SELECT id, title, status FROM workflows WHERE status = ?').all('active');
console.log('\nActive workflows:', activeWorkflows.length);
activeWorkflows.forEach(w => console.log('  -', w.id, '|', w.title, '|', w.status));
