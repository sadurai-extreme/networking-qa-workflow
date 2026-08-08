const Database = require('better-sqlite3');
const db = new Database('./data/qa_workflow.db');

console.log('=== Users in database ===');
const users = db.prepare('SELECT id, name, email, username, role FROM users').all();
console.log(JSON.stringify(users, null, 2));

console.log('\n=== Checking admin user password ===');
const admin = db.prepare('SELECT id, username, email, password, role FROM users WHERE id = ?').get('user-admin');
if (admin) {
  console.log('Admin found:', { id: admin.id, username: admin.username, email: admin.email, role: admin.role });
  console.log('Password hash exists:', admin.password ? 'YES' : 'NO');
  console.log('Password hash length:', admin.password ? admin.password.length : 0);
} else {
  console.log('Admin user NOT FOUND in database!');
}

db.close();
