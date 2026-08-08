# Test Plan Evaluation Guide
## How to Use the Evaluation Feature in Stage 3

**Version**: 2.0  
**Last Updated**: 2026-07-25  
**Purpose**: Quick reference guide for using the test plan quality evaluation feature

---

## 📋 Overview

The **Test Plan Evaluation** feature automatically assesses the quality of AI-generated test plans against EXOS production standards. It provides a comprehensive score, identifies strengths, and suggests improvements.

---

## 🚀 How to Use

### Step 1: Generate Test Plan
1. Navigate to **Stage 3: Test Plan Generation**
2. Fill in the required information (JIRA ID, feature details, coverage level)
3. Click **"Generate Test Plan"**
4. Wait for the test plan to be generated

### Step 2: Run Evaluation
1. Once the test plan is generated, click the **"Evaluate Quality"** button
2. The evaluation will analyze:
   - Format & Structure (20%)
   - Content Quality (25%)
   - Test Coverage (30%)
   - Completeness (15%)
   - Professional Quality (10%)

### Step 3: Review Results
The evaluation display shows:
- **Overall Grade**: Excellent, Good, Acceptable, Needs Work, or FAIL
- **Score**: 0-100 points
- **Category Breakdown**: Detailed scores for each evaluation dimension
- **Strengths**: What the test plan does well
- **Improvements**: Specific recommendations for enhancement
- **Metrics**: Test case count, coverage statistics, etc.

### Step 4: Take Action
Based on the evaluation:
- **Score ≥ 90 (Excellent)**: Approve and proceed
- **Score 75-89 (Good)**: Minor improvements, then approve
- **Score 60-74 (Acceptable)**: Address key improvements, re-evaluate
- **Score < 60 (Needs Work/FAIL)**: Regenerate with improvements or major edits needed

---

## 🎯 Evaluation Criteria Summary

### Critical Requirements (Must-Have)
❌ **Automatic FAIL if ANY are missing:**
1. Test case numbering uses **5.x.x format** (NOT TC-001)
2. **Sanity flag** present on EVERY test case
3. **Pass Criteria** included for EVERY test case
4. At least ONE test case present
5. Feature name and JIRA ID clearly identified
6. Test topology defined
7. No placeholder text (TBD, TODO, [Fill in])
8. Test methodology has actionable steps

### Section Headers (New Standard)
✅ **Required Format:**
```markdown
#### 5.2.1.1 Test Case Title

**Topology used**: Single-node / 2-node / 5-node / Topology-1

**Methodology**:
[Opening description paragraph]

a. [First step]
CLI : #command

b. [Second step]
CLI : #command

**Pass Criteria**:
[Clear statement of expected outcome]

Eg : [Example output]

**Priority**: P1 / P2
**Sanity**: Yes / No
```

❌ **DO NOT USE:**
- ~~**Test Steps:**~~ (Old format - now use **Methodology**)
- ~~**Expected Results:**~~ (Old format - now use **Pass Criteria**)

---

## 📊 Scoring Breakdown

### 1. Format & Structure (20%)
- ✅ Test case numbering (5.x.x format)
- ✅ Section structure (Methodology, Pass Criteria)
- ✅ Sanity flags on all tests
- ✅ Pass criteria format

### 2. Content Quality (25%)
- ✅ Specific values (VLANs, NSIs, IPs, device models)
- ✅ CLI commands included
- ✅ Realistic test data (no placeholders)
- ✅ Actionable methodology steps

### 3. Test Coverage (30%)
- ✅ Feature scenarios covered
- ✅ Negative testing included
- ✅ Edge cases addressed
- ✅ Integration/resilience tests
- ✅ Appropriate test distribution

### 4. Completeness (15%)
- ✅ All required sections present
- ✅ Topology clearly defined
- ✅ Prerequisites documented
- ✅ Test environment specified

### 5. Professional Quality (10%)
- ✅ Clear, professional language
- ✅ Consistent formatting
- ✅ Proper grammar and spelling
- ✅ Logical organization

---

## 🔄 Re-evaluation

After making improvements to your test plan:
1. Click **"Re-evaluate"** button
2. Compare new score with previous score
3. Verify improvements addressed the recommendations
4. Repeat until score is acceptable (≥ 60) or excellent (≥ 90)

---

## 📈 Common Issues and Fixes

### Issue 1: Low Format Score
**Problem**: Test cases use wrong numbering or missing sanity flags  
**Fix**: 
- Change TC-001 to 5.1.1
- Add `**Sanity**: Yes/No` to every test case
- Ensure consistent section headers (Methodology, Pass Criteria)

### Issue 2: Low Content Score
**Problem**: Generic or placeholder values  
**Fix**:
- Replace "VLAN ID" with specific "VLAN 4048"
- Replace "management NSI" with specific "NSI 15999999"
- Add actual CLI commands instead of generic descriptions
- Include device model numbers (e.g., X670G2, 5520-24T)

