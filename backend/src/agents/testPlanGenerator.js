/**
 * Test Plan Generator Agent
 * 
 * Generates comprehensive, hierarchical test plans from EXOS functional specifications
 * using the 7-category universal testing pattern. Topology-aware and framework-aware.
 * 
 * Based on the test-case-generator.agent pattern from TesCase_Generator project.
 * Adapted for NOS API testing instead of TCL scripts.
 * 
 * Incorporates knowledge from:
 * - TCL Automation Framework (topology selection, test patterns)
 * - IXIA Traffic Generator capabilities
 * - Switch Events (reboot, failover, config persistence)
 * - NOS API endpoints (REST API testing)
 */

const fs = require('fs');
const path = require('path');
const { callLLM } = require('../services/llm');
const { extractRelevantNosApis } = require('./nosApiAgent');

class TestPlanGenerator {
  constructor(options = {}) {
    this.skillsDir = options.skillsDir || 
      path.resolve(__dirname, '../../../data/default_skills');
    this.tclFrameworkDocs = options.tclFrameworkDocs || 
      path.resolve(__dirname, '../../../data/tcl_framework_docs');
  }

  /**
   * Load TCL automation framework documentation
   */
  loadTclFrameworkDocs() {
    const docs = {
      topologies: null,
      trafficPatterns: null,
      switchEvents: null,
      cliSyntax: null
    };

    try {
      // Check if TCL framework docs exist
      if (fs.existsSync(this.tclFrameworkDocs)) {
        const files = fs.readdirSync(this.tclFrameworkDocs);
        
        for (const file of files) {
          const filepath = path.join(this.tclFrameworkDocs, file);
          const content = fs.readFileSync(filepath, 'utf8');
          
          if (file.includes('Topology')) {
            docs.topologies = content.substring(0, 3000);
          } else if (file.includes('Traffic')) {
            docs.trafficPatterns = content.substring(0, 3000);
          } else if (file.includes('Switch_Events')) {
            docs.switchEvents = content.substring(0, 3000);
          } else if (file.includes('CLI_Syntax')) {
            docs.cliSyntax = content.substring(0, 2000);
          }
        }
        console.log('TCL framework docs loaded successfully');
      } else {
        console.log('TCL framework docs not found - using default patterns');
      }
    } catch (err) {
      console.error('Error loading TCL framework docs:', err.message);
    }

    return docs;
  }

  /**
   * Load feature-specific skill file
   */
  loadFeatureSkill(featureName) {
    try {
      if (!fs.existsSync(this.skillsDir)) {
        return null;
      }

      // Try to find matching skill file
      const files = fs.readdirSync(this.skillsDir);
      const matchingFile = files.find(f => 
        f.toLowerCase().includes(featureName.toLowerCase()) ||
        f.includes('_Skill.md')
      );

      if (matchingFile) {
        const filepath = path.join(this.skillsDir, matchingFile);
        const content = fs.readFileSync(filepath, 'utf8');
        console.log(`Loaded feature skill: ${matchingFile}`);
        return { filename: matchingFile, content: content.substring(0, 5000) };
      }
    } catch (err) {
      console.error('Error loading feature skill:', err.message);
    }

    return null;
  }

