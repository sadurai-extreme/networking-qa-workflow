# EXOS-39208 Test Plan Comparison
## Automation Scripts vs Our Generated Test Plan

**Date**: 2026-07-07  
**Feature**: Flood Rate-Limit Burst-Tolerance CLI Enhancement

---

## 📁 **Existing Automation Scripts Overview**

| Script | Test Focus | Lines | Key Details |
|--------|-----------|-------|-------------|
| **1.26.1.1-7.tcl** | CLI Configuration & Show Verification | ~186 | All 4 tolerance levels, all 3 flood types, show command validation |
| **1.26.1.8.tcl** | Boundary Testing | ~109 | Max rate 262144 pps with burst-tolerance |
| **1.26.2.1-6.tcl** | Traffic Tests (Sustained) | ~199 | Sustained traffic at various rates |
| **1.26.2.7-8.tcl** | TC-14 & TC-18 Traffic | ~153 | Specific traffic scenarios |
| **1.26.2.9.tcl** | **Single-Burst Comprehensive** | **443** | **5 burst sizes × 4 tolerance levels × 3 flood types = 60 tests** |
| **1.26.3.1.tcl** | Persistence (Save/Reboot) | ~112 | Config persistence with traffic validation |
| **1.26.3.2.tcl** | Persistence (Other Scenarios) | ~121 | Process restart, stack failover |
| **1.26.4.1-2.tcl** | Combination Tests | ~155 | Out-actions + multi-port independence |
| **1.init.tcl** | Initialization | ~31 | Setup for test suite |

**Total**: 9 scripts, **~1,709 lines of TCL code**

---

## 🎯 **Test Parameters Used in Automation**

### Configuration Values
```tcl
set rate_limit 1000                             # 1000 pps
set burst_sizes {500 1024 2048 4096 8000}      # 5 different burst sizes
set tolerance_levels {low medium high default}  # All 4 levels
set burst_rate 10000                            # 10x CIR (10000 fps)
set hw_tolerance 50                             # ±50 packets for comparisons
```

### BCM Bucket Mapping (from script comments)
```
At 1000 pps configured rate:
  SDK default bucket = 1024
  low    = 256  (one below SDK)
  medium = 1024 (SDK default)
  high   = 2048 (one above SDK)
  default= 1024 (Extreme's original algo ≥ rate)

BCM ASIC buckets quantized to: {1, 4, 16, 64, 256, 1024, 2048, 4096}
```

### Validation Method
```tcl
# Verify drop ordering: low >= medium >= high (with ±50 tolerance)
if { $drops_by_level(low) >= $drops_by_level(medium) || \
     [expr $drops_by_level(medium) - $drops_by_level(low)] <= $hw_tolerance } {
  ;# OK
} else {
  set pass 0
}
```

---

## 📊 **Side-by-Side Comparison**

### **Coverage Analysis**

| Category | Automation Scripts | Our Test Plan (CORRECTED) | Match? |
|----------|-------------------|---------------------------|--------|
| **CLI Syntax** | ✅ All 4 levels (1.26.1.1-7) | ✅ All 4 levels (5.1.1-5.1.4) | ✅ **Yes** |
| **Show Commands** | ✅ Detailed validation | ✅ Show command tests (5.3.1) | ✅ **Yes** |
| **Burst Traffic Testing** | ✅ **Comprehensive** (1.26.2.9) | ✅ Burst validation (5.2.1-5.2.7) | ⚠️ **Partial** |
| **Flood Types** | ✅ BC/MC/UUC (all scripts) | ✅ BC/MC/UUC (5.2.5-5.2.6) | ✅ **Yes** |
| **Persistence (Reboot)** | ✅ With traffic (1.26.3.1) | ✅ Basic reboot (5.5.1) | ⚠️ **Partial** |
| **Process Restart** | ✅ HAL restart (1.26.3.2) | ✅ HAL restart (5.5.2) | ✅ **Yes** |
| **Stacking** | ✅ Master failover (1.26.3.2) | ✅ Stack test (5.5.3) | ✅ **Yes** |
| **Out-Actions** | ✅ Log/Trap integration (1.26.4.1-2) | ✅ Log/Trap/Disable-Port (5.9.1-5.9.3) | ✅ **Yes** |
| **Multi-Port** | ✅ Independence test (1.26.4.1-2) | ✅ Multiple ports (5.6.1) | ✅ **Yes** |
| **Error Handling** | ❌ Not found | ✅ Invalid options (5.8.1-5.8.3) | ❌ **Gap in automation** |
| **SNMP MIB** | ❌ Not found | ✅ MIB check (5.4.1) | ❌ **Gap in automation** |
| **Boundary Testing** | ✅ Max rate 262144 pps (1.26.1.8) | ❌ Not in our plan | ❌ **Gap in our plan** |

