# EXOS Test Plan - Detailed Automation-Ready Template
## **Standard Template for All EXOS Test Plans**

**Version**: 1.0  
**Date**: 2026-07-07  
**Purpose**: Ensure all test plans are **automation-ready** with script-level details  
**Based on**: EXOS-39208 Test Plan v3.1 (successful automation-ready format)

---

## 📋 **Template Overview**

This template ensures **every test plan** has:
- ✅ Exact CLI commands with variable syntax
- ✅ Complete Ixia/traffic generator parameters
- ✅ Counter parsing logic with offsets/columns
- ✅ Verification logic with if/then conditions
- ✅ Helper function implementations
- ✅ Show command output examples
- ✅ Error handling patterns
- ✅ Wait times with technical rationale

---

## 🎯 **Required Sections**

### **1. Document Header**

```markdown
# EXOS-[JIRA_ID] Functional Test Plan
## [Feature Name]
## **DETAILED AUTOMATION-READY VERSION**

**Feature**: [Brief description]
**Jira**: EXOS-[ID]
**Release**: EXOS [version] (TBD)
**Test Plan Version**: [X.Y] (Detailed automation-ready steps)
**Date**: [YYYY-MM-DD]
**Changes from v[X.Y-1]**: [What's new in this version]
```

---

### **2. Introduction** (Required)

```markdown
## 1. Introduction

### 1.1 Feature Overview
[What is the feature? What problem does it solve?]

### 1.2 Test Plan Goals
- **Automation-ready**: Every test case has exact CLI commands, Ixia parameters, and parsing details
- **Script-friendly**: Steps match automation script patterns from `/extreme/Regression/.../`
- **Reproducible**: Anyone can execute tests without interpretation

### 1.3 Changes from Previous Version (if applicable)
[What changed from v1.0 to v2.0? New test cases? Updated methodology?]
```

---

### **3. Test Environment Setup** (MANDATORY - With Exact Details)

```markdown
## 2. Test Environment Setup

### 2.1 Test Topology

```
Topology-1: [Topology Name]

[ASCII art diagram showing:]
- Ixia/traffic generator ports
- DUT ports (with MapDUTPortId references)
- Connections between devices
- VLAN information
- Link speeds

Example:
Ixia Port 1 (Traffic Generator)
  |
  | 10G Port 3 on DUT (Ingress)
  |
[DUT] 5720-24MXW FE (EXOS 33.7)
  Port 1 = MapDUTPortId 1 1 (typically 1:1)
  Port 3 = MapDUTPortId 3 1 (typically 1:3)
  |
  | 10G Port 1 on DUT (Egress - Rate Limited)
  |
Ixia Port 2 (Traffic Receiver)
```
```

### 2.2 Base Configuration

```bash
# Login to DUT
Login $DUT1_CONNECT

# Get mapped port IDs (DYNAMIC MAPPING - NOT HARDCODED)
set port1 [MapDUTPortId 1 1]
set port3 [MapDUTPortId 3 1]

# [All base configuration commands]
SendACmd "create vlan test_vlan"
SendACmd "configure vlan test_vlan add ports $port1 $port3 untagged"
SendACmd "enable jumbo-frame ports $port1 $port3"
SendACmd "configure ports $port1 $port3 auto off speed 10000 duplex full"

# Clear initial state
SendACmd "clear counters"
SendACmd "clear fdb"
```

### 2.3 Global Test Variables

```tcl
# Configuration parameters
set [param_name] [value]              # Description
set [param_name] [value]              # Description

# Traffic parameters
set src_mac "[mac_address]"           # Source MAC
set dest_mac_bc "ff:ff:ff:ff:ff:ff"   # Broadcast
set dest_mac_mc "01:00:00:01:01:01"   # Multicast
set frame_size 128                    # 128 bytes

# Counter offsets (for parsing show output)
set [counter]_offset [N]              # [Description of counter location]
set [column]_column [N]               # [Description of column]

# Expected values / thresholds
set hw_tolerance 50                   # Hardware tolerance for comparisons
```
```

---

### **4. Test Helper Functions** (MANDATORY)

```markdown
## 3. Test Helper Functions

### 3.1 [Function Name] Function

```tcl
proc [FunctionName] {param1 param2 param3} {
    # Purpose: [What does this function do?]
    # Parameters:
    #   param1: [description]
    #   param2: [description]
    #   param3: [description]
    # Returns: [what it returns]
    
    # Implementation with comments
    [TCL code here]
    
    # Return statement
    return $result
}
```

