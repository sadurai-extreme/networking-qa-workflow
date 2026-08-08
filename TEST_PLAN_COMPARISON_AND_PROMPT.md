# Test Plan Comparison & Complete Prompt Template

## 📊 Comparison: AI-Generated vs Official Test Plan

### Official Test Plan Structure (EXOS_33_7-Fabric Attach fallback mgmt vlan FTP.docx)

```
EXOS Functional Test Plan
├── 1. General Information
│   ├── Overview
│   ├── Feature Highlights
│   ├── Use Cases
│   ├── Deliverables and Limitations
│   ├── Terminology and Acronyms
│   ├── References and supporting documents
│   └── Topology (ASCII diagram with device models)
├── 2. Set up and Configurations
│   ├── FA Server (FE) — SPBM Configuration (full CLI commands)
│   ├── Static MLT on FA Server
│   ├── FA Server — No Mgmt VLAN TLV
│   ├── FA Server — With Mgmt VLAN TLV
│   ├── FA Proxy (EXOS DUT) — ZTP Bootstrap
│   └── Tools (IXIA)
├── 3. Test Cases
│   ├── 5.1 Conformance to Industry Standard
│   ├── 5.2 Feature Adherence to Functional Spec
│   │   ├── 5.2.1 FE without Onboarding VLAN — creates 4048, NSI 15999999
│   │   ├── 5.2.2 FE has MLT — creates 4048 on LAG port
│   │   ├── 5.2.3 Proxy creates 4048 — disable auto-provision
│   │   ├── 5.2.4 Client with same 4048 — proxy has both
│   │   ├── 5.2.5 FE without SPBM — proxy retries
│   │   ├── 5.2.6 FE auto-sense — NSI rejected
│   │   ├── 5.2.7 FE Server Rejects — disable auto-provision
│   │   └── 5.2.8 FE Advertises Mgmt VLAN — No Fallback
│   ├── 5.3 Feature Adherence to PRD/MRD
│   ├── 5.4 Feature Configuration - CLI & Network Mgmt Tool
│   ├── 5.5 SNMP MIB Verification
│   ├── 5.6 Redundancy/Resiliency/Failover
│   │   ├── 5.6.1 Reboot proxy with save — VLAN removed
│   │   ├── 5.6.2 Reboot proxy without save — VLAN recreated
│   │   ├── 5.6.3 Reboot client with save
│   │   ├── 5.6.4 restart process lldp
│   │   ├── 5.6.5 disable & enable server port
│   │   ├── 5.6.6 clear lldp neighbour
│   │   └── 5.6.7 restart ports all
│   ├── 5.7 Feature Scaling & Feature Limit Testing
│   ├── 5.8 Feature Performance
│   ├── 5.9 Integrated Feature Scaling & Limit Testing
│   ├── 5.10 Integrated Feature Performance
│   ├── 5.11 Interoperability - Extreme & 3rd Party
│   ├── 5.12 Diagnostic & Debug Testing
│   ├── 5.13 Usability Testing
│   ├── 5.14 Negative Testing
│   └── 5.15 System Resource & Stress testing
├── 6. Appendix A: References
├── 7. Appendix B: Minutes of Test Plan Review Meeting
└── 8. Review Meeting Action Items
```

---

## 🔍 Key Differences

### ✅ What the Official Plan Has (That Mine Didn't)

| Feature | Official Plan | My AI-Generated Plan |
|---------|---------------|---------------------|
| **Device Models** | Specific: 5720 FE, 5520 EXOS, WAP | Generic: "FA Server", "FA Proxy", "FA Client" |
| **VLAN/NSI Values** | Exact: VLAN 4048, NSI 15999999 | Generic: VLAN 10, 20, 100 |
| **Setup Configurations** | ✅ Full CLI commands for SPBM, MLT, FA | ❌ Missing (only mentioned prerequisites) |
| **Test Case Numbering** | ✅ 5.2.1, 5.2.2, 5.6.1 format | ✅ TC-FA-001, TC-FA-002 format |
| **Sanity Flag** | ✅ Sanity (Yes/No) per test case | ❌ Missing |
| **Cross-Reference** | ✅ "per testcase 5.2.1" | ❌ No cross-references |
| **Tools Section** | ✅ IXIA for traffic generation | ✅ Mentioned in test environment |
| **Review Meeting** | ✅ Minutes & Action Items sections | ❌ Missing |
| **Test Categories** | ✅ Industry Standard, PRD/MRD, SNMP, etc. | ✅ Functional, Performance, Negative |
| **Test Case Format** | Topology Used, Methodology, Pass Criteria | Objective, Prerequisites, Steps, Expected Results |

