# EXOS-39208 Functional Test Plan
## Flood Rate-Limit Burst-Tolerance CLI Enhancement
## **DETAILED AUTOMATION-READY VERSION**

**Feature**: Configure burst-tolerance level for flood rate-limit  
**Jira**: EXOS-39208  
**Release**: EXOS 33.7 (TBD)  
**Test Plan Version**: 3.1 (Detailed automation-ready steps)  
**Date**: 2026-07-07  
**Changes from v3.0**: Added exact CLI commands, Ixia parameters, parsing details, verification logic for automation

---

## 1. Introduction

### 1.1 Feature Overview
This test plan covers the CLI enhancement to configure **burst-tolerance** parameter for flood rate-limit functionality. The feature provides predefined tolerance levels (default, low, medium, high) to control burst traffic handling at the BCM ASIC level.

### 1.2 Test Plan Goals
- **Automation-ready**: Every test case has exact CLI commands, Ixia parameters, and parsing details
- **Script-friendly**: Steps match automation script patterns from `/extreme/Regression/.../L2_ratelimit/`
- **Reproducible**: Anyone can execute tests without interpretation

---

## 2. Test Environment Setup

### 2.1 Test Topology

```
Topology-1: Burst Traffic Validation

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

### 2.2 Base Configuration

```bash
# Login to DUT
Login $DUT1_CONNECT

# Get mapped port IDs
set port1 [MapDUTPortId 1 1]  # Egress port (rate-limited)
set port3 [MapDUTPortId 3 1]  # Ingress port

# Create test VLAN
SendACmd "create vlan burst_test"
SendACmd "configure vlan burst_test add ports $port1 $port3 untagged"

# Port configuration
SendACmd "enable jumbo-frame ports $port1 $port3"
SendACmd "configure ports $port1 $port3 auto off speed 10000 duplex full"

# Clear initial state
SendACmd "clear counters"
SendACmd "clear fdb"
```

### 2.3 Global Test Variables

```tcl
# Configuration
set rate_limit 1000                              # 1000 pps
set burst_sizes {500 1024 2048 4096 8000}       # 5 burst sizes
set tolerance_levels {low medium high default}   # All 4 levels
set burst_rate 10000                             # 10x CIR (10000 fps)
set hw_tolerance 50                              # ±50 packets for comparisons

# Traffic parameters
set src_mac "00:00:01:00:09:01"                 # Source MAC
set dest_mac_bc "ff:ff:ff:ff:ff:ff"             # Broadcast
set dest_mac_mc "01:00:00:01:01:01"             # Multicast
set dest_mac_uuc "00:00:00:99:99:99"            # Unknown unicast
set frame_size 128                               # 128 bytes (64-byte minimum + headers)

# Counter offsets (for parsing show output)
set bc_counter_offset 6                          # Broadcast at line 6
set mc_counter_offset 5                          # Multicast at line 5
set uuc_counter_offset 6                         # Unknown-destmac at line 6
set exceeded_column 2                            # "Exceeded" is column 2
```

---

## 3. Test Helper Functions

### 3.1 Send Single Burst Function

```tcl
proc SendSingleBurst {txPortId destMac sourceMac numFrames frameRate frameSize} {
    # Send finite burst of frames
    # IMPORTANT: Use numFrames (not continuous stream)
    
    SendFrame -txPortId $txPortId \
              -destMac    $destMac \
              -sourceMac  $sourceMac \
              -numFrames  $numFrames \
              -frameRate  $frameRate \
              -streamType "singleBurst" \
              -frameSize  $frameSize
    
    # Note: streamType "singleBurst" ensures finite transmission
    # NOT "contPacket" which is continuous
}
```

### 3.2 Read Exceeded Counter Function

```tcl
proc GetExceededCounter {port flood_type} {
    # Parse "Exceeded" counter from CLI output
    # flood_type: "broadcast", "multicast", "unknown-destmac"
    
    # Set counter offset based on flood type
    if {$flood_type == "broadcast"} {
        set offset 6
    } elseif {$flood_type == "multicast"} {
        set offset 5
    } else {
        set offset 6  ;# unknown-destmac
    }
    
    # Execute show command (no-refresh for accurate drops)
    set paramList ""
    lappend paramList "Exceeded $offset 2"
    set exceeded [GetKeyValue "show port $port rate-limit flood no-refresh" $paramList]
    unset paramList
    
    return $exceeded
}
```

### 3.3 Verify Drop Ordering Function

```tcl
proc VerifyDropOrdering {burst_size drops_low drops_medium drops_high hw_tolerance} {
    # Verify: drops(low) >= drops(medium) >= drops(high)
    # With hardware tolerance
    
    set pass 1
    set msg "burst=$burst_size: low=$drops_low medium=$drops_medium high=$drops_high"
    
    # Check low >= medium (within tolerance)
    if {$drops_low >= $drops_medium || \
        [expr abs($drops_medium - $drops_low)] <= $hw_tolerance} {
        # OK
    } else {
        set pass 0
        result_error "Ordering VIOLATED: low ($drops_low) < medium ($drops_medium)"
    }
    
    # Check medium >= high (within tolerance)
    if {$drops_medium >= $drops_high || \
        [expr abs($drops_high - $drops_medium)] <= $hw_tolerance} {
        # OK
    } else {
        set pass 0
        result_error "Ordering VIOLATED: medium ($drops_medium) < high ($drops_high)"
    }
    
    if {$pass} {
        result_ok "$msg — ordering correct (within ±$hw_tolerance)"
    }
    
    return $pass
}
```

---

## 4. Test Cases with Detailed Steps

### 5.1 Conformance Testing

#### 5.1.1 Verify CLI Syntax - Burst-Tolerance Default

**Topology used**: Topology-1

**Detailed Test Methodology**:

```tcl
# Step 1: Login to DUT
Login $DUT1_CONNECT

