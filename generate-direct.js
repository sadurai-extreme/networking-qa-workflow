/**
 * Direct Backend Skill File Generation
 * Bypasses API layer and calls the generator directly
 */

const path = require('path');
const fs = require('fs');

// Load environment from backend/.env
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

// Resolve paths
const BACKEND_DIR = path.join(__dirname, 'backend');
const SkillFileGenerator = require(path.join(BACKEND_DIR, 'src/agents/skillFileGenerator'));
const { convertToMarkdown } = require(path.join(BACKEND_DIR, 'src/utils/documentConverter'));

// Configuration
const JIRA_STORY = {
  key: 'EXOS-39369',
  summary: 'Fabric Attach Zero-Touch Client with NetLogin Bypass Enhancement',
  description: 'Allow FA devices to bypass NetLogin authentication using bypass-netlogin option'
};

// Document paths
const DOC_DIR = 'C:\\sadurai\\Working Folder\\FA Attach\\FA_Zero_Touch_Bypass';
const CLI_CHANGES_FILE = path.join(DOC_DIR, 'Cli_changes.txt');
const FUNC_SPEC_FILE = path.join(DOC_DIR, 'Fabric Attach Functional Specification(1).docx');
const TEST_PLAN_FILE = path.join(DOC_DIR, 'Fabric Attach Functional Test Plan.doc');
const ZERO_TOUCH_TEST_PLAN_FILE = path.join(DOC_DIR, 'EXOS Fabric Attach - Zero Touch Client Test plan.doc');

// QA Feature Interactions Input
const QA_FEATURE_INTERACTIONS = `**NetLogin Integration with Fabric Attach Zero-Touch:**

1. **NetLogin Bypass Mechanism:**
   - Fabric Attach devices can bypass NetLogin MAC-based authentication
   - New CLI: configure fabric attach zero-touch-client <client> bypass-netlogin [on | off]
   - Default behavior (off): FA device requires NetLogin authentication
   - Bypass enabled (on): FA device attached directly without authentication

2. **Authentication Flow Interaction:**
   - When NetLogin is enabled on port + bypass-netlogin is OFF: Device must authenticate before FA attachment
   - When NetLogin is enabled on port + bypass-netlogin is ON: Device bypasses authentication and attaches as FA element
   - When NetLogin is disabled on port: Bypass setting is shown but NetLogin authentication is N/A

3. **Show Command Integration:**
   - "show fabric attach elements" displays "Netlogin Bypass" column (Yes/No/N/A)
   - "show netlogin" displays new section "Netlogin Bypass Clients" with MAC, Port, VLAN
   - Bypass clients shown in both FA and NetLogin contexts

4. **LLDP Integration:**
   - LLDP communicates bypass clients to NetLogin subsystem
   - NetLogin maintains list of bypass clients even when disabled

5. **VLAN Assignment Coordination:**
   - FA zero-touch-client configures VLAN/NSI assignment
   - NetLogin authentication affects whether assignment occurs
   - Bypass mechanism allows FA VLAN assignment without NetLogin

6. **Client Type Support:**
   - Applies to all FA client types (Switch, Server, IP Phone, Camera, etc.)
   - "No Auth" server types display "N/A" for bypass status`;

async function readDocumentFile(filePath, fileName) {
  console.log(`\n📄 Processing: ${fileName}`);
  
  try {
    const result = await convertToMarkdown(filePath, {
      extractImages: true,
      usePandoc: true
    });
    
    if (!result.success) {
      console.error(`⚠️ Conversion failed: ${result.warnings.join(', ')}`);
      console.log(`⚠️ Skipping this document and continuing...`);
      return null; // Return null instead of throwing
    }
    
    console.log(`  ✓ Converted with ${result.method}`);
    console.log(`  Content length: ${result.markdown.length} characters`);
    
    return result.markdown;
  } catch (error) {
    console.error(`❌ Document processing error: ${error.message}`);
    console.log(`⚠️ Skipping this document and continuing...`);
    return null; // Return null instead of throwing
  }
}