### ✅ What My Plan Has (That Official Didn't)

| Feature | My AI-Generated Plan | Official Plan |
|---------|---------------------|---------------|
| **Detailed Expected Results** | ✅ Comprehensive pass/fail criteria | ⚠️ "Verify as per methodology" |
| **Risk Assessment** | ✅ Risk matrix with mitigation | ❌ Missing |
| **Success Criteria** | ✅ Functional, Performance, Stability | ❌ Missing |
| **CLI Command Reference** | ✅ Appendix with all commands | ⚠️ Inline in test cases |
| **Test Execution Guidelines** | ✅ Pre/During/Post checklists | ❌ Missing |
| **Performance Metrics** | ✅ Specific timing and load targets | ❌ Missing |
| **Test Summary Table** | ✅ Ready-to-use tracking table | ❌ Missing |

---

## 🎯 The Perfect Prompt Template

Use this prompt to generate **Extreme Networks-style test plans** that match official standards:

````markdown
# COMPLETE PROMPT TEMPLATE FOR EXTREME NETWORKS TEST PLANS

Generate a comprehensive Functional Test Plan (FTP) for the following Extreme Networks EXOS feature:

---

## PART 1: FEATURE INFORMATION (REQUIRED)

**Jira Ticket**: [EXOS-XXXXX]
**Feature Name**: [Exact feature name]
**Feature Description**: 
```
[Paste Jira description here, including:
 - Overview paragraph
 - Key behavior points (numbered list)
 - Background on previous implementations
 - Any customer impacts or use cases]
```

**Target Release**: EXOS [version]
**Priority**: [P0/P1/P2/P3]

**Related Features/Background**:
- Previous ticket: EXOS-XXXXX (description)
- Dependencies: [list]

---

## PART 2: TECHNICAL SPECIFICATIONS (REQUIRED)

### Topology
Provide:
- Specific device models (e.g., "5720 FE", "5520 EXOS", "WAP")
- ASCII topology diagram showing connections
- Port assignments (e.g., "1:49 trunk", "1:1 access")

### Configuration Details
Specify:
- VLAN IDs used (e.g., VLAN 4048)
- NSI/ISID values (e.g., NSI 15999999)
- Protocol parameters (e.g., SPBM BVLAN 4051, 4052)
- CLI commands for base setup

### Tools
- Traffic generators (e.g., IXIA)
- Debug tools
- Monitoring tools

---

## PART 3: TEST PLAN STRUCTURE (REQUIRED)

Generate the test plan with the following structure:

### 1. General Information
- Overview (2-3 paragraphs)
- Feature Highlights (bullet points)
- Use Cases (real-world scenarios)
- Deliverables and Limitations
- Terminology and Acronyms
- References (functional spec, MRD, related docs)
- Topology (ASCII diagram)

### 2. Set up and Configurations
**CRITICAL**: Include complete CLI commands for:
- FA Server configuration (SPBM, MLT, FA enable)
- FA Proxy configuration (ZTP, FA enable)
- FA Client configuration
- Baseline configs for all devices

### 3. Test Cases

Organize test cases into these categories:

**5.1 Conformance to Industry Standard**
- Placeholder section

**5.2 Feature Adherence to Functional Spec**
- 8-12 core functional test cases
- Cover positive, negative, and edge cases
- Each test case must include:
  - Test Case Number (5.2.1, 5.2.2, etc.)
  - Short descriptive name (50 chars max)
  - Topology used: [reference]
  - Methodology: (numbered steps)
  - Pass Criteria: "Verify as per the testing methodology"
  - Sanity (Yes/No): [Yes for critical tests]