# Step 2: Get mapped port ID
set port1 [MapDUTPortId 1 1]

# Step 3: Configure burst-tolerance default
SendACmd "configure port $port1 rate-limit flood broadcast 1000 burst-tolerance default"

# Step 4: Verify command accepted (no error in result buffer)
# Framework automatically checks for errors; test continues if accepted

# Step 5: Execute show command
set show_output [SendACmd "show port $port1 information detail"]

# Step 6: Verify output contains burst-tolerance
set parameterList ""
lappend parameterList "{Broadcast Rate.*1000 packets-per-second.*Burst Tolerance:.*Default} exist"
CheckKeyValue "show port $port1 information detail" $parameterList \
              -comment "Verify broadcast 1000 pps with Burst Tolerance: Default"
unset parameterList
```

**Expected Show Output**:
```
Port: 1
...
Broadcast Rate: 1000 packets-per-second, Burst Tolerance: Default
  Exceeded:  0
  Out-Actions: None
...
```

**Pass Criteria**: 
- Command accepted without error
- Show output contains "Burst Tolerance: Default"
- Broadcast rate shows 1000 pps

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.1.2 Verify CLI Syntax - Burst-Tolerance Low

**Topology used**: Topology-1

**Detailed Test Methodology**:

```tcl
# Step 1: Get port ID (already logged in from 5.1.1)
set port1 [MapDUTPortId 1 1]

# Step 2: Configure burst-tolerance low for multicast
SendACmd "configure port $port1 rate-limit flood multicast 1000 burst-tolerance low"

# Step 3: Verify with show command
set parameterList ""
lappend parameterList "{Multicast Rate.*1000 packets-per-second.*Burst Tolerance:.*Low} exist"
CheckKeyValue "show port $port1 information detail" $parameterList \
              -comment "Verify multicast 1000 pps with Burst Tolerance: Low"
unset parameterList
```

**Expected Show Output**:
```
Port: 1
...
Multicast Rate: 1000 packets-per-second, Burst Tolerance: Low
  Exceeded:  0
  Out-Actions: None
...
```

**Pass Criteria**: 
- Command accepted
- Show output contains "Burst Tolerance: Low"
- Multicast rate shows 1000 pps

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.1.3 Verify CLI Syntax - Burst-Tolerance Medium

**Topology used**: Topology-1

**Detailed Test Methodology**:

```tcl
# Step 1: Configure burst-tolerance medium for unknown-destmac
SendACmd "configure port $port1 rate-limit flood unknown-destmac 1000 burst-tolerance medium"

# Step 2: Verify with show command
set parameterList ""
lappend parameterList "{Unknown Dest Mac Rate.*1000 packets-per-second.*Burst Tolerance:.*Medium} exist"
CheckKeyValue "show port $port1 information detail" $parameterList \
              -comment "Verify unknown-destmac 1000 pps with Burst Tolerance: Medium"
unset parameterList
```

**Expected Show Output**:
```
Port: 1
...
Unknown Dest Mac Rate: 1000 packets-per-second, Burst Tolerance: Medium
  Exceeded:  0
  Out-Actions: None
...
```

**Pass Criteria**: 
- Command accepted
- Show output contains "Burst Tolerance: Medium"

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.1.4 Verify CLI Syntax - Burst-Tolerance High

**Topology used**: Topology-1

**Detailed Test Methodology**:

```tcl
# Step 1: Configure burst-tolerance high for broadcast
SendACmd "configure port $port1 rate-limit flood broadcast 1000 burst-tolerance high"

# Step 2: Verify with show command
set parameterList ""
lappend parameterList "{Broadcast Rate.*1000 packets-per-second.*Burst Tolerance:.*High} exist"
CheckKeyValue "show port $port1 information detail" $parameterList \
              -comment "Verify broadcast 1000 pps with Burst Tolerance: High"