---

## 🔬 **Detailed Test Case Comparison**

### **1. CLI Configuration (1.26.1.1-7 vs Our 5.1.x)**

#### **Automation Scripts**
```tcl
# Tests all 4 levels for broadcast
SendACmd "configure port $port1 rate-limit flood broadcast 1000 burst-tolerance low"
# Verifies with regex match in show output
lappend parameterList "{Broadcast Rate.*1000 packets-per-second.*Burst Tolerance:.*Low} exist"
CheckKeyValue "show ports $port1 information detail" $parameterList
```

#### **Our Test Plan**
```
5.1.1: configure port 1 rate-limit flood broadcast 500 burst-tolerance default out-actions log trap
5.1.2: configure port 1 rate-limit flood multicast 500 burst-tolerance low out-actions log trap
5.1.3: configure port 1 rate-limit flood unknown-destmac 20 burst-tolerance medium out-actions log trap
5.1.4: configure port 1 rate-limit flood broadcast 500 burst-tolerance high out-actions log trap
```

**Differences:**
- ✅ **Automation**: Uses 1000 pps consistently
- ⚠️ **Our plan**: Uses varying rates (500, 20) - less systematic
- ✅ **Both**: Cover all 4 tolerance levels

---

### **2. Burst Traffic Validation (1.26.2.9 vs Our 5.2.x)**

#### **Automation Scripts (1.26.2.9 - THE KEY TEST)**
```tcl
# Configuration
set rate_limit 1000
set burst_sizes {500 1024 2048 4096 8000}      # 5 burst sizes
set tolerance_levels {low medium high default} # All 4 levels
set burst_rate 10000                           # 10x CIR

# Test Logic (nested loops)
foreach burst_size $burst_sizes {
  foreach level $tolerance_levels {
    # Configure tolerance
    SendACmd "configure port $port1 rate-limit flood broadcast $rate_limit burst-tolerance $level"
    
    # Send SINGLE BURST (key difference!)
    SendFrame -numFrames "$burst_size" \
              -frameRate "$burst_rate"  # 10000 fps
    
    # Read exceeded counter
    set drops_by_level($level) [GetKeyValue "show port $port1 rate-limit flood no-refresh" ...]
  }
  
  # Verify ordering: drops(low) >= drops(medium) >= drops(high)
  # With ±50 packet tolerance
}
```

**Key Test Matrix (1.26.2.9)**:
- Broadcast: 5 burst sizes × 4 levels = **20 tests**
- Multicast: 5 burst sizes × 4 levels = **20 tests**  
- Unknown-destmac: 5 burst sizes × 4 levels = **20 tests**
- **Total: 60 burst validation tests**

#### **Our Test Plan (5.2.x)**
```
5.2.1: Default tolerance (baseline) - First second ~1500-2000 packets
5.2.2: Low tolerance - First second ≤ 650 packets (≤30% over limit)
5.2.3: Medium tolerance - First second ~800-1000 packets
5.2.4: High tolerance - First second ~1200-1500 packets
5.2.5: Multicast with low tolerance
5.2.6: Unknown-destmac with low tolerance
5.2.7: Comparison of all 4 levels
```

**Differences:**

| Aspect | Automation (1.26.2.9) | Our Test Plan (5.2.x) | Winner |
|--------|----------------------|---------------------|--------|
| **Burst Approach** | **Single finite burst** (500-8000 frames) | **Continuous traffic for 5 seconds** | ✅ **Automation is superior** |
| **Burst Sizes** | **5 sizes** (500, 1024, 2048, 4096, 8000) | Only **1 rate** (line rate) | ✅ **Automation is superior** |
| **Traffic Rate** | **10000 fps** (10x CIR) | **Line rate** (10 Gbps) | ✅ **Automation more controlled** |
| **Validation** | **Exceeded counter** from CLI | **Wireshark I/O graph** | ⚠️ **Automation more precise** |
| **Tolerance Check** | **±50 packets** hardware tolerance | **% based** (30%, 60%, etc.) | ✅ **Automation accounts for HW** |
| **Test Matrix** | **60 tests** (5 sizes × 4 levels × 3 types) | **7 tests total** | ✅ **Automation more comprehensive** |

