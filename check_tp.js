const db = require('./src/db/database');
// List all stage 3 docs
const all = db.prepare("SELECT doc_type, length(content) as len, created_at FROM documents WHERE workflow_id = 'eeb77145-726d-4146-a872-a5918b531bf3' AND stage_number = 3 ORDER BY created_at DESC LIMIT 10").all();
console.log('=== ALL STAGE 3 DOCS:');
all.forEach(d => console.log(d.doc_type, d.len, d.created_at));
const doc = db.prepare("SELECT content FROM documents WHERE workflow_id = 'eeb77145-726d-4146-a872-a5918b531bf3' AND stage_number = 3 AND doc_type = 'test_plan' ORDER BY created_at DESC LIMIT 1").get();
if (!doc) { console.log('NO DOC'); process.exit(); }
const c = doc.content;
console.log('=== LENGTH:', c.length);
// Find lines with #### 
const headerLines = c.split('\n').filter(l => l.match(/^#{3,5}\s/)).slice(0, 20);
console.log('=== HEADERS (first 20):');
headerLines.forEach(l => console.log(l));
// Sanity samples
console.log('\n=== SANITY LINES:');
c.split('\n').filter(l => /sanity/i.test(l)).slice(0,5).forEach(l => console.log(l));
// Pass criteria samples
console.log('\n=== PASS CRITERIA LINES:');
c.split('\n').filter(l => /pass.*criteria/i.test(l)).slice(0,5).forEach(l => console.log(l));
// Test case headers 5.x.x
console.log('\n=== 5.x.x HEADERS:');
const tc5 = c.match(/#{3,5}\s+5\.\d+\.\d+[^\n]*/g);
console.log(tc5 ? tc5.slice(0,5) : 'NONE');