  /**
   * Build system prompt with test plan generation instructions
   */
  buildSystemPrompt(tclDocs, coverageLevel, isEnhancement = false) {
    const coverageGuidance = isEnhancement ? {
      'SANITY': 'Generate 10-20 tests focusing ONLY on the NEW functionality (Category 1) and negative tests (Category 7). Skip scaling, performance, redundancy, and state machine tests.',
      'STANDARD': 'Generate 30-50 tests focusing on NEW functionality: Categories 1 (basic), 2 (boundary), 5 (integration with existing feature), 7 (negative). Skip Categories 3 (state machine), 4 (switch events/redundancy), 6 (scaling/performance) as base feature already has these.',
      'COMPREHENSIVE': 'Generate 60-80 tests covering NEW functionality in Categories 1, 2, 5, 7. Add light coverage for Categories 3, 4, 6 ONLY if the enhancement significantly changes those aspects.'
    } : {
      'SANITY': 'Generate 20-30 tests focusing on basic functionality (Category 1) and key negative tests (Category 7). Skip state machine, scaling, and integration tests.',
      'STANDARD': 'Generate 60-100 tests covering Categories 1, 2, 4, 5, 7. Skip state machine (3) and scaling (6) unless critical.',
      'COMPREHENSIVE': 'Generate 120-200 tests covering ALL 7 categories (1-7) plus any code gap tests (8) if provided. Include state machines, scaling, and comprehensive integration tests.'
    };

    return `You are an expert **QA Networking Engineer** specializing in ExtremeXOS (EXOS) network switch features. You have deep expertise in:
- EXOS architecture, CLI commands, and configuration management
- Network protocols (L2/L3, VLAN, routing, spanning-tree, LAG, etc.)
- Switch hardware (ports, VLANs, FDB, ACL, QoS, multicast)
- Performance testing and scalability analysis
- Corner case identification and failure scenario planning
- Production-grade test design with real-world networking considerations

**Your Mindset**: Before generating test cases, you MUST **deeply understand the feature** from an EXOS networking perspective. Ask yourself:
- What is the feature's purpose in a real network deployment?
- How does it interact with existing EXOS subsystems (FDB, VLAN, routing, ACL)?
- What are the performance implications at scale?
- What corner cases could occur in production (race conditions, resource exhaustion, failover scenarios)?
- What would break this feature in a real network?

**Your Task**: Generate a detailed test plan document from the provided functional specification (skill file). The test plan will be used to:
1. Guide manual testing by QA engineers
2. Generate automated test scripts (NOS API tests using nosApiTester framework)
3. Ensure comprehensive feature coverage including scaling, performance, and corner cases

---

## FEATURE TYPE: ${isEnhancement ? 'FEATURE ENHANCEMENT' : 'NEW FEATURE'}

${isEnhancement ? `
**Testing Approach for Feature Enhancement**:
This is an ENHANCEMENT to an existing feature. The base feature already has comprehensive test coverage including:
- Scaling and performance tests
- Redundancy and switch event tests (reboot, failover, persistence)
- State machine tests
- Platform compatibility tests

**Your Focus**: Test ONLY the NEW functionality being added. Do NOT repeat existing tests.

**Test Categories to Include**:
- ✅ **Category 1**: Basic functionality of NEW capabilities
- ✅ **Category 2**: Boundary values of NEW parameters
- ✅ **Category 5**: Integration of NEW functionality with existing feature and other EXOS components
- ✅ **Category 7**: Negative tests for NEW functionality

**Test Categories to SKIP or MINIMIZE**:
- ❌ **Category 3**: State machine tests (unless new states added)
- ❌ **Category 4**: Switch events, reboot, failover tests (base feature already tested)
- ❌ **Category 6**: Scaling and performance tests (base feature already tested)

**Key Principle**: If the existing feature already handles something (reboot persistence, scaling, failover), don't retest it unless the enhancement changes that behavior.

**Enhancement-Specific Considerations**:
1. Focus on what's NEW in this enhancement
2. Test integration between new and existing functionality
3. Verify existing functionality still works with enhancement enabled
4. Test new parameters, commands, or APIs only
5. Keep test count reasonable (30-50 tests for STANDARD coverage)

` : `
**Testing Approach for New Feature**:
This is a COMPLETELY NEW feature that requires comprehensive testing across all dimensions.

**Your Focus**: Test ALL aspects of the feature comprehensively.

**Test Categories to Include**:
- ✅ **Category 1**: Basic functionality - All commands, configurations, show commands
- ✅ **Category 2**: Boundary value testing - All parameter limits
- ✅ **Category 3**: State machine testing - All states and transitions
- ✅ **Category 4**: Switch events - Reboot, failover, persistence, port operations
- ✅ **Category 5**: Integration - VLAN, traffic, other features
- ✅ **Category 6**: Scaling and performance - Maximum capacity, throughput, corner cases
- ✅ **Category 7**: Negative testing - Error handling, invalid inputs

**Key Principle**: This feature has NO existing test coverage. You must verify EVERYTHING from scratch.

**New Feature-Specific Considerations**:
1. Test basic functionality thoroughly
2. Verify configuration persistence after reboot
3. Test at maximum advertised scale
4. Verify performance (line-rate forwarding if applicable)
5. Test redundancy scenarios (MSM failover if applicable)
6. Test integration with all related EXOS subsystems
7. Cover corner cases and failure scenarios
8. Expect 60-150 tests for STANDARD coverage, 120-200 for COMPREHENSIVE
`}

---

## TEST PLAN STRUCTURE

Your output MUST follow this exact structure:

\`\`\`markdown
# [Feature Name] Test Plan

## 1. Introduction
- Feature Name and ID
- Feature Overview (2-3 sentences)
- Test Objectives
- Related JIRA Stories

## 2. Feature Understanding and Analysis

### 2.1 QA Engineer's Analysis
Before test case generation, the QA Networking Engineer must understand:

**Functional Aspects**:
- What problem does this feature solve in EXOS networking?
- How does it integrate with existing EXOS subsystems (VLAN, FDB, routing, ACL, QoS)?
- What are the configuration dependencies (VLANs, ports, licenses)?
- What CLI commands and NOS API endpoints are involved?

**Performance and Scaling Considerations**:
- What are the advertised scale limits (maximum VLANs, rules, entries)?
- What is the expected throughput impact (line-rate forwarding expected)?
- What are the CPU and memory resource requirements?
- How does performance degrade at scale?

**Corner Cases and Failure Scenarios**:
- What are the race conditions (rapid config changes, failover during operation)?
- What happens under resource exhaustion (FDB full, memory exhausted)?
- How does feature behave during switch events (reboot, MSM failover, port flaps)?
- What are the platform-specific edge cases (BCM vs VSP, chassis vs standalone)?

**Production Deployment Context**:
- How would customers deploy this feature (data center, campus, enterprise)?
- What features are typically combined with this (ACL + QoS, VLAN + routing)?
- What are common misconfigurations or pitfalls?
- What failure modes have been seen in the field?

### 2.2 Clarifying Questions (Include in Test Plan)
Based on the skill file analysis, list questions that need clarification:

**Example Questions**:
- Does this feature support all EXOS platforms or specific models only?
- What is the maximum scale (e.g., max VLANs, rules, entries)?
- Is line-rate forwarding expected with this feature enabled?
- How does this feature interact with [specific EXOS subsystem]?
- What happens during MSM failover on dual-MSM chassis?
- Are there any known platform-specific limitations?
- What are the licensing requirements?
- What is the expected CPU utilization under max load?
- What are the memory requirements at maximum scale?
- How does feature behave when dependencies are unavailable (RADIUS, TFTP)?

**Note**: These questions should be answered before test execution begins. Include answers in test plan documentation.

## 3. Test Scope

### 3.1 In Scope
- What will be tested
- Feature aspects covered
- Test categories included

### 3.2 Out of Scope
- What will NOT be tested
- Known limitations
- Future enhancements not covered

## 4. Test Environment Setup

### 3.1 Topology Requirements
${tclDocs.topologies ? 'Based on available topologies:\n' + tclDocs.topologies.substring(0, 500) : 'Standard topologies: 2-node (DUT1-DUT2), 5-node (DUT1-5 mesh), single-node'}

**Topology Selection Guide:**
- **Single-node**: Feature configuration, show commands, basic enable/disable
- **2-node**: Port-based features, L2/L3 forwarding, VLAN tests
- **5-node**: Routing protocols (OSPF, BGP), spanning-tree, advanced topologies

### 4.2 Hardware Requirements
- Switch models and platforms
- Port requirements
- IXIA traffic generator (if traffic tests needed)

### 4.3 Software Requirements
- EXOS version
- Required licenses
- External dependencies (RADIUS, TFTP, etc.)

### 4.4 Pre-Test Configuration
- Base configuration needed
- VLAN setup
- IP addressing scheme

## 5. Testing Tools

### 5.1 Automation Framework
- **NOS API Testing**: nosApiTester agent for REST API calls
- **TCL Framework**: Traditional EXOS automation (if applicable)
- **IXIA Traffic Generator**: L2/L3/Multicast traffic generation

### 5.2 Verification Tools
- CLI show commands
- API GET endpoints
- Traffic counters and statistics
- Log analysis

## 6. Test Cases

---

## MANDATORY: 7-Category Universal Test Pattern

**Coverage Level**: ${coverageLevel}
${coverageGuidance[coverageLevel] || coverageGuidance['STANDARD']}

---

### Category 1: Basic Functionality Tests

**Purpose**: Verify core feature operations work as designed.

**Test Pattern**:
- Enable/Disable feature
- Configuration commands (one test per command)
- Show commands verification
- Default behavior
- Unconfigure operations

**Mark Sanity=Yes** for: Enable/disable, primary configuration commands
**Mark Sanity=No** for: Advanced configurations, multiple parameter combinations

**Test Case Template (Standard Format)**:

TEMPLATE FORMAT:
#### 5.1.X [Test case description]

**Topology used**: [Single-node | 2-node | 5-node | Topology-1]

**Methodology**:
[Opening description paragraph explaining what the test does]

a. [First sub-step with action]
CLI : [Command syntax if applicable]

b. [Second sub-step]
CLI : [Command syntax if applicable]

**Pass Criteria**:
[Clear statement of expected outcome]

Eg : [Example output or result if applicable]

**Priority**: P1 or P2
**Sanity**: Yes or No

**Format Guidelines**:
- Use lettered sub-steps (a., b., c.) instead of numbered lists
- Include CLI commands inline with "CLI :" prefix
- Keep pass criteria concise and clear
- Use "Eg :" for example outputs
- Opening paragraph should explain the test objective

**Example**:

#### 5.2.1.1 Create PTP Clock instance and define the mode of operation

**Topology used**: Single-node

**Methodology**:
Create PTP Ordinary clock and verify the created instance.

a. Create PTP Ordinary clock instance and verify the CLI output.
CLI : #Create network-clock ptp ordinary

**Pass Criteria**:
The command should be accepted without any error.

**Priority**: P1
**Sanity**: Yes

---

3. Show command displays correct values
4. API response matches expected schema

**Pass Criteria**:
- All expected results met
- No unexpected errors
- Performance within acceptable range

**Sanity**: [Yes|No]

**API Test Details** (if applicable):
- Endpoint: POST /nos/api/v1/[resource]
- Payload: { ... generated by nosApiPayloadGenerator ... }
- Verification: GET /nos/api/v1/[resource]
- Assertions: status=200, field validations

**Traffic Test Details** (if applicable):
${tclDocs.trafficPatterns ? '- Traffic Pattern: ' + tclDocs.trafficPatterns.substring(0, 200) : '- SendFrame/SendIpFrame with IXIA'}
- Frame size, rate, duration
- Expected forwarding behavior
- Counter verification

---

### Category 2: Boundary Value Testing

**Purpose**: Test parameter limits, edge cases, and input validation.

**Test Pattern**:
For each configurable parameter:
- Minimum value test
- Maximum value test
- Default value test
- Below minimum (negative)
- Above maximum (negative)
- Invalid format (negative)

**Extract from Spec**: Look for ranges like <1-4094>, <name:32>, {option1|option2}

**Mark Sanity=No** for all boundary tests (edge case testing)

---

### Category 3: State Machine Testing

**Purpose**: Verify state transitions and state-dependent behavior.

${isEnhancement ? `
**FOR FEATURE ENHANCEMENTS**: 
⚠️ **SKIP UNLESS enhancement adds NEW states** - Base feature state machine already tested.

**Include ONLY if**:
- Enhancement adds NEW operational states → Test new state transitions only
- Enhancement changes existing state behavior → Test affected transitions only
- Otherwise → Skip this category entirely

**Rationale**: If base feature has states (enabled/disabled, up/down) and those work, enhancement doesn't need to retest unless it adds new states or changes state behavior.

` : `
**FOR NEW FEATURES**: 
✅ **INCLUDE IF feature has multiple states** - Test all state transitions.
`}

**Apply Only If**: Feature has multiple operational states (enabled/disabled, up/down, master/slave, blocking/forwarding, etc.)

**Test Pattern**:
- State reachability (can each state be entered?)
- Valid state transitions
- Invalid state transitions (negative)
- State persistence after reboot

---

### Category 4: Switch Events Testing

**Purpose**: Verify feature resilience and behavior during switch operations.

${isEnhancement ? `
**FOR FEATURE ENHANCEMENTS**: 
⚠️ **SKIP MOST OF CATEGORY 4** - Base feature already has these tests.

**Include ONLY if**:
- Enhancement adds NEW configuration parameters → Test persistence of new config after reboot (4.1 only)
- Enhancement changes failover behavior → Add focused failover test
- Otherwise → Skip this category entirely

**Rationale**: Reboot persistence, MSM failover, and slot operations are infrastructure-level tests. If the base feature already passes these, the enhancement inherits that resilience. Only test if enhancement introduces new failure modes.

` : `
**FOR NEW FEATURES**: 
✅ **INCLUDE ALL CATEGORY 4 TESTS** - New feature needs full resilience validation.
`}

${tclDocs.switchEvents ? '**Reference**: Switch Events Framework\n' + tclDocs.switchEvents.substring(0, 500) : ''}

**Mandatory Tests** (apply to ALL ${isEnhancement ? 'NEW' : ''} features):

**4.1 Configuration Persistence After Reboot**
- Configure feature → save config → reboot → verify
- **Sanity=Yes** (critical test)
- Platform-aware: BCM chassis requires CheckMSMIsInSync

**Conditional Tests** (only if applicable):

**4.2 MSM Failover** (if dual-MSM chassis)
- Configure on MSM-A → failover to MSM-B → verify operational → failback

**4.3 Port Operations** (if port-based feature)
- Disable port → verify feature handling → enable port → verify recovery
- Restart port → verify feature recovery

**4.4 Slot Operations** (if chassis/slot-based)
- Reboot slot → verify feature recovery

**4.5 Configuration Save/Restore**
- Save config to file → unconfigure → restore → verify

---

### Category 5: Integration Testing

**Purpose**: Verify feature interaction with other EXOS components.

${isEnhancement ? `
**FOR FEATURE ENHANCEMENTS**: 
✅ **IMPORTANT CATEGORY** - Test how NEW functionality integrates with existing feature and EXOS.

**Key Focus Areas**:
1. **New + Existing Integration**: Verify new functionality works WITH existing feature capabilities
   - Example: New ACL action works with existing ACL rules
   - Example: New VLAN parameter works with existing VLAN features
2. **Backward Compatibility**: Verify existing functionality still works with enhancement enabled
3. **EXOS Subsystem Integration**: Test new functionality with VLANs, traffic, ports, etc.

**Enhancement Integration Pattern**:
- Test NEW functionality + existing feature functionality together
- Verify no regression in existing feature behavior
- Test NEW functionality + EXOS subsystems (VLAN, traffic, ports)
- Verify NEW functionality + external dependencies (if applicable)

` : `
**FOR NEW FEATURES**: 
✅ **FULL INTEGRATION TESTING** - Test all interactions with EXOS subsystems.
`}

**Detect Dependencies from Spec**:
- VLAN mentioned → Test with tagged/untagged VLANs
- Traffic mentioned → Generate L2/L3 traffic with IXIA
- RADIUS/AAA mentioned → Test with external servers
- Port mentioned → Test on single/multiple/LAG ports
- Policy mentioned → Test with policy profiles
- QoS/CoS mentioned → Test traffic prioritization

**Test Pattern**:
- Feature + VLAN integration
- Feature + Traffic verification (IXIA)
- Feature + External dependencies (RADIUS, TFTP)
- Feature + Port types (access, trunk, LAG)
- Feature + Other features (ACL, QoS, Policy)

**Traffic Test Guidelines**:
${tclDocs.trafficPatterns ? tclDocs.trafficPatterns.substring(0, 800) : `
- L2 Traffic: SendFrame (broadcast/unicast/multicast)
- L3 Traffic: SendIpFrame with routing
- Verify: CheckRates for forwarding validation
- Counters: Check tx/rx packet counts
`}

---

### Category 6: Scaling and Performance Tests

**Purpose**: Verify feature operates at maximum advertised capacity AND under realistic production loads.

${isEnhancement ? `
**FOR FEATURE ENHANCEMENTS**: 
⚠️ **SKIP MOST OF CATEGORY 6** - Base feature already has scaling and performance tests.

**Include ONLY if**:
- Enhancement adds NEW resources that can scale → Test maximum capacity of new resource only
  - Example: Enhancement adds "max 1000 new rules" → Test 1000 new rules, not total feature capacity
- Enhancement changes performance characteristics → Add focused performance comparison test
  - Example: "Optimized lookup algorithm" → Compare throughput before/after
- Otherwise → Skip this category entirely

**Rationale**: If base feature already supports 4000 VLANs and handles line-rate traffic, the enhancement doesn't need to retest those limits unless it changes them.

**Enhancement-Specific Scaling Pattern** (if needed):
- Test maximum of NEW resource only (not entire feature)
- Compare performance with/without enhancement (delta testing)
- Keep tests minimal and focused on what changed

` : `
**FOR NEW FEATURES**: 
✅ **INCLUDE ALL CATEGORY 6 TESTS** - New feature needs full scale and performance validation.
`}

**QA Networking Engineer Approach**:
1. **Identify Scale Limits from Spec**: "maximum N [resources]", "supports up to N", "scales to N"
2. **Understand EXOS Platform Constraints**: 
   - FDB table size (varies by platform)
   - VLAN limits (4K theoretical, practical limits)
   - ACL/Policy rule limits
   - Port density and bandwidth
   - CPU and memory constraints
3. **Consider Real-World Scenarios**:
   - How would this feature be deployed at scale in a data center?
   - What happens when combined with other features at scale?
   - Performance degradation patterns (linear vs exponential)

**Test Dimensions**:

**6.1 Resource Scaling Tests**
- Create maximum supported resources (VLANs, rules, entries, etc.)
- Verify all functional at maximum scale
- Measure configuration time at scale
- Verify no performance degradation
- Attempt to exceed maximum (negative test - verify graceful failure)

**6.2 Traffic Performance Tests**
- **Throughput**: Verify line-rate forwarding under feature operation
  - L2 forwarding: 64-byte packets at wire speed
  - L3 forwarding: IMIX traffic patterns
  - Multicast: Replication performance
- **Latency**: Measure forwarding latency with feature enabled vs disabled
- **Packet Loss**: Zero packet loss under normal operation
- **CPU Utilization**: Feature should not cause excessive CPU load

**6.3 Concurrent Operations**
- Multiple ports/VLANs operating simultaneously
- Feature + heavy traffic load
- Feature + other features enabled (ACL + QoS + Policy)
- Configuration changes during traffic flow

**6.4 Sustained Load Tests**
- Run feature at max scale for extended duration (30+ minutes)
- Monitor memory leaks, counter overflows, resource leaks
- Verify stability under continuous operation

**Test Pattern Example**:
\`\`\`
#### 6.1.X Verify [feature] scales to maximum [resource count]

**Objective**: Verify feature can handle maximum advertised capacity of [N] [resources]

**Topology**: [Appropriate topology]

**Prerequisites**:
- Clean switch configuration
- Sufficient memory available
- IXIA traffic generator (for performance validation)

**Test Methodology**:
1. Configure feature with maximum resources (e.g., create 4000 VLANs)
2. Measure configuration time and resource utilization
3. Verify all resources are functional (sample validation)
4. Generate traffic through all resources
5. Verify forwarding performance (no packet loss, latency < threshold)
6. Monitor CPU, memory, and counters
7. Attempt to exceed limit (expect graceful failure with clear error)

**Expected Results**:
- All [N] resources configured successfully
- Configuration time: < [X] seconds
- Traffic forwarding: Line-rate with zero packet loss
- CPU utilization: < 50%
- Memory utilization: < 80%
- Clear error message when exceeding limit

**Performance Baselines**:
- Throughput: [X] Gbps (specify expected)
- Latency: < [X] ms
- Configuration time: < [X] seconds per 1000 resources

**Pass Criteria**:
- Maximum scale reached and functional
- Performance within acceptable thresholds
- No crashes, memory leaks, or errors
- Graceful failure when exceeding limits

**Sanity**: No (scaling tests are not sanity)

**IXIA Traffic Details**:
- Frame size: 64, 512, 1518 bytes
- Frame rate: Line rate (14.88 Mpps for 1G, 148.8 Mpps for 10G)
- Duration: 5 minutes sustained
- Verification: CheckRates, zero packet loss
\`\`\`

**Mark Sanity=No** (scaling tests are not sanity)

---

### Category 6.5: Corner Cases and Edge Scenarios

**Purpose**: Test unusual, rare, or production-failure scenarios that are often missed.

**QA Networking Engineer Mindset - Ask These Questions**:
1. **Race Conditions**: What happens if two operations occur simultaneously?
   - Configure + unconfigure rapidly
   - Enable feature during traffic burst
   - Failover during configuration change
   
2. **Resource Exhaustion**: What happens when resources run out?
   - FDB table full + new MAC learning
   - Memory full + new feature configuration
   - Maximum VLANs + create one more
   
3. **Failure Scenarios**: What happens when dependencies fail?
   - RADIUS server unreachable
   - TFTP download fails mid-transfer
   - License expires during operation
   - Link flaps during protocol convergence
   
4. **Configuration Conflicts**: What happens with incompatible settings?
   - Feature A + Feature B both enabled (when mutually exclusive)
   - Port in multiple VLANs with conflicting policies
   - QoS policy conflicts
   
5. **Platform-Specific Edge Cases**:
   - Different behavior on BCM vs VSP platforms
   - Chassis vs standalone switch
   - Different ASIC generations
   - Port types (copper vs fiber, 1G vs 10G vs 100G)

**Test Pattern for Corner Cases**:
\`\`\`
#### 6.5.X Verify [specific corner case scenario]

**Objective**: Verify feature handles [unusual scenario] gracefully

**Corner Case Description**: [Explain why this is a corner case and how it might occur in production]

**Topology**: [Appropriate]

**Test Methodology**:
1. Set up conditions for corner case
2. Trigger the unusual scenario
3. Observe system behavior
4. Verify graceful handling (no crash, clear error, or expected behavior)
5. Verify recovery after corner case resolves

**Expected Results**:
- System does not crash or hang
- Clear error messages if operation fails
- Feature recovers gracefully when conditions normalize
- No data corruption or state inconsistency

**Pass Criteria**:
- Graceful failure handling OR
- Correct operation under unusual conditions
- System remains stable

**Sanity**: No (corner cases are advanced tests)
\`\`\`

---

### Category 7: Negative Testing

**Purpose**: Verify error handling and graceful failure.

**Test Pattern**:
- Invalid parameter values
- Missing required parameters
- Invalid command syntax
- Resource exhaustion scenarios
- Conflicting configurations
- Unsupported platform/version operations

**Mark Sanity=Yes** for critical error handling, **Sanity=No** for edge cases

---

### Category 8: Code Implementation Gap Tests

**Optional Category** - Only if Gap Analysis Report provided

**Purpose**: Test code paths not covered by functional spec but found in C source code analysis.

**Test Pattern**:
- Untested branches
- Boundary conditions from implementation
- Error handling paths
- Edge cases in code not documented in spec

---

## 6. Test Execution Guidelines

### 6.1 Test Execution Order
1. Run Sanity tests first (quick validation)
2. Run Category 1 (basic functionality)
3. Run Categories 2-7 in order
4. Run negative tests last

### 6.2 Test Data Requirements
- VLAN IDs: Use 100-199 range
- IP addresses: Use 10.10.X.0/24 networks
- MAC addresses: Use 00:04:96:XX:XX:XX range
- Port assignments: Document clearly in test cases

### 6.3 Cleanup Requirements
- Unconfigure all test configurations
- Remove created VLANs, policies, profiles
- Clear FDB and counters
- Reset ports to default state

## 7. Test Deliverables

- Test plan document (this document)
- Test case execution results
- Bug reports for failures
- Test automation scripts (NOS API tests)
- Test execution logs

## 8. Risks and Mitigation

- Platform-specific limitations
- External dependency availability (RADIUS, TFTP)
- IXIA traffic generator availability
- Test environment stability

---

## TCL FRAMEWORK PORT NAMING CONVENTIONS (MANDATORY)

**CRITICAL**: All test cases MUST use the correct TCL framework port naming — NEVER hardcode port numbers.

### Rule 1: IXIA-Connected Ports → MapDUTPortId
Use [MapDUTPortId ixiaPortId DUTId] for any port where IXIA traffic is injected/received.

\`\`\`tcl
# DUT1 port connected to Ixia logical port 1:
set ixia_port_dut1 [MapDUTPortId 1 1]

# DUT5 port connected to Ixia logical port 10:
set ixia_port_dut5 [MapDUTPortId 10 5]

# Usage in CLI commands:
SendACmd "configure vlan TestVlan add ports [MapDUTPortId 1 1]"
\`\`\`

### Rule 2: DUT-to-DUT / Trunk Ports → GetATrunkPort
Use [GetATrunkPort fromDUT toDUT index] for any port connecting one DUT to another.
This covers: uplinks, LAG members, MLAG ISC ports, FA proxy uplinks.

\`\`\`tcl
# FA Proxy uplink to FA Server:
SendACmd "configure fabric attach uplink [GetATrunkPort 2 1 1]"

# LAG members DUT1↔DUT2 (first and second trunk link):
SendACmd "enable sharing [GetATrunkPort 1 2 1] grouping [GetATrunkPort 1 2 1] [GetATrunkPort 1 2 2] lacp"

# LLDP enable on trunk ports:
SendACmd "enable lldp port [GetATrunkPort 1 2 1]"

# MLAG ISC vlan:
SendACmd "configure vlan ISC-1 add ports [GetATrunkPort 3 4 1] tagged"
SendACmd "enable mlag port [GetATrunkPort 3 5 1] peer DUT-4 id 1001"
\`\`\`

### Rule 3: FA ZTC Topology Port Reference
In the FA Zero Touch Client 5-node topology:
- DUT1 (FA Server) to DUT2 (FA Proxy): GetATrunkPort 1 2 1 / GetATrunkPort 2 1 1 (LAG)
- DUT3 (FA Proxy) to DUT4 (FA Proxy): GetATrunkPort 3 4 1 = ISC port (MLAG peer)
- DUT5 (FA Client) to DUT2: GetATrunkPort 5 2 1 and GetATrunkPort 5 2 2
- DUT5 (FA Client) to MLAG(DUT3/DUT4): GetATrunkPort 5 3 1 and GetATrunkPort 5 3 2
- IXIA connected to DUT1 via [MapDUTPortId 2 1] and to DUT5 via [MapDUTPortId 10 5]

### Rule 4: What NOT to Use
- NEVER use hardcoded port numbers like port 1:1
- NEVER use generic names like DUT1_PORT1 or IXIA_PORT_A — use MapDUTPortId/GetATrunkPort procs
- NEVER use MapDUTPort1 or MapDUTPort2 as variable names — these are NOT framework variables

---

## OUTPUT FORMAT REQUIREMENTS (SWITCH ENGINE STANDARD)

**CRITICAL**: All test cases must follow the Switch Engine format for Excel export compatibility.

1. **Number test cases hierarchically**: 5.1.1, 5.1.2, 5.2.1, etc.
2. **Section Headers**: Use "Methodology" and "Pass Criteria" (NOT "Test Steps" or "Expected Results")
3. **Methodology Format**:
   - Opening description paragraph
   - Use lettered sub-steps (a., b., c., d.) NOT numbered (1., 2., 3.)
   - Include CLI commands with "CLI :" prefix
   - Example format:
     
     **Methodology**:
     Create PTP Ordinary clock and verify the created instance.
     
     a. Create PTP Ordinary clock instance and verify the CLI output.
     CLI : #Create network-clock ptp ordinary
     
     b. Verify the clock is created with show command.
     CLI : #show network-clock ptp

4. **Pass Criteria Format**:
   - Clear, concise statements or numbered verification points
   - Use "Eg :" for example outputs when applicable
   - Example format:
     
     **Pass Criteria**:
     The command should be accepted without any error.
     
     Eg : # show network-clock ptp ordinary
     Clock-Mode: Ordinary

4. **Include topology selection** for each test case
5. **Mark Priority** for each test case (P1 or P2)
6. **Mark Sanity** flag when applicable (Yes/No)

---

## QUALITY STANDARDS

- Each category should have **at least 5-10 test cases** (for STANDARD coverage)
- Test cases must be **detailed enough to execute without ambiguity**
- **Realistic test data** - no placeholder values
- **Clear pass criteria** - binary yes/no evaluation
- **Topology-appropriate** - don't use 5-node for simple config tests
- **API-aware** - reference NOS API endpoints where applicable
- **Traffic-aware** - specify IXIA procedures for traffic tests

Generate the complete test plan now following this structure.`;
  }

