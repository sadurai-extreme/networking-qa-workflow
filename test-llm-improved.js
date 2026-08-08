#!/usr/bin/env node
/**
 * Minimal test of improved LLM configuration
 * Tests 16K tokens + extended thinking without document conversions
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const SkillFileGenerator = require(path.join(__dirname, 'backend', 'src/agents/skillFileGenerator'));
const fs = require('fs');

const OUTPUT_FILE = 'skill-EXOS-39369-backend-improved.md';

// Simplified test documents - no conversions needed
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
2. Enable bypass: configure netlogin port 1:5 bypass-netlogin
3. Connect FA device
4. Verify device authenticated without NetLogin
**Expected**: Device connects successfully, FA TLVs validated, no NetLogin challenge

### TC2: Bypass Disabled Behavior  
**Objective**: Verify devices require NetLogin when bypass disabled
**Steps**:
1. Configure NetLogin on port 1:5
2. Disable bypass: configure netlogin port 1:5 no bypass-netlogin
3. Connect FA device
4. Verify NetLogin authentication required
**Expected**: NetLogin challenge presented, device must authenticate

### TC3: Show Command Verification
**Objective**: Verify show commands display bypass status
**Steps**:
1. Configure bypass on multiple ports
2. Run: show netlogin port
3. Run: show fabric attach elements
**Expected**: Bypass status shown correctly in both commands

### TC4: Invalid FA TLVs
**Objective**: Verify bypass denied for invalid FA TLVs
**Steps**:
1. Enable bypass on port
2. Connect device with invalid/missing FA TLVs
3. Verify authentication failure
**Expected**: Device denied access, error logged

### TC5: Multi-Port Configuration
**Objective**: Verify bypass works on multiple ports independently
**Steps**:
1. Enable bypass on ports 1:1-1:10
2. Connect FA devices to all ports
3. Verify all authenticate correctly
**Expected**: All ports process bypass correctly

## Performance Tests
- Test 100+ devices with bypass enabled
- Measure authentication time vs standard NetLogin
- Verify no CPU/memory impact

## Negative Tests
- Attempt bypass without FA TLVs
- Test with corrupted TLV data
- Verify security boundaries`,

  additionalCLI: `# CLI Changes for Bypass NetLogin

## New Commands

### Configure Bypass
\`\`\`
configure netlogin port <port> bypass-netlogin
\`\`\`
Enables Fabric Attach devices to bypass NetLogin authentication on specified port.

### Remove Bypass  
\`\`\`
configure netlogin port <port> no bypass-netlogin
\`\`\`
Disables bypass - FA devices must authenticate via NetLogin.

## Modified Show Commands

### show netlogin port <port>
Added field:
- Bypass NetLogin: <enabled|disabled>

### show fabric attach elements  
Added column:
- NetLogin Bypass: <Yes|No|N/A>

## Configuration Examples
\`\`\`bash
# Enable on single port
configure netlogin port 1:5 bypass-netlogin

# Enable on range
configure netlogin port 1:1-1:24 bypass-netlogin

# Verify
show netlogin port 1:5
show fabric attach elements
\`\`\``,

  qaFeatureInteractions: `Related Features:
- NetLogin MAC authentication
- Fabric Attach (FA) 
- LLDP/802.1ab
- Network Access Control
- VLAN assignment
- AAA integration`
};

async function testImprovedLLM() {
  console.log('\n🧪 Testing Improved Backend LLM Configuration');
  console.log('='.repeat(80));
  console.log('⚙️  Configuration:');
  console.log('   • max_tokens: 16384 (was 4096)');
  console.log('   • temperature: 0.5 (was 0.3)');
  console.log('   • extended_thinking: enabled');
  console.log('   • thinking_budget: 10K tokens');
  console.log('='.repeat(80));
  console.log('\n⏳ Generating skill file with improved configuration...\n');

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

    // Save output
    fs.writeFileSync(OUTPUT_FILE, result.content, 'utf8');
    const stats = fs.statSync(OUTPUT_FILE);
    const lines = result.content.split('\n').length;
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log('\n✅ Generation Completed!');
    console.log('='.repeat(80));
    console.log('\n📊 Output Statistics:');
    console.log(`   • File: ${OUTPUT_FILE}`);
    console.log(`   • Size: ${sizeKB} KB`);
    console.log(`   • Lines: ${lines}`);
    console.log(`   • Duration: ${duration}s`);

    // Compare with previous runs
    const comparisons = [
      { file: 'skill-EXOS-39369-backend-sonnet.md', label: 'Previous Backend (4K tokens)' },
      { file: 'skill-EXOS-39369-copilot.md', label: 'GitHub Copilot' },
      { file: 'skill-EXOS-39369-claude.md', label: 'Backend Opus 4.8' }
    ];

    console.log('\n📈 Comparison:');
    console.log('   ' + '─'.repeat(76));
    console.log(`   ${'Run'.padEnd(30)} ${'Size'.padEnd(12)} ${'Lines'.padEnd(10)} ${'Change'}`);
    console.log('   ' + '─'.repeat(76));
    
    comparisons.forEach(comp => {
      if (fs.existsSync(comp.file)) {
        const prevStats = fs.statSync(comp.file);
        const prevSizeKB = (prevStats.size / 1024).toFixed(2);
        const prevLines = fs.readFileSync(comp.file, 'utf8').split('\n').length;
        const sizeChange = ((sizeKB / prevSizeKB - 1) * 100).toFixed(1);
        const linesChange = ((lines / prevLines - 1) * 100).toFixed(1);
        const changeStr = sizeChange > 0 ? `+${sizeChange}%` : `${sizeChange}%`;
        console.log(`   ${comp.label.padEnd(30)} ${(prevSizeKB + ' KB').padEnd(12)} ${(prevLines + '').padEnd(10)} ${changeStr}`);
      }
    });
    
    console.log(`   ${'IMPROVED (Current)'.padEnd(30)} ${(sizeKB + ' KB').padEnd(12)} ${(lines + '').padEnd(10)} ✅`);
    console.log('   ' + '─'.repeat(76));

    console.log('\n✅ Test completed successfully!');
    console.log('\n💡 Key Improvements:');
    console.log('   • 4x larger token limit (4K → 16K)');
    console.log('   • Extended thinking enabled for better reasoning');
    console.log('   • Higher temperature for more creative output');

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ Test Failed after ${duration}s:`);
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testImprovedLLM();
