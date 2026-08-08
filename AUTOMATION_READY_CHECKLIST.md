# Automation-Ready Test Plan Checklist
## **Validate EVERY test plan before finalization**

**Version**: 1.0  
**Date**: 2026-07-07  
**Purpose**: Ensure 95%+ automation readiness for all test plans  
**Based on**: EXOS-39208 v3.1 (gold standard)

---

## 📋 **PRE-GENERATION CHECKLIST**

### **1. Requirements Gathering** ✅

- [ ] **Jira ticket** fetched with complete details
- [ ] **Feature documentation** analyzed:
  - [ ] CLI syntax verified (CRITICAL - never assume!)
  - [ ] Feature behavior understood
  - [ ] Use cases documented
- [ ] **Code commits** reviewed (if available):
  - [ ] Search repos for CLI implementation
  - [ ] Find actual command parsing logic
  - [ ] Identify show command output format
- [ ] **Existing automation scripts** examined (if accessible):
  - [ ] SSH to automation server
  - [ ] Navigate to feature area scripts
  - [ ] Analyze traffic patterns, counter validation, drop logic
- [ ] **Reference template** reviewed:
  - [ ] TEST_PLAN_DETAILED_TEMPLATE.md
  - [ ] EXOS-39208_Test_Plan_v3.1_Detailed.md

**CRITICAL**: If CLI syntax unknown, **STOP** and search code OR ask user. Do not generate test plan with assumed syntax.

---

### **2. Design Inputs Ready** ✅

- [ ] **Test topology** defined:
  - [ ] Ixia/traffic generator ports identified
  - [ ] DUT ports identified (with MapDUTPortId numbers)
  - [ ] Connections documented
  - [ ] ASCII diagram drafted
- [ ] **Base configuration** determined:
  - [ ] VLANs needed
  - [ ] Port speeds
  - [ ] Link types
  - [ ] Initial state cleanup
- [ ] **Global variables** identified:
  - [ ] Configuration parameters (rates, burst sizes, etc.)
  - [ ] Traffic parameters (MACs, frame sizes, etc.)
  - [ ] Counter offsets and columns
  - [ ] Expected values and tolerances
- [ ] **Helper functions** planned:
  - [ ] Traffic generation function (SendSingleBurst, SendContinuousTraffic)
  - [ ] Counter reading function (GetExceededCounter, GetPortStats)
  - [ ] Verification function (VerifyCounterInRange, VerifyOrdering)
- [ ] **Show commands** documented:
  - [ ] Output format examples
  - [ ] Parsing logic (line offsets, columns)
  - [ ] Counter locations
- [ ] **Hardware details** known:
  - [ ] ASIC-specific behavior
  - [ ] Bucket sizes or quantization
  - [ ] Hardware tolerances

---

## 🔍 **POST-GENERATION VALIDATION CHECKLIST**

### **3. Document Structure** ✅

- [ ] **Header** complete:
  - [ ] Jira ID
  - [ ] Feature name
  - [ ] Release version
  - [ ] Test plan version
  - [ ] Date
  - [ ] Changelog
- [ ] **Introduction** present:
  - [ ] Feature overview
  - [ ] Test goals
  - [ ] Automation-ready statement
- [ ] **Test environment** detailed:
  - [ ] ASCII topology diagram
  - [ ] Base configuration with dynamic ports
  - [ ] Global variables in TCL syntax
- [ ] **Helper functions** implemented (minimum 3):
  - [ ] Function definitions with parameters
  - [ ] Implementation code
  - [ ] Example usage
  - [ ] Comments explaining logic
- [ ] **Appendix** complete:
  - [ ] Show command parsing reference
  - [ ] Traffic parameter reference
  - [ ] Wait times table with rationale
  - [ ] Error handling patterns
  - [ ] Hardware-specific details (if applicable)

---

### **4. Code Quality - CRITICAL** ✅

**For EVERY test case, verify ALL these items:**