unset parameterList
```

**Pass Criteria**: 
- Command accepted
- Show output contains "Burst Tolerance: High"

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

### 5.2 Functional Specification - Burst Size Variation Testing

**Global Configuration for 5.2.x**:
```tcl
set rate_limit 1000
set burst_sizes {500 1024 2048 4096 8000}
set tolerance_levels {low medium high default}
set burst_rate 10000
set hw_tolerance 50
```

---

#### 5.2.1 Verify Burst-Tolerance Low - Single Burst Testing

**Topology used**: Topology-1

**Detailed Test Methodology**:

```tcl
proc 5.2.1 {} {
    global DUT1_CONNECT
    global rate_limit burst_sizes burst_rate hw_tolerance
    
    # Step 1: Login and get ports
    Login $DUT1_CONNECT
    set port1 [MapDUTPortId 1 1]
    set port3 [MapDUTPortId 3 1]
    
    # Step 2: Configure burst-tolerance low
    SendACmd "configure port $port1 rate-limit flood broadcast $rate_limit burst-tolerance low"
    
    # Step 3: Verify configuration
    set parameterList ""
    lappend parameterList "{Broadcast Rate.*${rate_limit} packets-per-second.*Burst Tolerance:.*Low} exist"
    CheckKeyValue "show port $port1 information detail" $parameterList \
                  -comment "Verify broadcast ${rate_limit} pps with Low tolerance configured"
    unset parameterList
    
    # Step 4: Initialize results array
    array set drops_by_size {}
    
    # Step 5: Loop through each burst size
    foreach burst_size $burst_sizes {
        
        result_debug "===== Testing burst_size = $burst_size frames ====="
        
        # Step 5a: Clear counters
        SendACmd "clear counters"
        SendACmd "clear port $port1 rate-limit flood out-of-profile"
        
        # Step 5b: Wait for hardware to settle
        exSleep 1
        
        # Step 5c: Send single burst from Ixia
        SendFrame -txPortId 1 \
                  -destMac    "ff:ff:ff:ff:ff:ff" \
                  -sourceMac  "00:00:01:00:09:01" \
                  -numFrames  $burst_size \
                  -frameRate  $burst_rate \
                  -streamType "singleBurst" \
                  -frameSize  128
        
        # Step 5d: Wait for burst to complete and counters to update
        exSleep 3
        
        # Step 5e: Read exceeded counter
        set paramList ""
        lappend paramList "Exceeded 6 2"
        set drops_by_size($burst_size) [GetKeyValue "show port $port1 rate-limit flood no-refresh" $paramList]
        unset paramList
        
        # Step 5f: Log result
        result_debug "burst_size=$burst_size: exceeded = $drops_by_size($burst_size)"
        
        # Step 5g: Verify drops observed for burst_size > 256
        if {$burst_size > 256} {
            report_start_test "Burst $burst_size: Verify drops > 0 with low tolerance"
            if {$drops_by_size($burst_size) > 0} {
                result_ok "Drops observed: $drops_by_size($burst_size) (burst exceeds BCM bucket 256)"
            } else {
                result_error "Zero drops for burst=$burst_size — expected drops > 0 with low tolerance (BCM bucket 256)"
            }
            report_end_test
        }
    }
    
    # Step 6: Verify drops increase with burst size
    report_start_test "Verify drops increase monotonically with burst size"
    set prev_drops 0
    set monotonic 1
    foreach burst_size $burst_sizes {
        if {$drops_by_size($burst_size) < $prev_drops} {
            set monotonic 0
            result_error "Drop ordering VIOLATED: burst=$burst_size has fewer drops than previous burst"
        }
        set prev_drops $drops_by_size($burst_size)
    }
    if {$monotonic} {
        result_ok "Drops increase with burst size as expected"
    }
    report_end_test
    
    # Step 7: Verify specific expected drop counts
    report_start_test "Verify expected drop counts for low tolerance (BCM bucket 256)"
    
    # At burst_size=1024: expect ~750-800 drops (1024 - 256 = 768)
    set expected_min_1024 700
    set expected_max_1024 850
    if {$drops_by_size(1024) >= $expected_min_1024 && \
        $drops_by_size(1024) <= $expected_max_1024} {
        result_ok "burst=1024: drops=$drops_by_size(1024) within expected range [700-850]"
    } else {
        result_error "burst=1024: drops=$drops_by_size(1024) outside expected range [700-850]"
    }
    
    # At burst_size=2048: expect ~1750-1800 drops (2048 - 256 = 1792)
    set expected_min_2048 1700
    set expected_max_2048 1850
    if {$drops_by_size(2048) >= $expected_min_2048 && \
        $drops_by_size(2048) <= $expected_max_2048} {
        result_ok "burst=2048: drops=$drops_by_size(2048) within expected range [1700-1850]"
    } else {
        result_error "burst=2048: drops=$drops_by_size(2048) outside expected range [1700-1850]"
    }
    
    report_end_test
    
    # Step 8: Cleanup
    SendACmd "configure port $port1 rate-limit flood broadcast no-limit"
    SendACmd "clear counters"
}
```

**Expected Drops Table** (burst-tolerance low, BCM bucket = 256):

| Burst Size | Expected Drops | Tolerance Range | BCM Reasoning |
|-----------|----------------|-----------------|---------------|
| 500 | ~240-290 | 190-340 | Small burst, ~256 allowed through |
| 1024 | ~750-800 | 700-850 | At SDK boundary: 1024 - 256 = 768 |
| 2048 | ~1750-1800 | 1700-1850 | Well above bucket: 2048 - 256 = 1792 |
| 4096 | ~3800-3900 | 3750-3950 | 4096 - 256 = 3840 |
| 8000 | ~7700-7800 | 7650-7850 | 8000 - 256 = 7744 |

**Show Command Output Example**:
```
# show port 1 rate-limit flood no-refresh

