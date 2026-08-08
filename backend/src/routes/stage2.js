const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const SkillFileGenerator = require('../agents/skillFileGenerator');
const skillFileEvaluator = require('../agents/skillFileEvaluator');
const { readJiraAttachments } = require('../agents/jiraAttachmentReader');
const { convertToMarkdown } = require('../utils/documentConverter');
const { logAuditTrail, getAuditTrail } = require('../utils/auditLogger');
const { createDocumentVersion } = require('../utils/versionControl');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(__dirname, '../../../uploads/references');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Initialize Skill File Generator Agent with optimized settings
const skillGenerator = new SkillFileGenerator({
  maxTemplatesInPrompt: 8,  // Select top 8 most relevant templates (from 254 total)
  maxTemplateContentLength: 800  // Limit template size to 800 chars each
});

/**
 * Read and convert document file to markdown
 * Supports: .txt, .md, .docx, .pdf (with Pandoc)
 * Automatically extracts images and tables
 * @param {string} filePath - Path to the document
 * @returns {Promise<string>} - Markdown content
 */
async function readDocumentFile(filePath) {
  console.log(`\n📄 Processing document: ${path.basename(filePath)}`);
  
  try {
    const result = await convertToMarkdown(filePath, {
      extractImages: true,
      usePandoc: true
    });
    
    if (!result.success) {
      console.error('⚠️ Conversion failed:', result.warnings.join(', '));
      throw new Error(result.warnings[0] || 'Document conversion failed');
    }
    
    console.log(`✓ Converted with ${result.method}`);
    console.log(`  Content length: ${result.markdown.length} characters`);
    
    if (result.imagePath) {
      console.log(`  Images extracted to: ${path.basename(result.imagePath)}`);
    }
    
    if (result.warnings.length > 0) {
      console.log(`  Warnings: ${result.warnings.join(', ')}`);
    }
    
    return result.markdown;
  } catch (error) {
    console.error('❌ Document processing error:', error.message);
    throw error;
  }
}

// Get default skill files
router.get('/default-skills', (req, res) => {
  const defaultDir = path.resolve(__dirname, '../../../data/default_skills');
  try {
    if (!fs.existsSync(defaultDir)) {
      return res.json({ files: [] });
    }
    const files = fs.readdirSync(defaultDir).map(name => ({
      name,
      url: `/api/stage2/default-skills/${name}`
    }));
    res.json({ files });
  } catch (err) {
    res.json({ files: [] });
  }
});

// Serve default skill file
router.get('/default-skills/:filename', (req, res) => {
  const filepath = path.resolve(__dirname, '../../../data/default_skills', req.params.filename);
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).send('File not found');
  }
});