#### **4.1 Port References**
- [ ] **NO hardcoded ports**: Search for `port 1`, `port 2` (should be ZERO matches except in comments)
- [ ] **Dynamic mapping used**: All ports use `set port1 [MapDUTPortId 1 1]`
- [ ] **Variables used in CLI**: All CLI commands use `$port1` not `1`

**How to check**:
```bash
# BAD - should NOT find these:
grep -n "port 1[^0-9]" test_plan.md  # Hardcoded "port 1"
grep -n "ports 1 " test_plan.md      # Hardcoded "ports 1"

# GOOD - should find these:
grep -n "MapDUTPortId" test_plan.md  # Dynamic mapping
grep -n '\$port' test_plan.md        # Variable usage
```

---

#### **4.2 CLI Commands**
- [ ] **Exact syntax**: All `configure`, `show`, `clear` commands are complete
- [ ] **Variables used**: All commands use `$variables` not hardcoded values
- [ ] **SendACmd wrapper**: All CLI commands use `SendACmd "command"`
- [ ] **No placeholders**: NO `<port_list>`, `[value]`, or similar placeholders

**How to check**:
```bash
# GOOD - should find many:
grep -n "SendACmd" test_plan.md  # CLI command wrapper

# BAD - should NOT find these:
grep -n "<port" test_plan.md     # Placeholder <port_list>
grep -n "\[port\]" test_plan.md  # Placeholder [port]
grep -n "configure port 1" test_plan.md  # Hardcoded port
```

**Example GOOD**:
```tcl
SendACmd "configure port $port1 rate-limit flood broadcast $rate_limit burst-tolerance low"
```

**Example BAD**:
```tcl
Configure port <port_list> rate-limit flood broadcast <pps> burst-tolerance <level>
```

---

#### **4.3 Traffic Generation (Ixia/SendFrame)**
- [ ] **Complete parameters**: ALL 7 required parameters present
  - [ ] `-txPortId`
  - [ ] `-destMac`
  - [ ] `-sourceMac`
  - [ ] `-numFrames`
  - [ ] `-frameRate`
  - [ ] `-streamType`
  - [ ] `-frameSize`
- [ ] **Correct syntax**: Multi-line format with backslashes
- [ ] **Variable values**: Uses variables like `$burst_size`, `$dest_mac_bc`

**How to check**:
```bash
# Count SendFrame parameters (should be 7 per call)
grep -A10 "SendFrame" test_plan.md | grep -c "^[ ]*-"
```

**Example GOOD**:
```tcl
SendFrame -txPortId 1 \
          -destMac    "ff:ff:ff:ff:ff:ff" \
          -sourceMac  "00:00:01:00:09:01" \
          -numFrames  $burst_size \
          -frameRate  $burst_rate \
          -streamType "singleBurst" \
          -frameSize  128
```

**Example BAD**:
```tcl
Send traffic from Ixia port 1 with burst size X
```

---

#### **4.4 Counter Parsing**
- [ ] **Exact parsing code**: All counter reads use `GetKeyValue` with paramList
- [ ] **Offset specified**: Line offset number provided (e.g., `6` for line 6)
- [ ] **Column specified**: Column number provided (e.g., `2` for column 2)
- [ ] **Result stored**: Counter value stored in variable

**How to check**:
```bash
# Should find these patterns:
grep -n "lappend paramList" test_plan.md  # Parsing code
grep -n "GetKeyValue" test_plan.md        # Counter reading
```

**Example GOOD**:
```tcl
set paramList ""
lappend paramList "Exceeded 6 2"  # Line 6, Column 2
set drops [GetKeyValue "show port $port1 rate-limit flood no-refresh" $paramList]
unset paramList
```

**Example BAD**:
```tcl
Read the "Exceeded" counter from show output
```

---

#### **4.5 Verification Logic**
- [ ] **If/then conditionals**: All verifications use `if {condition}`
- [ ] **Specific ranges**: Min/max values specified (e.g., `>= 1700 && <= 1850`)
- [ ] **result_ok for pass**: Success logged with `result_ok "message"`
- [ ] **result_error for fail**: Failure logged with `result_error "message"`
- [ ] **result_debug for values**: Intermediate values logged for debugging

