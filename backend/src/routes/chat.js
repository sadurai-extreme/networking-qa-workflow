/**
 * Chat Assistant API Routes
 * AI-powered conversational interface for requirements gathering
 * Stages: 2 (Skill Files) and 3 (Test Plans)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db/database');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL_LIGHT || 'claude-sonnet-4-6';

// Configure file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(__dirname, '../../../uploads/chat');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|txt|md|json|yaml|yml|pdf|docx/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.test(ext.substring(1))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: images, text, markdown, JSON, YAML, PDF, DOCX'));
    }
  },
});

/**
 * Get context for AI based on workflow and stage
 */
function getAIContext(workflowId, stageNumber) {
  const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId);
  
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  const documents = db.prepare(
    'SELECT * FROM documents WHERE workflow_id = ? ORDER BY stage_number, created_at DESC'
  ).all(workflowId);

  const context = {
    workflow: {
      id: workflow.id,
      jira_story_id: workflow.jira_story_id,
      title: workflow.title,
      description: workflow.jira_story_description,
      stage: stageNumber,
    },
    documents: {},
  };

  // Organize documents by type
  documents.forEach(doc => {
    if (!context.documents[doc.doc_type]) {
      context.documents[doc.doc_type] = [];
    }
    context.documents[doc.doc_type].push({
      filename: doc.filename,
      stage: doc.stage_number,
      created_at: doc.created_at,
    });
  });

  // Stage-specific context
  if (stageNumber === 2) {
    // Skill file generation context
    const skillDocs = documents.filter(d => d.doc_type === 'skill_file');
    context.stage_info = {
      goal: 'Generate skill file for QA testing',
      required_info: [
        'Feature type and description',
        'CLI commands involved',
        'Topology requirements',
        'Expected behavior',
      ],
    };
    if (skillDocs.length > 0) {
      context.existing_skill_file = skillDocs[0].filename;
      // Include actual skill file content
      if (skillDocs[0].content) {
        context.skill_file_content = skillDocs[0].content;
      }
    }
    // Inject TCL framework docs for Stage 2 as well
    try {
      const tclDocsDir = path.resolve(__dirname, '../../../../data/tcl_framework_docs');
      const topologyGuide = path.join(tclDocsDir, 'Topology_Guide.md');
      const trafficPatterns = path.join(tclDocsDir, 'Traffic_Patterns.md');
      if (fs.existsSync(topologyGuide)) context.tcl_topology_guide = fs.readFileSync(topologyGuide, 'utf-8');
      if (fs.existsSync(trafficPatterns)) context.tcl_traffic_patterns = fs.readFileSync(trafficPatterns, 'utf-8');
    } catch (e) { /* optional — skip if unavailable */ }
  } else if (stageNumber === 3) {
    // Test plan generation context
    const skillFile = documents.find(d => d.doc_type === 'skill_file' && d.stage_number === 2);
    const topologyFiles = documents.filter(d => d.filename.includes('topology'));
    
    context.stage_info = {
      goal: 'Generate comprehensive test plan',
      required_info: [
        'Test objectives',
        'Test scenarios (positive/negative)',
        'Prerequisites and setup',
        'Expected results',
      ],
    };
    
    if (skillFile) {
      context.skill_file = skillFile.filename;
      if (skillFile.content) {
        context.skill_file_content = skillFile.content;
      }
    }
    if (topologyFiles.length > 0) {
      context.topology_files = topologyFiles.map(t => t.filename);
    }

    // Include generated test plan content
    const testPlanDoc = documents.find(d => d.doc_type === 'test_plan' && d.stage_number === 3);
    if (testPlanDoc && testPlanDoc.content) {
      context.test_plan_content = testPlanDoc.content;
    }

    // Include test cases from DB
    const testCases = db.prepare(
      'SELECT tc_number, title, description, classification FROM test_cases WHERE workflow_id=? ORDER BY tc_number'
    ).all(workflowId);
    if (testCases.length > 0) {
      context.test_cases = testCases;
    }

    // Inject TCL framework docs (topology guide + traffic patterns)
    try {
      const tclDocsDir = path.resolve(__dirname, '../../../../data/tcl_framework_docs');
      const topologyGuide = path.join(tclDocsDir, 'Topology_Guide.md');
      const trafficPatterns = path.join(tclDocsDir, 'Traffic_Patterns.md');
      if (fs.existsSync(topologyGuide)) context.tcl_topology_guide = fs.readFileSync(topologyGuide, 'utf-8');
      if (fs.existsSync(trafficPatterns)) context.tcl_traffic_patterns = fs.readFileSync(trafficPatterns, 'utf-8');
    } catch (e) { /* optional — skip if unavailable */ }
  }

  return context;
}