**5.3 Feature Adherence to PRD/MRD**
- Placeholder section

**5.4 Feature Configuration - CLI & Network Mgmt Tool**
- Placeholder section

**5.5 SNMP MIB Verification**
- Placeholder section

**5.6 Redundancy/Resiliency/Failover**
- 6-8 test cases covering:
  - Reboots (with/without save)
  - Process restarts
  - Port disable/enable
  - LLDP operations
  - Failover scenarios

**5.7-5.15**: Placeholder sections for:
- Feature Scaling & Limit Testing
- Feature Performance
- Integrated Scaling
- Integrated Performance
- Interoperability
- Diagnostic & Debug
- Usability
- Negative Testing
- System Resource & Stress

### 4. Appendices
- Appendix A: References (list all docs)
- Appendix B: Minutes of Test Plan Review Meeting (template)
- Review Meeting Action Items (table)

---

## PART 4: TEST CASE REQUIREMENTS (CRITICAL)

### Test Case Format (Use This Exactly):

```
#### 5.2.X [Short Test Name]

**Topology used**: Topology-1

**Methodology:**
1. [Step 1 - specific action with CLI command]
2. [Step 2 - verification with show command]
3. [Step 3 - expected observation]
4. [Step 4 - next action]
... (continue)

**Pass Criteria:**
Verify as per the testing methodology.

**Sanity (Yes/No)**: [Yes/No]
```

### Test Case Guidelines:
1. **Use exact values from implementation**
   - Specific VLANs (e.g., 4048, not "mgmt VLAN")
   - Specific NSI values (e.g., 15999999)
   - Specific device models

2. **Cross-reference previous test cases**
   - Example: "On Proxy, trigger fallback VLAN 4048 creation per testcase 5.2.1"

3. **Mark Sanity tests**
   - Yes = Critical path, must run
   - No = Important but not critical

4. **Keep test cases focused**
   - 5-8 methodology steps max
   - One primary objective per test case

---

## PART 5: SPECIFIC FEATURE BEHAVIORS TO TEST (CUSTOMIZE)

For **EXOS-39334**, test:
1. ✅ Fallback VLAN 4048 created ONLY when ZTP is AUTO_IN_PROGRESS
2. ✅ Client ports added to VLAN 4048 only on NSI 15999999 approval
3. ✅ Proxy retries NSI signaling while ZTP active (server reject)
4. ✅ No VLAN forwarding to clients on NSI rejection
5. ✅ VLAN persists until reboot or server override
6. ✅ Works with MLT/Auto-LAG
7. ✅ Handles server with/without SPBM
8. ✅ Handles server advertising mgmt VLAN (no fallback)
9. ✅ Resilience: reboots, process restarts, port flaps
10. ✅ Cleanup on save/no-save scenarios

---

## EXAMPLE OUTPUT FORMAT

```
EXOS Functional Test Plan
• FA Fallback Mgmt VLAN Auto-Creation in Proxy

General Information

Overview:
[2-3 paragraph feature description]

Feature Highlights:
• Fallback mgmt VLAN 4048 auto-created only when ZTP is in AUTO_IN_PROGRESS state
• Client ports added to VLAN 4048 only after FA server approves NSI 15999999
• Proxy retries NSI signaling while ZTP is active if server rejects

[... continue with full structure ...]
```

---

## CHECKLIST FOR COMPLETE PROMPT

Before submitting the prompt, ensure you have:

- [ ] Jira ticket ID and full description
- [ ] Specific VLAN IDs and NSI values from implementation
- [ ] Device models (e.g., 5720, 5520)
- [ ] ASCII topology diagram
- [ ] Base configuration CLI commands
- [ ] List of behaviors to test (numbered)
- [ ] Related ticket references
- [ ] Functional specification link
- [ ] Target release version
- [ ] Use case descriptions

---

## ADDITIONAL TIPS FOR BEST RESULTS