Port  Flood           Rate      Exceeded  Disabled
 1    Broadcast       1000      1789      -
 1    Multicast       No Limit  -         -
 1    Unknown DestMac No Limit  -         -

# Parsing: Line 1 (port 1 broadcast) → Column "Exceeded" = 1789
```

**Pass Criteria**: 
- For burst_size > 256: Exceeded counter > 0
- Drops increase monotonically with burst size
- burst=1024: drops in range [700-850]
- burst=2048: drops in range [1700-1850]
- All 5 burst sizes tested successfully

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.2 Verify Burst-Tolerance Medium - Single Burst Testing

**Topology used**: Topology-1

**Detailed Test Methodology**:

```tcl
proc 5.2.2 {} {
    global DUT1_CONNECT
    global rate_limit burst_sizes burst_rate hw_tolerance
    
    # Step 1: Login and get ports
    Login $DUT1_CONNECT
    set port1 [MapDUTPortId 1 1]
    
    # Step 2: Configure burst-tolerance medium
    SendACmd "configure port $port1 rate-limit flood broadcast $rate_limit burst-tolerance medium"
    
    # Step 3: Initialize results array
    array set drops_by_size {}
    
    # Step 4: Loop through each burst size
    foreach burst_size $burst_sizes {
        
        result_debug "===== Testing burst_size = $burst_size frames (medium tolerance) ====="
        
        # Clear counters
        SendACmd "clear counters"
        SendACmd "clear port $port1 rate-limit flood out-of-profile"
        exSleep 1
        
        # Send single burst
        SendFrame -txPortId 1 \
                  -destMac    "ff:ff:ff:ff:ff:ff" \
                  -sourceMac  "00:00:01:00:09:02" \
                  -numFrames  $burst_size \
                  -frameRate  $burst_rate \
                  -streamType "singleBurst" \
                  -frameSize  128
        
        # Wait and read counter
        exSleep 3
        
        set paramList ""
        lappend paramList "Exceeded 6 2"
        set drops_by_size($burst_size) [GetKeyValue "show port $port1 rate-limit flood no-refresh" $paramList]
        unset paramList
        
        result_debug "burst_size=$burst_size: exceeded = $drops_by_size($burst_size)"
    }
    
    # Step 5: Verify expected drop counts for medium (BCM bucket 1024)
    report_start_test "Verify expected drop counts for medium tolerance (BCM bucket 1024)"
    
    # burst_size=500: expect 0-50 (all or most allowed)
    if {$drops_by_size(500) <= 50} {
        result_ok "burst=500: drops=$drops_by_size(500) ≤ 50 (burst < bucket, mostly allowed)"
    } else {
        result_error "burst=500: drops=$drops_by_size(500) > 50 (expected minimal drops)"
    }
    
    # burst_size=1024: expect 0-100 (at bucket boundary)
    if {$drops_by_size(1024) <= 100} {
        result_ok "burst=1024: drops=$drops_by_size(1024) ≤ 100 (at bucket boundary)"
    } else {
        result_error "burst=1024: drops=$drops_by_size(1024) > 100 (expected minimal drops at boundary)"
    }
    
    # burst_size=2048: expect ~1000-1100 (2048 - 1024 = 1024)
    if {$drops_by_size(2048) >= 950 && $drops_by_size(2048) <= 1150} {
        result_ok "burst=2048: drops=$drops_by_size(2048) within [950-1150] (2048-1024=1024)"
    } else {
        result_error "burst=2048: drops=$drops_by_size(2048) outside [950-1150]"
    }
    
    report_end_test
    
    # Cleanup
    SendACmd "configure port $port1 rate-limit flood broadcast no-limit"
}
```

**Expected Drops Table** (burst-tolerance medium, BCM bucket = 1024):

| Burst Size | Expected Drops | Tolerance Range | BCM Reasoning |
|-----------|----------------|-----------------|---------------|
| 500 | 0-50 | 0-100 | Burst < bucket, all/most allowed |
| 1024 | 0-100 | 0-150 | At bucket boundary |
| 2048 | ~1000-1100 | 950-1150 | 2048 - 1024 = 1024 |
| 4096 | ~3000-3100 | 2950-3150 | 4096 - 1024 = 3072 |
| 8000 | ~6900-7100 | 6850-7150 | 8000 - 1024 = 6976 |

**Pass Criteria**: 
- burst=500: drops ≤ 50
- burst=1024: drops ≤ 100
- burst=2048: drops in [950-1150]
- Behavior shows larger bucket than low tolerance

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.5 Verify Quantitative Drop Ordering - All Burst Sizes

**Topology used**: Topology-1

**Prerequisites**: Testcases 5.2.1 through 5.2.4 completed (results stored)

**Detailed Test Methodology**:

```tcl
proc 5.2.5 {} {
    global DUT1_CONNECT
    global rate_limit burst_sizes hw_tolerance
    
    # Step 1: Retrieve results from previous tests
    # Assume results stored in global arrays:
    # drops_low(burst_size), drops_medium(burst_size), drops_high(burst_size)
    
    global drops_low drops_medium drops_high drops_default
    
    # Step 2: Loop through each burst size
    foreach burst_size $burst_sizes {
        
        result_h2 "Verify drop ordering for burst_size = $burst_size"
        report_start_test "Drop ordering: burst=$burst_size"
        
        # Step 3: Get drops for all tolerance levels
        set d_low $drops_low($burst_size)
        set d_med $drops_medium($burst_size)
        set d_high $drops_high($burst_size)
        set d_def $drops_default($burst_size)
        
        # Step 4: Build message
        set msg "burst=$burst_size: low=$d_low medium=$d_med high=$d_high default=$d_def"
        result_debug $msg
        
        # Step 5: Verify ordering: low >= medium (within tolerance)
        set pass 1
        if {$d_low >= $d_med || [expr abs($d_med - $d_low)] <= $hw_tolerance} {
            # OK
        } else {
            set pass 0
            result_error "ORDERING VIOLATION: low ($d_low) < medium ($d_med) by more than $hw_tolerance"
        }
        
        # Step 6: Verify ordering: medium >= high (within tolerance)
        if {$d_med >= $d_high || [expr abs($d_high - $d_med)] <= $hw_tolerance} {
            # OK
        } else {
            set pass 0
            result_error "ORDERING VIOLATION: medium ($d_med) < high ($d_high) by more than $hw_tolerance"
        }
        
        # Step 7: Report result
        if {$pass} {
            result_ok "$msg — ordering correct (within ±$hw_tolerance)"
        } else {
            result_error "$msg — ordering VIOLATED"
        }
        
        report_end_test
        
        # Step 8: Additional check for burst > 256
        if {$burst_size > 256} {
            report_start_test "burst=$burst_size: Verify low tolerance has drops > 0"
            if {$d_low > 0} {
                result_ok "low tolerance correctly drops packets for burst=$burst_size (exceeds BCM bucket 256)"
            } else {
                result_error "low tolerance had 0 drops for burst=$burst_size — unexpected (burst > 256)"
            }
            report_end_test
        }
    }
}
```

**Expected Ordering Example** (burst_size=2048):

| Tolerance Level | Drops | BCM Bucket | Formula |
|----------------|-------|------------|---------|
| **low** | ~1750-1800 | 256 | 2048 - 256 = 1792 |
| **medium** | ~1000-1100 | 1024 | 2048 - 1024 = 1024 |
| **high** | ~0-100 | 2048 | 2048 - 2048 = 0 |
| **default** | ~1000-1100 | ~1024 | Similar to medium |

**Verification Logic**:
```
Condition 1: drops(low) >= drops(medium) OR |drops(medium) - drops(low)| <= 50
Condition 2: drops(medium) >= drops(high) OR |drops(high) - drops(medium)| <= 50