async function generateSkillFile() {
  console.log('\n🚀 Fabric Attach Skill File Generation (Direct Backend Call)');
  console.log('='.repeat(80));
  console.log(`📋 JIRA Story: ${JIRA_STORY.key}`);
  console.log(`📂 Document Directory: ${DOC_DIR}`);
  console.log('='.repeat(80));

  // Check if files exist
  console.log('\n📁 Checking files...');
  const filesToCheck = [
    { path: CLI_CHANGES_FILE, name: 'CLI Changes' },
    { path: FUNC_SPEC_FILE, name: 'Functional Specification' },
    { path: TEST_PLAN_FILE, name: 'Test Plan' },
    { path: ZERO_TOUCH_TEST_PLAN_FILE, name: 'Zero Touch Test Plan' }
  ];

  for (const file of filesToCheck) {
    if (fs.existsSync(file.path)) {
      const stats = fs.statSync(file.path);
      console.log(`  ✓ ${file.name}: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.error(`  ✗ ${file.name}: NOT FOUND`);
      process.exit(1);
    }
  }

  try {
    // Read documents
    console.log('\n📚 Converting documents to markdown...');
    
    const documents = {};
    
    console.log('\n1️⃣ Current Feature Specification');
    const currentSpec = await readDocumentFile(FUNC_SPEC_FILE, 'Functional Specification');
    if (currentSpec) documents.currentSpec = currentSpec;
    
    console.log('\n2️⃣ Existing Feature Specification (Zero Touch Test Plan)');
    const existingSpec = await readDocumentFile(ZERO_TOUCH_TEST_PLAN_FILE, 'Zero Touch Test Plan');
    if (existingSpec) documents.existingSpec = existingSpec;
    
    console.log('\n3️⃣ Existing Test Plan');
    const testPlan = await readDocumentFile(TEST_PLAN_FILE, 'Test Plan');
    if (testPlan) documents.testPlan = testPlan;
    
    console.log('\n4️⃣ CLI Changes');
    const cliChanges = fs.readFileSync(CLI_CHANGES_FILE, 'utf8');
    documents.additionalCLI = cliChanges + '\n\n# Additional CLI Commands\n' + `configure fabric attach zero-touch-client <client> bypass-netlogin [on | off]
show fabric attach elements
show netlogin`;
    console.log(`  ✓ CLI Changes: ${documents.additionalCLI.length} characters`);
    
    console.log('\n5️⃣ QA Feature Interactions');
    documents.qaFeatureInteractions = QA_FEATURE_INTERACTIONS;
    console.log(`  ✓ QA Input: ${documents.qaFeatureInteractions.length} characters`);

    // Initialize generator
    console.log('\n🤖 Initializing Skill File Generator...');
    const generator = new SkillFileGenerator({
      maxTemplatesInPrompt: 8,
      maxTemplateContentLength: 800
    });
    console.log('  ✓ Generator initialized');

    // Generate skill file
    console.log('\n⚙️ Generating skill file with AI...');
    console.log('   ⏳ This may take a few minutes...');
    console.log('   Using configured LLM provider');
    
    const result = await generator.generateSkillFile({
      jiraStory: JIRA_STORY,
      documents: documents
    });

    if (result.success) {
      console.log('\n✅ SUCCESS! Skill file generated');
      console.log('='.repeat(80));
      
      const outputPath = path.join(__dirname, `skill-${JIRA_STORY.key}.md`);
      fs.writeFileSync(outputPath, result.content, 'utf8');
      
      console.log(`\n📝 Skill file saved to: ${outputPath}`);
      console.log(`   File size: ${(result.content.length / 1024).toFixed(2)} KB`);
      
      if (result.metadata) {
        console.log('\n📊 Generation Metadata:');
        console.log(`   Model: ${result.metadata.model || 'GitHub Copilot (Claude)'}`);
        console.log(`   Templates used: ${result.metadata.templatesUsed || 'N/A'}`);
        console.log(`   Commit analysis: ${result.metadata.commitAnalysis ? 'Yes' : 'No'}`);
        if (result.metadata.commitCount) {
          console.log(`   Commits analyzed: ${result.metadata.commitCount}`);
        }
      }

      // Show preview
      console.log('\n📄 Preview (first 800 characters):');
      console.log('-'.repeat(80));
      console.log(result.content.substring(0, 800));
      console.log('...');
      console.log('-'.repeat(80));
      
      console.log('\n🎉 Generation complete!');
      console.log(`   Output: ${outputPath}`);
      
    } else {
      console.error('\n❌ Generation failed:', result.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Error during generation:');
    console.error(error);
    process.exit(1);
  }
}

// Run
generateSkillFile();