/**
 * Build AI system prompt based on stage
 */
function buildSystemPrompt(stageNumber, context) {
  const skillFileInfo = context.skill_file_content
    ? `\n\nSKILL FILE CONTENT:\n${context.skill_file_content}`
    : '';

  const tclFrameworkInfo = (context.tcl_topology_guide || context.tcl_traffic_patterns)
    ? `\n\nTCL AUTOMATION FRAMEWORK KNOWLEDGE:\n` +
      `The project uses the EXOS TCL automation framework with 3746+ procs across 552 files.\n` +
      `Use this framework knowledge to fill in default setup details — do NOT ask the user for standard framework conventions.\n` +
      (context.tcl_topology_guide ? `\n${context.tcl_topology_guide}` : '') +
      (context.tcl_traffic_patterns ? `\n${context.tcl_traffic_patterns}` : '')
    : '';

  const testPlanInfo = context.test_plan_content
    ? `\n\nGENERATED TEST PLAN:\n${context.test_plan_content}`
    : '';

  const testCasesInfo = context.test_cases && context.test_cases.length > 0
    ? `\n\nTEST CASES (${context.test_cases.length} total):\n` +
      context.test_cases.map(tc => `- TC ${tc.tc_number}: ${tc.title} [${tc.classification || 'Unclassified'}]${tc.description ? ' — ' + tc.description : ''}`).join('\n')
    : '';

  const basePrompt = `You are an expert QA assistant helping network engineers with test automation.

Context:
- JIRA Story: ${context.workflow.jira_story_id || 'N/A'}
- Title: ${context.workflow.title || 'N/A'}
- Current Stage: ${stageNumber} (${stageNumber === 2 ? 'Skill File Generation' : 'Test Plan Generation'})${skillFileInfo}${testPlanInfo}${testCasesInfo}${tclFrameworkInfo}

`;

  if (stageNumber === 2) {
    const hasTcl = !!(context.tcl_topology_guide || context.tcl_traffic_patterns);
    return basePrompt + `Your role in SKILL FILE GENERATION:
1. Ask clarifying questions about the feature being tested
2. Understand CLI commands, topology needs, and test scope
3. Extract structured information: feature_type, cli_commands, topology_description, user_instructions
4. Guide the user to provide complete information for skill file generation
5. ${context.skill_file_content ? 'IMPORTANT: A skill file has been generated. You can answer questions about its content, explain sections, or suggest improvements.' : 'Reference existing skill files when helpful'}
6. Be conversational and helpful, but stay focused on gathering requirements
${hasTcl ? '7. IMPORTANT: You already have full TCL framework knowledge (topology types, IXIA proc names, default setup conventions). Do NOT ask the user for standard framework details — use the framework docs directly.' : ''}

Key information to extract:
- Feature Type: What feature/functionality is being tested?
- CLI Commands: What commands are involved?
- Topology: What hardware/network setup is needed?
- User Instructions: Any special setup or testing notes?

Ask one focused question at a time. If the user provides all necessary info, confirm and offer to proceed with generation.`;
  } else if (stageNumber === 3) {
    const hasPlan = !!context.test_plan_content;
    const hasTCs  = context.test_cases && context.test_cases.length > 0;
    const hasTcl  = !!(context.tcl_topology_guide || context.tcl_traffic_patterns);
    return basePrompt + `Your role in TEST PLAN GENERATION:
1. ${hasPlan ? 'A test plan has already been generated — reference it above to answer questions accurately.' : context.skill_file_content ? 'Reference the skill file above to understand the feature.' : 'Understand test coverage requirements.'}
2. ${hasTCs ? `There are ${context.test_cases.length} test cases already defined — you can list, explain, or discuss any of them by TC number.` : 'Help define test scenarios.'}
3. Answer questions about specific test cases, their steps, or coverage gaps.
4. Suggest improvements or additional scenarios if asked.
5. Be precise — cite TC numbers and titles when referring to test cases.
${hasTcl ? '6. IMPORTANT: You already have full TCL framework knowledge above (topology types, default port mappings, IXIA traffic procs, setup conventions). Do NOT ask the user for standard framework details — use the framework docs directly to fill in setup/teardown steps, default VLANs, port assignments, and traffic proc names.' : ''}

If the user asks about a specific TC (e.g. "TC 5.1.3" or "what does 5.1.3 test"), look it up in the test cases list above and explain it in detail.`;
  }

  return basePrompt + 'Help the user with their testing workflow.';
}

