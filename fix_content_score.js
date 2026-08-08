const axios = require('axios');

const workflowId = 'eeb77145-726d-4146-a872-a5918b531bf3';

const reviewComments = `# FIX CONTENT SCORE: 69 → 90+

## CRITICAL: Add Cross-References (Missing 15 points!)
**Currently: 0/15 points**

Add "per testcase 5.x.x" or "as per testcase 5.x.x" references throughout the test plan:
- Example: "Configure RA Guard per testcase 5.1.1"
- Example: "Use same topology as per testcase 5.2.3"
- Example: "Verify DHCPv6 Guard functionality per testcase 5.3.2"
- Example: "Apply filter rules as per testcase 5.4.1"

**TARGET: Add AT LEAST 10 cross-references between related test cases**

## CRITICAL: Expand Methodology Sections (Only 7/20 points!)
**Currently: 7/20 points (need 5-8 steps average)**

EVERY test case methodology MUST have 5-8 detailed, numbered steps:

**Template for expansion:**
1. Configure prerequisite settings (specific commands)
2. Apply main feature configuration with exact CLI
3. Verify configuration using show commands
4. Execute test action (send traffic, trigger event, etc.)
5. Verify expected behavior with specific checks
6. Check counters/statistics for confirmation
7. Document any error messages or warnings
8. Confirm final state meets pass criteria

**KEEP:**
- All existing test cases
- All CLI command blocks  
- All specific values (VLAN IDs, IP addresses, etc.)
- Test case structure and numbering

**ONLY ADD:**
- Cross-references between test cases
- Expand each methodology section to 5-8 steps
- Add specific device models to topology if missing

**TARGET: Content score 90+/100 (currently 69/100)**`;

async function regenerateTestPlan() {
  try {
    console.log('Sending regeneration request...');
    console.log('Workflow ID:', workflowId);
    console.log('Review comments length:', reviewComments.length);
    
    const response = await axios.post(
      `http://localhost:5100/api/stage3/regenerate-with-comments`,
      {
        workflow_id: workflowId,
        review_comments: reviewComments
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minutes
      }
    );

    console.log('\n✅ Success!');
    console.log('Revision:', response.data.revision_number);
    console.log('Preview:', response.data.content.substring(0, 200) + '...');
    console.log('\n🔄 Refresh the browser and run EVAL again!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.code === 'ECONNABORTED') {
      console.log('⏱️ Request timed out - LLM is still processing. Check browser for results.');
    }
  }
}

regenerateTestPlan();