Both must be TRUE for pass.

Example:
  low=1789, medium=1024, high=87
  Check 1: 1789 >= 1024 → TRUE ✓
  Check 2: 1024 >= 87 → TRUE ✓
  PASS
```

**Pass Criteria**: 
- For ALL burst sizes: drops(low) >= drops(medium) >= drops(high) within ±50
- Clear differentiation between tolerance levels
- Ordering consistent across all 5 burst sizes
- No violations reported

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

### 5.5 Redundancy/Resiliency

#### 5.5.1 Verify Burst-Tolerance Persists After Reboot (Config + Traffic)

**Topology used**: Topology-1

**Detailed Test Methodology**:

```tcl
proc 5.5.1 {} {
    global DUT1_CONNECT
    
    # Step 1: Login and setup
    Login $DUT1_CONNECT
    set port1 [MapDUTPortId 1 1]
    set port2 [MapDUTPortId 2 1]
    
    # Step 2: Create test VLAN
    SendACmd "create vlan persist_test"
    SendACmd "configure vlan persist_test add ports $port1 $port2 untagged"
    
    # Step 3: Configure burst-tolerance on all 3 flood types (different levels)
    SendACmd "configure port $port1 rate-limit flood broadcast 1000 burst-tolerance low"
    SendACmd "configure port $port1 rate-limit flood multicast 1000 burst-tolerance medium"
    SendACmd "configure port $port1 rate-limit flood unknown-destmac 1000 burst-tolerance high"
    
    # Step 4: Verify configuration before reboot
    report_start_test "Verify configuration before reboot"
    set parameterList ""
    lappend parameterList "{Broadcast Rate.*1000 packets-per-second.*Burst Tolerance:.*Low} exist"
    lappend parameterList "{Multicast Rate.*1000 packets-per-second.*Burst Tolerance:.*Medium} exist"
    lappend parameterList "{Unknown Dest Mac Rate.*1000 packets-per-second.*Burst Tolerance:.*High} exist"
    CheckKeyValue "show port $port1 information detail" $parameterList \
                  -comment "Verify all 3 flood types configured with different burst-tolerance"
    unset parameterList
    report_end_test
    
    # Step 5: PRE-REBOOT TRAFFIC TEST
    report_start_test "Pre-reboot traffic validation"
    
    # Clear counters
    SendACmd "clear counters"
    SendACmd "clear port $port1 rate-limit flood out-of-profile"
    exSleep 1
    
    # Send burst (broadcast, burst_size=2048)
    SendFrame -txPortId 1 \
              -destMac    "ff:ff:ff:ff:ff:ff" \
              -sourceMac  "00:00:01:00:05:01" \
              -numFrames  2048 \
              -frameRate  10000 \
              -streamType "singleBurst" \
              -frameSize  128
    
    exSleep 3
    
    # Read pre-reboot drops
    set paramList ""
    lappend paramList "Exceeded 6 2"
    set pre_reboot_drops [GetKeyValue "show port $port1 rate-limit flood no-refresh" $paramList]
    unset paramList
    
    result_debug "Pre-reboot: broadcast exceeded = $pre_reboot_drops"
    
    # Verify drops in expected range for low tolerance
    if {$pre_reboot_drops >= 1700 && $pre_reboot_drops <= 1850} {
        result_ok "Pre-reboot: drops=$pre_reboot_drops within expected [1700-1850] for low tolerance"
    } else {
        result_error "Pre-reboot: drops=$pre_reboot_drops outside expected [1700-1850]"
    }
    
    report_end_test
    
    # Step 6: Save configuration
    report_start_test "Save configuration and reboot"
    SendACmd "save configuration"
    result_ok "Configuration saved"
    
    # Step 7: Reboot switch
    result_debug "Rebooting switch..."
    SendACmd "reboot"
    
    # Step 8: Wait for reboot (framework handles this)
    # Typically: exSleep for boot time, then CheckRebootComplete
    exSleep 180  ;# Wait 3 minutes for reboot
    CheckRebootComplete $DUT1_CONNECT
    result_ok "Reboot completed"
    report_end_test
    
    # Step 9: POST-REBOOT CONFIG VERIFICATION
    report_start_test "Verify configuration persists after reboot"
    
    Login $DUT1_CONNECT
    set port1 [MapDUTPortId 1 1]
    
    set parameterList ""
    lappend parameterList "{Broadcast Rate.*1000 packets-per-second.*Burst Tolerance:.*Low} exist"
    lappend parameterList "{Multicast Rate.*1000 packets-per-second.*Burst Tolerance:.*Medium} exist"
    lappend parameterList "{Unknown Dest Mac Rate.*1000 packets-per-second.*Burst Tolerance:.*High} exist"
    CheckKeyValue "show port $port1 information detail" $parameterList \
                  -comment "Verify all 3 flood types still configured after reboot"
    unset parameterList
    
    report_end_test
    
    # Step 10: POST-REBOOT TRAFFIC TEST
    report_start_test "Post-reboot traffic validation"
    
    # Clear counters
    SendACmd "clear counters"
    SendACmd "clear port $port1 rate-limit flood out-of-profile"
    exSleep 1
    
    # Send same burst (broadcast, burst_size=2048)
    SendFrame -txPortId 1 \
              -destMac    "ff:ff:ff:ff:ff:ff" \
              -sourceMac  "00:00:01:00:05:02" \
              -numFrames  2048 \
              -frameRate  10000 \
              -streamType "singleBurst" \
              -frameSize  128
    
    exSleep 3
    
    # Read post-reboot drops
    set paramList ""
    lappend paramList "Exceeded 6 2"
    set post_reboot_drops [GetKeyValue "show port $port1 rate-limit flood no-refresh" $paramList]
    unset paramList
    
    result_debug "Post-reboot: broadcast exceeded = $post_reboot_drops"
    
    # Step 11: Compare pre vs post drops
    set drop_diff [expr abs($post_reboot_drops - $pre_reboot_drops)]
    
    if {$drop_diff <= 100} {
        result_ok "Post-reboot drops ($post_reboot_drops) match pre-reboot ($pre_reboot_drops) within ±100"
        result_ok "Traffic behavior consistent across reboot"
    } else {
        result_error "Post-reboot drops ($post_reboot_drops) differ from pre-reboot ($pre_reboot_drops) by $drop_diff (> 100)"
        result_error "Possible BCM state initialization issue"
    }
    
    report_end_test
    
    # Step 12: Cleanup
    SendACmd "configure port $port1 rate-limit flood broadcast no-limit"
    SendACmd "configure port $port1 rate-limit flood multicast no-limit"
    SendACmd "configure port $port1 rate-limit flood unknown-destmac no-limit"
    SendACmd "delete vlan persist_test"
}
```

**Expected Behavior**:
```
Pre-reboot traffic test:
  burst_size=2048, tolerance=low
  → Expected drops: ~1750-1800 (actual: 1789)

