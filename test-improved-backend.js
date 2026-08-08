#!/usr/bin/env node
/**
 * Direct backend API test for improved LLM configuration
 * Tests: 16K token limit + extended thinking
 */

require('dotenv').config({ path: './backend/.env', quiet: true });
const fs = require('fs');

const BACKEND_URL = 'http://10.127.26.9:5100';
const TICKET_ID = 'EXOS-39369';
const OUTPUT_FILE = 'skill-EXOS-39369-backend-improved.md';

// Simplified test payload
const testPayload = {
  storyId: TICKET_ID,
  storyTitle: 'FA: Allow devices to bypass NetLogin authentication',
  documents: {
    currentSpec: `
# Fabric Attach - Bypass NetLogin Authentication

## Feature Overview
This feature allows network devices to bypass NetLogin authentication when using Fabric Attach.
When a device connects with valid Fabric Attach TLVs, it can be configured to skip the NetLogin 
authentication process using the 'bypass-netlogin' option.

## CLI Command
\`\`\`
configure netlogin port <port> bypass-netlogin
\`\`\`

## Use Cases
1. Automated device onboarding for Fabric Attach enabled devices
2. Zero-touch provisioning scenarios
3. Integration with existing Fabric Attach infrastructure
4. Simplified network access for trusted FA devices

## Configuration Examples
- Enable bypass on port 1:5: configure netlogin port 1:5 bypass-netlogin
- Disable bypass: configure netlogin port 1:5 no bypass-netlogin
- Verify configuration: show netlogin port 1:5

## Security Considerations
- Only devices with valid FA TLVs are bypassed
- Port-level granular control
- Works with MAC authentication mode
- Compatible with existing NetLogin policies

## Testing Requirements
1. Verify bypass with valid FA TLVs
2. Ensure rejection without FA TLVs
3. Test port-specific configuration
4. Validate interaction with existing NetLogin settings
5. Performance testing with multiple ports
    `.trim(),
    
    qaFeatureInteractions: `
Related Features:
- NetLogin MAC authentication
- Fabric Attach (FA)
- LLDP/802.1ab
- Network Access Control
    `.trim()
  }
};

async function testBackend() {
  console.log('\n🧪 Testing Improved Backend Configuration');
  console.log('='.repeat(80));
  console.log(`📋 Ticket: ${TICKET_ID}`);
  console.log(`🌐 Backend: ${BACKEND_URL}`);
  console.log(`📝 Output: ${OUTPUT_FILE}`);
  console.log('='.repeat(80));
  console.log('\n⚙️ Configuration:');
  console.log('  • max_tokens: 16384 (was 4096)');
  console.log('  • temperature: 0.5 (was 0.3)');
  console.log('  • extended_thinking: enabled');
  console.log('  • thinking_budget: 10K tokens');
  console.log('\n⏳ Generating skill file (this will take 1-3 minutes)...\n');

  const startTime = Date.now();
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/stage2/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const error = await response.text();
      console.error(`\n❌ Backend Error (${response.status}): ${error}`);
      process.exit(1);
    }

    const result = await response.json();
    
    console.log(`\n✅ Generation Completed in ${duration}s`);
    console.log('='.repeat(80));
    
    // Save output
    if (result.content) {
      fs.writeFileSync(OUTPUT_FILE, result.content, 'utf8');
      const stats = fs.statSync(OUTPUT_FILE);
      const lines = result.content.split('\n').length;
      const sizeKB = (stats.size / 1024).toFixed(2);
      
      console.log('\n📊 Output Statistics:');
      console.log(`  • File: ${OUTPUT_FILE}`);
      console.log(`  • Size: ${sizeKB} KB`);
      console.log(`  • Lines: ${lines}`);
      console.log(`  • Duration: ${duration}s`);
      
      // Compare with previous run
      const prevFile = 'skill-EXOS-39369-backend-sonnet.md';
      if (fs.existsSync(prevFile)) {
        const prevStats = fs.statSync(prevFile);
        const prevSizeKB = (prevStats.size / 1024).toFixed(2);
        const improvement = ((sizeKB / prevSizeKB - 1) * 100).toFixed(1);
        console.log(`\n📈 Comparison with Previous Run:`);
        console.log(`  • Previous: ${prevSizeKB} KB`);
        console.log(`  • Current: ${sizeKB} KB`);
        console.log(`  • Change: ${improvement}%`);
      }
      
      console.log('\n✅ Test completed successfully!');
    } else {
      console.error('\n❌ No content in response');
      process.exit(1);
    }
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ Test Failed after ${duration}s:`);
    console.error(error.message);
    process.exit(1);
  }
}

testBackend();
