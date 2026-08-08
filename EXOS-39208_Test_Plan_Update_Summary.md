# EXOS-39208 Test Plan Update Summary
## Version 2.0 → Version 3.0

**Date**: 2026-07-07  
**Reason**: Alignment with existing automation scripts after comparison analysis

---

## 🎯 **Executive Summary**

Test Plan v3.0 incorporates critical improvements learned from analyzing production automation scripts at `/extreme/Regression/33.4_latest/exos-tcl-automation/automation/Functionaltest/L2_ratelimit/`. The updated plan uses **matrix-based burst testing**, **CLI exceeded counter validation**, and **quantitative drop ordering** aligned with BCM hardware behavior.

**Key Metrics**:
- **Test cases**: 32 → 34 (+2 new)
- **Sanity coverage**: 41% → 44% (+3%)
- **BCM-aware**: Added burst size variation (5 sizes) and BCM bucket mapping
- **Validation method**: Changed from Wireshark to CLI exceeded counter
- **Quantitative**: Added ±50 hardware tolerance for drop ordering

---

## 📊 **Major Changes**

### **1. Burst Testing Methodology (CRITICAL CHANGE)**

#### **Before (v2.0)**:
```
Methodology:
2. Configure Ixia1 to generate broadcast traffic at line rate (10 Gbps, 64-byte packets)
3. Start Wireshark capture on Ixia2
4. Send traffic for 5 seconds from Ixia1
5. Stop capture, analyze I/O graph in Wireshark (1-second intervals)
7. Record packets received in first second vs subsequent seconds

Pass Criteria:
- First second: ≤ 650 packets (≤ 30% over limit)
```

#### **After (v3.0)**:
```
Configuration:
- Rate-limit: 1000 pps (sets SDK default bucket at 1024)
- Burst sizes: 500, 1024, 2048, 4096, 8000 frames
- Burst rate: 10000 fps (10x CIR)
- Validation: CLI exceeded counter from 'show port rate-limit flood no-refresh'
- Hardware tolerance: ±50 packets

Methodology:
2. For each burst size in {500, 1024, 2048, 4096, 8000}:
   a. Execute: clear counters
   b. Execute: clear port 1 rate-limit flood out-of-profile
   c. Wait 1 second for hardware to settle
   d. Send single burst from Ixia: numFrames=<burst_size>, frameRate=10000 fps
   e. Wait 3 seconds for counters to update
   f. Execute: show port 1 rate-limit flood no-refresh
   g. Read "Exceeded" counter (broadcast offset 6, column 2)
   h. Record drops for this burst size

Expected Drops (burst-tolerance low, BCM bucket = 256):
| Burst Size | Expected Drops | Reasoning |
| 500        | ~240-290       | Small burst, low bucket allows ~256 through |
| 1024       | ~750-800       | At SDK boundary, ~256 allowed → ~768 dropped |
| 2048       | ~1750-1800     | Exceeds low bucket significantly |
| 4096       | ~3800-3900     | Well above low bucket |
| 8000       | ~7700-7800     | Extreme burst |
```

**Why This Matters**:
- **BCM bucket alignment**: Burst sizes {1024, 2048, 4096} align with BCM hardware quantization
- **Finite burst**: Tests actual burst bucket behavior (continuous traffic masks bucket differences)
- **Quantitative validation**: Specific drop counts based on BCM bucket sizes, not vague "~800-1000 packets"
- **Hardware-aware**: ±50 packet tolerance accounts for BCM ASIC timing variations

---

### **2. Validation Method Change**

#### **Before (v2.0)**:
```
Tools:
- Wireshark for packet capture and I/O graph analysis
- Manual PCAP export and analysis

Methodology:
4. Stop capture, export to PCAP
6. Analyze I/O graph in Wireshark (1-second intervals)
7. Record packets received in first second

Issues:
- Capture loss at line rate
- Post-processing required
- Imprecise (sampling, rounding)
- Not how users debug
```

#### **After (v3.0)**:
```
Tools:
- CLI exceeded counter (primary validation)
- Direct BCM ASIC hardware read

Methodology:
f. Execute: show port 1 rate-limit flood no-refresh
g. Read "Exceeded" counter (broadcast offset 6, column 2)
h. Record exact drop count

Example Output:
Port  Flood           Rate      Exceeded  Disabled
 1    Broadcast       1000      1789      -

Advantages:
✅ Direct hardware read (BCM ASIC counters)
✅ Automation-friendly (parseable CLI output)
✅ Production-ready (how users debug)
✅ Precise (exact drop count, no sampling)
```