---

### **3. Persistence Testing (1.26.3.1 vs Our 5.5.1)**

#### **Automation Scripts**
```tcl
# Step 1: Configure different tolerance levels
SendACmd "configure port $port1 rate-limit flood broadcast 2000 burst-tolerance high"
SendACmd "configure port $port1 rate-limit flood multicast 1500 burst-tolerance medium"
SendACmd "configure port $port1 rate-limit flood unknown-destmac 500 burst-tolerance low"

# Step 2: Traffic verification BEFORE reboot
SendFrame -frameRate "5000" ...
set pre_reboot_drops [GetKeyValue "show port $port1 rate-limit flood no-refresh" ...]

# Step 3: Save and reboot
SendACmd "save configuration"
SendACmd "reboot"
# Wait for reboot...

# Step 4: Verify show commands after reboot
CheckKeyValue "show ports $port1 information detail" ...

# Step 5: Traffic verification AFTER reboot
SendFrame ...
set post_reboot_drops [GetKeyValue ...]

# Step 6: Compare pre vs post drops
if {[expr abs($post_reboot_drops - $pre_reboot_drops)] <= 100} {
  result_ok "Post-reboot behavior matches pre-reboot"
}
```

#### **Our Test Plan**
```
5.5.1: Configure burst-tolerance low, save config, reboot, verify config persists
Pass Criteria: Burst-tolerance configuration persists after reboot
```

**Differences:**
- ✅ **Automation**: Tests **3 flood types** with different tolerance levels simultaneously
- ✅ **Automation**: **Traffic validation** before AND after reboot with counter comparison
- ⚠️ **Our plan**: Only checks **config persistence** (no traffic validation)
- ✅ **Automation**: **Quantitative comparison** (pre vs post drops within tolerance)

---

### **4. Out-Actions Integration (1.26.4.1-2 vs Our 5.9.x)**

#### **Automation Scripts**
```tcl
# Part 1: Low tolerance with log out-action
SendACmd "configure port $port1 rate-limit flood broadcast 1000 burst-tolerance low out-actions log"
SendFrame -frameRate "3000" ...  # 3x rate limit
CheckKeyValue "show log | grep FldRateOutActLogEvent" ...

# Part 2: Change to High tolerance, verify log still works
SendACmd "configure port $port1 rate-limit flood broadcast 1000 burst-tolerance high out-actions log"
SendFrame -frameRate "3000" ...
CheckKeyValue "show log | grep FldRateOutActLogEvent" ...

# Part 3: Multi-port independence
# Port 1 with Low, Port 2 with High
SendACmd "configure port $port1 rate-limit flood broadcast 1000 burst-tolerance low"
SendACmd "configure port $port2 rate-limit flood broadcast 1000 burst-tolerance high"
# Send same traffic to both, compare drops
```

#### **Our Test Plan**
```
5.9.1: Log action with burst-tolerance low
5.9.2: Trap action with burst-tolerance low
5.9.3: Disable-port action with burst-tolerance low
```

**Differences:**
- ✅ **Automation**: Tests **tolerance level change** with same out-action active
- ✅ **Automation**: **Multi-port independence** test (low vs high on different ports)
- ⚠️ **Our plan**: Only tests each out-action individually
- ❌ **Our plan**: Missing multi-port independence verification

---

## 🚨 **Key Gaps Found**

### **Gaps in Our Generated Test Plan** (Missing from automation)

1. ❌ **No Boundary Testing with Max Rate**
   - Automation has **1.26.1.8**: Tests 262144 pps (max rate) with burst-tolerance
   - Our plan: Missing this edge case

2. ❌ **Traffic Pattern Variations**
   - Our plan has: Short burst, continuous, periodic (5.10.1-5.10.3)
   - Automation: Not found - **Good addition in our plan**

3. ❌ **Error Handling Tests**
   - Our plan has: Invalid options, typos, numeric values (5.8.1-5.8.3)
   - Automation: Not found - **Good addition in our plan**

4. ❌ **SNMP MIB Testing**
   - Our plan has: MIB validation (5.4.1)
   - Automation: Not found - **Good addition in our plan**

