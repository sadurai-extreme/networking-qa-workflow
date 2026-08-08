const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

// Initialize DB
require('./db/database');

// Routes
const authRoutes = require('./routes/auth');
const workflowRoutes = require('./routes/workflows');
const userRoutes = require('./routes/users');
const releasesRoutes = require('./routes/releases');
const stage1Routes = require('./routes/stage1');
const stage2Routes = require('./routes/stage2');
const stage3Routes = require('./routes/stage3');
const stage4Routes = require('./routes/stage4');
const stage5Routes = require('./routes/stage5');
const stage6Routes = require('./routes/stage6');
const stage7Routes = require('./routes/stage7');
const stage8Routes = require('./routes/stage8');
const stage9Routes = require('./routes/stage9');
const payloadGeneratorRoutes = require('./routes/payloadGenerator');
const versionControlRoutes = require('./routes/versionControl');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const contractsRoutes = require('./routes/contracts');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { 
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5101',
      'http://localhost:5173',
      'http://localhost:5174'
    ], 
    methods: ['GET', 'POST'] 
  },
});

// Make io accessible in routes
app.set('io', io);

app.use(cors({ 
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5101',
    'http://localhost:5173',
    'http://localhost:5174'
  ]
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/users', userRoutes);
app.use('/api/releases', releasesRoutes);
app.use('/api/stage1', stage1Routes);
app.use('/api/stage2', stage2Routes);
app.use('/api/stage3', stage3Routes);
app.use('/api/stage4', stage4Routes);
app.use('/api/stage5', stage5Routes);
app.use('/api/stage6', stage6Routes);
app.use('/api/stage7', stage7Routes);
app.use('/api/stage8', stage8Routes);
app.use('/api/stage9', stage9Routes);
app.use('/api/payload-generator', payloadGeneratorRoutes);
app.use('/api', versionControlRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contracts', contractsRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// TCL index status + on-demand refresh
const { reloadIndex, getIndexMeta } = require('./utils/tclIndex');
const { execFileSync, spawn } = require('child_process');

// GET  /api/tcl-index         — index metadata (loaded procs, areas, indexed_at)
app.get('/api/tcl-index', (req, res) => res.json(getIndexMeta()));

// POST /api/tcl-index/reload  — re-read automation_index.json from disk (called by shell script after indexing)
app.post('/api/tcl-index/reload', (req, res) => {
  try {
    reloadIndex();
    res.json({ success: true, meta: getIndexMeta() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/tcl-index/refresh — full pipeline: git pull → re-index → reload (runs async, streams log)
app.post('/api/tcl-index/refresh', (req, res) => {
  const scriptPath = path.resolve(__dirname, '../../scripts/refresh-tcl-index.sh');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const child = spawn('bash', [scriptPath], {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', d => res.write(d));
  child.stderr.on('data', d => res.write(d));

  child.on('close', code => {
    if (code === 0) {
      reloadIndex(); // also reload in this process
      res.write(`\n[backend] Index reloaded. Total procs: ${getIndexMeta().total_procs}\n`);
    } else {
      res.write(`\n[backend] Script exited with code ${code}\n`);
    }
    res.end();
  });
});

// WebSocket
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('join-workflow', (workflowId) => socket.join(workflowId));
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 NOS QA Workflow Backend running on port ${PORT}`));

module.exports = { app, io };