**Impact**: More reliable, automatable, and matches production debugging workflows.

---

### **3. Quantitative Drop Ordering Validation**

#### **Before (v2.0)**:
```
5.2.7: Verify Burst-Tolerance Comparison (All 4 Levels)

Pass Criteria:
- low: ≤ 650 packets (most aggressive)
- medium: ~800-1000 packets
- high: ~1200-1500 packets
- default: ~1500-2000 packets (baseline)
- Clear progression of burst tolerance
```

#### **After (v3.0)**:
```
5.2.5: Verify Quantitative Drop Ordering - All Burst Sizes

Test Methodology:
1. For each burst size {500, 1024, 2048, 4096, 8000}:
   a. Compare drops across tolerance levels from previous tests
   b. Verify ordering: drops(low) >= drops(medium) >= drops(high)
   c. Account for hardware tolerance: abs(drops_A - drops_B) <= 50 means equivalent
   d. Document any violations

Expected Ordering (example for burst_size=2048):
- low: ~1750-1800 drops
- medium: ~1000-1100 drops
- high: ~0-100 drops
- default: ~1000-1100 drops
- Verification: 1800 >= 1100 >= 100 ✅

Pass Criteria:
- For ALL burst sizes: drops(low) >= drops(medium) >= drops(high) (within ±50)
- Clear differentiation between tolerance levels
- Ordering consistent across all 5 burst sizes
```

**Impact**: Programmatic validation catches subtle BCM bucket mapping issues.

---

### **4. BCM Hardware Details Added**

#### **Added Section 1.5: BCM Hardware Details**

```markdown
**BCM Burst Bucket Quantization**: {1, 4, 16, 64, 256, 1024, 2048, 4096, ...}

**At 1000 pps configured rate**:
- low: 256 frames (one BCM bucket below SDK default)
- medium: 1024 frames (SDK default bucket)
- high: 2048 frames (one BCM bucket above SDK default)
- default: 1024 frames (Extreme's algorithm, ≥ configured rate)

**Hardware Tolerance**: ±50 packets for drop count comparisons
```

**Impact**: Provides context for expected drop counts and tolerance level behavior.

---

### **5. Enhanced Persistence Testing**

#### **Before (v2.0)**:
```
5.5.1: Verify Burst-Tolerance Persists After Reboot

Methodology:
1. Configure burst-tolerance low
2. save configuration
3. reboot
4. show port information detail
5. Verify burst-tolerance configuration persists

Pass Criteria:
- Burst-tolerance configuration persists after reboot
```

#### **After (v3.0)**:
```
5.5.1: Verify Burst-Tolerance Persists After Reboot (Config + Traffic)

Methodology:
1. Configure burst-tolerance low
2. Pre-Reboot Traffic Test:
   a. Send burst_size=2048, record exceeded counter (expect ~1750-1800)
3. save configuration
4. reboot
5. Wait for switch to come back up
6. show port information detail
7. Verify burst-tolerance low configuration persists
8. Post-Reboot Traffic Test:
   a. Send burst_size=2048, record exceeded counter
   b. Compare with pre-reboot drops (should match within ±100)

Pass Criteria:
- Burst-tolerance configuration persists after reboot
- Traffic behavior consistent before and after reboot
- Pre-reboot drops ≈ Post-reboot drops (within ±100 tolerance)
```

**Impact**: Validates functional behavior, not just configuration persistence. Catches BCM state initialization issues.

---

## ➕ **New Test Cases (v3.0)**

### **5.2.5: Verify Quantitative Drop Ordering - All Burst Sizes**
- **Purpose**: Programmatically verify `drops(low) >= drops(medium) >= drops(high)` across all 5 burst sizes
- **Sanity**: Yes
- **Automatable**: Yes

### **5.3.5: Verify Maximum Rate (262144 pps) with Burst-Tolerance**
- **Purpose**: Boundary test at maximum supported rate
- **Sanity**: No
- **Automatable**: Yes

### **5.6.2: Verify Multi-Port Independence (Low vs High Simultaneously)**
- **Purpose**: Test low on port 1, high on port 2 with identical bursts
- **Sanity**: No
- **Automatable**: Yes

---