5. ❌ **Backward Compatibility**
   - Our plan has: Rate-limit without burst-tolerance (5.11.2)
   - Automation: Not found - **Good addition in our plan**

---

### **Gaps in Automation Scripts** (Missing from our plan)

1. ✅ **Burst Size Variation**
   - Automation: **5 burst sizes** (500, 1024, 2048, 4096, 8000)
   - Our plan: Only continuous traffic with line rate
   - **Impact**: Critical for BCM bucket boundary testing

2. ✅ **Quantitative Drop Ordering Validation**
   - Automation: Verifies `drops(low) >= drops(medium) >= drops(high)` with ±50 tolerance
   - Our plan: Only qualitative expectations
   - **Impact**: Automation is more precise

3. ✅ **Exceeded Counter Validation**
   - Automation: Uses CLI `show port rate-limit flood` exceeded counter
   - Our plan: Uses Wireshark I/O graph
   - **Impact**: CLI counter is more reliable for automation

4. ✅ **Traffic + Config Validation Together**
   - Automation: Validates **both** config persistence AND traffic behavior after reboot
   - Our plan: Only validates config persistence
   - **Impact**: Automation catches functional regressions

5. ✅ **Multi-Port Independence**
   - Automation: Tests low vs high tolerance on different ports simultaneously
   - Our plan: Only tests multiple ports with same tolerance
   - **Impact**: Critical for verifying per-port configuration

---

## 💡 **Strengths of Each Approach**

### **Automation Scripts Strengths**

✅ **1. Single-Burst Testing (1.26.2.9)**
- Uses **finite bursts** (500-8000 frames) instead of continuous traffic
- Tests burst sizes aligned with **BCM bucket boundaries** (256, 1024, 2048, 4096)
- **Why superior**: Burst buckets only matter during initial burst; sustained traffic doesn't differentiate tolerance levels

✅ **2. Precise Validation**
- Uses CLI **exceeded counter** (`show port rate-limit flood`)
- Accounts for **±50 packet hardware tolerance**
- **Ordering validation**: Programmatically verifies `low >= medium >= high`

✅ **3. Comprehensive Traffic Matrix**
- **60 burst tests**: 5 sizes × 4 levels × 3 flood types
- **Systematic approach**: Nested loops ensure all combinations tested

✅ **4. Real-World Persistence Testing**
- Validates **traffic behavior** pre and post reboot, not just config
- Tests **3 flood types simultaneously** with different tolerance levels

✅ **5. Integration Testing**
- Multi-port independence (low on port1, high on port2)
- Out-actions work with different tolerance levels

---

### **Our Test Plan Strengths**

✅ **1. Error Handling Coverage**
- Invalid burst-tolerance options (5.8.1)
- Numeric values when enum expected (5.8.2)
- Typos and edge cases (5.8.3)

✅ **2. SNMP MIB Validation**
- Tests MIB exposure of burst-tolerance (5.4.1)
- Not covered in automation

✅ **3. Traffic Pattern Variations**
- Short burst (1 second) - 5.10.1
- Continuous traffic (60 seconds) - 5.10.2
- Periodic bursts - 5.10.3

✅ **4. Backward Compatibility**
- Rate-limit without burst-tolerance still works (5.11.2)
- Ensures feature doesn't break existing functionality

✅ **5. Negative Scenarios**
- Burst-tolerance without rate-limit configured (5.8.4)
- Configuration order dependencies

---

## 📈 **Test Coverage Metrics**

| Metric | Automation Scripts | Our Test Plan | Comments |
|--------|-------------------|---------------|----------|
| **Total Test Cases** | ~60+ (matrix-based) | 32 | Automation has more granular burst tests |
| **Sanity Coverage** | N/A | 41% (13/32) | Our plan has explicit sanity flags |
| **CLI Validation** | ✅ Comprehensive | ✅ Comprehensive | Both cover all 4 levels × 3 types |
| **Burst Traffic** | ✅ **60 burst tests** | ⚠️ 7 basic tests | **Automation superior** |
| **Persistence** | ✅ Traffic + Config | ⚠️ Config only | **Automation superior** |
| **Error Handling** | ❌ Not found | ✅ 4 tests | **Our plan superior** |
| **SNMP** | ❌ Not found | ✅ 1 test | **Our plan superior** |
| **Out-Actions** | ✅ Integration tests | ✅ Basic tests | Automation has multi-port |
| **Boundary Cases** | ✅ Max rate 262144 pps | ❌ Missing | **Automation superior** |
| **Traffic Patterns** | ⚠️ Single burst only | ✅ 3 patterns | **Our plan superior** |