/**
 * Extract structured requirements from conversation
 */
async function extractRequirements(messages, stageNumber) {
  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const extractionPrompt = stageNumber === 2
    ? `Based on this conversation, extract the following information for skill file generation:
- feature_type: The main feature being tested
- cli_commands: List of CLI commands mentioned (as array)
- topology_description: Description of network topology needed
- user_instructions: Any special instructions or notes

Conversation:
${conversationText}

Return ONLY a JSON object with these fields. If information is missing, use null.`
    : `Based on this conversation, extract the following information for test plan generation:
- test_objectives: Main goals of testing
- positive_scenarios: List of positive test cases
- negative_scenarios: List of negative test cases
- prerequisites: Setup requirements
- coverage_level: comprehensive, moderate, or basic

Conversation:
${conversationText}

Return ONLY a JSON object with these fields. If information is missing, use null.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: extractionPrompt }],
    });

    const extracted = JSON.parse(response.content[0].text);
    return extracted;
  } catch (error) {
    console.error('Requirements extraction error:', error);
    return {};
  }
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/chat/session/start
 * Start a new chat session
 */
router.post('/session/start', async (req, res) => {
  try {
    const { workflow_id, stage_number } = req.body;

    if (!workflow_id || !stage_number) {
      return res.status(400).json({ error: 'workflow_id and stage_number required' });
    }

    if (![2, 3].includes(stage_number)) {
      return res.status(400).json({ error: 'Chat assistant only available for stages 2 and 3' });
    }

    // Get context
    const context = getAIContext(workflow_id, stage_number);

    // Create session
    const sessionId = uuidv4();
    db.prepare(`
      INSERT INTO chat_sessions (id, workflow_id, stage_number, status)
      VALUES (?, ?, ?, 'active')
    `).run(sessionId, workflow_id, stage_number);

    // Generate welcome message
    const systemPrompt = buildSystemPrompt(stage_number, context);
    const hasPlan = stage_number === 3 && !!context.test_plan_content;
    const tcCount  = context.test_cases ? context.test_cases.length : 0;

    const welcomePrompt = stage_number === 2
      ? `Generate a friendly welcome message for a user starting to create a skill file for JIRA story ${context.workflow.jira_story_id}: "${context.workflow.title}". Ask the first question to understand what they need to test. Keep it brief and conversational.`
      : hasPlan
        ? `Generate a brief, helpful welcome for a user who already has a generated test plan with ${tcCount} test cases for JIRA story ${context.workflow.jira_story_id}: "${context.workflow.title}". Tell them you have the full test plan and all ${tcCount} test cases loaded. Invite them to ask anything — e.g. list TCs, explain a specific TC, check coverage gaps, or suggest improvements. Do NOT ask them to describe what they want to test. Keep it to 2-3 sentences.`
        : `Generate a friendly welcome message for a user starting to create a test plan for JIRA story ${context.workflow.jira_story_id}: "${context.workflow.title}". They have a skill file ready. Ask the first question about test objectives. Keep it brief and conversational.`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: welcomePrompt }],
    });

    const welcomeMessage = response.content[0].text;

    // Save welcome message
    const msgId = uuidv4();
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, context_used)
      VALUES (?, ?, 'assistant', ?, ?)
    `).run(msgId, sessionId, welcomeMessage, JSON.stringify(context));

    // Suggested questions
    const suggestions = stage_number === 2
      ? [
          'What feature are you testing?',
          'What CLI commands are involved?',
          'What topology do you need?',
        ]
      : hasPlan
        ? [
            `List all ${tcCount} test cases`,
            'Which TCs are automatable?',
            'Are there any coverage gaps?',
            'Explain TC in detail',
          ]
        : [
            'What are your test objectives?',
            'Do you need positive and negative tests?',
            'What are the prerequisites?',
          ];

    res.json({
      session_id: sessionId,
      welcome_message: welcomeMessage,
      suggested_questions: suggestions,
      context,
    });
  } catch (error) {
    console.error('Chat session start error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/chat/send
 * Send a message and get AI response
 */
router.post('/send', async (req, res) => {
  try {
    const { session_id, message, files = [] } = req.body;

    if (!session_id || !message) {
      return res.status(400).json({ error: 'session_id and message required' });
    }

    // Get session
    const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(session_id);
    if (!session || session.status !== 'active') {
      return res.status(404).json({ error: 'Active session not found' });
    }

    // Get context
    const context = getAIContext(session.workflow_id, session.stage_number);

    // Get conversation history
    const history = db.prepare(`
      SELECT role, content FROM chat_messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `).all(session_id);

    // Save user message
    const userMsgId = uuidv4();
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, files_attached)
      VALUES (?, ?, 'user', ?, ?)
    `).run(userMsgId, session_id, message, JSON.stringify(files));

    // Build conversation for AI
    const messages = history.map(h => ({
      role: h.role,
      content: h.content,
    }));
    messages.push({ role: 'user', content: message });

    // Load any files uploaded in this session that have extracted content
    const sessionFiles = db.prepare(
      'SELECT filename, content FROM chat_files WHERE session_id=? AND content IS NOT NULL ORDER BY rowid'
    ).all(session_id);

    const fileContextBlock = sessionFiles.length > 0
      ? '\n\n---\nUPLOADED FILES IN THIS CHAT SESSION (read and reference these when answering):\n' +
        sessionFiles.map(f => `\n### File: ${f.filename}\n${f.content}`).join('\n') +
        '\n---'
      : '';

    // Get AI response
    const systemPrompt = buildSystemPrompt(session.stage_number, context) + fileContextBlock;
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages,
    });

    const aiResponse = response.content[0].text;

    // Save AI response
    const aiMsgId = uuidv4();
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, context_used)
      VALUES (?, ?, 'assistant', ?, ?)
    `).run(aiMsgId, session_id, aiResponse, JSON.stringify(context));

    // Try to extract requirements
    const allMessages = [...history, { role: 'user', content: message }, { role: 'assistant', content: aiResponse }];
    const extracted = await extractRequirements(allMessages, session.stage_number);

    res.json({
      message_id: aiMsgId,
      response: aiResponse,
      extracted_data: extracted,
      conversation_complete: Object.values(extracted).filter(v => v !== null).length >= 3,
    });
  } catch (error) {
    console.error('Chat send error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/chat/history/:session_id
 * Get chat history
 */
router.get('/history/:session_id', (req, res) => {
  try {
    const { session_id } = req.params;

    const messages = db.prepare(`
      SELECT id, role, content, timestamp, files_attached
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `).all(session_id);

    res.json({
      session_id,
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        files: m.files_attached ? JSON.parse(m.files_attached) : [],
      })),
    });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/chat/upload
 * Upload file in chat
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { session_id } = req.body;
    const file = req.file;

    if (!session_id || !file) {
      return res.status(400).json({ error: 'session_id and file required' });
    }

    const ext = path.extname(file.originalname).toLowerCase();

    // Extract text content from the file
    let extractedContent = null;
    try {
      if (['.txt', '.md'].includes(ext)) {
        extractedContent = fs.readFileSync(file.path, 'utf-8');
      } else if (ext === '.pdf') {
        const { execSync } = require('child_process');
        // First try text extraction (works for text-based PDFs)
        try {
          extractedContent = execSync(
            `python3 -c "from pdfminer.high_level import extract_text; print(extract_text('${file.path.replace(/'/g, "'\\''")}'))"`,
            { encoding: 'utf-8', timeout: 30000 }
          );
        } catch (textErr) {
          console.warn('PDF text extraction failed, trying vision:', textErr.message.split('\n')[0]);
        }
        // If no text extracted (image-based PDF or text extraction failed), use Claude vision
        if (!extractedContent || extractedContent.trim().length < 30) {
          try {
            const imgPrefix = file.path + '_p';
            execSync(`pdftoppm -r 150 -png -f 1 -l 1 "${file.path}" "${imgPrefix}"`, { timeout: 30000 });
            // pdftoppm outputs: prefix-1.png or prefix-01.png depending on page count
            const imgPath = fs.existsSync(imgPrefix + '-1.png') ? imgPrefix + '-1.png'
                          : fs.existsSync(imgPrefix + '-01.png') ? imgPrefix + '-01.png' : null;
            if (imgPath) {
              const imgData = fs.readFileSync(imgPath).toString('base64');
              const visionResp = await anthropic.messages.create({
                model: MODEL,
                max_tokens: 1024,
                messages: [{
                  role: 'user',
                  content: [
                    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imgData } },
                    { type: 'text', text: 'This is a network topology diagram. Describe in detail: all devices shown (switches, routers, hosts, servers), their labels/names, all connections between them (including port numbers if visible), any VLANs, subnets, or network segments, and the overall topology type (ring, star, mesh, etc.).' }
                  ]
                }]
              });
              extractedContent = '[TOPOLOGY DIAGRAM - Visual Analysis]\n' + visionResp.content[0].text;
              fs.unlinkSync(imgPath);
            }
          } catch (visionErr) {
            console.warn('Vision analysis failed:', visionErr.message);
          }
        }
      } else if (ext === '.docx') {
        const { execSync } = require('child_process');
        extractedContent = execSync(
          `python3 -c "import docx; d=docx.Document('${file.path.replace(/'/g, "'\\''")}'); print('\\n'.join(p.text for p in d.paragraphs))"`,
          { encoding: 'utf-8', timeout: 30000 }
        );
      } else if (['.json', '.yaml', '.yml'].includes(ext)) {
        extractedContent = fs.readFileSync(file.path, 'utf-8');
      }
    } catch (extractErr) {
      console.warn('Content extraction failed:', extractErr.message);
    }

    // Save file record with extracted content
    const fileId = uuidv4();
    db.prepare(`
      INSERT INTO chat_files (id, session_id, filename, filepath, file_type, file_size, content)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(fileId, session_id, file.originalname, file.filename, file.mimetype, file.size, extractedContent);

    const isTopologyVision = extractedContent?.startsWith('[TOPOLOGY DIAGRAM');
    const analysis = extractedContent
      ? isTopologyVision
        ? `Topology diagram analyzed successfully. I can see the network layout in "${file.originalname}". Ask me to use it for test case generation.`
        : `File uploaded successfully. I can now read the content of "${file.originalname}" (${Math.round(extractedContent.length / 100) / 10} KB of text extracted). You can ask me questions about it.`
      : `File uploaded. Note: I could not extract text from this file type (${ext}).`;

    res.json({
      file_id: fileId,
      filename: file.originalname,
      url: `/uploads/chat/${file.filename}`,
      size: file.size,
      analysis,
      has_content: !!extractedContent,
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/chat/session/complete
 * Complete session and extract final requirements
 */
router.post('/session/complete', async (req, res) => {
  try {
    const { session_id } = req.body;

    const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get all messages
    const messages = db.prepare(`
      SELECT role, content FROM chat_messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `).all(session_id);

    // Extract requirements
    const requirements = await extractRequirements(messages, session.stage_number);

    // Generate summary
    const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    const summaryResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Summarize this conversation in 2-3 sentences:\n\n${conversationText}`,
      }],
    });

    const summary = summaryResponse.content[0].text;

    // Update session
    db.prepare(`
      UPDATE chat_sessions 
      SET status = 'completed', 
          ended_at = CURRENT_TIMESTAMP,
          summary = ?,
          extracted_requirements = ?
      WHERE id = ?
    `).run(summary, JSON.stringify(requirements), session_id);

    res.json({
      summary,
      requirements,
      ready_for_generation: true,
    });
  } catch (error) {
    console.error('Session complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/chat/export/:session_id
 * Export chat history
 */
router.get('/export/:session_id', (req, res) => {
  try {
    const { session_id } = req.params;
    const { format = 'text' } = req.query;

    const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(session_id);
    const messages = db.prepare(`
      SELECT role, content, timestamp FROM chat_messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `).all(session_id);

    if (format === 'json') {
      res.json({ session, messages });
    } else if (format === 'markdown') {
      let md = `# Chat Session Export\n\n`;
      md += `**Workflow**: ${session.workflow_id}\n`;
      md += `**Stage**: ${session.stage_number}\n`;
      md += `**Started**: ${session.started_at}\n\n`;
      md += `---\n\n`;
      messages.forEach(m => {
        md += `### ${m.role === 'user' ? '👤 User' : '🤖 Assistant'} (${m.timestamp})\n\n`;
        md += `${m.content}\n\n`;
      });
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename=chat-${session_id}.md`);
      res.send(md);
    } else {
      // Plain text
      let text = `Chat Session Export\n${'='.repeat(50)}\n\n`;
      text += `Workflow: ${session.workflow_id}\n`;
      text += `Stage: ${session.stage_number}\n`;
      text += `Started: ${session.started_at}\n\n`;
      text += `${'-'.repeat(50)}\n\n`;
      messages.forEach(m => {
        text += `[${m.timestamp}] ${m.role.toUpperCase()}:\n${m.content}\n\n`;
      });
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=chat-${session_id}.txt`);
      res.send(text);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