// Generate skill file with 3 document types (up to 3 files each)
router.post('/generate', upload.fields([
  { name: 'current_feature_spec', maxCount: 3 },
  { name: 'existing_feature_spec', maxCount: 3 },
  { name: 'existing_test_plan', maxCount: 3 }
]), async (req, res) => {
  console.log('=== Stage 2: Generate Skill File ===');
  console.log('Request body:', req.body);
  console.log('Uploaded files:', req.files);
  
  try {
    const { workflow_id, jira_story, selected_skill_files, additional_cli, qa_feature_interactions, base_contract_id } = req.body;
    const story = JSON.parse(jira_story);
    console.log('Parsed Jira story:', story);
    console.log('Additional CLI commands:', additional_cli);
    console.log('QA Feature Interactions:', qa_feature_interactions);
    
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id);
    console.log('Workflow found:', workflow);

    // Read uploaded documents (handle both .txt and .docx files)
    const documents = {};
    if (req.files.current_feature_spec) {
      const texts = await Promise.all(req.files.current_feature_spec.map(f => readDocumentFile(f.path)));
      documents.currentSpec = texts.join('\n\n---\n\n');
      console.log(`Current spec loaded: ${documents.currentSpec.length} characters (${req.files.current_feature_spec.length} file(s))`);
    }
    if (req.files.existing_feature_spec) {
      const texts = await Promise.all(req.files.existing_feature_spec.map(f => readDocumentFile(f.path)));
      documents.existingSpec = texts.join('\n\n---\n\n');
      console.log(`Existing spec loaded: ${documents.existingSpec.length} characters (${req.files.existing_feature_spec.length} file(s))`);
    }
    if (req.files.existing_test_plan) {
      const texts = await Promise.all(req.files.existing_test_plan.map(f => readDocumentFile(f.path)));
      documents.testPlan = texts.join('\n\n---\n\n');
      console.log(`Test plan loaded: ${documents.testPlan.length} characters (${req.files.existing_test_plan.length} file(s))`);
    }
    
    // Add additional CLI commands to documents if provided
    if (additional_cli && additional_cli.trim()) {
      documents.additionalCLI = additional_cli.trim();
      console.log('Additional CLI commands provided:', documents.additionalCLI.length, 'characters');
    }
    
    // Add QA feature interactions to documents if provided
    if (qa_feature_interactions && qa_feature_interactions.trim()) {
      documents.qaFeatureInteractions = qa_feature_interactions.trim();
      console.log('QA Feature Interactions provided:', documents.qaFeatureInteractions.length, 'characters');
    }

    // Inject base contract if selected (parent skill file for feature enhancements)
    if (base_contract_id) {
      const baseContract = db.prepare('SELECT title, content FROM contracts WHERE id = ? AND is_active = 1').get(base_contract_id);
      if (baseContract) {
        documents.baseContract = `## Base Contract: ${baseContract.title}\n\n${baseContract.content}`;
        console.log(`[Stage2] Base contract loaded: ${baseContract.title} (${documents.baseContract.length} chars)`);
      }
    }
    
    console.log('Documents loaded:', Object.keys(documents));

    // STRICT RULE: Always fetch Jira attachments to capture all requirements,
    // email threads, and design decisions not present in the Jira description.
    const jiraKey = story.id || workflow.jira_story_id;
    console.log(`[Stage2] Fetching Jira attachments for ${jiraKey}...`);
    const jiraAttachments = await readJiraAttachments(jiraKey);
    const readableAttachments = jiraAttachments.filter(a => !a.skipped && !a.error);
    if (readableAttachments.length > 0) {
      documents.jiraAttachments = readableAttachments;
      console.log(`[Stage2] Loaded ${readableAttachments.length} Jira attachment(s) into documents`);
    } else {
      console.log('[Stage2] No readable Jira attachments found');
    }

    // Use Skill File Generator Agent
    console.log('Calling Skill File Generator Agent...');
    const result = await skillGenerator.generateSkillFile({
      jiraStory: {
        id: story.id || workflow.jira_story_id,
        title: story.title || workflow.title,
        description: story.description || workflow.jira_story_description || '',
        release: story.release || workflow.jira_release,
        type: story.type || workflow.jira_story_type
      },
      documents,
      streaming: true
    });

    if (!result.success) {
      throw new Error(result.error || 'Skill file generation failed');
    }

    console.log('Skill file generation successful! Content length:', result.content.length);
    
    // Save skill file
    const docId = uuidv4();
    const filename = `skill_file_${workflow_id}_v${Date.now()}.md`;
    const filepath = path.resolve(__dirname, '../../../uploads', filename);
    fs.writeFileSync(filepath, result.content);
    console.log('Skill file saved:', filepath);

    // Save to database with version control (use incrementing version so ORDER BY version DESC returns latest)
    const existingVersion = db.prepare(`SELECT MAX(version) as max_version FROM documents WHERE workflow_id = ? AND stage_number = 2`).get(workflow_id);
    const genVersion = (existingVersion?.max_version || 0) + 1;
    db.prepare(`INSERT INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content, version, created_by, change_summary, is_active) 
                VALUES (?, ?, 2, 'skill_file', ?, ?, ?, ?, ?, ?, 1)`)
      .run(docId, workflow_id, filename, filepath, result.content, genVersion, workflow.created_by, 'Initial skill file generation');
    console.log('Skill file saved to database. ID:', docId, 'Version:', genVersion);

    // Clear existing approval — new skill file requires fresh review
    db.prepare(`DELETE FROM approvals WHERE workflow_id=? AND stage_number=2`).run(workflow_id);
    console.log('Cleared previous approval — fresh approval required for new skill file.');

    // Save generation prompts for audit/reuse
    if (result.prompts) {
      try {
        db.prepare(`INSERT INTO generation_prompts (id, document_id, workflow_id, stage_number, doc_type, system_prompt, user_prompt, model_used, total_chars) VALUES (?, ?, ?, 2, 'skill_file', ?, ?, ?, ?)`)
          .run(uuidv4(), docId, workflow_id, result.prompts.systemPrompt, result.prompts.userPrompt, 'claude-opus-4-8', result.prompts.systemPrompt.length + result.prompts.userPrompt.length);
        console.log('Generation prompts saved.');
      } catch (e) {
        console.warn('Could not save prompts:', e.message);
      }
    }
    
    // Create version history entry
    createDocumentVersion({
      document_id: docId,
      workflow_id,
      content: result.content,
      created_by: workflow.created_by || 'user-admin',
      change_summary: 'Initial skill file generation',
      change_reason: 'Generated from JIRA story and reference documents',
      change_type: 'create',
      tags: 'initial,generated'
    });
    
    // Log audit trail
    logAuditTrail({
      workflow_id,
      stage_number: 2,
      action: 'Generated skill file',
      action_type: 'generate',
      user_id: workflow.created_by,
      details: {
        document_id: docId,
        filename,
        content_length: result.content.length,
        has_current_spec: !!documents.currentSpec,
        has_existing_spec: !!documents.existingSpec,
        has_test_plan: !!documents.testPlan,
        has_additional_cli: !!documents.additionalCLI,
        has_qa_feature_interactions: !!documents.qaFeatureInteractions
      },
      document_id: docId,
      document_version: 1
    });
    
    console.log('Metadata:', JSON.stringify(result.metadata, null, 2));
    console.log('=== Stage 2: Generation Complete ===');

    res.json({ 
      id: docId, 
      content: result.content, 
      filename,
      metadata: result.metadata 
    });
  } catch (err) {
    console.error('=== Stage 2: Generation ERROR ===');
    console.error('Error:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Regenerate skill file based on user feedback
router.post('/regenerate', async (req, res) => {
  console.log('=== Stage 2: Regenerate Skill File with Feedback ===');
  console.log('Request body:', req.body);
  
  try {
    const { workflow_id, current_content, user_feedback, jira_story } = req.body;
    
    if (!user_feedback || !user_feedback.trim()) {
      return res.status(400).json({ error: 'User feedback is required' });
    }
    
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id);
    console.log('Workflow found:', workflow);
    console.log('User feedback:', user_feedback);
    
    // Call LLM to regenerate based on feedback
    const { callLLM } = require('../services/llm');
    
    const systemPrompt = `You are an expert EXOS (Extreme Networks Operating System) technical writer specializing in skill file documentation.

Your task is to UPDATE an existing skill file based on user feedback. The user will provide specific changes, additions, or corrections they want made to the current skill file.

Follow these guidelines:
1. Make ONLY the changes requested by the user
2. Maintain the existing structure and format unless asked to change it
3. Keep all other content unchanged unless specifically requested
4. Ensure CLI commands, configuration examples, and technical details remain accurate
5. Use proper Markdown formatting
6. Preserve the professional tone and comprehensive nature of the documentation

Return the COMPLETE updated skill file, not just the changed sections.`;

    const userPrompt = `**Current Skill File:**
\`\`\`markdown
${current_content}
\`\`\`

**User's Requested Changes:**
${user_feedback}

**Story Context:**
- Story ID: ${jira_story.id}
- Title: ${jira_story.title}
- Release: ${jira_story.release}

Please regenerate the complete skill file incorporating the user's requested changes. Return only the updated markdown content, with no additional explanations.`;

    console.log('Calling LLM for regeneration...');
    const updatedContent = await callLLM(systemPrompt, userPrompt, false);
    console.log('Regeneration successful! Updated content length:', updatedContent.length);
    
    // Save updated skill file
    const docId = uuidv4();
    const filename = `skill_file_${workflow_id}_v${Date.now()}.md`;
    const filepath = path.resolve(__dirname, '../../../uploads', filename);
    fs.writeFileSync(filepath, updatedContent);
    console.log('Updated skill file saved:', filepath);

    // Save to database with version control
    const currentVersion = db.prepare(`SELECT MAX(version) as max_version FROM documents WHERE workflow_id = ? AND stage_number = 2`).get(workflow_id);
    const newVersion = (currentVersion?.max_version || 0) + 1;
    
    db.prepare(`INSERT INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content, version, created_by, change_summary, change_reason, is_active) 
                VALUES (?, ?, 2, 'skill_file', ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(docId, workflow_id, filename, filepath, updatedContent, newVersion, workflow.created_by, 'Regenerated based on user feedback', user_feedback.substring(0, 500));
    
    // Create version history entry
    createDocumentVersion({
      document_id: docId,
      workflow_id,
      content: updatedContent,
      created_by: workflow.created_by || 'user-admin',
      change_summary: 'Regenerated based on user feedback',
      change_reason: user_feedback.substring(0, 500),
      change_type: 'update',
      tags: 'regenerated,user-feedback'
    });
    
    console.log('Updated skill file saved to database. ID:', docId, 'Version:', newVersion);

    // Clear existing approval — regenerated skill file requires fresh review
    db.prepare(`DELETE FROM approvals WHERE workflow_id=? AND stage_number=2`).run(workflow_id);
    console.log('Cleared previous approval — fresh approval required for regenerated skill file.');

    // Save generation prompts for audit/reuse
    try {
      db.prepare(`INSERT INTO generation_prompts (id, document_id, workflow_id, stage_number, doc_type, system_prompt, user_prompt, model_used, total_chars) VALUES (?, ?, ?, 2, 'skill_file', ?, ?, ?, ?)`)
        .run(uuidv4(), docId, workflow_id, systemPrompt, userPrompt, 'claude-opus-4-8', systemPrompt.length + userPrompt.length);
      console.log('Generation prompts saved (regenerate).');
    } catch (e) {
      console.warn('Could not save prompts:', e.message);
    }
    
    // Log audit trail
    logAuditTrail({
      workflow_id,
      stage_number: 2,
      action: `Regenerated skill file (v${newVersion}) based on user feedback`,
      action_type: 'regenerate',
      user_id: workflow.created_by,
      details: {
        document_id: docId,
        filename,
        version: newVersion,
        user_feedback: user_feedback.substring(0, 200), // First 200 chars
        content_length: updatedContent.length
      },
      document_id: docId,
      document_version: newVersion
    });
    
    console.log('=== Stage 2: Regeneration Complete ===');

    res.json({ 
      id: docId, 
      content: updatedContent, 
      filename,
      version: newVersion
    });
  } catch (err) {
    console.error('=== Stage 2: Regeneration ERROR ===');
    console.error('Error:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Query LLM about the skill file (Q&A without modification)
router.post('/query', async (req, res) => {
  console.log('=== Stage 2: Query LLM about Skill File ===');
  console.log('Request body:', req.body);
  
  try {
    const { workflow_id, current_content, user_question, jira_story } = req.body;
    
    if (!user_question || !user_question.trim()) {
      return res.status(400).json({ error: 'User question is required' });
    }
    
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id);
    console.log('Workflow found:', workflow);
    console.log('User question:', user_question);
    
    // Call LLM to answer the question
    const { callLLM } = require('../services/llm');
    
    const systemPrompt = `You are an expert EXOS (Extreme Networks Operating System) technical documentation assistant.

Your role is to answer questions about skill file documentation. You will be provided with:
1. The current skill file content
2. A specific question from the user

Analyze the skill file and provide a helpful, accurate answer. You should:
- Point out what is present or missing in the skill file
- Suggest improvements if asked
- Identify gaps or errors
- Provide specific examples if needed
- Reference relevant sections by name or line numbers
- Be concise but thorough

Do NOT regenerate or modify the skill file. Simply answer the question based on what you observe.`;

    const userPrompt = `**Current Skill File:**
\`\`\`markdown
${current_content}
\`\`\`

**Story Context:**
- Story ID: ${jira_story.id}
- Title: ${jira_story.title}
- Release: ${jira_story.release}
- Type: ${jira_story.type}

**User's Question:**
${user_question}

Please analyze the skill file and answer the user's question. Be specific and reference relevant sections.`;

    console.log('Calling LLM for skill file query...');
    const answer = await callLLM(systemPrompt, userPrompt, false);
    console.log('LLM query successful! Answer length:', answer.length);
    
    console.log('=== Stage 2: Query Complete ===');

    res.json({ 
      answer: answer,
      question: user_question,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('=== Stage 2: Query ERROR ===');
    console.error('Error:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Check if skill file exists for a Jira story ID (from any previous workflow)
router.get('/check-existing/:jira_story_id', (req, res) => {
  try {
    const { jira_story_id } = req.params;
    console.log(`Checking for existing skill file for Jira story: ${jira_story_id}`);
    
    // Find the most recent skill file for this Jira story across all workflows
    const existingDoc = db.prepare(`
      SELECT d.*, w.title as workflow_title, w.created_at as workflow_created_at
      FROM documents d
      JOIN workflows w ON d.workflow_id = w.id
      WHERE w.jira_story_id = ? 
        AND d.stage_number = 2 
        AND d.doc_type = 'skill_file'
      ORDER BY d.created_at DESC 
      LIMIT 1
    `).get(jira_story_id);
    
    if (existingDoc) {
      console.log(`Found existing skill file: ${existingDoc.filename} from workflow: ${existingDoc.workflow_title}`);
      res.json({
        exists: true,
        document: existingDoc
      });
    } else {
      console.log(`No existing skill file found for Jira story: ${jira_story_id}`);
      res.json({ exists: false });
    }
  } catch (err) {
    console.error('Error checking existing skill file:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reuse existing skill file from another workflow
router.post('/reuse', (req, res) => {
  try {
    const { workflow_id, source_document_id } = req.body;
    console.log(`=== Reusing skill file ${source_document_id} for workflow ${workflow_id} ===`);
    
    // Get the source document
    const sourceDoc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(source_document_id);
    if (!sourceDoc) {
      return res.status(404).json({ error: 'Source skill file not found' });
    }
    
    // Copy the skill file to the new workflow
    const docId = uuidv4();
    const filename = `skill_file_${workflow_id}_v${Date.now()}.md`;
    const filepath = path.resolve(__dirname, '../../../uploads', filename);
    
    // Copy file content
    fs.writeFileSync(filepath, sourceDoc.content);
    console.log('Skill file copied:', filepath);
    
    // Save to database
    db.prepare(`INSERT OR REPLACE INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content, version) 
                VALUES (?, ?, 2, 'skill_file', ?, ?, ?, 1)`)
      .run(docId, workflow_id, filename, filepath, sourceDoc.content);
    
    console.log('Skill file reused successfully. New ID:', docId);
    
    // Get workflow info for audit
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id);
    const sourceWorkflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(sourceDoc.workflow_id);
    
    // Log audit trail
    logAuditTrail({
      workflow_id,
      stage_number: 2,
      action: `Reused skill file from workflow ${sourceWorkflow?.jira_story_id || sourceDoc.workflow_id}`,
      action_type: 'reuse',
      user_id: workflow?.created_by,
      details: {
        document_id: docId,
        source_document_id: source_document_id,
        source_workflow_id: sourceDoc.workflow_id,
        source_jira_id: sourceWorkflow?.jira_story_id,
        filename,
        content_length: sourceDoc.content.length
      },
      document_id: docId,
      document_version: 1
    });
    
    res.json({ 
      id: docId, 
      content: sourceDoc.content, 
      filename,
      reused: true
    });
  } catch (err) {
    console.error('Error reusing skill file:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get current skill file and approval status
router.get('/:workflow_id', (req, res) => {
  const doc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=2 AND doc_type='skill_file' ORDER BY version DESC LIMIT 1`).get(req.params.workflow_id);
  const approval = db.prepare(`SELECT * FROM approvals WHERE workflow_id=? AND stage_number=2 AND action='approved' LIMIT 1`).get(req.params.workflow_id);
  res.json({ 
    ...doc, 
    approved: !!approval 
  });
});

// Evaluate skill file quality
router.post('/evaluate', async (req, res) => {
  console.log('=== Stage 2: Evaluate Skill File Quality ===');
  console.log('Request body keys:', Object.keys(req.body));
  
  try {
    const { workflow_id, content, jira_story } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Skill file content is required' });
    }
    
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id);
    console.log('Workflow found:', workflow ? workflow.id : 'not found');
    
    // Get commit analysis if available
    let commitAnalysis = null;
    if (workflow && process.env.SKIP_COMMIT_ANALYSIS !== 'true') {
      console.log('Fetching commit analysis for evaluation context...');
      const { analyzeCommitsForStory } = require('../agents/commitAnalyzer');
      const storyForAnalysis = {
        id: jira_story.id || workflow.jira_story_id,
        title: jira_story.title || workflow.title,
        description: jira_story.description || workflow.jira_story_description || '',
        release: jira_story.release || workflow.jira_release
      };
      commitAnalysis = await analyzeCommitsForStory(storyForAnalysis);
      console.log('Commit analysis:', commitAnalysis.success ? 
        `${commitAnalysis.commitCount} commits analyzed` : 'not available');
    }
    
    // Call evaluator
    console.log('Calling skill file evaluator...');
    // Fetch Jira attachments for evaluation context (STRICT RULE)
    const evalJiraKey = jira_story.id || workflow.jira_story_id;
    let evalAttachments = [];
    try {
      const rawAttachments = await readJiraAttachments(evalJiraKey);
      evalAttachments = rawAttachments.filter(a => !a.skipped && !a.error);
      console.log(`[Evaluate] Loaded ${evalAttachments.length} Jira attachment(s) for evaluation`);
    } catch (e) {
      console.warn('[Evaluate] Could not fetch attachments for evaluation:', e.message);
    }
    const evaluationResult = await skillFileEvaluator.evaluateSkillFile(
      content,
      {
        id: jira_story.id || workflow.jira_story_id,
        title: jira_story.title || workflow.title,
        description: jira_story.description || workflow.jira_story_description || '',
        release: jira_story.release || workflow.jira_release
      },
      commitAnalysis,
      evalAttachments
    );
    
    if (!evaluationResult.success) {
      throw new Error(evaluationResult.error || 'Evaluation failed');
    }
    
    console.log('Evaluation successful!');
    console.log('Grade:', evaluationResult.grade, '| Score:', evaluationResult.finalScore);
    
    // Save evaluation to database
    const evalId = uuidv4();
    const timestamp = new Date().toISOString();
    
    try {
      db.prepare(`
        INSERT INTO skill_evaluations 
        (id, workflow_id, grade, final_score, category_scores, strengths, weaknesses, recommendations, summary, evaluated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        evalId,
        workflow_id,
        evaluationResult.grade,
        evaluationResult.finalScore,
        JSON.stringify(evaluationResult.categoryScores || {}),
        JSON.stringify(evaluationResult.strengths || []),
        JSON.stringify(evaluationResult.weaknesses || []),
        JSON.stringify(evaluationResult.recommendations || []),
        evaluationResult.summary || '',
        timestamp
      );
      console.log('Evaluation saved to database with ID:', evalId);
    } catch (dbError) {
      // Table might not exist - create it
      console.log('Creating skill_evaluations table...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS skill_evaluations (
          id TEXT PRIMARY KEY,
          workflow_id TEXT NOT NULL,
          grade TEXT NOT NULL,
          final_score REAL NOT NULL,
          category_scores TEXT,
          strengths TEXT,
          weaknesses TEXT,
          recommendations TEXT,
          summary TEXT,
          evaluated_at TEXT NOT NULL,
          FOREIGN KEY (workflow_id) REFERENCES workflows(id)
        )
      `);
      
      // Retry insert
      db.prepare(`
        INSERT INTO skill_evaluations 
        (id, workflow_id, grade, final_score, category_scores, strengths, weaknesses, recommendations, summary, evaluated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        evalId,
        workflow_id,
        evaluationResult.grade,
        evaluationResult.finalScore,
        JSON.stringify(evaluationResult.categoryScores || {}),
        JSON.stringify(evaluationResult.strengths || []),
        JSON.stringify(evaluationResult.weaknesses || []),
        JSON.stringify(evaluationResult.recommendations || []),
        evaluationResult.summary || '',
        timestamp
      );
      console.log('Table created and evaluation saved with ID:', evalId);
    }
    
    console.log('=== Stage 2: Evaluation Complete ===');
    
    res.json({
      success: true,
      evaluation_id: evalId,
      ...evaluationResult
    });
    
  } catch (err) {
    console.error('=== Stage 2: Evaluation ERROR ===');
    console.error('Error:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Approve skill file
router.post('/approve', (req, res) => {
  try {
    const { workflow_id, user_id } = req.body;
    
    // Record approval
    const approvalId = uuidv4();
    db.prepare(`INSERT INTO approvals (id, workflow_id, stage_number, user_id, action) 
                VALUES (?, ?, 2, ?, 'approved')`)
      .run(approvalId, workflow_id, user_id);
    
    // Update stage status (don't update current_stage here - let the frontend's advanceStage handle it)
    db.prepare(`UPDATE stages SET status='completed', completed_at=CURRENT_TIMESTAMP 
                WHERE workflow_id=? AND stage_number=2`).run(workflow_id);
    
    // Get user info for audit
    const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(user_id);
    
    // Log audit trail
    logAuditTrail({
      workflow_id,
      stage_number: 2,
      action: `Skill file approved by ${user?.name || 'user'}`,
      action_type: 'approve',
      user_id,
      user_name: user?.name,
      details: {
        stage_status: 'completed'
      }
    });
    
    console.log(`Stage 2 approved for workflow ${workflow_id} by user ${user_id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Approval failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get audit trail for workflow
router.get('/audit-trail/:workflow_id', (req, res) => {
  try {
    const { workflow_id } = req.params;
    const auditTrail = getAuditTrail(workflow_id, 2); // Stage 2 only
    
    res.json({ 
      success: true, 
      audit_trail: auditTrail.map(entry => ({
        ...entry,
        details: entry.details ? JSON.parse(entry.details) : null
      }))
    });
  } catch (err) {
    console.error('Failed to get audit trail:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get saved prompts for a document (for audit/debugging)
router.get('/prompts/:workflow_id', (req, res) => {
  try {
    const rows = db.prepare(`SELECT id, document_id, stage_number, doc_type, model_used, total_chars, created_at FROM generation_prompts WHERE workflow_id=? ORDER BY created_at DESC`).all(req.params.workflow_id);
    res.json({ success: true, prompts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/prompts/detail/:prompt_id', (req, res) => {
  try {
    const row = db.prepare(`SELECT * FROM generation_prompts WHERE id=?`).get(req.params.prompt_id);
    if (!row) return res.status(404).json({ error: 'Prompt not found' });
    res.json({ success: true, prompt: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save current skill file as a Contract (parent/canonical skill file for a feature)
router.post('/save-as-contract', (req, res) => {
  try {
    const { workflow_id, feature_key, title, description, content, document_id } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });
    if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });

    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id);
    const jira_story_id = workflow?.jira_story_id || null;

    // Derive feature_key from title if not supplied
    const fKey = (feature_key || title).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 60);

    // Compute next version for this feature
    const latest = db.prepare(`SELECT MAX(version) as v FROM contracts WHERE feature_key=?`).get(fKey);
    const newVer = (latest?.v || 0) + 1;

    const contractId = uuidv4();
    db.prepare(`INSERT INTO contracts (id, feature_key, jira_story_id, title, description, content, version, source_document_id, created_by, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(contractId, fKey, jira_story_id, title.trim(), description || '', content, newVer, document_id || null, workflow?.created_by || null);

    console.log(`Contract saved: ${fKey} v${newVer} (${contractId})`);
    res.json({ success: true, contract_id: contractId, feature_key: fKey, version: newVer });
  } catch (err) {
    console.error('Save-as-contract failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