1. **Be specific with values**: Use actual VLAN IDs, NSI values, device models
2. **Include CLI setup**: Complete configuration commands save test setup time
3. **Cross-reference tests**: Link related test cases for efficient execution
4. **Mark sanity tests**: Helps prioritize test execution
5. **Use official structure**: Follow 5.1-5.15 category numbering
6. **Keep methodology concise**: 5-8 steps with clear verification points
7. **Reference real topology**: Use actual lab equipment available
8. **Include review sections**: Placeholders for test plan review meetings

---

## SAMPLE COMPLETE PROMPT

```markdown
Generate a comprehensive EXOS Functional Test Plan (FTP) for EXOS-39334.

**FEATURE INFORMATION:**
- Jira: EXOS-39334
- Name: Fabric Attach - Auto creation of fallback mgmt vlan in proxy
- Description:
  With EXOS-38257, we added support of fallback management vlan in FA proxy if the FA server 
  is not sending one. This disturbed some customers who used different management VLANs. 
  To address this:
  1. Create fallback mgmt VLAN only when ZTP is running
  2. Add client ports to mgmt VLAN only if server approves NSI
  3. If server rejects NSI, keep retrying while ZTP is active
  4. Do not forward mgmt VLAN to clients if server rejects NSI
  5. If server accepts, add ports, advertise VLAN, keep until reboot or server override
- Target Release: EXOS 33.7
- Priority: P2 - High
- Background: EXOS-38257 introduced fallback VLAN which caused customer issues

**TOPOLOGY:**
```
+----------+         +----------+         +----------+
| FA Server|  trunk  | FA Proxy |  access | FA Client|
|  (VOSS)  |---------|  (EXOS)  |---------|  (WAP)   |
| 5720 FE  |  1:49   | 5520 DUT |  1:1    |          |
+----------+         +----------+         +----------+
```

**TECHNICAL SPECS:**
- Fallback VLAN ID: 4048
- Fallback NSI: 15999999
- SPBM BVLAN: 4051, 4052
- Test VLANs: 1000 (NSI 10000)
- Tools: IXIA for traffic generation

**CONFIGURATION REQUIREMENTS:**
Include complete CLI for:
1. FA Server (FE) — SPBM setup (run spbm script)
2. FA Server — MLT configuration
3. FA Server — With/without mgmt VLAN TLV
4. FA Proxy — ZTP bootstrap (unconfigure switch all)
5. FA Client — VLAN creation

**TEST CATEGORIES:**
- 5.2 Feature Adherence to Functional Spec (8 test cases)
  - FE without mgmt VLAN → proxy creates 4048
  - FE with MLT → proxy creates 4048 on LAG
  - Disable auto-provision behavior
  - Client with same VLAN 4048
  - FE without SPBM → retries
  - FE auto-sense rejection
  - Server rejects → disable auto-provision
  - Server advertises VLAN → no fallback

- 5.6 Redundancy/Resiliency/Failover (7 test cases)
  - Reboot proxy with save → VLAN removed
  - Reboot proxy without save → VLAN recreated
  - Reboot client scenarios
  - restart process lldp
  - disable/enable port
  - clear lldp neighbour
  - restart ports all

**FORMAT:**
- Use exact official FTP structure
- Test case numbers: 5.2.1, 5.2.2, etc.
- Include: Topology Used, Methodology, Pass Criteria, Sanity flag
- Keep methodology concise (5-8 steps)
- Cross-reference test cases where applicable
- Mark critical tests as Sanity: Yes
```

---

## 📝 NOTES

**When to use Official Style:**
- Formal test plan for release qualification
- Test plan review meetings
- QA team execution in lab
- Documentation for certification

**When to use Detailed Style (my original):**
- Exploratory testing
- Performance benchmarking
- Risk assessment
- Training new QA engineers
- Complex feature validation

**Best Approach:**
Combine both! Use official structure with detailed step-by-step verification from my approach.

---

*Created: 2026-07-06*
*Purpose: Guide for generating Extreme Networks-compliant test plans*
````