**Example Usage**:
```tcl
# Call the function
set result [FunctionName $port1 "value" 100]
```

**Notes**:
- [Any special considerations]
- [When to use this function]
```

**REQUIRED HELPER FUNCTIONS** (minimum):
1. Traffic generation function (e.g., `SendSingleBurst`, `SendContinuousTraffic`)
2. Counter reading function (e.g., `GetExceededCounter`, `GetPortStats`)
3. Verification function (e.g., `VerifyCounterInRange`, `VerifyOrdering`)

---

### **5. Test Cases with DETAILED Steps** (CRITICAL)

```markdown
## 4. Test Cases with Detailed Steps

### 5.[X].[Y] [Test Case Title]

**Topology used**: Topology-1

**Detailed Test Methodology**:

```tcl
proc [test_case_id] {} {
    # Declare global variables
    global DUT1_CONNECT
    global [var1] [var2] [var3]
    
    # Step 1: [Description]
    Login $DUT1_CONNECT
    
    # Step 2: [Description] (DYNAMIC PORT MAPPING)
    set port1 [MapDUTPortId 1 1]
    set port2 [MapDUTPortId 2 1]
    
    # Step 3: [Configuration step with EXACT CLI]
    SendACmd "configure [exact CLI command with $variables]"
    
    # Step 4: [Verification step with EXACT PARSING]
    set parameterList ""
    lappend parameterList "{[regex pattern to match]} exist"
    CheckKeyValue "show [command]" $parameterList \
                  -comment "[Human-readable verification description]"
    unset parameterList
    
    # Step 5: [Traffic generation with COMPLETE PARAMETERS]
    SendFrame -txPortId [N] \
              -destMac    "[mac]" \
              -sourceMac  "[mac]" \
              -numFrames  [count] \
              -frameRate  [fps] \
              -streamType "[type]" \
              -frameSize  [bytes]
    
    # Step 6: [Wait with RATIONALE]
    exSleep [N]  ;# [Why this wait time?]
    
    # Step 7: [Counter reading with EXACT PARSING]
    set paramList ""
    lappend paramList "[CounterName] [offset] [column]"
    set [variable] [GetKeyValue "show [command]" $paramList]
    unset paramList
    
    # Step 8: [VERIFICATION LOGIC with IF/THEN]
    report_start_test "[Description of what we're verifying]"
    
    if {$[variable] >= $[min] && $[variable] <= $[max]} {
        result_ok "[Success message with actual value: $[variable]]"
    } else {
        result_error "[Failure message with actual vs expected]"
        result_debug "[Additional debugging info]"
    }
    
    report_end_test
    
    # Step 9: [Cleanup]
    SendACmd "[cleanup commands]"
    SendACmd "clear counters"
}
```

**Expected Show Output**:
```
# show [command]

[Exact output format from switch]
[Show column headers]
[Show data rows]

# Parsing: [Explain how to extract values]
# Example: Line 6, Column 2 = "Exceeded" counter = 1789
```

**Expected Results Table** (if applicable):
```markdown
| Parameter | Expected Value | Tolerance Range | Reasoning |
|-----------|---------------|-----------------|-----------|
| [param1] | [value] | [min-max] | [Why this range?] |
| [param2] | [value] | [min-max] | [BCM hardware detail] |
```

**Pass Criteria**: 
- ✅ [Specific measurable criterion 1]
- ✅ [Specific measurable criterion 2]
- ✅ [Specific measurable criterion 3]

**Sanity (Yes/No)**: [Yes/No]  
**Automatable (Yes/No)**: [Yes/No]

**Error Scenarios**:
- ❌ [Error condition 1]: [What it means]
- ❌ [Error condition 2]: [What it means]

---
```

**REPEAT FOR ALL TEST CASES**

---

### **6. Appendix** (MANDATORY)

```markdown
## 5. Appendix

### A.1 Show Command Output Parsing

**Command**: `show [command]`

**Output Format**:
```
[Exact output from switch with column headers and example data]
```

**Parsing Logic**:
```tcl
# Extract [field_name]
# Line offset: [N] ([field] is typically line [N] in output)
# Column: [M] ([field] is column [M] in paramList)

set paramList ""
lappend paramList "[Field] [offset] [column]"
set [variable] [GetKeyValue "show [command]" $paramList]

# Result: [variable] = [example_value]
```