### Issue 3: Low Coverage Score
**Problem**: Only positive test cases, missing edge cases  
**Fix**:
- Add negative test cases (invalid inputs, error conditions)
- Include boundary testing (min/max values)
- Add resilience tests (reboot, failover, link down)
- Ensure all feature aspects are tested

### Issue 4: Low Completeness Score
**Problem**: Missing sections or incomplete topology  
**Fix**:
- Add Introduction, Scope, Setup sections
- Define topology with device models and connections
- Include prerequisites and test environment details
- Document testing tools (IXIA, CLI, API)

### Issue 5: Low Quality Score
**Problem**: Vague steps, unclear language  
**Fix**:
- Make methodology steps specific and actionable
- Use clear, professional language
- Fix grammar and spelling errors
- Organize test cases logically by category

---

## 💡 Best Practices

### For Excellent Scores (90+)
1. **Use lettered sub-steps** (a., b., c.) in Methodology
2. **Include CLI commands** with "CLI :" prefix
3. **Specify exact values** (VLAN 4048, NSI 15999999, IP 192.168.1.10)
4. **Reference device models** (X670G2, 5520-24T, X690-48x-2c-F)
5. **Add examples** in Pass Criteria with "Eg :" prefix
6. **Mark 40-60% as Sanity: Yes** (critical path tests)
7. **Cover all 7 test categories** (Basic, Negative, Scale, etc.)
8. **Include cross-references** (refer to testcase 5.2.1)

### For Good Scores (75-89)
1. Ensure all test cases have proper format
2. Add specific values where possible
3. Include most CLI commands
4. Cover main scenarios and negative cases
5. Define topology clearly

### For Acceptable Scores (60-74)
1. Fix critical issues (numbering, sanity flags)
2. Add missing sections
3. Replace placeholder text
4. Improve methodology clarity

---

## 📁 Related Documents

- **TEST_PLAN_EVALUATION_CRITERIA.md** - Detailed scoring criteria
- **TEST_PLAN_GENERATION_GUIDELINES.md** - How to generate quality test plans
- **TEST_PLAN_DETAILED_TEMPLATE.md** - Test plan template structure

---

## 🎓 Training Examples

### Example 1: Excellent Test Case (95+ points)
```markdown
#### 5.2.1.1 Verify VLAN/NSI mapping creation on FA Proxy

**Topology used**: Topology-1 (X670G2 proxy + X590 server + 5520-24T client)

**Methodology**:
Configure DUT1 (X670G2) and DUT2 (X670G2) as MLAG proxy peers. 
Create VLAN 4048 to NSI 15999999 mapping on FA client (5520-24T).

a. Configure MLAG on DUT1 and DUT2 with ISC port 1:49-50.
CLI : #configure virtual-switch "MLAG" peer 1:49-50

b. Enable Fabric Attach proxy mode on both MLAG peers.
CLI : #enable fabric attach
CLI : #configure fabric attach role proxy

c. Send LLDP TLV from client with VLAN 4048:NSI 15999999 mapping.

d. Verify dynamic VLAN created on proxy authenticator.
CLI : #show vlan

**Pass Criteria**:
1. MLAG peer status shows UP
2. DUT with highest ISC IP becomes authenticator
3. Dynamic VLAN 4048 created on authenticator
4. ISC port added to VLAN 4048
5. VLAN/NSI mapping visible: show fabric attach assignments

Eg : show fabric attach assignments
Port     VLAN    NSI        Type      State
1:1      4048    15999999   Dynamic   Accepted

**Priority**: P1
**Sanity**: Yes
```

### Example 2: Poor Test Case (40 points)
```markdown
#### TC-001: Test FA Proxy

**Steps**:
1. Configure the system
2. Test the feature
3. Verify it works

**Expected Results**:
Feature should work properly

**Priority**: TBD
```

**Issues**:
- ❌ Wrong numbering format (TC-001)
- ❌ No topology specified
- ❌ Vague methodology
- ❌ No CLI commands
- ❌ No sanity flag
- ❌ Placeholder text (TBD)
- ❌ Wrong section headers (Steps, Expected Results)

---

## 📞 Support

For questions or issues with the evaluation feature:
1. Check **TEST_PLAN_EVALUATION_CRITERIA.md** for detailed criteria
2. Review **TEST_PLAN_GENERATION_GUIDELINES.md** for generation tips
3. Examine **SKILL_FILE_STRUCTURE.md** for upstream improvements
4. Contact QA team for standards clarification

---

**Remember**: The evaluation is a tool to help improve test plan quality. Use it iteratively to refine your test plans until they meet production standards!