---

## 🎯 **Recommendations**

### **Improvements Needed for Our Test Plan**

#### **1. HIGH PRIORITY: Add Burst Size Variation Testing**

**Current (Our Plan)**:
```
5.2.2: Send continuous broadcast traffic at line rate for 5 seconds
```

**Should Be (Like Automation)**:
```
5.2.2-A: Burst Size 500 frames with Low Tolerance
  - Send single burst of 500 frames at 10000 fps
  - Expected: drops ≤ 50 (small burst, mostly allowed)

5.2.2-B: Burst Size 1024 frames with Low Tolerance
  - Send single burst of 1024 frames at 10000 fps
  - Expected: drops ~750-800 (at SDK bucket boundary)

5.2.2-C: Burst Size 2048 frames with Low Tolerance
  - Send single burst of 2048 frames at 10000 fps
  - Expected: drops ~1750-1800 (exceeds low bucket significantly)

... repeat for medium, high, default
```

#### **2. HIGH PRIORITY: Use CLI Exceeded Counter Instead of Wireshark**

**Current (Our Plan)**:
```
4. Stop capture, analyze I/O graph in Wireshark (1-second intervals)
7. Record packets received in first second vs subsequent seconds
```

**Should Be (Like Automation)**:
```
4. Wait 3 seconds after burst
5. Execute: show port 1 rate-limit flood no-refresh
6. Read "Exceeded" counter (offset 6 for broadcast)
7. Verify exceeded counter matches expected drops
```

**Why**: CLI counter is more reliable, automatable, and matches production debugging

#### **3. MEDIUM PRIORITY: Add Quantitative Ordering Validation**

**Current (Our Plan)**:
```
Pass Criteria:
- First second: ~800-1000 packets (moderate burst)
- More than low, less than default
```

**Should Be (Like Automation)**:
```
Pass Criteria:
For burst_size=2048:
  drops(low) >= drops(medium) >= drops(high)
  With hardware tolerance: abs(drops(low) - drops(medium)) <= 50
  
Expected ranges:
  low:     ~1750-1800 drops
  medium:  ~1000-1050 drops
  high:    ~200-250 drops
  default: ~1000-1050 drops
```

#### **4. MEDIUM PRIORITY: Add Boundary Test**

**Add New Test Case**:
```
5.3.3: Verify Burst-Tolerance with Maximum Rate (262144 pps)

Test Methodology:
1. Configure: configure port 1 rate-limit flood broadcast 262144 burst-tolerance low
2. Verify command accepted
3. Send traffic at 500000 pps (above max rate)
4. Verify rate-limiting still functions correctly at maximum rate
5. Compare drops across all 4 tolerance levels

Pass Criteria: Burst-tolerance functional at maximum supported rate
```

#### **5. MEDIUM PRIORITY: Enhance Persistence Testing**

**Current (Our Plan)**:
```
5.5.1: Configure burst-tolerance low, save, reboot, verify config persists
```

**Should Add (Like Automation)**:
```
5.5.1-Enhanced:
1. Configure all 3 flood types with different tolerance levels:
   - broadcast: high
   - multicast: medium
   - unknown-destmac: low
2. Send traffic, record exceeded counters for all 3
3. Save and reboot
4. Verify configs persist via show command
5. Send same traffic, record exceeded counters
6. Compare pre vs post drops (within ±100 tolerance)
```

#### **6. LOW PRIORITY: Add Multi-Port Independence Test**

**Add New Test Case**:
```
5.6.2: Verify Burst-Tolerance Independence Across Multiple Ports

Test Methodology:
1. Configure port 1: burst-tolerance low
2. Configure port 2: burst-tolerance high
3. Send identical burst traffic (2048 frames) to both ports simultaneously
4. Read exceeded counters:
   - Port 1 (low): expect ~1750-1800 drops
   - Port 2 (high): expect ~200-250 drops
5. Verify port 1 drops > port 2 drops (by significant margin)

Pass Criteria: Each port's tolerance level is independent
```

---

### **Improvements Needed for Automation Scripts**

#### **1. Add Error Handling Tests**