**For Multiple Counters**:
[Show how to extract different counters with different offsets]

---

### A.2 Ixia/Traffic Generator Parameter Reference

**All Parameters**:
```tcl
SendFrame -txPortId <port_id> \
          -destMac <mac_address> \
          -sourceMac <mac_address> \
          -numFrames <count> \
          -frameRate <fps> \
          -streamType <type> \
          -frameSize <bytes>

Parameters:
  -txPortId: [Description]
  -destMac: [Description]
  -sourceMac: [Description]
  -numFrames: [Description]
  -frameRate: [Description]
  -streamType: "[options]" (e.g., "singleBurst" vs "contPacket")
  -frameSize: [Description]
```

**Example Usage**:
```tcl
# [Example 1 description]
SendFrame -txPortId 1 \
          -destMac    "ff:ff:ff:ff:ff:ff" \
          -sourceMac  "00:00:01:00:09:01" \
          -numFrames  2048 \
          -frameRate  10000 \
          -streamType "singleBurst" \
          -frameSize  128

# [Example 2 description]
SendFrame -txPortId 2 \
          -destMac    "01:00:00:01:01:01" \
          -sourceMac  "00:00:01:00:09:02" \
          -numFrames  4096 \
          -frameRate  5000 \
          -streamType "singleBurst" \
          -frameSize  256
```

---

### A.3 Wait Times and Rationale

| Wait Command | Duration | Rationale |
|-------------|----------|-----------|
| `exSleep [N]` after [action] | [N] second(s) | [Technical reason - hardware settle, counter update, etc.] |
| `exSleep [M]` after [action] | [M] second(s) | [Technical reason] |

**Critical**: Do not reduce wait times below these values. [Why? Hardware constraints, ASIC behavior, etc.]

---

### A.4 Error Handling Patterns

**Pattern 1: [Error Type]**
```tcl
# [Description of when this error occurs]
[TCL code showing how to detect and handle]
```

**Pattern 2: [Error Type]**
```tcl
# [Description]
[TCL code]
```

**Pattern 3: [Error Type]**
```tcl
# [Description]
[TCL code]
```

---

### A.5 Hardware-Specific Details (if applicable)

[Document any ASIC-specific behavior, BCM bucket sizes, quantization, tolerances, etc.]

**Example**:
```markdown
**BCM Burst Bucket Quantization**:
- Available bucket sizes: {1, 4, 16, 64, 256, 1024, 2048, 4096}
- Low tolerance maps to bucket: 256
- Medium tolerance maps to bucket: 1024
- High tolerance maps to bucket: 2048

**Hardware Tolerance**: ±50 packets for drop comparisons due to ASIC timing
```

---

**Test Plan Template - End of Document**

---

## 📊 **Quality Checklist**

Before finalizing ANY test plan, verify ALL these items:

### **Structure**
- [ ] Document header complete with Jira ID, release, version
- [ ] Introduction explains feature and test goals
- [ ] Test topology with ASCII diagram
- [ ] Base configuration with dynamic port mapping
- [ ] Global test variables defined

### **Helper Functions**
- [ ] At least 3 helper functions defined
- [ ] Each function has parameter descriptions
- [ ] Example usage shown for each function
- [ ] Functions use TCL automation framework patterns

### **Test Cases - Format**
- [ ] Each test case has test case ID (5.X.Y format)
- [ ] Each has topology reference
- [ ] Each has "Detailed Test Methodology" section
- [ ] Each has complete TCL proc implementation
- [ ] Each has Pass Criteria list
- [ ] Each has Sanity flag (Yes/No)
- [ ] Each has Automatable flag (Yes/No)

### **Test Cases - Content (CRITICAL)**
- [ ] **NO HARDCODED PORTS**: All ports use `MapDUTPortId`
- [ ] **EXACT CLI COMMANDS**: All SendACmd with actual syntax
- [ ] **COMPLETE IXIA PARAMETERS**: All SendFrame parameters specified
- [ ] **EXACT PARSING CODE**: All GetKeyValue with offset/column
- [ ] **VERIFICATION LOGIC**: All checks have if/then with ranges
- [ ] **ERROR HANDLING**: Common failures detected and logged
- [ ] **DATA STRUCTURES**: Arrays/variables for storing results
- [ ] **LOGGING**: result_debug, result_ok, result_error at key points
- [ ] **WAIT TIMES**: exSleep with comment explaining duration
- [ ] **CLEANUP**: Explicit cleanup steps at test end