Reboot switch...
  save configuration
  reboot
  <wait for boot>

Post-reboot config check:
  show port 1 information detail
  → Verify: Burst Tolerance: Low (PERSISTS ✓)

Post-reboot traffic test:
  burst_size=2048, tolerance=low
  → Expected drops: ~1750-1800 (actual: 1795)
  
Comparison:
  |1795 - 1789| = 6 <= 100 → PASS ✓
```

**Pass Criteria**: 
- Configuration persists after reboot (show command verification)
- Pre-reboot drops in expected range for low tolerance
- Post-reboot drops in expected range for low tolerance
- |post_drops - pre_drops| <= 100 (traffic behavior consistent)
- No BCM state initialization issues

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

### 5.6.2 Verify Multi-Port Independence (Low vs High Simultaneously)

**Topology used**: Topology-1 (use ports 1 and 2)

**Detailed Test Methodology**:

```tcl
proc 5.6.2 {} {
    global DUT1_CONNECT
    
    # Step 1: Login and get ports
    Login $DUT1_CONNECT
    set port1 [MapDUTPortId 1 1]
    set port2 [MapDUTPortId 2 1]
    
    # Step 2: Configure different tolerance levels
    SendACmd "configure port $port1 rate-limit flood broadcast 1000 burst-tolerance low"
    SendACmd "configure port $port2 rate-limit flood broadcast 1000 burst-tolerance high"
    
    # Step 3: Verify configuration
    report_start_test "Verify multi-port configuration"
    
    set parameterList ""
    lappend parameterList "{Broadcast Rate.*1000 packets-per-second.*Burst Tolerance:.*Low} exist"
    CheckKeyValue "show port $port1 information detail" $parameterList \
                  -comment "Verify port 1 has Low tolerance"
    unset parameterList
    
    set parameterList ""
    lappend parameterList "{Broadcast Rate.*1000 packets-per-second.*Burst Tolerance:.*High} exist"
    CheckKeyValue "show port $port2 information detail" $parameterList \
                  -comment "Verify port 2 has High tolerance"
    unset parameterList
    
    report_end_test
    
    # Step 4: Send identical burst to port 1
    report_start_test "Port 1 (low tolerance) burst test"
    
    SendACmd "clear counters"
    SendACmd "clear port $port1 rate-limit flood out-of-profile"
    exSleep 1
    
    SendFrame -txPortId 1 \
              -destMac    "ff:ff:ff:ff:ff:ff" \
              -sourceMac  "00:00:01:00:06:01" \
              -numFrames  2048 \
              -frameRate  10000 \
              -streamType "singleBurst" \
              -frameSize  128
    
    exSleep 3
    
    set paramList ""
    lappend paramList "Exceeded 6 2"
    set port1_drops [GetKeyValue "show port $port1 rate-limit flood no-refresh" $paramList]
    unset paramList
    
    result_debug "Port 1 (low): drops = $port1_drops"
    
    if {$port1_drops >= 1700 && $port1_drops <= 1850} {
        result_ok "Port 1 drops=$port1_drops within expected [1700-1850] for low tolerance"
    }
    
    report_end_test
    
    # Step 5: Send identical burst to port 2
    report_start_test "Port 2 (high tolerance) burst test"
    
    SendACmd "clear counters"
    SendACmd "clear port $port2 rate-limit flood out-of-profile"
    exSleep 1
    
    SendFrame -txPortId 2 \
              -destMac    "ff:ff:ff:ff:ff:ff" \
              -sourceMac  "00:00:01:00:06:02" \
              -numFrames  2048 \
              -frameRate  10000 \
              -streamType "singleBurst" \
              -frameSize  128
    
    exSleep 3
    
    set paramList ""
    lappend paramList "Exceeded 6 2"
    set port2_drops [GetKeyValue "show port $port2 rate-limit flood no-refresh" $paramList]
    unset paramList
    
    result_debug "Port 2 (high): drops = $port2_drops"
    
    if {$port2_drops >= 0 && $port2_drops <= 100} {
        result_ok "Port 2 drops=$port2_drops within expected [0-100] for high tolerance"
    }
    
    report_end_test
    
    # Step 6: Compare drops between ports
    report_start_test "Verify port independence: port1 drops >> port2 drops"
    
    set drop_difference [expr $port1_drops - $port2_drops]
    
    result_debug "Drop difference: port1 - port2 = $drop_difference"
    
    if {$drop_difference > 1500} {
        result_ok "Port 1 (low) drops ($port1_drops) >> Port 2 (high) drops ($port2_drops) by $drop_difference"
        result_ok "Multi-port independence verified: each port's tolerance level is isolated"
    } else {
        result_error "Port 1 drops ($port1_drops) not significantly higher than Port 2 ($port2_drops)"
        result_error "Expected difference > 1500, got $drop_difference"
        result_error "Possible cross-port interference or tolerance not per-port"
    }
    
    report_end_test
    
    # Step 7: Cleanup
    SendACmd "configure port $port1 rate-limit flood broadcast no-limit"
    SendACmd "configure port $port2 rate-limit flood broadcast no-limit"
}
```

**Expected Results**:
```
Port 1 (low tolerance, BCM bucket 256):
  burst_size=2048
  Expected drops: ~1750-1800
  Actual: 1789 ✓