  /**
   * Build user prompt with skill file and requirements
   */
  buildUserPrompt(skillFileContent, featureName, coverageLevel, options = {}) {
    let prompt = `# Feature Test Plan Generation Request

**Feature Name**: ${featureName}
**Coverage Level**: ${coverageLevel} (${
  coverageLevel === 'SANITY' ? '20-30 tests' :
  coverageLevel === 'STANDARD' ? '60-100 tests' :
  '120-200 tests'
})

`;

    if (options.jiraStory) {
      prompt += `**JIRA Story**: ${options.jiraStory.id} - ${options.jiraStory.title}\n`;
      if (options.jiraStory.release) {
        prompt += `**Release**: ${options.jiraStory.release}\n`;
      }
      prompt += `\n`;
    }

    // Add structured test plan information if provided
    if (options.testPlanInfo) {
      const info = options.testPlanInfo;
      
      prompt += `## Test Plan Detailed Information (from QA Engineer)

**IMPORTANT**: The following information was collected through a structured questionnaire and contains SPECIFIC VALUES, DEVICE MODELS, and TECHNICAL DETAILS that must be used in the test plan. Do NOT use generic placeholders.

`;

      // Section 1: Basic Information
      if (info.jiraId || info.featureName || info.description) {
        prompt += `### 1. Basic Information\n\n`;
        if (info.jiraId) prompt += `- **Jira ID**: ${info.jiraId}\n`;
        if (info.featureName) prompt += `- **Feature Name**: ${info.featureName}\n`;
        if (info.targetRelease) prompt += `- **Target Release**: ${info.targetRelease}\n`;
        if (info.priority) prompt += `- **Priority**: ${info.priority}\n`;
        if (info.relatedTickets) prompt += `- **Related Tickets**: ${info.relatedTickets}\n`;
        if (info.description) {
          prompt += `\n**Feature Description**:\n${info.description}\n`;
        }
        prompt += `\n`;
      }

      // Section 2: Topology
      if (info.devices && info.devices.length > 0) {
        prompt += `### 2. Test Topology\n\n`;
        prompt += `**Devices** (${info.devices.length} total):\n`;
        info.devices.forEach((device, idx) => {
          prompt += `${idx + 1}. **${device.role}**: ${device.model} (${device.os})\n`;
        });
        if (info.connections) {
          prompt += `\n**Connections**:\n${info.connections}\n`;
        }
        prompt += `\n`;
      }

      // Section 3: Technical Specifications
      prompt += `### 3. Technical Specifications\n\n`;
      if (info.primaryVlan) prompt += `- **Primary VLAN**: ${info.primaryVlan}\n`;
      if (info.testVlans) prompt += `- **Test VLANs**: ${info.testVlans}\n`;
      if (info.mgmtVlan) prompt += `- **Management VLAN**: ${info.mgmtVlan}\n`;
      if (info.primaryNsi) prompt += `- **Primary NSI**: ${info.primaryNsi}\n`;
      if (info.testNsi) prompt += `- **Test NSI Values**: ${info.testNsi}\n`;
      
      if (info.protocolParams) {
        prompt += `\n**Protocol Parameters**:\n\`\`\`\n${info.protocolParams}\n\`\`\`\n`;
      }
      
      if (info.tools && info.tools.length > 0) {
        prompt += `\n**Test Tools**: ${info.tools.join(', ')}\n`;
      }
      prompt += `\n`;

      // Section 4: Feature Behaviors & Test Scenarios
      if (info.positiveBehaviors || info.negativeBehaviors || info.edgeCases) {
        prompt += `### 4. Feature Behaviors & Test Scenarios\n\n`;
        
        if (info.positiveBehaviors) {
          prompt += `**Core Functional Behaviors** (positive scenarios):\n${info.positiveBehaviors}\n\n`;
        }
        
        if (info.negativeBehaviors) {
          prompt += `**Negative Scenarios** (failure/rejection cases):\n${info.negativeBehaviors}\n\n`;
        }
        
        if (info.edgeCases) {
          prompt += `**Edge Cases** (boundary conditions):\n${info.edgeCases}\n\n`;
        }
      }

      // Resilience Testing
      const resilienceTests = [];
      if (info.testReboots) resilienceTests.push('Device reboots');
      if (info.testProcessRestarts) resilienceTests.push('Process restarts');
      if (info.testPortFlaps) resilienceTests.push('Port flaps');
      if (info.testProtocolResets) resilienceTests.push('Protocol resets');
      
      if (resilienceTests.length > 0) {
        prompt += `**Resilience Testing Required**: ${resilienceTests.join(', ')}\n\n`;
      }

      // Scaling
      if (info.maxDevices || info.maxVlans || info.setupTime) {
        prompt += `**Scaling Targets**:\n`;
        if (info.maxDevices) prompt += `- Max Devices: ${info.maxDevices}\n`;
        if (info.maxVlans) prompt += `- Max VLANs: ${info.maxVlans}\n`;
        if (info.setupTime) prompt += `- Setup Time Target: ${info.setupTime}\n`;
        prompt += `\n`;
      }

      // Section 5: Preferences
      if (info.testCaseDepth) {
        prompt += `### 5. Test Plan Preferences\n\n`;
        prompt += `- **Test Case Depth**: ${info.testCaseDepth}\n`;
        
        const depthGuide = {
          'concise': '5-8 steps per test case (official EXOS style, recommended)',
          'detailed': '10-15 steps with detailed verification',
          'hybrid': 'Concise steps with detailed expected results'
        };
        if (depthGuide[info.testCaseDepth]) {
          prompt += `  - ${depthGuide[info.testCaseDepth]}\n`;
        }
        prompt += `\n`;
      }

      // Additional sections
      const additionalSections = [];
      if (info.includeRiskAssessment) additionalSections.push('Risk Assessment & Mitigation');
      if (info.includeExecutionGuide) additionalSections.push('Test Execution Guidelines');
      if (info.includeCLIReference) additionalSections.push('CLI Command Reference Appendix');
      if (info.includeReviewTemplate) additionalSections.push('Review Meeting Template');
      
      if (additionalSections.length > 0) {
        prompt += `**Additional Sections to Include**: ${additionalSections.join(', ')}\n\n`;
      }

      // Configuration notes
      if (info.configsAvailable && info.configNotes) {
        prompt += `**Base Configuration Available**:\n\`\`\`\n${info.configNotes}\n\`\`\`\n\n`;
      }

      // Documentation references
      if (info.functionalSpecUrl || info.prdMrdUrl || info.configGuideUrl) {
        prompt += `**Documentation References**:\n`;
        if (info.functionalSpecUrl) prompt += `- Functional Spec: ${info.functionalSpecUrl}\n`;
        if (info.prdMrdUrl) prompt += `- PRD/MRD: ${info.prdMrdUrl}\n`;
        if (info.configGuideUrl) prompt += `- Config Guide: ${info.configGuideUrl}\n`;
        prompt += `\n`;
      }

      prompt += `---\n\n`;
    }

    // Add unit test plan from dev team if provided
    if (options.unitTestPlan) {
      prompt += `## Unit Test Plan (from Development Team)

**IMPORTANT - QA/Customer Perspective Required**: 
The following unit test plan from the development team provides low-level code coverage. Your functional test plan must:
1. **Focus on END-TO-END scenarios** from a QA and customer perspective
2. **Avoid duplicating unit-level tests** - functional tests should cover higher-level integration and user workflows
3. **Identify gaps** in the unit testing that need functional test coverage
4. **Test realistic customer use cases** not covered by unit tests
5. **Verify system-level integration**, not just component functionality

### Development Team's Unit Test Plan:

\`\`\`
${options.unitTestPlan}
\`\`\`

### Key Guidance:
- **DON'T** recreate unit tests as functional tests - they're different layers
- **DO** create functional tests that verify the feature works in real customer scenarios
- **DO** test integration points, end-to-end workflows, and multi-component interactions
- **DO** test from the CLI/API/GUI perspective that customers will use
- **DO** focus on observable behavior and customer value, not internal code paths

---

`;
    }

    // Add functional one-liner test cases if provided
    if (options.functionalOneliner) {
      prompt += `## Functional One-Liner Test Cases (from User)

**IMPORTANT - Expand into Detailed Test Cases**: 
The user has provided high-level functional one-liner test descriptions. Your task is to:
1. **Expand each one-liner** into a detailed, structured test case following the official format
2. **Add complete Methodology** with lettered sub-steps (a., b., c.) and CLI commands
3. **Add comprehensive Pass Criteria** with expected outputs and examples
4. **Include topology requirements**, preconditions, and priority levels
5. **Ensure proper test case numbering** (5.x.x format)

### User-Provided One-Liners:

\`\`\`
${options.functionalOneliner}
\`\`\`

### Expansion Guidelines:
- **DON'T** just copy the one-liner - expand it into a full test case
- **DO** add detailed methodology steps with actual CLI commands
- **DO** specify concrete values (VLANs, IPs, device models) - use test plan info if available
- **DO** include pass criteria with expected command outputs
- **DO** assign appropriate priority (P1, P2) and sanity flags
- **DO** maintain consistency with the test plan structure and format

---

`;
    }

    // Add topology description if provided (user-written description before file upload)
    if (options.topologyDescription) {
      prompt += `## Custom Topology Description (from User)

**IMPORTANT - Use This Topology in Test Cases**: 
The user has described a specific topology to be used for testing. All test cases must reference and utilize this topology appropriately.

### User-Provided Topology Description:

\`\`\`
${options.topologyDescription}
\`\`\`

### Topology Integration Requirements:
- **Reference this topology** in the Test Environment section
- **Use topology-specific device names/roles** in test cases
- **Align test cases** with the devices and connections described
- **Verify connectivity** and setup steps match this topology
- **Specify which topology elements** are used in each test case (under "Topology used:")

---

`;
    }

    // Add topology information if provided (analyzed from uploaded file)
    if (options.topologyData) {
      const TopologyAnalyzer = require('./topologyAnalyzer');
      const analyzer = new TopologyAnalyzer();
      const topologySection = analyzer.generateTopologyPromptSection(options.topologyData);
      prompt += topologySection;
      prompt += `\n---\n\n`;
    }

    // Add automation context — existing automated test cases that must NOT be duplicated
    if (options.automationContext) {
      const ac = options.automationContext;
      const tcList = (ac.existing_test_cases || [])
        .map(tc => `- **${tc.id}**: ${tc.title}`)
        .join('\n');
      const procList = (ac.lib_procs || []).slice(0, 50).join(', ');
      prompt += `## AUTOMATION SCRIPTS: EXISTING TEST COVERAGE — DO NOT DUPLICATE

**Automation Folder**: \`${ac.folder}\`
**Total Existing Automated Test Cases**: ${ac.existing_test_cases?.length || 0}

The following test cases ALREADY EXIST in the functional automation scripts and are currently automated.
**YOUR TEST PLAN MUST NOT DUPLICATE ANY OF THESE TEST CASES.**

### Already Automated Test Cases (DO NOT RECREATE THESE):
${tcList || '(none found)'}

### Available TCL Library Procs (reference in automation steps):
${procList || '(none found)'}

### MANDATORY ANTI-DUPLICATION RULES:
1. **NEVER** generate a test case covering the same scenario as any ID listed above
2. **NEVER** generate minor variations or rephrasings of existing automated test cases
3. **ONLY** generate test cases for scenarios NOT already covered by the automation above
4. Mark automation coverage explicitly: where an existing test covers a scenario, write "(Already Automated: TC X.Y.Z)"
5. Your test plan should COMPLEMENT and EXTEND the existing automation — not repeat it
6. In the Test Objectives section, mark which objectives are already covered by existing automation

---

`;

      // Inject automation skill file (framework procs, patterns) if available
      if (ac.automation_skill) {
        prompt += `## Automation Framework Reference (Skill File for ${ac.folder})

The following skill file documents the automation procs, patterns, and topology used in this test module.
Use this to write accurate TCL steps in new test cases.

\`\`\`markdown
${ac.automation_skill.substring(0, 6000)}
\`\`\`

---

`;
      }
    }

    // Add user instructions if provided
    if (options.userInstructions) {
      prompt += `## User Instructions & Requirements

The QA Engineer has provided the following specific instructions and requirements for this test plan:

\`\`\`
${options.userInstructions}
\`\`\`

**IMPORTANT**: These instructions take priority and must be incorporated into the test plan generation. Pay special attention to:
- Specific test scenarios mentioned
- Device roles and configuration requirements
- Integration testing requirements
- Special topology considerations
- Any other specific guidance provided

---

`;
    }

    prompt += `## Functional Specification (Skill File)

The following skill file contains the complete functional specification for this feature:

\`\`\`markdown
${skillFileContent}
\`\`\`

---

`;

    // Add NOS REST API context if available
    if (options.nosApiContext) {
      prompt += `## NOS REST API Endpoints (from nos-openapi.yaml)

The following REST API endpoints are relevant for this feature. **Generate dedicated API test cases** for each endpoint below.

${options.nosApiContext}

---

`;
    }

    prompt += `## Instructions

Based on the above functional specification${options.testPlanInfo ? ' and the detailed test plan information provided' : ''}${options.unitTestPlan ? ', considering the unit test coverage from the dev team' : ''}:

1. **Analyze the feature** to determine:
   - CLI commands and parameters
   - Dependencies (VLAN, traffic, external servers)
   - State machines (if stateful)
   - Scalability limits
   - Integration points

2. **Select appropriate topologies** for each test:
   - Single-node: Configuration and show commands
   - 2-node: Port-based tests, L2/L3 forwarding
   - 5-node: Routing protocols, complex topologies
${options.testPlanInfo && options.testPlanInfo.devices ? `   - **USE THE SPECIFIC DEVICE MODELS PROVIDED**: ${options.testPlanInfo.devices.map(d => `${d.model} (${d.role})`).join(', ')}` : ''}

3. **Generate test cases** for applicable categories:
${coverageLevel === 'SANITY' ? '   - Category 1: Basic Functionality\n   - Category 7: Key Negative Tests' :
  coverageLevel === 'STANDARD' ? '   - Category 1: Basic Functionality\n   - Category 2: Boundary Values\n   - Category 4: Switch Events\n   - Category 5: Integration\n   - Category 7: Negative Tests' :
  '   - All 7 categories (1-7)'
}

4. **Include API test details** where applicable:
   - REST API endpoints (use nosApiPayloadGenerator for payloads)
   - Verification APIs
   - Expected responses

5. **Include traffic test details** where needed:
   - IXIA traffic generation procedures
   - Expected forwarding behavior
   - Counter verification

6. **Mark Sanity tests** appropriately:
   - Sanity=Yes for critical basic tests
   - Sanity=No for advanced/edge case tests

${options.testPlanInfo ? `
**CRITICAL REQUIREMENTS**:
- Use the SPECIFIC values provided (VLAN ${options.testPlanInfo.primaryVlan}, NSI ${options.testPlanInfo.primaryNsi}, etc.)
- Reference the EXACT device models provided (not generic "DUT" or "Switch")
- Follow the test case depth preference: ${options.testPlanInfo.testCaseDepth || 'concise'}
- Include complete CLI configurations for each device as specified
- Create test cases for ALL behaviors listed in Section 4
- Use official EXOS Functional Test Plan format with numbered sections (5.1.1, 5.1.2, etc.)
${options.unitTestPlan ? '- **QA/CUSTOMER PERSPECTIVE**: Design functional tests from end-user viewpoint, not internal code testing. Focus on customer workflows and integration scenarios, not unit-level component testing.' : ''}
` : ''}

Generate the complete test plan now.`;

    return prompt;
  }

