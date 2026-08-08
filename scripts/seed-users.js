// Run on server: node seed-users.js
const bcrypt  = require('bcryptjs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = '/root/networking-qa-workflow/backend/data/qa_workflow.db';
const db = new Database(DB_PATH);

const users = [
  { name: 'Ahamed Jasim',                            email: 'ajasim@extremenetworks.com',             username: 'ajasim' },
  { name: 'Akshaya Kumar',                           email: 'akskumar@extremenetworks.com',           username: 'akskumar' },
  { name: 'Balaji Seetharaman',                      email: 'bseetharaman@extremenetworks.com',       username: 'bseetharaman' },
  { name: 'Bharani Dharan Rajendran Chinnikrishnan', email: 'brajendranchinnikris@extremenetworks.com',username: 'brajendranchinnikris' },
  { name: 'Gokul Sridharan',                        email: 'gsridharan@extremenetworks.com',         username: 'gsridharan' },
  { name: 'Hema Priya Lakshmi Ramaiah',             email: 'hramaiah@extremenetworks.com',           username: 'hramaiah' },
  { name: 'Kalyana G',                               email: 'kg@extremenetworks.com',                 username: 'kg' },
  { name: 'Lakshmanan Kuppan',                      email: 'lkuppan@extremenetworks.com',            username: 'lkuppan' },
  { name: 'Manikandan A',                            email: 'mashokkumar@extremenetworks.com',        username: 'mashokkumar' },
  { name: 'Prabhakar Rao Murula Venkat',            email: 'pvenkat@extremenetworks.com',            username: 'pvenkat' },
  { name: 'Prathick R',                              email: 'prr@extremenetworks.com',                username: 'prr' },
  { name: 'Prawin Kirubhanandhan',                   email: 'pkirubhanandhan@extremenetworks.com',    username: 'pkirubhanandhan' },
  { name: 'Santhosh Durai',                          email: 'sadurai@extremenetworks.com',            username: 'sadurai' },
  { name: 'Saravanan Lakshmanan',                   email: 'slakshmanan@extremenetworks.com',        username: 'slakshmanan' },
  { name: 'Senthil Kandaswamy',                     email: 'skandaswamy@extremenetworks.com',        username: 'skandaswamy' },
  { name: 'Shankar Palanivel',                       email: 'spalanivel@extremenetworks.com',         username: 'spalanivel' },
  { name: 'SharmilaBanu Jamaludeen',                email: 'sjamaludeen@extremenetworks.com',        username: 'sjamaludeen' },
  { name: 'Sridhar Balakrishnan',                   email: 'srbalakrishnan@extremenetworks.com',     username: 'srbalakrishnan' },
];

const SALT_ROUNDS = 10;
const PASSWORD    = 'extreme';

(async () => {
  const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  console.log(`Password hash generated`);

  const insert = db.prepare(`
    INSERT INTO users (id, name, email, username, password, role)
    VALUES (?, ?, ?, ?, ?, 'admin')
    ON CONFLICT(email) DO UPDATE SET
      name     = excluded.name,
      username = excluded.username,
      password = excluded.password,
      role     = 'admin'
  `);

  const insertMany = db.transaction((list) => {
    let created = 0, updated = 0;
    for (const u of list) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
      if (existing) {
        db.prepare(`UPDATE users SET name=?, username=?, password=?, role='admin' WHERE email=?`)
          .run(u.name, u.username, hash, u.email);
        console.log(`  UPDATED  ${u.username} (${u.email})`);
        updated++;
      } else {
        insert.run(uuidv4(), u.name, u.email, u.username, hash);
        console.log(`  CREATED  ${u.username} (${u.email})`);
        created++;
      }
    }
    return { created, updated };
  });

  const result = insertMany(users);
  console.log(`\nDone: ${result.created} created, ${result.updated} updated`);
  db.close();
})();