**How to check**:
```bash
# Should find these patterns:
grep -n "if {" test_plan.md           # Conditionals
grep -n "result_ok" test_plan.md      # Pass logging
grep -n "result_error" test_plan.md   # Fail logging
```

**Example GOOD**:
```tcl
if {$drops >= 1700 && $drops <= 1850} {
    result_ok "Drops=$drops within [1700-1850] for low tolerance"
} else {
    result_error "Drops=$drops outside [1700-1850] — expected for low tolerance"
    result_debug "Possible BCM bucket misconfiguration"
}
```

**Example BAD**:
```tcl
Verify drops are approximately 1750-1800
```

---

#### **4.6 Error Handling**
- [ ] **Counter unavailable**: Check if counter is empty or "-"
- [ ] **Command rejection**: Framework handles, but test should log
- [ ] **Out-of-range values**: Check if values are within expected bounds
- [ ] **Ordering violations**: Check if drops follow expected order

**Example GOOD**:
```tcl
if {$exceeded == "" || $exceeded == "-"} {
    result_error "Exceeded counter not available — rate-limit not configured?"
    return
}
```

---

#### **4.7 Wait Times**
- [ ] **exSleep used**: All waits use `exSleep [N]`
- [ ] **Rationale provided**: Comment explains why (hardware settle, counter update, etc.)
- [ ] **Appropriate duration**: 1-3 seconds for most operations

**Example GOOD**:
```tcl
exSleep 1  ;# Wait for BCM hardware to settle after configuration
exSleep 3  ;# Wait for burst to complete and counters to fully update
```

**Example BAD**:
```tcl
Wait for a few seconds
```

---

#### **4.8 Logging**
- [ ] **result_debug**: Used for step-by-step progress
- [ ] **result_ok**: Used for successful verifications
- [ ] **result_error**: Used for failures
- [ ] **report_start_test / report_end_test**: Used for test boundaries

**How to check**:
```bash
grep -n "result_debug\|result_ok\|result_error" test_plan.md | wc -l
# Should have many matches (50+ for detailed test plan)
```

---

#### **4.9 Cleanup**
- [ ] **Config removed**: Rate limits set to no-limit
- [ ] **Counters cleared**: `clear counters` executed
- [ ] **State reset**: VLANs deleted, ports reset (if needed)

**Example GOOD**:
```tcl
# Cleanup
SendACmd "configure port $port1 rate-limit flood broadcast no-limit"
SendACmd "clear counters"
SendACmd "delete vlan test_vlan"
```

---

### **5. Documentation Quality** ✅

- [ ] **Show output examples** provided:
  - [ ] Exact format from switch
  - [ ] Column headers shown
  - [ ] Example data rows
  - [ ] Parsing explanation
- [ ] **Expected results tables** provided (for quantitative tests):
  - [ ] Parameter column
  - [ ] Expected value column
  - [ ] Tolerance range column
  - [ ] Reasoning column
- [ ] **Error scenarios** documented:
  - [ ] What each error means
  - [ ] How to detect
  - [ ] What to do
- [ ] **Pass criteria** specific and measurable:
  - [ ] NOT "Verify drops observed"
  - [ ] YES "Drops in range [1700-1850]"

---

## ✅ **FINAL QUALITY GATES**

### **Gate 1: Automation Engineer Test** (5 minutes)

**Task**: Give test plan to automation engineer unfamiliar with feature

**Questions**:
1. Can you identify which ports to use? **[Yes/No]**
2. Can you copy-paste the traffic generation code? **[Yes/No]**
3. Can you extract the counter parsing logic? **[Yes/No]**
4. Can you see the pass/fail criteria? **[Yes/No]**
5. Estimated time to convert to working script? **[_____ minutes]**

**PASS**: All Yes, ≤30 minutes  
**FAIL**: Any No, >30 minutes → Improve test plan

---

### **Gate 2: Manual Tester Test** (5 minutes)

**Task**: Give test plan to manual tester unfamiliar with feature

