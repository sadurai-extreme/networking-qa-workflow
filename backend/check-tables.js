const db = require('./src/db/database');

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('\n=== All Tables ===');
tables.forEach(t => console.log('  -', t.name));

// Check foreign keys for workflows table
console.log('\n=== Tables with Foreign Keys to workflows ===');
tables.forEach(table => {
  try {
    const fks = db.prepare(`PRAGMA foreign_key_list(${table.name})`).all();
    const workflowFKs = fks.filter(fk => fk.table === 'workflows');
    if (workflowFKs.length > 0) {
      console.log(`  - ${table.name}:`, workflowFKs.map(fk => `${fk.from} -> workflows.${fk.to}`).join(', '));
    }
  } catch (err) {
    // Ignore errors
  }
});

// Count workflows
const count = db.prepare("SELECT COUNT(*) as count FROM workflows WHERE status = 'active'").get();
console.log('\n=== Active Workflows ===');
console.log('  Count:', count.count);