## 🔧 **Enhanced Test Cases**

### **5.2.1-5.2.4: Burst Tolerance Testing (All Levels)**
- ✅ **Added**: Burst size variation (500, 1024, 2048, 4096, 8000)
- ✅ **Changed**: Validation from Wireshark to CLI exceeded counter
- ✅ **Added**: Expected drop count tables based on BCM bucket sizes
- ✅ **Added**: Hardware tolerance (±50 packets)
- ✅ **Changed**: From continuous line-rate to finite burst (numFrames parameter)

### **5.5.1: Persistence Testing**
- ✅ **Added**: Pre-reboot traffic validation
- ✅ **Added**: Post-reboot traffic validation
- ✅ **Added**: Quantitative comparison (pre vs post drops within ±100)

### **5.9.2: Out-Actions Integration**
- ✅ **Added**: Test out-actions with low AND high tolerance (not just low)
- ✅ **Added**: Verify tolerance level change doesn't break out-actions

---

## 📈 **Test Coverage Comparison**

| Metric | v2.0 | v3.0 | Change |
|--------|------|------|--------|
| **Total Test Cases** | 32 | 34 | +2 |
| **Sanity Tests** | 13 (41%) | 15 (44%) | +2 (+3%) |
| **Automatable** | 32 (100%) | 34 (100%) | +2 |
| **Burst Testing Matrix** | 1 rate (line rate) | 5 burst sizes | **5x coverage** |
| **Validation Method** | Wireshark I/O graph | CLI exceeded counter | **More reliable** |
| **Quantitative Validation** | Qualitative ranges | ±50 hardware tolerance | **Precise** |
| **Boundary Tests** | 0 | 1 (max rate) | **+1** |
| **Multi-Port Tests** | 1 (sequential) | 2 (+ simultaneous) | **+1** |

---

## 🎓 **Key Learnings Applied**

### **From Automation Script 1.26.2.9.tcl**:

1. **Burst Size Selection**:
   ```tcl
   set burst_sizes {500 1024 2048 4096 8000}
   # Aligned to BCM bucket boundaries
   ```
   - **Applied**: Test all 5 burst sizes in 5.2.1-5.2.4

2. **Finite Burst vs Continuous**:
   ```tcl
   SendFrame -numFrames "$burst_size" -frameRate "$burst_rate"
   # NOT continuous stream
   ```
   - **Applied**: Changed from continuous to finite burst (numFrames parameter)

3. **Exceeded Counter Validation**:
   ```tcl
   set drops_by_level($level) [GetKeyValue "show port rate-limit flood no-refresh" ...]
   ```
   - **Applied**: Primary validation method changed to CLI exceeded counter

4. **Drop Ordering Check**:
   ```tcl
   if { $drops_by_level(low) >= $drops_by_level(medium) || \
        [expr $drops_by_level(medium) - $drops_by_level(low)] <= $hw_tolerance }
   ```
   - **Applied**: Added testcase 5.2.5 with quantitative ordering validation

5. **Hardware Tolerance**:
   ```tcl
   set hw_tolerance 50  ;# ±50 packets for comparisons
   ```
   - **Applied**: Added ±50 packet tolerance throughout test plan

6. **Persistence with Traffic**:
   ```tcl
   # Pre-reboot: send traffic, record drops
   # Reboot
   # Post-reboot: send traffic, compare drops
   ```
   - **Applied**: Enhanced testcase 5.5.1 with traffic validation

---

## 📋 **Migration Guide (v2.0 → v3.0)**

### **For QA Engineers**:

1. **Update Ixia Configuration**:
   - ❌ Remove: Continuous line-rate streams
   - ✅ Add: Finite burst streams with `numFrames` parameter
   - ✅ Configure: 5 burst sizes (500, 1024, 2048, 4096, 8000)
   - ✅ Set: frameRate = 10000 fps (10x CIR)

2. **Change Validation Method**:
   - ❌ Remove: Wireshark capture and I/O graph analysis
   - ✅ Add: CLI commands:
     ```bash
     clear counters
     clear port 1 rate-limit flood out-of-profile
     # <send burst>
     # <wait 3 seconds>
     show port 1 rate-limit flood no-refresh
     # Read "Exceeded" column
     ```

3. **Update Pass Criteria**:
   - ❌ Remove: "First second: ~800-1000 packets"
   - ✅ Add: "Drops for burst_size=2048 with low: ~1750-1800 (within ±50)"