### **Test Cases - Documentation**
- [ ] Show command output examples provided
- [ ] Expected results table (if quantitative test)
- [ ] Error scenarios documented
- [ ] Pass criteria specific and measurable

### **Appendix**
- [ ] Show command parsing explained
- [ ] Traffic generator parameters documented
- [ ] Wait times table with rationale
- [ ] Error handling patterns provided
- [ ] Hardware-specific details (if applicable)

### **Overall Quality**
- [ ] An automation engineer can copy-paste code and run with <30 min modification
- [ ] A manual tester can execute without interpretation
- [ ] A reviewer can verify correctness from documentation
- [ ] Code matches patterns from `/extreme/Regression/.../` automation scripts

**PASS THRESHOLD**: 100% of items checked ✅

**If ANY item unchecked**: Test plan is **NOT READY** for automation conversion.

---

## 🚀 **Quick Start Guide**

### **Step 1: Copy This Template**
```powershell
cp TEST_PLAN_DETAILED_TEMPLATE.md EXOS-[JIRA_ID]_Test_Plan_v1.0_Detailed.md
```

### **Step 2: Fill in Feature-Specific Details**
1. Replace `[JIRA_ID]` with actual Jira ticket
2. Fill in feature overview from Jira summary
3. Document topology based on feature requirements
4. Define global variables based on feature parameters

### **Step 3: Create Helper Functions**
1. Identify common operations (traffic, parsing, verification)
2. Write reusable functions matching automation framework
3. Document parameters and usage

### **Step 4: Write Test Cases**
**For EACH test case**:
1. Start with high-level objective
2. Write complete TCL proc with:
   - Dynamic port mapping
   - Exact CLI commands
   - Complete Ixia parameters
   - Exact parsing code
   - Verification logic with if/then
   - Error handling
   - Cleanup
3. Document expected output
4. Create expected results table
5. Define pass criteria

### **Step 5: Complete Appendix**
1. Show command parsing examples
2. Traffic parameter reference
3. Wait time table
4. Error handling patterns
5. Hardware details

### **Step 6: Quality Check**
1. Run through **entire checklist** above
2. All items must be checked ✅
3. If any unchecked, go back and complete

### **Step 7: Review**
1. Have automation engineer review code sections
2. Have manual tester review execution steps
3. Address feedback and iterate

---

## 💡 **Best Practices**

### **DO**:
- ✅ Use dynamic port mapping (`MapDUTPortId`)
- ✅ Show exact CLI syntax with variables
- ✅ Specify ALL SendFrame parameters
- ✅ Include parsing code with offset/column
- ✅ Write if/then verification logic
- ✅ Handle common error scenarios
- ✅ Use arrays for storing results
- ✅ Log at each major step
- ✅ Document wait time rationale
- ✅ Clean up at end of test

### **DON'T**:
- ❌ Hardcode port numbers (port 1, port 2)
- ❌ Write vague steps ("configure burst-tolerance")
- ❌ Omit Ixia parameters ("send traffic")
- ❌ Skip parsing details ("read counter")
- ❌ Use generic pass criteria ("verify drops observed")
- ❌ Ignore error handling
- ❌ Skip data structures (store in ad-hoc variables)
- ❌ Miss logging opportunities
- ❌ Use arbitrary wait times (exSleep 5 without explanation)
- ❌ Forget cleanup

---

## 📈 **Success Metrics**

A test plan following this template should achieve:

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Automation readiness** | ≥95% | Checklist score |
| **Conversion effort** | ≤30 min/test | Time to working TCL script |
| **Interpretation required** | <5% of steps | Steps needing clarification |
| **First-run success** | ≥80% | Tests passing on first execution |
| **Maintenance effort** | <1 hour/year | Time to update for CLI changes |

---

## 🎓 **Training Resources**

For teams new to automation-ready test plans:

1. **Reference Example**: EXOS-39208_Test_Plan_v3.1_Detailed.md (gold standard)
2. **Comparison Document**: EXOS-39208_Detail_Level_Comparison.md (shows before/after)
3. **Automation Scripts**: `/extreme/Regression/.../L2_ratelimit/` (learn patterns)
4. **Framework Documentation**: [Link to TCL automation framework docs]

---

**This template ensures consistency, quality, and automation-readiness across ALL EXOS test plans.**
