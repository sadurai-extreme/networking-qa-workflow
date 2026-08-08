# TCL Test Framework - Switch Events and Operations

## Overview
Common switch event procedures for resilience and operational testing in the EXOS TCL framework.

## Core Switch Event Procedures

### 1. CheckReboot (System Reboot)
**Purpose:** Verify feature persistence and recovery after system reboot

**Syntax:**
```tcl
CheckReboot $DUT1_CONNECT \
    -waitTime 300 \
    -verifyCommand "show vlan" \
    -expectedOutput "VLAN 100"
```

**Parameters:**
- `waitTime` - Seconds to wait for boot completion (default: 300)
- `verifyCommand` - Command to verify after reboot
- `expectedOutput` - Expected string in command output

**Use Cases:**
- Configuration persistence testing
- Feature state after reboot
- License activation verification
- Database recovery

**Example:**
```tcl
# Configure VLAN before reboot
SendCliCommand $DUT1_CONNECT "create vlan test_vlan tag 100"
SendCliCommand $DUT1_CONNECT "configure vlan test_vlan add port 1:1"
SendCliCommand $DUT1_CONNECT "save configuration"

# Reboot and verify
set result [CheckReboot $DUT1_CONNECT \
    -waitTime 300 \
    -verifyCommand "show vlan test_vlan" \
    -expectedOutput "100"]

if {$result == "PASS"} {
    puts "PASS: VLAN configuration persisted after reboot"
} else {
    puts "FAIL: VLAN configuration lost after reboot"
    return FAIL
}
```

**Full Procedure:**
```tcl
proc CheckReboot {connect args} {
    global DUT1_IP
    
    # Parse arguments
    array set opts {
        -waitTime 300
        -verifyCommand ""
        -expectedOutput ""
    }
    array set opts $args
    
    # Issue reboot command
    puts ">>> Issuing reboot command..."
    SendCliCommand $connect "reboot" -timeout 10
    
    # Wait for switch to go down
    after 30000  ;# 30 seconds
    
    # Wait for switch to come back up
    puts ">>> Waiting for switch to boot (max $opts(-waitTime) seconds)..."
    set bootComplete 0
    set elapsed 0
    
    while {$elapsed < $opts(-waitTime)} {
        if {[catch {ping $DUT1_IP -count 1} result]} {
            # Still down
            after 10000
            incr elapsed 10
        } else {
            # Switch responding
            puts ">>> Switch responding after $elapsed seconds"
            set bootComplete 1
            break
        }
    }
    
    if {!$bootComplete} {
        puts "ERROR: Switch did not boot within $opts(-waitTime) seconds"
        return FAIL
    }
    
    # Reconnect
    after 30000  ;# Wait for services to start
    ReconnectSwitch $connect
    
    # Verify configuration if specified
    if {$opts(-verifyCommand) != ""} {
        set output [SendCliCommand $connect $opts(-verifyCommand)]
        if {[string first $opts(-expectedOutput) $output] >= 0} {
            puts ">>> Verification PASSED: Found '$opts(-expectedOutput)'"
            return PASS
        } else {
            puts "ERROR: Verification FAILED: '$opts(-expectedOutput)' not found"
            return FAIL
        }
    }
    
    return PASS
}
```

---

### 2. CheckMSMFailover (Master/Slave Module Failover)
**Purpose:** Verify high availability and stateful failover for stacked switches

**Syntax:**
```tcl
CheckMSMFailover $DUT1_CONNECT \
    -masterSlot 1 \
    -backupSlot 2 \
    -failoverTime 30 \
    -verifyCommand "show switch"
```

**Parameters:**
- `masterSlot` - Current MSM slot number
- `backupSlot` - Backup MSM slot number
- `failoverTime` - Maximum failover duration (seconds)
- `verifyCommand` - Verification command after failover

**Use Cases:**
- Stacking resilience tests
- MSM redundancy verification
- Stateful failover (L2/L3 state preservation)
- Control plane failover

**Example:**
```tcl
# Verify initial master
set output [SendCliCommand $DUT1_CONNECT "show switch"]
if {[string first "1 *Master" $output] < 0} {
    puts "ERROR: Slot 1 is not master"
    return FAIL
}

# Force failover
set result [CheckMSMFailover $DUT1_CONNECT \
    -masterSlot 1 \
    -backupSlot 2 \
    -failoverTime 30 \
    -verifyCommand "show switch"]

if {$result == "PASS"} {
    # Verify new master
    set output [SendCliCommand $DUT1_CONNECT "show switch"]
    if {[string first "2 *Master" $output] >= 0} {
        puts "PASS: MSM failover successful, slot 2 is new master"
        return PASS
    } else {
        puts "FAIL: Slot 2 did not become master"
        return FAIL
    }
} else {
    puts "FAIL: MSM failover failed"
    return FAIL
}
```

