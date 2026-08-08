const express = require('express');
const router = express.Router();
const db = require('../db/database');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

// ─── GET /admin/stats ────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const workflows       = db.prepare('SELECT COUNT(*) AS n FROM workflows').get().n;
  const active          = db.prepare("SELECT COUNT(*) AS n FROM workflows WHERE status='active'").get().n;
  const completed       = db.prepare("SELECT COUNT(*) AS n FROM workflows WHERE status='completed'").get().n;
  const users           = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const totalTc         = db.prepare('SELECT COUNT(*) AS n FROM test_cases').get().n;
  const execResults     = db.prepare('SELECT COUNT(*) AS n FROM tc_execution_results').get().n;
  const auditEntries    = db.prepare('SELECT COUNT(*) AS n FROM audit_trail').get().n;
  const documents       = db.prepare('SELECT COUNT(*) AS n FROM documents').get().n;

  // TC execution pass rate (all time)
  const passed  = db.prepare("SELECT COUNT(*) AS n FROM tc_execution_results WHERE result='PASS'").get().n;
  const failed  = db.prepare("SELECT COUNT(*) AS n FROM tc_execution_results WHERE result='FAIL'").get().n;
  const passRate = (passed + failed) > 0 ? Math.round((passed / (passed + failed)) * 100) : null;

  // Workflows created in last 7 days
  const recent = db.prepare(
    "SELECT COUNT(*) AS n FROM workflows WHERE created_at >= datetime('now', '-7 days')"
  ).get().n;

  // Stage distribution — how many workflows at each stage
  const stageRows = db.prepare('SELECT current_stage, COUNT(*) AS cnt FROM workflows GROUP BY current_stage ORDER BY current_stage').all();

  // Workflow status over time (last 30 days, daily counts)
  const dailyActivity = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS created
    FROM workflows
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY day
    ORDER BY day
  `).all();

  res.json({
    workflows, active, completed, users, totalTc, execResults, auditEntries, documents,
    passRate, recent, stageRows, dailyActivity,
  });
});

// ─── GET /admin/audit-summary — consolidated view ───────────────────────────
router.get('/audit-summary', (req, res) => {
  // Per-workflow roll-up
  const byWorkflow = db.prepare(`
    SELECT
      a.workflow_id,
      w.title            AS workflow_title,
      w.jira_story_id,
      w.status           AS workflow_status,
      u.name             AS created_by_name,
      COUNT(*)           AS total_actions,
      MAX(a.created_at)  AS last_activity,
      GROUP_CONCAT(DISTINCT a.action_type) AS action_types_csv
    FROM audit_trail a
    LEFT JOIN workflows w ON a.workflow_id = w.id
    LEFT JOIN users     u ON w.created_by  = u.id
    GROUP BY a.workflow_id
    ORDER BY last_activity DESC
  `).all();

  // Recent 12 events for the activity feed
  const recent = db.prepare(`
    SELECT a.action_type, a.action, a.user_name, a.created_at,
           w.title AS workflow_title, w.jira_story_id
    FROM audit_trail a
    LEFT JOIN workflows w ON a.workflow_id = w.id
    ORDER BY a.created_at DESC
    LIMIT 12
  `).all();

  // Counts per action type
  const byType = db.prepare(
    'SELECT action_type, COUNT(*) AS cnt FROM audit_trail GROUP BY action_type ORDER BY cnt DESC'
  ).all();

  // Top users by action count
  const byUser = db.prepare(
    "SELECT user_name, COUNT(*) AS cnt FROM audit_trail WHERE user_name IS NOT NULL GROUP BY user_name ORDER BY cnt DESC LIMIT 6"
  ).all();

  const today = db.prepare(
    "SELECT COUNT(*) AS n FROM audit_trail WHERE date(created_at) = date('now')"
  ).get().n;

  const total = byWorkflow.reduce((s, r) => s + r.total_actions, 0);

  res.json({ byWorkflow, recent, byType, byUser, today, total });
});

// ─── GET /admin/audit-logs ───────────────────────────────────────────────────
router.get('/audit-logs', (req, res) => {
  const {
    workflow_id,
    action_type,
    user_id,
    stage_number,
    search,
    date_from,
    date_to,
    limit  = 200,
    offset = 0,
  } = req.query;

  let sql = `
    SELECT a.*, w.title AS workflow_title, w.jira_story_id
    FROM audit_trail a
    LEFT JOIN workflows w ON a.workflow_id = w.id
    WHERE 1=1
  `;
  const params = [];

  if (workflow_id)  { sql += ' AND a.workflow_id = ?';   params.push(workflow_id); }
  if (action_type)  { sql += ' AND a.action_type = ?';   params.push(action_type); }
  if (user_id)      { sql += ' AND a.user_id = ?';       params.push(user_id); }
  if (stage_number) { sql += ' AND a.stage_number = ?';  params.push(parseInt(stage_number, 10)); }
  if (search)       { sql += ' AND a.action LIKE ?';     params.push(`%${search}%`); }
  if (date_from)    { sql += ' AND date(a.created_at) >= ?'; params.push(date_from); }
  if (date_to)      { sql += ' AND date(a.created_at) <= ?'; params.push(date_to); }

  sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const rows = db.prepare(sql).all(...params);

  // Total count for pagination
  let countSql = sql.replace(/SELECT a\.\*, w\.title AS workflow_title, w\.jira_story_id/, 'SELECT COUNT(*) AS n').replace(/ORDER BY.*/, '').replace(/LIMIT.*/, '');
  // Simpler: rebuild count query
  let cSql = `SELECT COUNT(*) AS n FROM audit_trail a LEFT JOIN workflows w ON a.workflow_id = w.id WHERE 1=1`;
  const cParams = [];
  if (workflow_id)  { cSql += ' AND a.workflow_id = ?';       cParams.push(workflow_id); }
  if (action_type)  { cSql += ' AND a.action_type = ?';       cParams.push(action_type); }
  if (user_id)      { cSql += ' AND a.user_id = ?';           cParams.push(user_id); }
  if (stage_number) { cSql += ' AND a.stage_number = ?';      cParams.push(parseInt(stage_number, 10)); }
  if (search)       { cSql += ' AND a.action LIKE ?';         cParams.push(`%${search}%`); }
  if (date_from)    { cSql += ' AND date(a.created_at) >= ?'; cParams.push(date_from); }
  if (date_to)      { cSql += ' AND date(a.created_at) <= ?'; cParams.push(date_to); }

  const total = db.prepare(cSql).get(...cParams).n;

  // Distinct action_types for filter dropdown
  const actionTypes = db.prepare('SELECT DISTINCT action_type FROM audit_trail ORDER BY action_type').all().map(r => r.action_type);

  res.json({ rows, total, actionTypes });
});

// ─── GET /admin/system ───────────────────────────────────────────────────────
router.get('/system', (req, res) => {
  const uptime  = process.uptime(); // seconds
  const mem     = process.memoryUsage();
  const dbPath  = path.resolve(__dirname, '../../data/workflows.db');
  let dbSize = null;
  try { dbSize = fs.statSync(dbPath).size; } catch {}

  const uploadsPath = path.resolve(__dirname, '../../../uploads');
  let uploadsSize = 0;
  let uploadsCount = 0;
  try {
    const files = fs.readdirSync(uploadsPath);
    uploadsCount = files.length;
    uploadsSize = files.reduce((acc, f) => {
      try { return acc + fs.statSync(path.join(uploadsPath, f)).size; } catch { return acc; }
    }, 0);
  } catch {}

  res.json({
    node:       process.version,
    platform:   process.platform,
    arch:       process.arch,
    uptime,
    uptimeHuman: formatUptime(uptime),
    memory: {
      heapUsed:  Math.round(mem.heapUsed  / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss:       Math.round(mem.rss       / 1024 / 1024),
    },
    os: {
      hostname: os.hostname(),
      type:     os.type(),
      release:  os.release(),
      totalMem: Math.round(os.totalmem() / 1024 / 1024),
      freeMem:  Math.round(os.freemem()  / 1024 / 1024),
      cpus:     os.cpus().length,
    },
    db: { path: dbPath, sizeBytes: dbSize, sizeMB: dbSize ? (dbSize / 1024 / 1024).toFixed(2) : null },
    uploads: { path: uploadsPath, count: uploadsCount, sizeBytes: uploadsSize, sizeMB: (uploadsSize / 1024 / 1024).toFixed(2) },
  });
});

// ─── GET /admin/workflows ────────────────────────────────────────────────────
// Enhanced workflow list with TC counts and audit trail count
router.get('/workflows', (req, res) => {
  const rows = db.prepare(`
    SELECT
      w.*,
      u.name  AS created_by_name,
      (SELECT COUNT(*) FROM test_cases tc WHERE tc.workflow_id = w.id) AS tc_count,
      (SELECT COUNT(*) FROM audit_trail  a  WHERE a.workflow_id  = w.id) AS audit_count,
      (SELECT COUNT(*) FROM tc_execution_results ter JOIN test_cases tc2 ON ter.tc_number=tc2.tc_number AND tc2.workflow_id=w.id WHERE ter.workflow_id=w.id AND ter.result='PASS') AS passed_count,
      (SELECT COUNT(*) FROM tc_execution_results ter JOIN test_cases tc2 ON ter.tc_number=tc2.tc_number AND tc2.workflow_id=w.id WHERE ter.workflow_id=w.id AND ter.result='FAIL') AS failed_count
    FROM workflows w
    LEFT JOIN users u ON w.created_by = u.id
    ORDER BY w.created_at DESC
  `).all();

  res.json(rows);
});

// ─── DELETE /admin/workflows/:id ────────────────────────────────────────────
router.delete('/workflows/:id', (req, res) => {
  const { id } = req.params;
  const wf = db.prepare('SELECT id FROM workflows WHERE id=?').get(id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });

  // Cascade delete related data
  db.prepare('DELETE FROM tc_execution_results WHERE workflow_id=?').run(id);
  db.prepare('DELETE FROM execution_sessions WHERE workflow_id=?').run(id);
  db.prepare('DELETE FROM test_cases WHERE workflow_id=?').run(id);
  db.prepare('DELETE FROM documents WHERE workflow_id=?').run(id);
  db.prepare('DELETE FROM stages WHERE workflow_id=?').run(id);
  db.prepare('DELETE FROM audit_trail WHERE workflow_id=?').run(id);
  try { db.prepare('DELETE FROM approvals WHERE workflow_id=?').run(id); } catch {}
  db.prepare('DELETE FROM workflows WHERE id=?').run(id);

  res.json({ success: true });
});

// ─── PUT /admin/users/:id/role ───────────────────────────────────────────────
router.put('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (req.params.id === 'user-admin') return res.status(400).json({ error: 'Cannot change system admin role' });
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, req.params.id);
  res.json({ success: true });
});

// ─── POST /admin/users/:id/reset-password ───────────────────────────────────
router.post('/users/:id/reset-password', (req, res) => {
  const bcrypt = require('bcryptjs');
  if (req.params.id === 'user-admin') return res.status(400).json({ error: 'Cannot reset system admin password' });
  const hash = bcrypt.hashSync('extreme', 10);
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, req.params.id);
  res.json({ success: true, message: 'Password reset to: extreme' });
});

// ─── GET /admin/activity ─────────────────────────────────────────────────────
// Recent activity feed (latest 50 audit entries across all workflows)
router.get('/activity', (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, w.title AS workflow_title, w.jira_story_id
    FROM audit_trail a
    LEFT JOIN workflows w ON a.workflow_id = w.id
    ORDER BY a.created_at DESC
    LIMIT 50
  `).all();
  res.json(rows);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}
