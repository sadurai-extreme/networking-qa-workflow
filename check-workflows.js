const db = require('./src/db/database');
const workflows = db.prepare('SELECT * FROM workflows ORDER BY created_at DESC LIMIT 5').all();
console.log('Workflows in database:');
if (workflows.length === 0) {
  console.log('  No workflows found');
} else {
  workflows.forEach(w => {
    console.log('  ID: ' + w.id + ' | Status: ' + w.status);
  });
}