Port 2 (high tolerance, BCM bucket 2048):
  burst_size=2048
  Expected drops: ~0-100
  Actual: 87 ✓

Drop difference: 1789 - 87 = 1702 > 1500 ✓

Conclusion: Each port has independent burst-tolerance config
```

**Pass Criteria**: 
- Port 1 (low) drops in [1700-1850]
- Port 2 (high) drops in [0-100]
- Drop difference > 1500 (significant)
- Multi-port independence confirmed

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

## 5. Appendix

### A.1 Show Command Output Parsing

**Command**: `show port 1 rate-limit flood no-refresh`

**Output Format**:
```
Port  Flood           Rate      Exceeded  Disabled
 1    Broadcast       1000      1789      -
 1    Multicast       No Limit  -         -
 1    Unknown DestMac No Limit  -         -
```

**Parsing Logic**:
```tcl
# Extract "Exceeded" counter for broadcast
# Line offset: 6 (broadcast is typically line 6 in output)
# Column: 2 (Exceeded is column 2 in paramList)

set paramList ""
lappend paramList "Exceeded 6 2"  # Line 6, Column 2
set exceeded [GetKeyValue "show port $port1 rate-limit flood no-refresh" $paramList]

# Result: exceeded = 1789
```

**For Multicast** (offset 5):
```tcl
lappend paramList "Exceeded 5 2"
```

**For Unknown-DestMAC** (offset 6):
```tcl
lappend paramList "Exceeded 6 2"
```

---

### A.2 Ixia SendFrame Parameter Reference

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
  -txPortId: Ixia port ID (1, 2, etc.)
  -destMac: Destination MAC address (hex with colons)
  -sourceMac: Source MAC address (hex with colons)
  -numFrames: Number of frames to send (for finite burst)
  -frameRate: Frames per second (e.g., 10000 for 10000 fps)
  -streamType: "singleBurst" (finite) or "contPacket" (continuous)
  -frameSize: Frame size in bytes (min 64, typical 128)
```