// ─── GET /admin/system-checks ─────────────────────────────────────────────────
// Runs server-side checks that can't be done from the browser
router.get('/system-checks', (req, res) => {
  const results = [];
  const run = (id, name, fn) => {
    const t0 = Date.now();
    try {
      const detail = fn();
      results.push({ id, name, status: 'pass', detail, duration: Date.now() - t0 });
    } catch (err) {
      results.push({ id, name, status: 'fail', detail: err.message, duration: Date.now() - t0 });
    }
  };

  run('db_connect', 'Database connection', () => {
    const row = db.prepare('SELECT sqlite_version() AS v').get();
    return `SQLite ${row.v} — connected`;
  });

  run('db_tables', 'Required tables exist', () => {
    const required = ['workflows', 'users', 'test_cases', 'stages', 'documents', 'audit_trail', 'tc_execution_results'];
    const existing = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    const missing = required.filter(t => !existing.includes(t));
    if (missing.length) throw new Error(`Missing tables: ${missing.join(', ')}`);
    return `All ${required.length} required tables present`;
  });

  run('db_users', 'At least one admin user exists', () => {
    const n = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n;
    if (n === 0) throw new Error('No admin users found');
    return `${n} admin user(s) found`;
  });

  run('db_workflows', 'Workflows table readable', () => {
    const n = db.prepare('SELECT COUNT(*) AS n FROM workflows').get().n;
    return `${n} workflow(s) in database`;
  });

  run('db_test_cases', 'Test cases table readable', () => {
    const n = db.prepare('SELECT COUNT(*) AS n FROM test_cases').get().n;
    return `${n} test case(s) in database`;
  });

  run('db_file_exists', 'Database file on disk', () => {
    const dbFile = path.join(__dirname, '../../data/qa_workflow.db');
    if (!fs.existsSync(dbFile)) throw new Error(`Not found: ${dbFile}`);
    const stat = fs.statSync(dbFile);
    return `${dbFile} — ${(stat.size / 1024).toFixed(1)} KB`;
  });

  run('uploads_dir', 'Uploads directory writable', () => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const testFile = path.join(uploadsDir, '.write_test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return `${uploadsDir} — writable`;
  });

  run('python_docx', 'Python DOCX generator script exists', () => {
    const scriptPath = path.join(__dirname, '../scripts/generate_iso_docx.py');
    if (!fs.existsSync(scriptPath)) throw new Error(`Script not found: ${scriptPath}`);
    const stat = fs.statSync(scriptPath);
    return `${(stat.size / 1024).toFixed(1)} KB — ${scriptPath}`;
  });

  run('node_version', 'Node.js version acceptable', () => {
    const v = process.version;
    const major = parseInt(v.replace('v', '').split('.')[0]);
    if (major < 14) throw new Error(`Node.js ${v} is too old (need v14+)`);
    return `Node.js ${v}`;
  });

  run('memory_ok', 'Server memory not critically low', () => {
    const free = os.freemem();
    const total = os.totalmem();
    const pct = Math.round((free / total) * 100);
    if (pct < 5) throw new Error(`Only ${pct}% free memory remaining`);
    return `${pct}% free (${(free / 1024 / 1024).toFixed(0)} MB / ${(total / 1024 / 1024).toFixed(0)} MB)`;
  });

  run('audit_trail', 'Audit trail table writable', () => {
    const n = db.prepare('SELECT COUNT(*) AS n FROM audit_trail').get().n;
    return `${n} audit entries — accessible`;
  });

  res.json({ checks: results, ran_at: new Date().toISOString() });
});
module.exports = router;