**Missing in Automation**:
- Invalid burst-tolerance options (e.g., "very-low", "extreme")
- Numeric values (e.g., `burst-tolerance 100`)
- Typos (e.g., "loww", "medum")
- Configuration without rate-limit set

#### **2. Add SNMP MIB Validation**

**Missing in Automation**:
- Verify burst-tolerance exposed via SNMP MIB
- Test MIB SET operation (if supported)
- Trap generation with different tolerance levels

#### **3. Add Negative Test Cases**

**Missing in Automation**:
- Burst-tolerance configured before rate-limit
- Conflicting configurations
- Rapid tolerance level changes (race conditions)

---

## 🏆 **Final Assessment**

### **Overall Quality Comparison**

| Aspect | Automation Scripts | Our Generated Test Plan | Winner |
|--------|-------------------|------------------------|--------|
| **Burst Testing** | ⭐⭐⭐⭐⭐ (60 tests, BCM-aware) | ⭐⭐⭐ (Basic coverage) | 🥇 **Automation** |
| **CLI Validation** | ⭐⭐⭐⭐⭐ (All combinations) | ⭐⭐⭐⭐⭐ (All combinations) | 🤝 **Tie** |
| **Persistence** | ⭐⭐⭐⭐⭐ (Traffic + Config) | ⭐⭐⭐ (Config only) | 🥇 **Automation** |
| **Error Handling** | ⭐ (Missing) | ⭐⭐⭐⭐⭐ (Comprehensive) | 🥇 **Our Plan** |
| **SNMP/MIB** | ⭐ (Missing) | ⭐⭐⭐ (Basic test) | 🥇 **Our Plan** |
| **Out-Actions** | ⭐⭐⭐⭐⭐ (Integration) | ⭐⭐⭐⭐ (Basic) | 🥇 **Automation** |
| **Boundary Cases** | ⭐⭐⭐⭐ (Max rate test) | ⭐ (Missing) | 🥇 **Automation** |
| **Traffic Patterns** | ⭐⭐⭐ (Single burst) | ⭐⭐⭐⭐ (3 patterns) | 🥇 **Our Plan** |
| **Documentation** | ⭐⭐⭐ (Comments) | ⭐⭐⭐⭐⭐ (Full test plan) | 🥇 **Our Plan** |
| **Automation Readiness** | ⭐⭐⭐⭐⭐ (TCL scripts ready) | ⭐⭐⭐ (Manual steps) | 🥇 **Automation** |

### **Key Takeaways**

✅ **Automation Excels At**:
1. **Burst size variation** (500, 1024, 2048, 4096, 8000) aligned with BCM bucket boundaries
2. **Quantitative validation** with hardware tolerance (±50 packets)
3. **Traffic + config validation** (not just config persistence)
4. **Multi-port independence** testing
5. **Immediate automation readiness** (TCL scripts)

✅ **Our Test Plan Excels At**:
1. **Error handling** coverage (invalid options, typos, edge cases)
2. **SNMP MIB** validation
3. **Traffic pattern variations** (short burst, continuous, periodic)
4. **Backward compatibility** checks
5. **Comprehensive documentation** (test plan format)

---

## 📝 **Conclusion**

### **Summary**

The existing automation scripts (especially **1.26.2.9.tcl**) provide **superior burst traffic testing** through:
- **Matrix-based approach**: 5 burst sizes × 4 tolerance levels × 3 flood types = 60 tests
- **BCM-aware testing**: Burst sizes align with hardware bucket boundaries
- **Precise validation**: CLI exceeded counters with ±50 hardware tolerance
- **Traffic + config verification**: Tests functional behavior, not just configuration

Our generated test plan adds **complementary coverage** through:
- **Error handling**: Invalid options, typos, edge cases
- **SNMP MIB**: Validates management interface
- **Traffic patterns**: Short burst, continuous, periodic variations
- **Negative scenarios**: Configuration order dependencies

### **Recommendation**

**Hybrid Approach**:
1. **Use automation scripts** (1.26.2.9.tcl) for **core burst testing** (already implemented, superior approach)
2. **Add our error handling tests** (5.8.x) to automation suite (currently missing)
3. **Add our SNMP/MIB tests** (5.4.1) to automation suite
4. **Keep our traffic pattern variations** (5.10.x) as complementary manual tests

This provides **maximum coverage** with **minimum duplication**.

---

**Test Plan Version**: 2.0 (Revised after automation comparison)  
**Next Steps**: Merge error handling and SNMP tests into automation suite
