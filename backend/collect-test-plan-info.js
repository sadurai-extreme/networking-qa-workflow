#!/usr/bin/env node

/**
 * Interactive Test Plan Information Collector
 * Systematically gathers all required information for generating EXOS test plans
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Store collected information
const testPlanInfo = {
  basic: {},
  topology: { devices: [], connections: [] },
  technical: {},
  behaviors: { positive: [], negative: [], edge: [] },
  resilience: {},
  preferences: {},
  metadata: { timestamp: new Date().toISOString() }
};

// Helper function to ask questions
function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Helper function to ask yes/no questions
async function askYesNo(question) {
  const answer = await ask(`${question} (yes/no): `);
  return answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
}

// Helper function to collect list items
async function collectList(prompt, minItems = 1) {
  const items = [];
  console.log(`\n${prompt}`);
  console.log('(Enter blank line when done, minimum ' + minItems + ' item(s) required)\n');
  
  let index = 1;
  while (true) {
    const item = await ask(`  ${index}. `);
    if (!item && items.length >= minItems) break;
    if (!item && items.length < minItems) {
      console.log(`  ⚠️  Please enter at least ${minItems} item(s)`);
      continue;
    }
    items.push(item);
    index++;
  }
  return items;
}

// Main questionnaire flow
async function runQuestionnaire() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   EXOS Test Plan Information Collector                    ║');
  console.log('║   Interactive Questionnaire v1.0                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('This tool will guide you through collecting all information needed');
  console.log('to generate a production-quality EXOS Functional Test Plan.\n');
  
  const proceed = await askYesNo('Ready to start?');
  if (!proceed) {
    console.log('\nExiting...');
    rl.close();
    return;
  }
  
  // SECTION 1: BASIC INFORMATION
  console.log('\n' + '='.repeat(60));
  console.log('SECTION 1: BASIC FEATURE INFORMATION (MANDATORY)');
  console.log('='.repeat(60));
  
  testPlanInfo.basic.jiraId = await ask('\n📋 Jira Ticket ID (e.g., EXOS-39334): ');
  testPlanInfo.basic.featureName = await ask('📝 Feature Name: ');
  testPlanInfo.basic.targetRelease = await ask('🎯 Target Release (e.g., EXOS 33.7): ');
  testPlanInfo.basic.priority = await ask('⚡ Priority (P0/P1/P2/P3): ');
  testPlanInfo.basic.relatedTickets = await ask('🔗 Related Jira Tickets (comma-separated, or N/A): ');
  
  console.log('\n📄 Feature Description:');
  console.log('(Paste the complete Jira description. Press Enter twice when done)\n');
  
  let description = '';
  let emptyLineCount = 0;
  while (emptyLineCount < 2) {
    const line = await ask('');
    if (line === '') {
      emptyLineCount++;
    } else {
      emptyLineCount = 0;
      description += line + '\n';
    }
  }
  testPlanInfo.basic.description = description.trim();
  
  // SECTION 2: TOPOLOGY INFORMATION
  console.log('\n' + '='.repeat(60));
  console.log('SECTION 2: TOPOLOGY INFORMATION (MANDATORY)');
  console.log('='.repeat(60));
  
  const numDevices = parseInt(await ask('\n🔌 How many devices in the topology? '));
  
  for (let i = 1; i <= numDevices; i++) {
    console.log(`\n--- Device ${i} ---`);
    const device = {
      id: i,
      role: await ask('  Role (FA Server/FA Proxy/FA Client/DUT/Other): '),
      model: await ask('  Model (e.g., 5720-24MXW): '),
      os: await ask('  OS (EXOS/VOSS FE/Third-party): '),
      managementIp: await ask('  Management IP (optional, or N/A): ')
    };
    testPlanInfo.topology.devices.push(device);
  }
  
  console.log('\n🔗 Define connections between devices:');
  console.log('Format: Device1ID:Port <--> Device2ID:Port [trunk/access]');
  console.log('(Enter blank line when done)\n');
  
  let connIndex = 1;
  while (true) {
    const conn = await ask(`  Connection ${connIndex}: `);
    if (!conn) break;
    testPlanInfo.topology.connections.push(conn);
    connIndex++;
  }
  
  // SECTION 3: TECHNICAL SPECIFICATIONS
  console.log('\n' + '='.repeat(60));
  console.log('SECTION 3: TECHNICAL SPECIFICATIONS (MANDATORY)');
  console.log('='.repeat(60));
  
  console.log('\n🏷️  VLANs Used:');
  testPlanInfo.technical.primaryVlan = await ask('  Primary/Fallback VLAN: ');
  testPlanInfo.technical.testVlans = await ask('  Test VLANs (comma-separated): ');
  testPlanInfo.technical.mgmtVlan = await ask('  Management VLAN (or N/A): ');
  
  console.log('\n🔢 NSI/ISID Values:');
  testPlanInfo.technical.primaryNsi = await ask('  Primary/Fallback NSI: ');
  testPlanInfo.technical.testNsi = await ask('  Test NSI values (comma-separated): ');
  
  const hasProtocolParams = await askYesNo('\n⚙️  Are there protocol-specific parameters (SPBM, etc.)?');
  if (hasProtocolParams) {
    console.log('\nEnter protocol parameters (key=value format, blank line when done):');
    testPlanInfo.technical.protocolParams = [];
    while (true) {
      const param = await ask('  ');
      if (!param) break;
      testPlanInfo.technical.protocolParams.push(param);
    }
  }
  
  console.log('\n🛠️  Tools:');
  testPlanInfo.technical.tools = await ask('  Traffic Generators/Tools (IXIA/Spirent/N/A): ');
  
  // SECTION 4: FEATURE BEHAVIORS
  console.log('\n' + '='.repeat(60));
  console.log('SECTION 4: FEATURE BEHAVIORS TO TEST (MANDATORY)');
  console.log('='.repeat(60));
  
  testPlanInfo.behaviors.positive = await collectList(
    '\n✅ Core Functional Behaviors (what the feature SHOULD do):',
    3
  );
  
  testPlanInfo.behaviors.negative = await collectList(
    '\n❌ Negative Scenarios (what happens when things fail):',
    1
  );
  
  const hasEdgeCases = await askYesNo('\nAre there edge cases to test?');
  if (hasEdgeCases) {
    testPlanInfo.behaviors.edge = await collectList(
      '\n⚠️  Edge Cases (boundary conditions, special scenarios):',
      1
    );
  }
  
  // SECTION 5: RESILIENCE & SCALE
  console.log('\n' + '='.repeat(60));
  console.log('SECTION 5: RESILIENCE & SCALE TESTING (OPTIONAL)');
  console.log('='.repeat(60));
  
  const needsResilience = await askYesNo('\n🔄 Include resilience/failover testing?');
  if (needsResilience) {
    testPlanInfo.resilience.rebootTests = await askYesNo('  Test reboot scenarios?');
    testPlanInfo.resilience.processRestarts = await askYesNo('  Test process restarts?');
    testPlanInfo.resilience.portFlaps = await askYesNo('  Test port disable/enable?');
    testPlanInfo.resilience.protocolResets = await askYesNo('  Test protocol resets (clear neighbor)?');
  }
  
  const needsScale = await askYesNo('\n📊 Include scaling/performance tests?');
  if (needsScale) {
    testPlanInfo.resilience.maxDevices = await ask('  Max client devices: ');
    testPlanInfo.resilience.maxVlans = await ask('  Max VLANs: ');
    testPlanInfo.resilience.setupTime = await ask('  Target setup time (e.g., < 10 sec): ');
  }
  
  // SECTION 6: CONFIGURATION
  console.log('\n' + '='.repeat(60));
  console.log('SECTION 6: BASE CONFIGURATION');
  console.log('='.repeat(60));
  
  const hasConfigs = await askYesNo('\n⚙️  Do you have base configuration CLI commands ready?');
  testPlanInfo.technical.configsAvailable = hasConfigs;
  
  if (hasConfigs) {
    console.log('\n📝 You can provide config files separately.');
    console.log('Expected location: ./configs/[device-name]-config.txt');
  }
  
  // SECTION 7: PREFERENCES
  console.log('\n' + '='.repeat(60));
  console.log('SECTION 7: TEST PLAN PREFERENCES');
  console.log('='.repeat(60));
  
  console.log('\n📏 Test Case Depth:');
  console.log('  1. Concise (5-8 steps, official style) ✅ RECOMMENDED');
  console.log('  2. Detailed (10-15 steps with verification)');
  console.log('  3. Hybrid (concise with detailed expected results)');
  const depthChoice = await ask('\nSelect (1/2/3): ');
  const depthMap = { '1': 'concise', '2': 'detailed', '3': 'hybrid' };
  testPlanInfo.preferences.testCaseDepth = depthMap[depthChoice] || 'concise';
  
  testPlanInfo.preferences.includeRiskAssessment = await askYesNo('\n⚠️  Include risk assessment section?');
  testPlanInfo.preferences.includeExecutionGuide = await askYesNo('📋 Include test execution guidelines?');
  testPlanInfo.preferences.includeCLIReference = await askYesNo('💻 Include CLI command reference appendix?');
  testPlanInfo.preferences.includeReviewTemplate = await askYesNo('👥 Include review meeting template?');
  
  // SECTION 8: DOCUMENTATION
  console.log('\n' + '='.repeat(60));
  console.log('SECTION 8: SUPPORTING DOCUMENTATION');
  console.log('='.repeat(60));
  
  testPlanInfo.preferences.functionalSpec = await ask('\n📚 Functional Specification URL (or N/A): ');
  testPlanInfo.preferences.prdMrd = await ask('📄 PRD/MRD Document URL (or N/A): ');
  testPlanInfo.preferences.configGuide = await ask('⚙️  Configuration Guide URL (or N/A): ');
  
  // SUMMARY & SAVE
  console.log('\n' + '='.repeat(60));
  console.log('INFORMATION COLLECTION COMPLETE!');
  console.log('='.repeat(60));
  
  console.log('\n📊 Summary:');
  console.log(`  Jira Ticket: ${testPlanInfo.basic.jiraId}`);
  console.log(`  Feature: ${testPlanInfo.basic.featureName}`);
  console.log(`  Topology: ${testPlanInfo.topology.devices.length} devices`);
  console.log(`  Behaviors: ${testPlanInfo.behaviors.positive.length} positive, ${testPlanInfo.behaviors.negative.length} negative`);
  console.log(`  Test Depth: ${testPlanInfo.preferences.testCaseDepth}`);
  
  const saveToFile = await askYesNo('\n💾 Save this information to a file?');
  
  if (saveToFile) {
    const filename = `test-plan-info-${testPlanInfo.basic.jiraId.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filepath = path.join(process.cwd(), filename);
    
    fs.writeFileSync(filepath, JSON.stringify(testPlanInfo, null, 2));
    console.log(`\n✅ Information saved to: ${filepath}`);
    console.log('\nYou can now use this file to generate your test plan!');
    console.log('Command: node generate-test-plan.js ' + filename);
  } else {
    console.log('\n📋 Here\'s your collected information:\n');
    console.log(JSON.stringify(testPlanInfo, null, 2));
  }
  
  console.log('\n✨ Thank you! Test plan generation can now proceed.\n');
  rl.close();
}

// Error handling
rl.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted. Information not saved.');
  rl.close();
  process.exit(0);
});

// Run the questionnaire
runQuestionnaire().catch((error) => {
  console.error('\n❌ Error:', error.message);
  rl.close();
  process.exit(1);
});