**Full Procedure:**
```tcl
proc CheckMSMFailover {connect args} {
    array set opts {
        -masterSlot 1
        -backupSlot 2
        -failoverTime 30
        -verifyCommand ""
    }
    array set opts $args
    
    puts ">>> Triggering MSM failover from slot $opts(-masterSlot) to $opts(-backupSlot)"
    
    # Disable master MSM
    SendCliCommand $connect "disable slot $opts(-masterSlot)"
    
    # Wait for failover
    set startTime [clock seconds]
    set failoverComplete 0
    
    while {[expr {[clock seconds] - $startTime}] < $opts(-failoverTime)} {
        after 5000  ;# Check every 5 seconds
        
        # Check if backup became master
        if {![catch {SendCliCommand $connect $opts(-verifyCommand)} output]} {
            if {[string first "$opts(-backupSlot) *Master" $output] >= 0} {
                set elapsed [expr {[clock seconds] - $startTime}]
                puts ">>> Failover completed in $elapsed seconds"
                set failoverComplete 1
                break
            }
        }
    }
    
    if {$failoverComplete} {
        return PASS
    } else {
        puts "ERROR: Failover did not complete within $opts(-failoverTime) seconds"
        return FAIL
    }
}
```

---

### 3. CheckPortOperations (Port State Changes)
**Purpose:** Verify feature behavior with port state changes (enable/disable/link flap)

**Syntax:**
```tcl
CheckPortOperations $DUT1_CONNECT $DUT1_PORT \
    -operation "disable" \
    -verifyCommand "show port $DUT1_PORT" \
    -expectedOutput "Disabled"
```

**Parameters:**
- `operation` - Port operation: disable, enable, flap
- `verifyCommand` - Verification command
- `expectedOutput` - Expected output string

**Use Cases:**
- Port-based feature testing
- Link flap recovery
- Port disable/enable impact
- SFP hot-swap testing

**Example:**
```tcl
# Test ACL behavior with port disable/enable
SendCliCommand $DUT1_CONNECT "configure access-list acl_test permit any"
SendCliCommand $DUT1_CONNECT "configure access-list apply acl_test port $DUT1_PORT ingress"

# Verify ACL active
set output [SendCliCommand $DUT1_CONNECT "show access-list"]
if {[string first "acl_test" $output] < 0} {
    puts "ERROR: ACL not configured"
    return FAIL
}

# Disable port
CheckPortOperations $DUT1_CONNECT $DUT1_PORT -operation "disable"

# Verify ACL still present
set output [SendCliCommand $DUT1_CONNECT "show access-list"]
if {[string first "acl_test" $output] < 0} {
    puts "FAIL: ACL lost after port disable"
    return FAIL
}

# Re-enable port
CheckPortOperations $DUT1_CONNECT $DUT1_PORT -operation "enable"

# Verify ACL still working
set output [SendCliCommand $DUT1_CONNECT "show access-list"]
if {[string first "acl_test" $output] >= 0} {
    puts "PASS: ACL persisted through port disable/enable"
    return PASS
} else {
    puts "FAIL: ACL lost after port enable"
    return FAIL
}
```

**Full Procedure:**
```tcl
proc CheckPortOperations {connect port args} {
    array set opts {
        -operation "disable"
        -verifyCommand ""
        -expectedOutput ""
    }
    array set opts $args
    
    switch $opts(-operation) {
        "disable" {
            puts ">>> Disabling port $port"
            SendCliCommand $connect "disable port $port"
            after 2000
        }
        "enable" {
            puts ">>> Enabling port $port"
            SendCliCommand $connect "enable port $port"
            after 2000
        }
        "flap" {
            puts ">>> Flapping port $port"
            SendCliCommand $connect "disable port $port"
            after 5000
            SendCliCommand $connect "enable port $port"
            after 5000
        }
        default {
            puts "ERROR: Unknown operation $opts(-operation)"
            return FAIL
        }
    }
    
    # Verify if specified
    if {$opts(-verifyCommand) != ""} {
        set output [SendCliCommand $connect $opts(-verifyCommand)]
        if {[string first $opts(-expectedOutput) $output] >= 0} {
            puts ">>> Verification PASSED"
            return PASS
        } else {
            puts "ERROR: Verification FAILED"
            return FAIL
        }
    }
    
    return PASS
}
```

---

### 4. CheckConfigPersistence (Save and Verify)
**Purpose:** Verify configuration is saved and persists across reboots

**Syntax:**
```tcl
CheckConfigPersistence $DUT1_CONNECT \
    -configCommands {"create vlan test tag 100" "configure vlan test add port 1:1"} \
    -verifyCommand "show vlan test" \
    -expectedOutput "100"
```

**Example:**
```tcl
set configCmds {
    "create vlan test_vlan tag 100"
    "configure vlan test_vlan add port 1:1"
    "configure vlan test_vlan ipaddress 10.0.0.1 255.255.255.0"
}

set result [CheckConfigPersistence $DUT1_CONNECT \
    -configCommands $configCmds \
    -verifyCommand "show vlan test_vlan" \
    -expectedOutput "10.0.0.1"]

if {$result == "PASS"} {
    puts "PASS: Configuration persisted"
} else {
    puts "FAIL: Configuration not persisted"
    return FAIL
}
```

