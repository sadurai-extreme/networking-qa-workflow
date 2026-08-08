/**
 * Create workflow and generate Fabric Attach Skill File
 */

const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const BACKEND_URL = 'http://10.127.26.9:5100';
const JIRA_STORY = 'EXOS-39369';

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

// Additional CLI Commands
const ADDITIONAL_CLI = `configure fabric attach zero-touch-client <client> bypass-netlogin [on | off]
show fabric attach elements
show netlogin`;

async function createWorkflow() {
  console.log('\n📋 Step 1: Creating workflow...');
  
  try {
    const response = await axios.post(`${BACKEND_URL}/api/workflows`, {
      jira_ticket_id: JIRA_STORY,
      title: 'Fabric Attach Zero-Touch Client with NetLogin Bypass',
      description: 'Allow FA devices to bypass NetLogin authentication using bypass-netlogin option'
    });
    
    console.log(`  ✓ Workflow created with ID: ${response.data.workflowId}`);
    return response.data.workflowId;
  } catch (error) {
    console.error('  ✗ Failed to create workflow:', error.response?.data || error.message);
    throw error;
  }
}

async function generateSkillFile(workflowId) {
  console.log('\n🚀 Step 2: Generating skill file');
  console.log('='.repeat(80));

  // Check if files exist
  const filesToCheck = [
    { path: CLI_CHANGES_FILE, name: 'CLI Changes' },
    { path: FUNC_SPEC_FILE, name: 'Functional Specification' },
    { path: TEST_PLAN_FILE, name: 'Test Plan' },
    { path: ZERO_TOUCH_TEST_PLAN_FILE, name: 'Zero Touch Test Plan' }
  ];

  console.log('\n📁 Checking files...');
  for (const file of filesToCheck) {
    if (fs.existsSync(file.path)) {
      const stats = fs.statSync(file.path);
      console.log(`  ✓ ${file.name}: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.error(`  ✗ ${file.name}: NOT FOUND at ${file.path}`);
      process.exit(1);
    }
  }

  // Read CLI changes
  console.log('\n📄 Reading CLI changes...');
  const cliChanges = fs.readFileSync(CLI_CHANGES_FILE, 'utf8');
  console.log(`  ✓ CLI Changes: ${cliChanges.length} characters`);

  // Prepare form data
  console.log('\n📦 Preparing request payload...');
  const form = new FormData();
  
  // Add files
  form.append('current_feature_spec', fs.createReadStream(FUNC_SPEC_FILE), {
    filename: path.basename(FUNC_SPEC_FILE),
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  
  form.append('existing_feature_spec', fs.createReadStream(ZERO_TOUCH_TEST_PLAN_FILE), {
    filename: path.basename(ZERO_TOUCH_TEST_PLAN_FILE),
    contentType: 'application/msword'
  });
  
  form.append('existing_test_plan', fs.createReadStream(TEST_PLAN_FILE), {
    filename: path.basename(TEST_PLAN_FILE),
    contentType: 'application/msword'
  });

  // Add text fields
  const jiraStoryObj = {
    key: JIRA_STORY,
    summary: 'Fabric Attach Zero-Touch Client with NetLogin Bypass Enhancement',
    description: 'Allow FA devices to bypass NetLogin authentication using bypass-netlogin option'
  };
  form.append('jira_story', JSON.stringify(jiraStoryObj));
  form.append('workflow_id', workflowId);
  form.append('additional_cli', cliChanges + '\n\n' + ADDITIONAL_CLI);
  form.append('qa_feature_interactions', QA_FEATURE_INTERACTIONS);

  console.log('  ✓ Form data prepared');
  console.log(`    - Workflow ID: ${workflowId}`);
  console.log('    - Documents: 3 files');
  console.log(`    - JIRA Story: ${JIRA_STORY}`);
  console.log(`    - Additional CLI: ${(cliChanges.length + ADDITIONAL_CLI.length)} characters`);
  console.log(`    - QA Feature Interactions: ${QA_FEATURE_INTERACTIONS.length} characters`);

  // Make request
  console.log('\n🔄 Sending request to backend...');
  console.log(`   Endpoint: ${BACKEND_URL}/api/stage2/generate`);
  console.log('   ⏳ This may take a few minutes...');
  
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/stage2/generate`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000 // 5 minutes
      }
    );

    console.log('\n✅ SUCCESS! Skill file generated');
    console.log('='.repeat(80));
    
    if (response.data.skillFile) {
      const outputPath = path.join(__dirname, `skill-${JIRA_STORY}.md`);
      fs.writeFileSync(outputPath, response.data.skillFile, 'utf8');
      console.log(`\n📝 Skill file saved to: ${outputPath}`);
      console.log(`   File size: ${(response.data.skillFile.length / 1024).toFixed(2)} KB`);
      
      // Show summary
      if (response.data.metadata) {
        console.log('\n📊 Generation Metadata:');
        console.log(`   Model: ${response.data.metadata.model || 'N/A'}`);
        console.log(`   Templates used: ${response.data.metadata.templatesUsed || 'N/A'}`);
        console.log(`   Commit analysis: ${response.data.metadata.commitAnalysis ? 'Yes' : 'No'}`);
      }

      // Show first 500 characters
      console.log('\n📄 Preview (first 500 characters):');
      console.log('-'.repeat(80));
      console.log(response.data.skillFile.substring(0, 500));
      console.log('-'.repeat(80));
      
      return outputPath;
    } else {
      console.log('\n⚠️ Response received but no skill file content');
      console.log(JSON.stringify(response.data, null, 2));
      return null;
    }

  } catch (error) {
    console.error('\n❌ ERROR generating skill file');
    console.error('='.repeat(80));
    
    if (error.response) {
      console.error(`Status: ${error.response.status} ${error.response.statusText}`);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Error:', error.message);
    } else {
      console.error('Error:', error.message);
    }
    
    throw error;
  }
}

async function main() {
  console.log('\n🎯 Fabric Attach Skill File Generation');
  console.log('='.repeat(80));
  console.log(`📋 JIRA Story: ${JIRA_STORY}`);
  console.log(`🌐 Backend URL: ${BACKEND_URL}`);
  console.log(`📂 Document Directory: ${DOC_DIR}`);
  console.log('='.repeat(80));

  try {
    // Step 1: Create workflow
    const workflowId = await createWorkflow();
    
    // Step 2: Generate skill file
    const outputPath = await generateSkillFile(workflowId);
    
    if (outputPath) {
      console.log('\n🎉 All done!');
      console.log(`   Skill file: ${outputPath}`);
    }
    
  } catch (error) {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  }
}

// Run
main();