**Example Usage**:
```tcl
# Broadcast burst of 2048 frames at 10000 fps
SendFrame -txPortId 1 \
          -destMac    "ff:ff:ff:ff:ff:ff" \
          -sourceMac  "00:00:01:00:09:01" \
          -numFrames  2048 \
          -frameRate  10000 \
          -streamType "singleBurst" \
          -frameSize  128

# Multicast burst
SendFrame -txPortId 1 \
          -destMac    "01:00:00:01:01:01" \
          -sourceMac  "00:00:01:00:09:02" \
          -numFrames  2048 \
          -frameRate  10000 \
          -streamType "singleBurst" \
          -frameSize  128

# Unknown-destmac burst (clear FDB first)
SendFrame -txPortId 1 \
          -destMac    "00:00:00:99:99:99" \
          -sourceMac  "00:00:01:00:09:03" \
          -numFrames  2048 \
          -frameRate  10000 \
          -streamType "singleBurst" \
          -frameSize  128
```

---

### A.3 Wait Times and Rationale

| Wait Command | Duration | Rationale |
|-------------|----------|-----------|
| `exSleep 1` after config | 1 second | Allow BCM hardware to settle after rate-limit configuration change |
| `exSleep 3` after burst | 3 seconds | Wait for burst transmission to complete AND counters to fully update |
| `exSleep 180` for reboot | 3 minutes | Typical boot time for 5720 switch |
| `exSleep 2` after stop traffic | 2 seconds | Allow final packets to drain and counters to stabilize |

**Critical**: Do not reduce wait times below these values. BCM ASIC counter updates can be delayed.

---

### A.4 Error Handling Patterns

**Pattern 1: Command Rejected**
```tcl
# Framework automatically checks for errors after SendACmd
# If command rejected, test will fail with error message
# No explicit error checking needed in most cases

SendACmd "configure port $port1 rate-limit flood broadcast 1000 burst-tolerance invalid"
# Framework detects error → Test fails with "Invalid option" message
```

**Pattern 2: Counter Not Updated**
```tcl
set exceeded [GetKeyValue "show port $port1 rate-limit flood no-refresh" $paramList]

if {$exceeded == "" || $exceeded == "-"} {
    result_error "Exceeded counter not available — possible rate-limit not configured"
    return
}
```

**Pattern 3: Drops Outside Expected Range**
```tcl
if {$drops < $expected_min || $drops > $expected_max} {
    result_error "Drops ($drops) outside expected range [$expected_min-$expected_max]"
    result_debug "Possible BCM bucket misconfiguration or hardware issue"
}
```

---

**Test Plan v3.1 - End of Document**

**Summary of Automation Enhancements**:
- ✅ Exact CLI commands with actual port variables
- ✅ Complete Ixia SendFrame parameters
- ✅ Detailed counter parsing (offset, column)
- ✅ Wait times with rationale
- ✅ Show command output examples
- ✅ Verification logic with if/then conditions
- ✅ Error handling patterns
- ✅ Variable names and data structures
- ✅ Helper function implementations
- ✅ Step-by-step procedures matching automation scripts

**This version can be directly converted to TCL automation scripts.**