4. **Add New Test Cases**:
   - 5.2.5: Quantitative drop ordering
   - 5.3.5: Boundary test at 262144 pps
   - 5.6.2: Multi-port independence

### **For Automation Engineers**:

1. **Burst Traffic Function**:
   ```python
   # Before (v2.0)
   def send_burst_traffic(port, rate_limit):
       ixia.start_continuous_traffic(port, rate="line_rate", duration=5)
       time.sleep(5)
       return analyze_wireshark_pcap()
   
   # After (v3.0)
   def send_burst_traffic(port, rate_limit, burst_size):
       cli.execute("clear counters")
       cli.execute(f"clear port {port} rate-limit flood out-of-profile")
       time.sleep(1)
       ixia.send_burst(port, num_frames=burst_size, frame_rate=10000)
       time.sleep(3)
       output = cli.execute(f"show port {port} rate-limit flood no-refresh")
       return parse_exceeded_counter(output, flood_type="broadcast")
   ```

2. **Drop Ordering Validation**:
   ```python
   # v3.0 addition
   def validate_drop_ordering(burst_size, drops_low, drops_medium, drops_high):
       hw_tolerance = 50
       
       # Check low >= medium
       if not (drops_low >= drops_medium or 
               abs(drops_medium - drops_low) <= hw_tolerance):
           return False, "Ordering violation: low < medium"
       
       # Check medium >= high
       if not (drops_medium >= drops_high or 
               abs(drops_high - drops_medium) <= hw_tolerance):
           return False, "Ordering violation: medium < high"
       
       return True, f"Ordering correct: {drops_low} >= {drops_medium} >= {drops_high}"
   ```

---

## 🔍 **What Stays the Same**

1. **Test topology** (Ixia1 → DUT → Ixia2)
2. **Hardware requirements** (5720-24MXW FE, Ixia XM2/XM12)
3. **CLI syntax validation** (testcases 5.1.1-5.1.4)
4. **Error handling tests** (testcases 5.8.1-5.8.3)
5. **SNMP MIB tests** (testcase 5.4.1)
6. **Out-actions tests** (testcases 5.9.x, enhanced but not replaced)
7. **Traffic pattern tests** (testcases 5.10.x)
8. **Negative scenarios** (testcases 5.11.x)

---

## ✅ **Validation Checklist**

Before executing Test Plan v3.0:

- [ ] Ixia supports `numFrames` parameter (finite burst mode)
- [ ] CLI `show port rate-limit flood no-refresh` available in EXOS 33.7
- [ ] BCM ASIC platform (5720-24MXW FE confirmed)
- [ ] Understanding of BCM bucket quantization ({256, 1024, 2048, 4096})
- [ ] Automation scripts can parse "Exceeded" counter from CLI output
- [ ] Test environment supports 5 burst sizes (500, 1024, 2048, 4096, 8000)

---

## 📊 **Expected Outcomes**

### **Improved Test Quality**:
1. **BCM-aware testing**: Burst sizes aligned to hardware boundaries
2. **Quantitative validation**: Precise drop counts with ±50 tolerance
3. **Production-ready**: CLI counter validation matches user debugging
4. **Behavioral verification**: Persistence testing includes traffic validation

### **Better Bug Detection**:
1. **BCM bucket mapping issues**: Wrong bucket selection for tolerance level
2. **State initialization**: BCM state not restored after reboot
3. **Hardware edge cases**: Behavior at bucket boundaries (1024, 2048)
4. **Multi-port isolation**: Tolerance level not per-port isolated

### **Automation Alignment**:
1. **Consistent with existing automation**: Matches `/extreme/Regression/` scripts
2. **Reusable test methodology**: Can adapt to other BCM-based features
3. **Maintainable**: Clear quantitative criteria, no manual PCAP analysis

---

## 📝 **Appendix: Version History**

| Version | Date | Changes | Reason |
|---------|------|---------|--------|
| **1.0** | 2026-07-07 | Initial (WRONG CLI syntax) | Assumed numeric bucketsize parameter |
| **2.0** | 2026-07-07 | Corrected CLI syntax (enum) | User-provided correct syntax |
| **3.0** | 2026-07-07 | **This version** | Automation script comparison |

---

**Document Status**: Ready for QA Review  
**Next Action**: Team review and test execution planning  
**Contact**: QA Team Lead for questions

---