---

## Event Test Patterns

### Pattern 1: Reboot Resilience Test
```tcl
proc Test_Reboot_Resilience {} {
    global DUT1_CONNECT
    
    puts "=== Test: Verify feature persists after reboot ==="
    
    # Step 1: Configure feature
    SendCliCommand $DUT1_CONNECT "create vlan production tag 100"
    SendCliCommand $DUT1_CONNECT "configure vlan production add port 1:1-1:10"
    SendCliCommand $DUT1_CONNECT "save configuration"
    
    # Step 2: Verify before reboot
    set output [SendCliCommand $DUT1_CONNECT "show vlan production"]
    if {[string first "100" $output] < 0} {
        puts "FAIL: VLAN not configured before reboot"
        return FAIL
    }
    
    # Step 3: Reboot
    set result [CheckReboot $DUT1_CONNECT \
        -waitTime 300 \
        -verifyCommand "show vlan production" \
        -expectedOutput "100"]
    
    if {$result == "PASS"} {
        puts "PASS: Feature persisted after reboot"
        return PASS
    } else {
        puts "FAIL: Feature lost after reboot"
        return FAIL
    }
}
```

### Pattern 2: Port Flap Resilience Test
```tcl
proc Test_Port_Flap_Resilience {} {
    global DUT1_CONNECT DUT1_PORT IXIA_PORT_A IXIA_PORT_B
    
    puts "=== Test: Verify traffic recovery after port flap ==="
    
    # Step 1: Establish baseline traffic
    SendFrame $IXIA_PORT_A $IXIA_PORT_B \
        -srcMac "00:00:00:00:00:01" \
        -destMac "00:00:00:00:00:02" \
        -frameCount 1000 \
        -frameRate 100
    
    set rxBefore [GetIxiaRxCount $IXIA_PORT_B]
    if {$rxBefore < 990} {
        puts "FAIL: Baseline traffic failed"
        return FAIL
    }
    
    # Step 2: Flap port
    CheckPortOperations $DUT1_CONNECT $DUT1_PORT -operation "flap"
    
    # Step 3: Verify traffic recovers
    ClearIxiaStats [list $IXIA_PORT_A $IXIA_PORT_B]
    SendFrame $IXIA_PORT_A $IXIA_PORT_B \
        -srcMac "00:00:00:00:00:01" \
        -destMac "00:00:00:00:00:02" \
        -frameCount 1000 \
        -frameRate 100
    
    set rxAfter [GetIxiaRxCount $IXIA_PORT_B]
    if {$rxAfter >= 990} {
        puts "PASS: Traffic recovered after port flap"
        return PASS
    } else {
        puts "FAIL: Traffic did not recover (only $rxAfter/1000 frames)"
        return FAIL
    }
}
```

### Pattern 3: MSM Failover with Traffic
```tcl
proc Test_MSM_Failover_With_Traffic {} {
    global DUT1_CONNECT IXIA_PORT_A IXIA_PORT_B
    
    puts "=== Test: Verify traffic during MSM failover ==="
    
    # Step 1: Start continuous traffic
    StartContinuousTraffic $IXIA_PORT_A $IXIA_PORT_B -rate 1000
    
    # Step 2: Trigger failover
    set failoverResult [CheckMSMFailover $DUT1_CONNECT \
        -masterSlot 1 \
        -backupSlot 2 \
        -failoverTime 30]
    
    if {$failoverResult != "PASS"} {
        StopContinuousTraffic
        puts "FAIL: MSM failover failed"
        return FAIL
    }
    
    # Step 3: Check traffic continuity
    set lossPercent [GetTrafficLoss $IXIA_PORT_A $IXIA_PORT_B]
    StopContinuousTraffic
    
    if {$lossPercent < 5.0} {
        puts "PASS: Traffic loss during failover: $lossPercent%"
        return PASS
    } else {
        puts "FAIL: Excessive traffic loss during failover: $lossPercent%"
        return FAIL
    }
}
```

---

## Best Practices

1. **Always Save Configuration**
   ```tcl
   SendCliCommand $DUT1_CONNECT "save configuration"
   ```

2. **Wait for Operations to Complete**
   - Reboot: 300+ seconds
   - Port enable/disable: 2-5 seconds
   - MSM failover: 30-60 seconds

3. **Verify Before and After**
   - Check feature state before event
   - Verify recovery after event
   - Compare before/after behavior

4. **Handle Connection Loss**
   ```tcl
   proc ReconnectSwitch {connect} {
       set maxRetries 10
       set retryCount 0
       
       while {$retryCount < $maxRetries} {
           if {![catch {SendCliCommand $connect "show switch"} output]} {
               puts ">>> Reconnected successfully"
               return PASS
           }
           after 10000
           incr retryCount
       }
       
       puts "ERROR: Could not reconnect after $maxRetries attempts"
       return FAIL
   }
   ```

5. **Use Timeouts**
   - Don't wait indefinitely for events
   - Set reasonable maximum wait times
   - Log timeout errors clearly