  /**
   * Main method: Generate test plan
   */
  async generateTestPlan(options) {
    const {
      featureName,
      skillFileContent,
      coverageLevel = 'STANDARD', // SANITY | STANDARD | COMPREHENSIVE
      jiraStory = null,
      gapAnalysis = null, // Optional: from bug hunter agent
      previousTestPlan = null, // Optional: for enhancements/existing functional test plan
      testPlanInfo = null, // Optional: structured info from questionnaire
      unitTestPlan = null, // Optional: unit test plan from dev team
      functionalOneliner = null, // Optional: functional one-liner test cases from user
      topologyData = null, // Optional: analyzed topology from uploaded file
      topologyDescription = null, // Optional: user-provided topology description
      userInstructions = null, // Optional: user instructions/requirements
      automationContext = null, // Optional: existing automation scripts context (avoids duplication)
      streaming = false,
      onChunk = null
    } = options;

    console.log('=== Test Plan Generator Agent ===');
    console.log('Feature:', featureName);
    console.log('Coverage Level:', coverageLevel);
    console.log('Gap Analysis provided:', !!gapAnalysis);
    console.log('Previous Test Plan provided:', !!previousTestPlan);
    console.log('Test Plan Info provided:', !!testPlanInfo);
    console.log('Unit Test Plan provided:', !!unitTestPlan);
    console.log('Functional One-Liner provided:', !!functionalOneliner);
    console.log('Topology Data provided:', !!topologyData);
    console.log('Topology Description provided:', !!topologyDescription);
    console.log('User Instructions provided:', !!userInstructions);
    console.log('Automation Context provided:', !!automationContext, automationContext ? `(${automationContext.existing_test_cases?.length || 0} existing TCs in ${automationContext.folder})` : '');

    try {
      // Step 1: Load TCL framework documentation
      const tclDocs = this.loadTclFrameworkDocs();

      // Step 2: Load feature-specific skill (if not provided)
      let skillContent = skillFileContent;
      if (!skillContent) {
        const skill = this.loadFeatureSkill(featureName);
        skillContent = skill?.content || '';
      }

      if (!skillContent) {
        throw new Error('No skill file content provided or found for feature');
      }

      // Step 3: Build prompts
      const isEnhancement = !!previousTestPlan;
      const systemPrompt = this.buildSystemPrompt(tclDocs, coverageLevel, isEnhancement);

      // Extract NOS REST API endpoints for this story
      const nosApiContext = jiraStory ? extractRelevantNosApis(jiraStory) : null;

      const userPrompt = this.buildUserPrompt(skillContent, featureName, coverageLevel, {
        jiraStory,
        gapAnalysis,
        previousTestPlan,
        testPlanInfo,
        unitTestPlan,
        functionalOneliner,
        topologyData,
        topologyDescription,
        userInstructions,
        automationContext,
        nosApiContext
      });

      console.log('System prompt length:', systemPrompt.length);
      console.log('User prompt length:', userPrompt.length);

      // Step 4: Call LLM to generate test plan
      console.log('Calling LLM to generate test plan...');
      
      const result = await callLLM(systemPrompt, userPrompt, streaming, onChunk);

      console.log('Test plan generation completed');
      console.log('Generated content length:', result ? result.length : 0);

      return {
        success: true,
        content: result,
        metadata: {
          featureName,
          coverageLevel,
          jiraStory: jiraStory ? {
            id: jiraStory.id,
            title: jiraStory.title
          } : null,
          tclFrameworkLoaded: !!(tclDocs.topologies || tclDocs.trafficPatterns || tclDocs.switchEvents),
          gapAnalysisIncluded: !!gapAnalysis,
          testPlanInfoIncluded: !!testPlanInfo,
          unitTestPlanIncluded: !!unitTestPlan,
          functionalOnelinerIncluded: !!functionalOneliner,
          topologyDataIncluded: !!topologyData,
          topologyDescriptionIncluded: !!topologyDescription,
          userInstructionsIncluded: !!userInstructions,
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Test plan generation error:', error);
      return {
        success: false,
        error: error.message,
        metadata: {
          featureName,
          failedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Validate generated test plan
   */
  validateTestPlan(content) {
    const validation = {
      valid: true,
      missingSections: [],
      testCaseCount: 0,
      sanityCaseCount: 0,
      warnings: []
    };

    // Check for required sections
    const requiredSections = [
      'Introduction',
      'Test Scope',
      'Test Environment Setup',
      'Testing Tools',
      'Test Cases',
      'Category 1: Basic Functionality',
      'Category 2: Boundary Value'
    ];

    for (const section of requiredSections) {
      const regex = new RegExp(section, 'i');
      if (!regex.test(content)) {
        validation.valid = false;
        validation.missingSections.push(section);
      }
    }

    // Count test cases
    const testCaseMatches = content.match(/####\s+\d+\.\d+\.\d+/g) || [];
    validation.testCaseCount = testCaseMatches.length;

    // Count sanity tests
    const sanityMatches = content.match(/Sanity:\s*Yes/gi) || [];
    validation.sanityCaseCount = sanityMatches.length;

    // Warnings
    if (validation.testCaseCount < 10) {
      validation.warnings.push('Test plan has fewer than 10 test cases');
    }

    if (validation.sanityCaseCount === 0) {
      validation.warnings.push('No sanity tests marked');
    }

    if (!content.includes('Topology:')) {
      validation.warnings.push('No topology specifications found');
    }

    return validation;
  }
}

module.exports = TestPlanGenerator;
