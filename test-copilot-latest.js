#!/usr/bin/env node
/**
 * Generate skill file using GitHub Copilot for comparison
 */

const path = require('path');
const fs = require('fs');

// Temporarily override environment to use GitHub Copilot
process.env.LLM_PROVIDER = 'github-copilot';

require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const SkillFileGenerator = require(path.join(__dirname, 'backend', 'src/agents/skillFileGenerator'));

const OUTPUT_FILE = 'skill-EXOS-39369-copilot-latest.md';

// Same documents as the improved test
const documents = {
  currentSpec: `# Fabric Attach - Bypass NetLogin Authentication

## Feature Overview
This feature allows network devices to bypass NetLogin authentication when using Fabric Attach.
When a device connects with valid Fabric Attach TLVs, it can be configured to skip the NetLogin 
authentication process using the 'bypass-netlogin' option.

## CLI Command
\`\`\`
configure netlogin port <port> bypass-netlogin
\`\`\`

## Key Functionality
- Port-level bypass configuration
- Works with MAC authentication mode  
- Validates FA TLVs before bypass
- Compatible with existing NetLogin policies
- Zero-touch provisioning support

## Configuration
### Enable Bypass
\`\`\`
configure netlogin port 1:5 bypass-netlogin
\`\`\`

### Disable Bypass
\`\`\`
configure netlogin port 1:5 no bypass-netlogin  
\`\`\`

### Verify Configuration
\`\`\`
show netlogin port 1:5
show fabric attach elements
\`\`\`

## Security
- Only valid FA devices can bypass
- Port-specific granular control
- Audit trail in system logs
- Integration with AAA policies

## Use Cases
1. Automated device onboarding
2. Zero-touch provisioning
3. Simplified network access for trusted devices
4. Fabric Attach infrastructure integration`,

  testPlan: `# Fabric Attach Bypass NetLogin - Test Plan

## Test Objectives
Verify that Fabric Attach devices can bypass NetLogin authentication correctly

## Test Setup
- EXOS switch with NetLogin and Fabric Attach enabled
- Test devices with FA capabilities
- Various port configurations

## Test Cases

### TC1: Basic Bypass Functionality
**Objective**: Verify bypass-netlogin command enables FA device authentication bypass
**Steps**:
1. Configure NetLogin on port 1:5
2. Enable bypass-netlogin on port 1:5
3. Connect FA device to port
4. Verify device authenticated without credentials
**Expected**: Device should bypass NetLogin and authenticate via FA TLVs

### TC2: Command Validation
**Objective**: Verify CLI commands work correctly
**Steps**:
1. Execute: configure netlogin port 1:5 bypass-netlogin
2. Verify with: show netlogin port 1:5
**Expected**: Output shows bypass-netlogin enabled

### TC3: Negative Testing
**Objective**: Verify non-FA devices still require authentication
**Steps**:
1. Configure bypass-netlogin on port
2. Connect non-FA device
**Expected**: Device should require normal NetLogin authentication`,

  additionalCLI: `# Additional CLI Commands

## Configuration Commands
configure netlogin port <port> bypass-netlogin
configure netlogin port <port> no bypass-netlogin

## Show Commands  
show netlogin port <port>
show netlogin session
show fabric attach elements
show fabric attach statistics

## Debug Commands
debug netlogin show info
debug lldp show fabric attach database`,

  qaFeatureInteractions: `# QA Feature Interactions

## Interaction with NetLogin
- Bypass only applies when FA TLVs present
- Existing NetLogin policies still apply
- Authentication logs maintained

## Interaction with LLDP/FA
- Requires LLDP enabled on port
- FA TLVs must be received and validated
- FA element assignment takes precedence

## Interaction with VLANs
- Dynamic VLAN assignment from FA TLVs
- Port VLAN configuration may be overridden
- VLAN authorization checks still apply`
};

async function generateSkillFile() {
  console.log('\n🧪 Testing GitHub Copilot Skill Generation');
  console.log('=' .repeat(80));
  console.log(`⚙️  Configuration:`);
  console.log(`   • Provider: github-copilot`);
  console.log(`   • Model: ${process.env.GITHUB_MODEL || 'gpt-4o'}`);
  console.log('=' .repeat(80));
  console.log('\n⏳ Generating skill file with GitHub Copilot...\n');

  const startTime = Date.now();

  try {
    const generator = new SkillFileGenerator();
    
    const result = await generator.generateSkillFile({
      jiraStory: {
        id: 'EXOS-39369',
        title: 'FA: Allow devices to bypass NetLogin authentication using bypass-netlogin option',
        summary: 'Allow devices to bypass NetLogin authentication using bypass-netlogin option'
      },
      documents,
      streaming: false
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (!result || !result.content) {
      console.error('\n❌ No content generated');
      process.exit(1);
    }
    
    const contentLength = result.content.length;
    const lineCount = result.content.split('\n').length;
    const fileSizeKB = (contentLength / 1024).toFixed(2);

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, result.content, 'utf8');

    console.log(`✅ Generation Completed!`);
    console.log('=' .repeat(80));
    console.log(`\n📊 Output Statistics:`);
    console.log(`   • File: ${OUTPUT_FILE}`);
    console.log(`   • Size: ${fileSizeKB} KB`);
    console.log(`   • Lines: ${lineCount}`);
    console.log(`   • Duration: ${duration}s`);
    console.log(`\n✅ Skill file saved successfully!\n`);

    return { contentLength, lineCount, duration, fileSizeKB };
  } catch (error) {
    console.error('\n❌ Generation failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
generateSkillFile().then(() => {
  console.log('✅ Test completed successfully!\n');
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
