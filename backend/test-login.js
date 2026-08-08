const db = require('./src/db/database');
const bcrypt = require('bcryptjs');

const user = db.prepare('SELECT * FROM users WHERE username=?').get('extreme');
if (user) {
  console.log('✅ Admin user found:');
  console.log('   Username:', user.username);
  console.log('   Email:', user.email);
  console.log('   Role:', user.role);
  
  // Test password
  const validPassword = bcrypt.compareSync('extreme', user.password);
  console.log('   Password "extreme" valid:', validPassword ? '✅ YES' : '❌ NO');
} else {
  console.log('❌ Admin user NOT found!');
}
