const express = require('express');
const router = express.Router();
const { logAuditTrail } = require('../utils/auditLogger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { callLLM } = require('../services/llm');
const TestPlanGenerator = require('../agents/testPlanGenerator');
const TopologyAnalyzer = require('../agents/topologyAnalyzer');
const testPlanEvaluator = require('../services/testPlanEvaluator');
const { createDocumentVersion, createDocumentRevision } = require('../utils/versionControl');
const { generateQTestExcel } = require('../utils/testPlanToExcel');
const { generateTestPlanWord } = require('../utils/testPlanToWord');
const TestPlanValidator = require('../utils/testPlanValidator');
const TestPlanNormalizer = require('../utils/testPlanNormalizer');

// Initialize agents and utilities
const testPlanGenerator = new TestPlanGenerator();
const topologyAnalyzer = new TopologyAnalyzer();
const testPlanValidator = new TestPlanValidator();
const testPlanNormalizer = new TestPlanNormalizer();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(__dirname, '../../../uploads/testplans');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Configure multer for multiple file uploads
const uploadFields = upload.fields([
  { name: 'existing_test_plan', maxCount: 1 },
  { name: 'unit_test_plan', maxCount: 1 },
  { name: 'functional_oneliner', maxCount: 1 },
  { name: 'topology_file', maxCount: 1 }
]);

// Generate test plan from skill file
router.post('/generate', uploadFields, async (req, res) => {
  const { workflow_id, feature_type, coverage_level = 'STANDARD', test_plan_info, user_instructions, topology_description } = req.body;
  const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id);
  const skillDoc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=2 AND doc_type='skill_file' ORDER BY version DESC LIMIT 1`).get(workflow_id);

  if (!skillDoc) return res.status(400).json({ error: 'Skill file not found. Complete Stage 2 first.' });

  console.log('=== Stage 3: Test Plan Generation ===');
  console.log('Feature Type:', feature_type);
  console.log('Coverage Level:', coverage_level);
  console.log('Has Existing Test Plan:', !!req.body.existing_test_plan);
  console.log('Has Test Plan Info:', !!test_plan_info);
  console.log('Has Unit Test Plan:', !!(req.files && req.files.unit_test_plan));
  console.log('Has Functional One-Liners:', !!(req.files && req.files.functional_oneliner));
  console.log('Has Existing Test Plan:', !!req.body.existing_test_plan);
  console.log('Has Topology File:', !!(req.files && req.files.topology_file));
  console.log('User Instructions:', user_instructions ? `"${user_instructions.substring(0, 100)}..."` : 'None');

  // Parse test plan info if provided
  let testPlanInfoData = null;
  if (test_plan_info) {
    try {
      testPlanInfoData = typeof test_plan_info === 'string' ? JSON.parse(test_plan_info) : test_plan_info;
      console.log('Test Plan Info:', JSON.stringify(testPlanInfoData, null, 2));
    } catch (err) {
      console.error('Error parsing test_plan_info:', err);
    }
  }

  // Process unit test plan if uploaded
  let unitTestPlanContent = null;
  if (req.files && req.files.unit_test_plan && req.files.unit_test_plan[0]) {
    const unitTestFile = req.files.unit_test_plan[0];
    console.log('Unit test plan uploaded:', unitTestFile.originalname);
    
    try {
      // Read the file based on its extension
      const ext = path.extname(unitTestFile.originalname).toLowerCase();
      
      if (['.txt', '.md'].includes(ext)) {
        unitTestPlanContent = fs.readFileSync(unitTestFile.path, 'utf-8');
      } else if (['.doc', '.docx'].includes(ext)) {
        // For now, read as text - you may want to add a doc parser library
        unitTestPlanContent = fs.readFileSync(unitTestFile.path, 'utf-8');
        console.log('Note: .doc/.docx files require additional parsing. Reading as text for now.');
      } else if (['.csv', '.xls', '.xlsx'].includes(ext)) {
        // For now, read as text - you may want to add a CSV/Excel parser library
        unitTestPlanContent = fs.readFileSync(unitTestFile.path, 'utf-8');
        console.log('Note: CSV/Excel files require additional parsing. Reading as text for now.');
      } else {
        unitTestPlanContent = fs.readFileSync(unitTestFile.path, 'utf-8');
      }
      
      console.log('Unit test plan content length:', unitTestPlanContent.length);
    } catch (err) {
      console.error('Error reading unit test plan file:', err);
      // Continue without unit test plan if there's an error
      unitTestPlanContent = null;
    }
  }

  // Process functional one-liner if uploaded
  let functionalOnelinerContent = null;
  if (req.files && req.files.functional_oneliner && req.files.functional_oneliner[0]) {
    const onelinerFile = req.files.functional_oneliner[0];
    console.log('Functional one-liner uploaded:', onelinerFile.originalname);
    
    try {
      functionalOnelinerContent = fs.readFileSync(onelinerFile.path, 'utf-8');
      console.log('Functional one-liner content length:', functionalOnelinerContent.length);
    } catch (err) {
      console.error('Error reading functional one-liner file:', err);
      functionalOnelinerContent = null;
    }
  }

  // Process topology file if uploaded
  let topologyData = null;
  if (req.files && req.files.topology_file && req.files.topology_file[0]) {
    const topologyFile = req.files.topology_file[0];
    console.log('Topology file uploaded:', topologyFile.originalname);
    
    try {
      const ext = path.extname(topologyFile.originalname).toLowerCase().substring(1); // Remove dot
      
      // Analyze topology using LLM
      topologyData = await topologyAnalyzer.analyzeTopology(
        topologyFile.path,
        ext,
        user_instructions || ''
      );
      
      console.log('Topology analyzed:', topologyData.topology_type);
      console.log('Devices:', topologyData.device_count);
      
      // Save topology data to workflow
      db.prepare('UPDATE workflows SET topology_file=?, topology_description=?, user_instructions=? WHERE id=?')
        .run(topologyFile.originalname, JSON.stringify(topologyData), user_instructions || null, workflow_id);
      
    } catch (err) {
      console.error('Error analyzing topology file:', err);
      // Continue without topology data if there's an error
      topologyData = null;
    }
  } else if (user_instructions) {
    // Save user instructions even if no topology file
    db.prepare('UPDATE workflows SET user_instructions=? WHERE id=?')
      .run(user_instructions, workflow_id);
  }

  try {
    let content;
    
    // Use Test Plan Generator Agent for comprehensive test plans
    console.log('Using Test Plan Generator Agent...');
    
    const result = await testPlanGenerator.generateTestPlan({
      featureName: workflow.title || 'Feature',
      skillFileContent: skillDoc.content,
      coverageLevel: coverage_level.toUpperCase(), // SANITY | STANDARD | COMPREHENSIVE
      jiraStory: {
        id: workflow.jira_story_id,
        title: workflow.title,
        release: workflow.jira_release
      },
      previousTestPlan: req.body.existing_test_plan || null, // For enhancements/existing functional test plan
      testPlanInfo: testPlanInfoData, // Add questionnaire data
      unitTestPlan: unitTestPlanContent, // Add unit test plan from dev team
      functionalOneliner: functionalOnelinerContent, // Add functional one-liners from user
      topologyData: topologyData, // Add analyzed topology data
      topologyDescription: topology_description || null, // Add user-provided topology description
      userInstructions: user_instructions || null, // Add user instructions
      streaming: false
    });

    if (!result.success) {
      throw new Error(result.error || 'Test plan generation failed');
    }

    content = result.content;
    console.log('Test plan generated successfully, length:', content.length);
    console.log('Metadata:', JSON.stringify(result.metadata, null, 2));
    
    // ===== QUALITY CONTROL PIPELINE =====
    console.log('\n=== Starting Quality Control Pipeline ===');
    
    // Step 1: Normalize format to ensure consistency
    console.log('Step 1: Normalizing test plan format...');
    const normalizationResult = testPlanNormalizer.normalize(content);
    content = normalizationResult.content;
    console.log(`Normalization complete: ${normalizationResult.changesCount} changes made`);
    if (normalizationResult.changes.length > 0) {
      console.log('Changes applied:');
      normalizationResult.changes.forEach((change, idx) => {
        console.log(`  ${idx + 1}. ${change}`);
      });
    }
    
    // Step 2: Validate against standards
    console.log('\nStep 2: Validating against organizational standards...');
    const validationResult = testPlanValidator.validate(content);
    const validationSummary = testPlanValidator.getSummary(validationResult);
    console.log(`Validation complete: Score ${validationResult.score}/100 (${validationSummary.grade})`);
    console.log(`  - Critical issues: ${validationSummary.criticalIssues}`);
    console.log(`  - Major issues: ${validationSummary.majorIssues}`);
    console.log(`  - Minor issues: ${validationSummary.minorIssues}`);
    console.log(`  - Status: ${validationSummary.status}`);
    console.log(`  - Recommendation: ${validationSummary.recommendation}`);
    
    // Step 3: Log to audit trail
    const auditId = uuidv4();
    db.prepare(`
      INSERT INTO audit_log (id, event_type, entity_type, entity_id, user_id, action, details, llm_model, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditId,
      'test_plan_generation',
      'document',
      workflow_id,
      workflow.created_by || 'system',
      'generate',
      `Generated and validated test plan. Score: ${validationResult.score}/100`,
      result.metadata.llmModel || 'claude-opus-4-8',
      JSON.stringify({
        validation_score: validationResult.score,
        normalization_changes: normalizationResult.changesCount,
        test_case_count: validationResult.statistics.testCaseCount
      })
    );
    
    console.log('=== Quality Control Pipeline Complete ===\n');
    
    // Save test plan info to database if provided
    if (testPlanInfoData) {
      const testPlanInfoId = uuidv4();
      const testPlanInfoFilename = `test_plan_info_${workflow_id}_${Date.now()}.json`;
      const testPlanInfoPath = path.resolve(__dirname, '../../../uploads', testPlanInfoFilename);
      fs.writeFileSync(testPlanInfoPath, JSON.stringify(testPlanInfoData, null, 2));
      
      db.prepare(`INSERT OR REPLACE INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content) VALUES (?, ?, 3, 'test_plan_info', ?, ?, ?)`)
        .run(testPlanInfoId, workflow_id, testPlanInfoFilename, testPlanInfoPath, JSON.stringify(testPlanInfoData));
      
      console.log('Test plan info saved to database');
    }
    
    // Determine new version by incrementing the current max version
    const latestTPVersion = db.prepare(`SELECT MAX(version) as mv FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan'`).get(workflow_id);
    const newVersion = (latestTPVersion?.mv || 0) + 1;

    const docId = uuidv4();
    const filename = `test_plan_${workflow_id}_${feature_type}_${coverage_level}_v${Date.now()}.md`;
    const filepath = path.resolve(__dirname, '../../../uploads', filename);
    fs.writeFileSync(filepath, content);

    // Save to database with version control and quality metadata
    db.prepare(`
      INSERT OR REPLACE INTO documents (
        id, workflow_id, stage_number, doc_type, filename, filepath, content, 
        version, created_by, change_summary, is_active,
        llm_model, llm_version, llm_temperature, generation_timestamp,
        validation_status, validation_score, validation_errors, validation_warnings, validated_at,
        normalization_applied, normalization_changes, normalized_at
      ) VALUES (?, ?, 3, 'test_plan', ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docId, workflow_id, filename, filepath, content, 
      newVersion, workflow.created_by, 'Initial test plan generation',
      result.metadata.llmModel || 'claude-opus-4-8',
      result.metadata.llmVersion || '2024-02-29',
      0.3,
      new Date().toISOString(),
      validationResult.valid ? 'passed' : 'failed',
      validationResult.score,
      JSON.stringify(validationResult.errors),
      JSON.stringify(validationResult.warnings),
      new Date().toISOString(),
      normalizationResult.changesCount > 0 ? 1 : 0,
      JSON.stringify(normalizationResult.changes),
      new Date().toISOString()
    );
    
    // Save detailed validation results
    const validationId = uuidv4();
    db.prepare(`
      INSERT INTO document_validations (
        id, document_id, validated_at, validator_version,
        validation_score, validation_grade, total_issues,
        critical_issues, major_issues, minor_issues,
        test_case_count, issues_json, statistics_json, recommendation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      validationId, docId, new Date().toISOString(), '2.0',
      validationResult.score, validationSummary.grade, validationSummary.totalIssues,
      validationSummary.criticalIssues, validationSummary.majorIssues, validationSummary.minorIssues,
      validationResult.statistics.testCaseCount,
      JSON.stringify(validationResult.issues),
      JSON.stringify(validationResult.statistics),
      validationSummary.recommendation
    );
    
    // Save normalization details
    if (normalizationResult.changesCount > 0) {
      const normalizationId = uuidv4();
      db.prepare(`
        INSERT INTO document_normalizations (
          id, document_id, normalized_at, normalizer_version,
          changes_count, changes_json, categories_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        normalizationId, docId, new Date().toISOString(), '2.0',
        normalizationResult.changesCount,
        JSON.stringify(normalizationResult.changes),
        JSON.stringify(testPlanNormalizer.getSummary().categories)
      );
    }

    // Create version history entry (with prompts for LLM drift tracking)
    createDocumentVersion({
      document_id: docId,
      workflow_id,
      content,
      created_by: workflow.created_by || 'user-admin',
      change_summary: 'Initial test plan generation',
      change_reason: `Generated from skill file with ${coverage_level} coverage`,
      change_type: 'create',
      tags: 'initial,generated',
      metadata: {
        feature_type,
        coverage_level,
        has_topology: !!topologyData,
        has_topology_description: !!topology_description,
        has_user_instructions: !!user_instructions,
        has_unit_test_plan: !!unitTestPlanContent,
        has_functional_oneliner: !!functionalOnelinerContent,
        has_existing_test_plan: !!req.body.existing_test_plan,
        llm_prompts: result.prompts ? {
          system_prompt: result.prompts.systemPrompt,
          user_prompt: result.prompts.userPrompt,
          system_prompt_length: result.prompts.systemPrompt.length,
          user_prompt_length: result.prompts.userPrompt.length
        } : null
      }
    });
    
    // Create detailed revision record with LLM and validation metadata
    createDocumentRevision({
      document_id: docId,
      version_number: 1,
      content,
      created_by: workflow.created_by || 'user-admin',
      change_type: 'create',
      change_summary: 'Initial test plan generation with quality controls',
      llm_model: result.metadata.llmModel || 'claude-opus-4-8',
      llm_version: result.metadata.llmVersion || '2024-02-29',
      validation_score: validationResult.score,
      normalization_applied: normalizationResult.changesCount > 0,
      metadata: {
        generation_metadata: result.metadata,
        validation_summary: validationSummary,
        normalization_summary: testPlanNormalizer.getSummary()
      }
    });

    console.log('Test plan saved to database with full audit trail');
    
    // Invalidate old cached Excel/Word files for this workflow before generating new ones
    const oldExcelDocs = db.prepare(`SELECT filepath FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_excel'`).all(workflow_id);
    oldExcelDocs.forEach(doc => { try { fs.unlinkSync(doc.filepath); } catch (e) {} });
    db.prepare(`DELETE FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_excel'`).run(workflow_id);
    const oldWordDocs = db.prepare(`SELECT filepath FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_word'`).all(workflow_id);
    oldWordDocs.forEach(doc => { try { fs.unlinkSync(doc.filepath); } catch (e) {} });
    db.prepare(`DELETE FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_word'`).run(workflow_id);

    // Generate Excel file in qTest format
    console.log('Generating Excel file in qTest format...');
    try {
      const excelFilename = `test_plan_${workflow_id}_${feature_type}_${coverage_level}_v${Date.now()}.xlsx`;
      const excelFilepath = path.resolve(__dirname, '../../../uploads', excelFilename);
      
      const excelResult = await generateQTestExcel(content, excelFilepath, {
        jira_story_id: workflow.jira_story_id,
        workflow_id: workflow_id,
        feature_name: workflow.title,
        release: workflow.jira_release
      });
      
      // Save Excel file reference to database
      const excelDocId = uuidv4();
      db.prepare(`INSERT INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content, version, created_by, change_summary, is_active) VALUES (?, ?, 3, 'test_plan_excel', ?, ?, ?, ?, ?, ?, 1)`)
        .run(excelDocId, workflow_id, excelFilename, excelFilepath, `Excel export with ${excelResult.testCaseCount} test cases`, newVersion, workflow.created_by, 'Excel test plan export');
      
      console.log(`Excel file generated: ${excelFilename} (${excelResult.testCaseCount} test cases)`);
    } catch (excelError) {
      console.error('Excel generation error (non-fatal):', excelError);
      // Don't fail the entire request if Excel generation fails
    }
    
    // Generate Word document
    console.log('Generating Word document...');
    try {
      const wordFilename = `test_plan_${workflow_id}_${feature_type}_${coverage_level}_v${Date.now()}.docx`;
      const wordFilepath = path.resolve(__dirname, '../../../uploads', wordFilename);
      
      const wordResult = await generateTestPlanWord(content, wordFilepath, {
        jira_story_id: workflow.jira_story_id,
        workflow_id: workflow_id,
        feature_name: workflow.title,
        jira_release: workflow.jira_release
      });
      
      // Save Word file reference to database
      const wordDocId = uuidv4();
      db.prepare(`INSERT INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content, version, created_by, change_summary, is_active) VALUES (?, ?, 3, 'test_plan_word', ?, ?, ?, ?, ?, ?, 1)`)
        .run(wordDocId, workflow_id, wordFilename, wordFilepath, `Word export with ${wordResult.testCaseCount} test cases`, newVersion, workflow.created_by, 'Word test plan export');
      
      console.log(`Word file generated: ${wordFilename} (${wordResult.testCaseCount} test cases)`);
    } catch (wordError) {
      console.error('Word generation error (non-fatal):', wordError);
      // Don't fail the entire request if Word generation fails
    }
    
    console.log('=== Stage 3: Generation Complete ===');
    
    // Extract new test cases for display
    const testCaseMatches = content.match(/### Test Case \d+:.*?(?=### Test Case \d+:|##\s|$)/gs);
    const newTestCases = testCaseMatches || [];
    
    res.json({ 
      id: docId, 
      content, 
      filename,
      metadata: result.metadata,
      new_test_cases: newTestCases,
      validation: {
        score: validationResult.score,
        grade: validationSummary.grade,
        status: validationSummary.status,
        totalIssues: validationSummary.totalIssues,
        criticalIssues: validationSummary.criticalIssues,
        majorIssues: validationSummary.majorIssues,
        minorIssues: validationSummary.minorIssues,
        recommendation: validationSummary.recommendation,
        testCaseCount: validationResult.statistics.testCaseCount,
        sanityTestCount: validationResult.statistics.sanityTestCount
      },
      normalization: {
        changesApplied: normalizationResult.changesCount,
        changes: normalizationResult.changes
      }
    });
  } catch (err) {
    console.error('=== Stage 3: Generation ERROR ===');
    console.error('Test plan generation error:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Upload existing test plan
router.post('/upload', upload.single('file'), (req, res) => {
  const { workflow_id } = req.body;
  const content = fs.readFileSync(req.file.path, 'utf-8');
  const docId = uuidv4();
  db.prepare(`INSERT OR REPLACE INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content) VALUES (?, ?, 3, 'test_plan', ?, ?, ?)`)
    .run(docId, workflow_id, req.file.originalname, req.file.path, content);
  res.json({ id: docId, content, filename: req.file.originalname });
});

// Amend test plan
router.put('/amend', (req, res) => {
  const { workflow_id, content, user_id, user_name } = req.body;
  db.prepare(`UPDATE documents SET content=? WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan'`).run(content, workflow_id);
  logAuditTrail({
    workflow_id,
    stage_number: 3,
    action: 'Test plan manually amended',
    action_type: 'amend',
    user_id: user_id || null,
    user_name: user_name || null,
    details: { content_length: content?.length },
  });
  res.json({ success: true });
});

// Approve (user only)
router.post('/approve', (req, res) => {
  const { workflow_id, user_id } = req.body;
  const usr = db.prepare('SELECT name FROM users WHERE id=?').get(user_id);
  db.prepare(`INSERT INTO approvals (id, workflow_id, stage_number, user_id, action) VALUES (?, ?, 3, ?, 'approved')`)
    .run(uuidv4(), workflow_id, user_id);
  db.prepare(`UPDATE stages SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE workflow_id=? AND stage_number=3`).run(workflow_id);
  logAuditTrail({
    workflow_id,
    stage_number: 3,
    action: `Test plan stage approved by ${usr?.name || user_id}`,
    action_type: 'approve',
    user_id,
    user_name: usr?.name || null,
  });
  res.json({ success: true });
});

// Get test plan
router.get('/:workflow_id', (req, res) => {
  const doc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1`).get(req.params.workflow_id);
  res.json(doc || null);
});

// Save test plan info (from questionnaire)
router.post('/test-plan-info', (req, res) => {
  const { workflow_id, test_plan_info } = req.body;
  
  if (!workflow_id || !test_plan_info) {
    return res.status(400).json({ error: 'workflow_id and test_plan_info are required' });
  }
  
  try {
    const testPlanInfoId = uuidv4();
    const testPlanInfoFilename = `test_plan_info_${workflow_id}_${Date.now()}.json`;
    const testPlanInfoPath = path.resolve(__dirname, '../../../uploads', testPlanInfoFilename);
    
    const infoData = typeof test_plan_info === 'string' ? test_plan_info : JSON.stringify(test_plan_info, null, 2);
    fs.writeFileSync(testPlanInfoPath, infoData);
    
    db.prepare(`INSERT OR REPLACE INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content) VALUES (?, ?, 3, 'test_plan_info', ?, ?, ?)`)
      .run(testPlanInfoId, workflow_id, testPlanInfoFilename, testPlanInfoPath, infoData);
    
    console.log('Test plan info saved:', testPlanInfoFilename);
    res.json({ id: testPlanInfoId, filename: testPlanInfoFilename });
  } catch (err) {
    console.error('Error saving test plan info:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get test plan info (from questionnaire)
router.get('/test-plan-info/:workflow_id', (req, res) => {
  const doc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_info' ORDER BY version DESC LIMIT 1`).get(req.params.workflow_id);
  
  if (!doc) {
    return res.json(null);
  }
  
  try {
    const testPlanInfo = JSON.parse(doc.content);
    res.json(testPlanInfo);
  } catch (err) {
    console.error('Error parsing test plan info:', err);
    res.json(null);
  }
});

// Get available coverage levels
router.get('/metadata/coverage-levels', (req, res) => {
  res.json({
    levels: [
      {
        value: 'SANITY',
        label: 'Sanity (20-30 tests)',
        description: 'Basic Functionality + Negative Testing only',
        categories: ['Category 1: Basic Functionality', 'Category 7: Negative Testing'],
        testCount: '20-30'
      },
      {
        value: 'STANDARD',
        label: 'Standard (60-100 tests)',
        description: 'Most common - covers core functionality without deep scaling',
        categories: [
          'Category 1: Basic Functionality',
          'Category 2: Boundary Value Testing',
          'Category 4: Switch Events',
          'Category 5: Integration Testing',
          'Category 7: Negative Testing'
        ],
        testCount: '60-100',
        recommended: true
      },
      {
        value: 'COMPREHENSIVE',
        label: 'Comprehensive (120-200 tests)',
        description: 'Complete coverage including state machine and scaling tests',
        categories: [
          'Category 1: Basic Functionality',
          'Category 2: Boundary Value Testing',
          'Category 3: State Machine Testing',
          'Category 4: Switch Events',
          'Category 5: Integration Testing',
          'Category 6: Scaling Tests',
          'Category 7: Negative Testing'
        ],
        testCount: '120-200'
      }
    ],
    topologies: [
      {
        value: 'single-node',
        label: 'Single Node',
        description: 'Configuration, show commands, basic functional tests',
        useCases: ['Configuration tests', 'CLI command verification', 'Non-forwarding features']
      },
      {
        value: '2-node',
        label: '2-Node',
        description: 'Port-based features, L2/L3 forwarding, VLAN testing',
        useCases: ['L2 forwarding', 'L3 routing basic', 'VLAN tests', 'Traffic generation']
      },
      {
        value: '5-node',
        label: '5-Node',
        description: 'Routing protocols, spanning-tree, complex topologies',
        useCases: ['OSPF', 'BGP', 'Spanning-tree', 'Multi-node routing']
      }
    ]
  });
});

// Evaluate test plan quality
router.post('/evaluate', async (req, res) => {
  try {
    const { workflow_id, content } = req.body;
    
    console.log('=== Test Plan Evaluation Starting ===');
    console.log('Workflow ID:', workflow_id);
    console.log('Content length:', content?.length || 0);

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'No test plan content provided' });
    }

    // Get workflow metadata
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id);
    const metadata = {
      jiraId: workflow?.jira_id,
      featureName: workflow?.feature_name
    };

    // Run evaluation
    const evaluation = testPlanEvaluator.evaluate(content, metadata);
    
    // Save evaluation results to database
    const evalId = uuidv4();
    const timestamp = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content) 
      VALUES (?, ?, 3, 'test_plan_evaluation', ?, ?, ?)
    `).run(
      evalId, 
      workflow_id, 
      `evaluation_${workflow_id}_${Date.now()}.json`,
      '',
      JSON.stringify({ ...evaluation, timestamp })
    );

    console.log('=== Test Plan Evaluation Complete ===');
    console.log('Grade:', evaluation.grade);
    console.log('Score:', evaluation.score);
    console.log('Passed:', evaluation.passed);

    res.json(evaluation);
  } catch (err) {
    console.error('=== Test Plan Evaluation ERROR ===');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Get latest evaluation
router.get('/evaluation/:workflow_id', (req, res) => {
  try {
    const { workflow_id } = req.params;
    
    const evalDoc = db.prepare(`
      SELECT * FROM documents 
      WHERE workflow_id = ? AND doc_type = 'test_plan_evaluation' 
      ORDER BY version DESC LIMIT 1
    `).get(workflow_id);

    if (!evalDoc) {
      return res.status(404).json({ error: 'No evaluation found' });
    }

    const evaluation = JSON.parse(evalDoc.content);
    res.json(evaluation);
  } catch (err) {
    console.error('Error retrieving evaluation:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate dynamic questionnaire based on skill file
router.post('/generate-questionnaire', async (req, res) => {
  const { workflow_id } = req.body;
  
  try {
    // Get skill file from Stage 2
    const skillDoc = db.prepare(`
      SELECT * FROM documents 
      WHERE workflow_id=? AND stage_number=2 AND doc_type='skill_file' 
      ORDER BY version DESC LIMIT 1
    `).get(workflow_id);

    if (!skillDoc) {
      return res.status(400).json({ error: 'Skill file not found. Complete Stage 2 first.' });
    }

    // Check if this is a feature enhancement (existing test plan exists)
    const existingTestPlan = db.prepare(`
      SELECT * FROM documents 
      WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' 
      ORDER BY version DESC LIMIT 1
    `).get(workflow_id);

    const isEnhancement = !!existingTestPlan;
    const targetQuestionCount = isEnhancement ? '3-4' : '6-8';

    console.log('=== Generating Dynamic Questionnaire ===');
    console.log('Skill file length:', skillDoc.content.length);
    console.log('Is Enhancement:', isEnhancement);
    console.log('Target Questions:', targetQuestionCount);

    // Use LLM to analyze skill file and generate relevant questions
    const systemPrompt = `You are an expert QA Test Engineer for EXOS networking features. Your role is to gather information about FUNCTIONAL BEHAVIOR that is NOT clearly specified in the skill file.

**CRITICAL FOCUS**: Ask about functional behavior, edge cases, and scenarios that are MISSING or UNCLEAR in the skill file. DO NOT ask about information already well-documented in the specification.

**TARGET**: Generate exactly ${targetQuestionCount} highly focused questions about functional behavior gaps.

**QUESTION FOCUS AREAS**:

1. **User Workflows & Real-World Scenarios** (functional behavior)
   - What specific customer use cases should be tested?
   - Are there common deployment scenarios not mentioned in the spec?
   - How should the feature behave in typical production environments?
   - What user workflows should work seamlessly?

2. **Functional Behavior Edge Cases** (missing from spec)
   - What happens when feature is enabled/disabled dynamically?
   - How should the feature behave during network transitions?
   - What is the expected behavior when limits are approached?
   - Are there timing-sensitive functional behaviors?

3. **Integration Functional Behavior** (behavior with other features)
   - How should this feature behave when combined with [related features]?
   - What functional behavior changes when used with other protocols?
   - Are there behavioral dependencies on other features?

4. **Negative Behavior Scenarios** (functional failures)
   - What should happen when invalid inputs are provided?
   - How should the feature gracefully handle failure conditions?
   - What user-visible behavior indicates feature is working correctly?
   - What error conditions should be tested from user perspective?

**IMPORTANT CONSTRAINTS**:
- ${isEnhancement ? 'This is a FEATURE ENHANCEMENT - focus on NEW functional behavior only (3-4 questions)' : 'This is a NEW FEATURE - focus on complete functional coverage (6-8 questions)'}
- DO NOT ask about test topology, switch models, or test environment setup
- DO NOT ask about information clearly stated in the skill file
- DO ask about functional behavior that is unclear, ambiguous, or missing
- DO ask about real-world scenarios and customer-facing behavior
- Focus on WHAT the feature should do, not HOW to test it

OUTPUT FORMAT:
Generate a JSON array of exactly ${targetQuestionCount} question objects:
{
  "id": "unique_id",
  "question": "Focused question about functional behavior",
  "type": "text|textarea|select|multiselect|boolean",
  "options": ["option1", "option2"], // if type is select/multiselect
  "placeholder": "Example answer or guidance",
  "help": "Why this functional behavior is important to clarify",
  "required": true
}

EXAMPLE QUESTIONS (Functional Behavior Focus):

{
  "id": "dynamic_enable_behavior",
  "question": "When the feature is enabled on a port that already has active sessions, what should happen to those existing sessions? (Continue, Reset, Graceful transition)",
  "type": "select",
  "options": ["Existing sessions continue unchanged", "Existing sessions are reset", "Graceful transition applies to new sessions only", "Behavior is undefined"],
  "help": "Clarifies functional behavior during dynamic configuration changes",
  "required": true
}

{
  "id": "failure_recovery_behavior",
  "question": "If the feature encounters an error condition (e.g., resource exhaustion), what is the expected user-visible behavior? Should traffic continue to flow, should there be a fallback mode, or should the feature disable itself?",
  "type": "textarea",
  "placeholder": "e.g., Feature gracefully degrades, traffic continues but without feature benefits...",
  "help": "Defines functional behavior during failure scenarios from user perspective",
  "required": true
}

{
  "id": "coexistence_behavior",
  "question": "When this feature is used together with [related feature X], what specific functional behavior should be verified? Are there behavioral changes or interactions?",
  "type": "textarea",
  "placeholder": "Describe expected functional behavior when features interact...",
  "help": "Clarifies functional behavior in integration scenarios",
  "required": true
}

${isEnhancement ? `
**ENHANCEMENT-SPECIFIC GUIDANCE**:
Since this is an enhancement, focus ONLY on:
- NEW functional behavior added in this enhancement
- Changes to EXISTING behavior
- Migration behavior from old to new functionality
- Backward compatibility behavioral considerations
Ask 3-4 precise questions about what changed functionally.
` : `
**NEW FEATURE GUIDANCE**:
Since this is a new feature, focus on:
- Core functional workflows and use cases
- Expected behavior in common scenarios
- Edge cases and boundary conditions
- Functional behavior when integrated with existing features
Ask 6-8 questions covering end-to-end functional behavior.
`}

REMEMBER:
- Focus on FUNCTIONAL BEHAVIOR, not test environment or setup
- Ask about what's MISSING or UNCLEAR in the skill file
- Questions should help QA understand expected user-facing behavior
- Generate EXACTLY ${targetQuestionCount} questions`;

    const userPrompt = `Based on this EXOS feature skill file, generate ${targetQuestionCount} focused questions about FUNCTIONAL BEHAVIOR that is NOT clearly specified in the skill file.

**KEY RULES**:
1. Focus on functional behavior, not test environment or infrastructure
2. Ask about user-facing scenarios and expected behavior
3. Identify gaps or ambiguities in the functional specification
4. ${isEnhancement ? 'Focus ONLY on NEW behavior in this enhancement (3-4 questions)' : 'Cover end-to-end functional behavior for this new feature (6-8 questions)'}

**ANALYSIS APPROACH**:
1. Read the skill file to understand what IS documented
2. Identify what functional behavior is NOT clearly specified
3. Generate ${targetQuestionCount} precise questions about those gaps

SKILL FILE CONTENT:
\`\`\`
${skillDoc.content.substring(0, 8000)}
\`\`\`

Generate a JSON array of EXACTLY ${targetQuestionCount} questions focused on functional behavior gaps:`;

    const response = await callLLM(systemPrompt, userPrompt, false);
    
    // Parse JSON response
    let questions;
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        questions = JSON.parse(response);
      }
    } catch (parseErr) {
      console.error('Failed to parse LLM response as JSON:', parseErr);
      // Fallback to generic questions
      questions = generateFallbackQuestions(isEnhancement);
    }

    // Validate question count
    const expectedMin = isEnhancement ? 3 : 6;
    const expectedMax = isEnhancement ? 4 : 8;
    
    console.log(`Generated ${questions.length} questions (expected: ${expectedMin}-${expectedMax})`);
    
    if (questions.length < expectedMin) {
      console.warn(`⚠️  Generated fewer questions than expected (${questions.length} < ${expectedMin})`);
    } else if (questions.length > expectedMax) {
      console.warn(`⚠️  Generated more questions than expected (${questions.length} > ${expectedMax})`);
      // Trim to expected max
      questions = questions.slice(0, expectedMax);
      console.log(`✂️  Trimmed to ${expectedMax} questions`);
    } else {
      console.log(`✅ Question count is within expected range`);
    }
    
    res.json({ 
      questions,
      isEnhancement,
      questionCount: questions.length 
    });
  } catch (err) {
    console.error('=== Questionnaire Generation ERROR ===');
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Fallback questions if LLM fails
function generateFallbackQuestions(isEnhancement = false) {
  if (isEnhancement) {
    // 3-4 questions for feature enhancements - focus on what changed
    return [
      {
        id: 'enhancement_new_behavior',
        question: 'What NEW functional behavior was added in this enhancement? Describe specific user-facing changes.',
        type: 'textarea',
        placeholder: 'e.g., Users can now configure X dynamically without reboot, feature now supports Y protocol...',
        help: 'Clarifies new functionality added in this enhancement',
        required: true
      },
      {
        id: 'enhancement_changed_behavior',
        question: 'What EXISTING behavior was modified? How does it differ from the previous version?',
        type: 'textarea',
        placeholder: 'e.g., Previous version required manual configuration, now auto-discovers; changed default timeout from 30s to 60s...',
        help: 'Documents functional changes to existing behavior',
        required: true
      },
      {
        id: 'enhancement_backward_compat',
        question: 'What is the migration or backward compatibility behavior? Will existing configurations work unchanged?',
        type: 'select',
        options: [
          'Fully backward compatible - no changes needed',
          'Requires config migration - automatic conversion',
          'Requires config migration - manual steps needed',
          'Breaking change - old configs will not work'
        ],
        help: 'Defines upgrade/migration functional behavior',
        required: true
      }
    ];
  } else {
    // 6-8 questions for new features - focus on complete functional behavior
    return [
      {
        id: 'primary_use_case',
        question: 'What is the primary customer use case or deployment scenario this feature addresses?',
        type: 'textarea',
        placeholder: 'e.g., Enterprise campus networks need zero-touch provisioning for IoT devices without manual VLAN assignment...',
        help: 'Defines the main functional purpose from user perspective',
        required: true
      },
      {
        id: 'expected_user_workflow',
        question: 'Describe the typical end-to-end user workflow. What steps does an admin/user take to use this feature?',
        type: 'textarea',
        placeholder: 'e.g., 1. Admin enables feature on ports, 2. Device connects, 3. Feature auto-configures VLANs, 4. Traffic flows...',
        help: 'Clarifies expected functional behavior in real-world usage',
        required: true
      },
      {
        id: 'dynamic_behavior',
        question: 'What happens when the feature is enabled/disabled on a live system with active traffic or sessions?',
        type: 'textarea',
        placeholder: 'e.g., Existing sessions continue; new sessions use new behavior; graceful cutover with 5s delay...',
        help: 'Defines dynamic configuration change behavior',
        required: true
      },
      {
        id: 'failure_behavior',
        question: 'What is the expected user-visible behavior when the feature encounters an error or resource limit?',
        type: 'textarea',
        placeholder: 'e.g., Feature logs error, continues with degraded mode; traffic flows but without feature benefits...',
        help: 'Clarifies functional behavior during failures',
        required: true
      },
      {
        id: 'integration_behavior',
        question: 'How should this feature functionally integrate with other EXOS features? Any behavioral dependencies or conflicts?',
        type: 'textarea',
        placeholder: 'e.g., Works seamlessly with VLAN; conflicts with static ACL; requires LLDP enabled...',
        help: 'Defines functional integration behavior',
        required: true
      },
      {
        id: 'boundary_behavior',
        question: 'What happens at scale boundaries? (e.g., max ports configured, max sessions active, etc.)',
        type: 'textarea',
        placeholder: 'e.g., At 100 ports, new configs are queued; at max sessions, feature rejects new connections gracefully...',
        help: 'Clarifies functional behavior at capacity limits',
        required: true
      },
      {
        id: 'negative_scenarios',
        question: 'What invalid user actions should the feature reject, and what error messages/behavior should users see?',
        type: 'textarea',
        placeholder: 'e.g., Reject config on trunk ports with error "Feature not supported on trunk"; reject invalid VLAN IDs...',
        help: 'Defines functional behavior for invalid inputs',
        required: true
      },
      {
        id: 'persistence_behavior',
        question: 'What configuration and state persists across reboots? What is reset? Any specific save/restore behavior?',
        type: 'textarea',
        placeholder: 'e.g., All configs persist; runtime state resets; auto-discovered settings require re-discovery...',
        help: 'Clarifies persistence and reboot functional behavior',
        required: false
      }
    ];
  }
}

// Export test cases to DOCX
router.post('/export-docx', async (req, res) => {
  const { workflow_id, test_cases, test_plan_info } = req.body;

  try {
    const PizZip = require('pizzip');
    const Docxtemplater = require('docxtemplater');
    
    // Create a simple DOCX structure
    const doc = new Docxtemplater(new PizZip(), {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Create document content
    let docContent = '';
    
    // Add header if test_plan_info exists
    if (test_plan_info) {
      docContent += `Test Plan: ${test_plan_info.featureName || 'Untitled'}\n`;
      docContent += `JIRA ID: ${test_plan_info.jiraId || 'N/A'}\n`;
      docContent += `Release: ${test_plan_info.targetRelease || 'N/A'}\n`;
      docContent += `\n${'='.repeat(60)}\n\n`;
    }

    // Add test cases
    docContent += 'NEW TEST CASES\n\n';
    test_cases.forEach((testCase, index) => {
      docContent += testCase;
      if (index < test_cases.length - 1) {
        docContent += '\n\n' + '-'.repeat(60) + '\n\n';
      }
    });

    // Create a basic DOCX file using PizZip
    const zip = new PizZip();
    
    // Add minimal DOCX structure
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${docContent.split('\n').map(line => `
    <w:p>
      <w:r>
        <w:t xml:space="preserve">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t>
      </w:r>
    </w:p>`).join('')}
  </w:body>
</w:document>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    zip.file('[Content_Types].xml', contentTypesXml);
    zip.file('_rels/.rels', relsXml);
    zip.file('word/document.xml', docXml);

    const buffer = zip.generate({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Test_Cases_${workflow_id.substring(0, 8)}.docx`);
    res.send(buffer);

    console.log('=== Test Cases Exported to DOCX ===');
    console.log('Workflow ID:', workflow_id);
    console.log('Test Cases Count:', test_cases.length);
  } catch (err) {
    console.error('=== DOCX Export ERROR ===');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Download test plan in different formats
router.get('/download/:workflow_id/:format', (req, res) => {
  const { workflow_id, format } = req.params;
  
  try {
    const testPlan = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1`).get(workflow_id);
    
    if (!testPlan) {
      return res.status(404).json({ error: 'Test plan not found' });
    }
    
    const content = testPlan.content;
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id);
    const filename = `TestPlan_${workflow.jira_story_id || workflow_id.substring(0, 8)}`;
    
    if (format === 'md' || format === 'markdown') {
      // Download as Markdown
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.md`);
      res.send(content);
      console.log(`Test plan downloaded as Markdown for workflow ${workflow_id}`);
      
    } else if (format === 'docx' || format === 'word') {
      // Download as Word document (use pre-generated file or generate on-the-fly)
      const wordDoc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_word' ORDER BY version DESC, created_at DESC LIMIT 1`).get(workflow_id);
      
      if (wordDoc && fs.existsSync(wordDoc.filepath)) {
        // Word file already exists, send it
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.docx`);
        res.sendFile(wordDoc.filepath);
        console.log(`Word test plan downloaded for workflow ${workflow_id}`);
      } else {
        // Generate Word file on-the-fly if it doesn't exist
        console.log('Word file not found, generating on-the-fly...');
        const wordFilepath = path.resolve(__dirname, '../../../uploads', `${filename}.docx`);
        
        generateTestPlanWord(content, wordFilepath, {
          jira_story_id: workflow.jira_story_id,
          workflow_id: workflow_id,
          feature_name: workflow.title,
          jira_release: workflow.jira_release
        }).then(() => {
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          res.setHeader('Content-Disposition', `attachment; filename=${filename}.docx`);
          res.sendFile(wordFilepath);
          console.log(`Word test plan generated and downloaded for workflow ${workflow_id}`);
        }).catch(wordError => {
          console.error('Word generation error:', wordError);
          res.status(500).json({ error: 'Failed to generate Word file: ' + wordError.message });
        });
      }
      
      
    } else if (format === 'xlsx' || format === 'excel') {
      // Download as Excel (qTest format)
      const excelDoc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_excel' ORDER BY version DESC, created_at DESC LIMIT 1`).get(workflow_id);
      
      if (excelDoc && fs.existsSync(excelDoc.filepath)) {
        // Excel file already exists, send it
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
        res.sendFile(excelDoc.filepath);
        console.log(`Excel test plan downloaded for workflow ${workflow_id}`);
      } else {
        // Generate Excel file on-the-fly if it doesn't exist
        console.log('Excel file not found, generating on-the-fly...');
        const excelFilepath = path.resolve(__dirname, '../../../uploads', `${filename}.xlsx`);
        
        generateQTestExcel(content, excelFilepath, {
          jira_story_id: workflow.jira_story_id,
          workflow_id: workflow_id,
          feature_name: workflow.title,
          release: workflow.jira_release
        }).then(() => {
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
          res.sendFile(excelFilepath);
          console.log(`Excel test plan generated and downloaded for workflow ${workflow_id}`);
        }).catch(excelError => {
          console.error('Excel generation error:', excelError);
          res.status(500).json({ error: 'Failed to generate Excel file: ' + excelError.message });
        });
      }
      
    } else if (format === 'pdf') {
      // For PDF, return markdown and let frontend handle conversion or suggest external tool
      res.status(501).json({ 
        error: 'PDF conversion not yet implemented',
        suggestion: 'Download as DOCX or Markdown and convert using external tools'
      });
    } else {
      res.status(400).json({ error: 'Invalid format. Supported: md, docx, xlsx' });
    }
    
  } catch (err) {
    console.error('Test plan download error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upload reviewed test plan with comments
router.post('/upload-reviewed', upload.single('file'), (req, res) => {
  const { workflow_id, review_comments } = req.body;
  
  try {
    const content = fs.readFileSync(req.file.path, 'utf-8');
    const docId = uuidv4();
    const filename = `test_plan_reviewed_${workflow_id}_${Date.now()}.md`;
    const filepath = path.resolve(__dirname, '../../../uploads', filename);
    fs.writeFileSync(filepath, content);
    
    // Get current revision number
    const currentDoc = db.prepare(`SELECT revision_number FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY revision_number DESC LIMIT 1`).get(workflow_id);
    const revisionNumber = (currentDoc?.revision_number || 0) + 1;
    
    // Save as new revision with review comments
    db.prepare(`INSERT INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content, review_comments, revision_number, approved) VALUES (?, ?, 3, 'test_plan', ?, ?, ?, ?, ?, 0)`)
      .run(docId, workflow_id, filename, filepath, content, review_comments || null, revisionNumber);
    
    console.log(`Reviewed test plan uploaded for workflow ${workflow_id}, revision ${revisionNumber}`);
    res.json({ 
      id: docId, 
      content, 
      filename,
      revision_number: revisionNumber,
      review_comments
    });
  } catch (err) {
    console.error('Upload reviewed test plan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Regenerate test plan with review comments
router.post('/regenerate-with-comments', uploadFields, async (req, res) => {
  const { workflow_id, review_comments } = req.body;
  
  try {
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id);
    const skillDoc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=2 AND doc_type='skill_file' ORDER BY version DESC LIMIT 1`).get(workflow_id);
    const currentTestPlan = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY revision_number DESC LIMIT 1`).get(workflow_id);
    
    if (!skillDoc || !currentTestPlan) {
      return res.status(400).json({ error: 'Required documents not found' });
    }
    
    console.log('=== Regenerating Test Plan with Review Comments ===');
    console.log('Workflow:', workflow_id);
    console.log('Review Comments:', review_comments ? review_comments.substring(0, 100) + '...' : 'None');
    
    // Get topology and user instructions from workflow
    const topologyData = workflow.topology_description ? JSON.parse(workflow.topology_description) : null;
    const userInstructions = workflow.user_instructions || null;
    
    // Combine review comments with user instructions
    const combinedInstructions = [
      userInstructions,
      '\n## REVIEW COMMENTS FROM PREVIOUS VERSION:\n',
      review_comments,
      '\nPlease address all review comments in the regenerated test plan.'
    ].filter(Boolean).join('\n');
    
    // Get test plan info if exists
    const testPlanInfoDoc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_info' ORDER BY version DESC LIMIT 1`).get(workflow_id);
    let testPlanInfo = null;
    if (testPlanInfoDoc) {
      testPlanInfo = JSON.parse(testPlanInfoDoc.content);
    }
    
    const result = await testPlanGenerator.generateTestPlan({
      featureName: workflow.title || 'Feature',
      skillFileContent: skillDoc.content,
      coverageLevel: 'STANDARD',
      jiraStory: {
        id: workflow.jira_story_id,
        title: workflow.title,
        release: workflow.jira_release
      },
      previousTestPlan: currentTestPlan.content,
      testPlanInfo: testPlanInfo,
      topologyData: topologyData,
      userInstructions: combinedInstructions,
      streaming: false
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Test plan regeneration failed');
    }
    
    const content = result.content;
    const docId = uuidv4();
    const revisionNumber = (currentTestPlan.revision_number || 0) + 1;
    const filename = `test_plan_${workflow_id}_v${revisionNumber}_${Date.now()}.md`;
    const filepath = path.resolve(__dirname, '../../../uploads', filename);
    fs.writeFileSync(filepath, content);
    
    // Save new revision with version = revisionNumber so download queries find it
    db.prepare(`INSERT INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content, review_comments, revision_number, version, is_active, approved) VALUES (?, ?, 3, 'test_plan', ?, ?, ?, ?, ?, ?, 1, 0)`)
      .run(docId, workflow_id, filename, filepath, content, review_comments, revisionNumber, revisionNumber);

    // Save version with prompts for LLM drift tracking
    createDocumentVersion({
      document_id: docId,
      workflow_id,
      content,
      created_by: workflow.created_by || 'user-admin',
      change_summary: `Regenerated test plan (revision ${revisionNumber}) addressing review comments`,
      change_reason: review_comments ? review_comments.substring(0, 500) : 'Regeneration with review comments',
      change_type: 'update',
      tags: 'regenerated,review-comments',
      metadata: {
        revision_number: revisionNumber,
        has_review_comments: !!review_comments,
        llm_prompts: result.prompts ? {
          system_prompt: result.prompts.systemPrompt,
          user_prompt: result.prompts.userPrompt,
          system_prompt_length: result.prompts.systemPrompt.length,
          user_prompt_length: result.prompts.userPrompt.length
        } : null,
        generation_info: result.metadata
      }
    });
    
    // Generate Excel file for the regenerated test plan
    // Invalidate old cached Excel/Word files before generating new ones
    const oldRegenExcelDocs = db.prepare(`SELECT filepath FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_excel'`).all(workflow_id);
    oldRegenExcelDocs.forEach(doc => { try { fs.unlinkSync(doc.filepath); } catch (e) {} });
    db.prepare(`DELETE FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_excel'`).run(workflow_id);
    const oldRegenWordDocs = db.prepare(`SELECT filepath FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_word'`).all(workflow_id);
    oldRegenWordDocs.forEach(doc => { try { fs.unlinkSync(doc.filepath); } catch (e) {} });
    db.prepare(`DELETE FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan_word'`).run(workflow_id);

    console.log('Generating Excel file for regenerated test plan...');
    try {
      const excelFilename = `test_plan_${workflow_id}_v${revisionNumber}_${Date.now()}.xlsx`;
      const excelFilepath = path.resolve(__dirname, '../../../uploads', excelFilename);
      
      const excelResult = await generateQTestExcel(content, excelFilepath, {
        jira_story_id: workflow.jira_story_id,
        workflow_id: workflow_id,
        feature_name: workflow.title,
        release: workflow.jira_release
      });
      
      // Save Excel file reference to database
      const excelDocId = uuidv4();
      db.prepare(`INSERT INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content, version, created_by, change_summary, is_active) VALUES (?, ?, 3, 'test_plan_excel', ?, ?, ?, ?, ?, ?, 1)`)
        .run(excelDocId, workflow_id, excelFilename, excelFilepath, `Excel export with ${excelResult.testCaseCount} test cases (revision ${revisionNumber})`, revisionNumber, workflow.created_by, 'Excel test plan export (regenerated)');
      
      console.log(`Excel file generated for revision ${revisionNumber}: ${excelFilename}`);
    } catch (excelError) {
      console.error('Excel generation error (non-fatal):', excelError);
    }
    
    // Generate Word document for the regenerated test plan
    console.log('Generating Word document for regenerated test plan...');
    try {
      const wordFilename = `test_plan_${workflow_id}_v${revisionNumber}_${Date.now()}.docx`;
      const wordFilepath = path.resolve(__dirname, '../../../uploads', wordFilename);
      
      const wordResult = await generateTestPlanWord(content, wordFilepath, {
        jira_story_id: workflow.jira_story_id,
        workflow_id: workflow_id,
        feature_name: workflow.title,
        jira_release: workflow.jira_release
      });
      
      // Save Word file reference to database
      const wordDocId = uuidv4();
      db.prepare(`INSERT INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath, content, version, created_by, change_summary, is_active) VALUES (?, ?, 3, 'test_plan_word', ?, ?, ?, ?, ?, ?, 1)`)
        .run(wordDocId, workflow_id, wordFilename, wordFilepath, `Word export with ${wordResult.testCaseCount} test cases (revision ${revisionNumber})`, revisionNumber, workflow.created_by, 'Word test plan export (regenerated)');
      
      console.log(`Word file generated for revision ${revisionNumber}: ${wordFilename}`);
    } catch (wordError) {
      console.error('Word generation error (non-fatal):', wordError);
    }
    
    console.log(`Test plan regenerated with review comments, revision ${revisionNumber}`);
    res.json({ 
      id: docId, 
      content, 
      filename,
      revision_number: revisionNumber,
      metadata: result.metadata
    });
    
  } catch (err) {
    console.error('Regenerate test plan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Approve test plan and move to next stage
router.post('/approve-testplan', (req, res) => {
  const { workflow_id, user_id, approved_doc_id } = req.body;
  
  try {
    // Mark document as approved
    db.prepare('UPDATE documents SET approved=1 WHERE id=?').run(approved_doc_id);
    
    // Create approval record
    db.prepare(`INSERT INTO approvals (id, workflow_id, stage_number, user_id, action) VALUES (?, ?, 3, ?, 'approved')`)
      .run(uuidv4(), workflow_id, user_id);
    
    // Mark stage as completed
    db.prepare(`UPDATE stages SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE workflow_id=? AND stage_number=3`).run(workflow_id);
    
    // Update workflow to next stage
    db.prepare('UPDATE workflows SET current_stage=4, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(workflow_id);
    
    console.log(`Test plan approved for workflow ${workflow_id}, moving to Stage 4`);
    res.json({ success: true, message: 'Test plan approved, moving to Stage 4' });
    
  } catch (err) {
    console.error('Approve test plan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Shared helper: extract a TC block from a test plan string ─────────────────
function extractTcBlock(fullPlan, tc_number) {
  const escapedTC = tc_number.replace(/\./g, '\\.');
  const tcStartRe = new RegExp(
    `(^|\\n)(#{1,4}\\s*(?:Test Case\\s*)?${escapedTC}[^\\n]*)`,
    'i'
  );
  const match = tcStartRe.exec(fullPlan);
  if (!match) return null;

  const tcStart = match.index + (match[1] ? 1 : 0);
  const headerLevel = (match[2].match(/^#+/) || [''])[0].length || 3;
  const nextTcRe = new RegExp(`\\n#{1,${headerLevel}}\\s+(?!${escapedTC}[^\\d])`, 'i');
  const afterBlock = fullPlan.slice(tcStart + 1);
  const nextMatch = nextTcRe.exec(afterBlock);
  const tcEnd = nextMatch ? tcStart + 1 + nextMatch.index : fullPlan.length;

  return { block: fullPlan.slice(tcStart, tcEnd).trim(), tcStart, tcEnd };
}

// GET /api/stage3/tc/:workflow_id/:tc_number — fetch a single TC block
router.get('/tc/:workflow_id/:tc_number', (req, res) => {
  const { workflow_id, tc_number } = req.params;
  const planDoc = db.prepare(
    `SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1`
  ).get(workflow_id);
  if (!planDoc) return res.status(404).json({ error: 'Test plan not found.' });

  const result = extractTcBlock(planDoc.content, tc_number);
  if (!result) return res.status(404).json({ error: `TC ${tc_number} not found in test plan.` });

  res.json({ tc_number, content: result.block });
});

// ── Fix / update a single test case in the plan ──────────────────────────────
// POST /api/stage3/fix-tc
// Body: { workflow_id, tc_number, issue_type, description, manual_content? }
//   issue_type: 'missing_steps' | 'incorrect_steps' | 'wrong_tc' | 'more_detail' | 'manual'
//   manual_content: if provided, skips LLM and directly replaces the TC block
router.post('/fix-tc', async (req, res) => {
  const { workflow_id, tc_number, issue_type, description, manual_content } = req.body;
  if (!workflow_id || !tc_number) return res.status(400).json({ error: 'workflow_id and tc_number are required' });

  const planDoc = db.prepare(
    `SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1`
  ).get(workflow_id);
  if (!planDoc) return res.status(404).json({ error: 'Test plan not found. Generate it in Stage 3 first.' });

  const fullPlan = planDoc.content;

  const extracted = extractTcBlock(fullPlan, tc_number);
  if (!extracted) return res.status(404).json({ error: `TC ${tc_number} not found in the test plan.` });
  const { block: originalTcBlock, tcStart, tcEnd } = extracted;

  let newTcBlock;

  if (manual_content) {
    // Direct manual replacement
    newTcBlock = manual_content.trim();
  } else {
    // LLM fixes the TC
    const issueLabels = {
      missing_steps:   'The test steps are missing or incomplete',
      incorrect_steps: 'The test steps are incorrect or wrong',
      wrong_tc:        'This test case itself is incorrect and needs to be rewritten',
      more_detail:     'The test case needs much more detail in steps',
    };
    const issueLabel = issueLabels[issue_type] || 'The test case has issues';

    const systemPrompt = `You are a networking QA test plan expert for Extreme Networks EXOS NOS.
You are given a single test case from a larger test plan.
Your task: Fix ONLY this test case based on the reported issue. Keep the same TC number and title unless the title itself is wrong.
Return ONLY the corrected test case block in the same markdown format as the original. No explanations, no extra text.`;

    const userPrompt = `Issue type: ${issueLabel}
Additional feedback: ${description || 'No additional details provided.'}

Original test case:
${originalTcBlock}

Return the corrected version of this test case only.`;

    try {
      const fixed = await callLLM(systemPrompt, userPrompt, false);
      newTcBlock = fixed.replace(/```(?:markdown)?\n?|\n?```/g, '').trim();
    } catch (err) {
      return res.status(500).json({ error: 'LLM fix failed: ' + err.message });
    }
  }

  // Patch the updated TC block back into the full plan
  const updatedPlan = fullPlan.slice(0, tcStart) + newTcBlock + '\n\n' + fullPlan.slice(tcEnd);

  // Save as new revision
  db.prepare(
    `UPDATE documents SET content=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(updatedPlan, planDoc.id);

  console.log(`[fix-tc] Fixed TC ${tc_number} in workflow ${workflow_id} (issue: ${issue_type})`);
  res.json({ success: true, updated_tc: newTcBlock, updated_plan: updatedPlan });
});

module.exports = router;