**Questions**:
1. Can you understand what the test does? **[Yes/No]**
2. Can you identify exact CLI commands to run? **[Yes/No]**
3. Can you see what values to expect? **[Yes/No]**
4. Can you determine pass vs fail? **[Yes/No]**
5. Do you need to ask clarifying questions? **[Yes/No]**

**PASS**: All Yes for 1-4, No for 5  
**FAIL**: Any No for 1-4, Yes for 5 → Improve test plan

---

### **Gate 3: Automated Validation** (1 minute)

**Run validation script**:

```javascript
const validation = validateAutomationReadiness(testPlanContent);

console.log(`Score: ${validation.score}/${validation.total} (${validation.percentage}%)`);
console.log(`Ready: ${validation.ready}`);
console.log(`Failed checks: ${validation.failedChecks.join(', ')}`);
```

**PASS**: Score ≥90%, Ready = true  
**FAIL**: Score <90% → Fix failed checks

---

## 📊 **Scoring Summary**

| Check Category | Items | Weight |
|---------------|-------|--------|
| **Structure** | 15 | 15% |
| **Port References** | 3 | 10% |
| **CLI Commands** | 4 | 10% |
| **Traffic Generation** | 7 | 15% |
| **Counter Parsing** | 4 | 10% |
| **Verification Logic** | 5 | 15% |
| **Error Handling** | 4 | 5% |
| **Wait Times** | 3 | 5% |
| **Logging** | 4 | 5% |
| **Cleanup** | 3 | 5% |
| **Documentation** | 4 | 5% |

**Total**: 56 items, 100%

**Grading**:
- **95-100%**: Excellent — Production-ready
- **90-94%**: Good — Minor improvements
- **80-89%**: Acceptable — Needs work
- **<80%**: Not Ready — Major improvements needed

**MINIMUM PASS**: 90%

---

## 🚀 **Quick Fix Guide**

### **If Score <90%, Common Issues**:

**Issue 1: Hardcoded ports** (10% penalty)
- **Fix**: Replace all `port 1` with `set port1 [MapDUTPortId 1 1]`
- **Time**: 5 minutes

**Issue 2: Missing Ixia parameters** (15% penalty)
- **Fix**: Add all 7 SendFrame parameters
- **Time**: 10 minutes

**Issue 3: No parsing code** (10% penalty)
- **Fix**: Add `lappend paramList "Counter offset column"` for all counters
- **Time**: 15 minutes

**Issue 4: No verification logic** (15% penalty)
- **Fix**: Add if/then with ranges, result_ok/result_error
- **Time**: 20 minutes

**Issue 5: No show output examples** (5% penalty)
- **Fix**: Add show command output to appendix with parsing explanation
- **Time**: 10 minutes

**Total Time to Fix All Issues**: ~60 minutes  
**Better**: Get it right the first time using template!

---

## 📝 **Usage Instructions**

### **For Test Plan Authors**:

**Before starting**:
1. Print this checklist
2. Review template (TEST_PLAN_DETAILED_TEMPLATE.md)
3. Study example (EXOS-39208_Test_Plan_v3.1_Detailed.md)

**During writing**:
1. Check off items as you complete them
2. Run automated validation periodically
3. Fix issues immediately (don't accumulate)

**Before submitting**:
1. Verify ALL items checked ✅
2. Run all 3 quality gates
3. Get peer review

---

### **For Reviewers**:

**Review process**:
1. Run automated validation first
2. If score <90%, reject immediately with failed checks
3. If score ≥90%, do manual spot-checks:
   - Random test case: Can you copy-paste code?
   - Random counter: Is parsing code complete?
   - Random verification: Is logic clear?
4. Run Gate 1 and Gate 2 tests
5. Approve only if all gates pass

**Review time**: 15-20 minutes per test plan

---

### **For Automation Engineers**:

**When receiving test plan**:
1. Check automation readiness score (should be ≥90%)
2. If <90%, send back with specific improvements needed
3. If ≥90%, estimate conversion effort
4. If >30 minutes, identify what's missing
5. Provide feedback to improve template

---

**This checklist ensures 95%+ automation readiness for ALL test plans.**
