# TCL Test Framework - EXOS CLI Syntax Guide

## Overview
Real EXOS TCL automation framework procedures extracted from the extremenetworks-emu/exos-tcl-automation repository.

> ⚠️ STRICT RULE: Only use procedures documented here. Do NOT invent procedure names.
> The ONLY CLI send proc is **SendACmd** — NOT SendCliCommand, SendCmd, or any other name.

---

## MANDATORY SCRIPT TEMPLATE

Every generated script MUST follow this exact structure:

```tcl
##################################################################
# Test Name: [test_case_id].tcl
# Description: [Test description and objective]
##################################################################

proc [test_case_id] {} {

set testcase_id "[test_case_id]"
set TestCaseTitle "$testcase_id: [Test objective]"

# ----- Declare global variables first
global DUT1_CONNECT
global DUT2_CONNECT
global DUTs_info

set fd_res [open_result_file "$testcase_id"]
set time1 [clock seconds]

  result_h1 "$TestCaseTitle"
  report_start_test "$TestCaseTitle"

    ### Step 1
    set subTestTitle "[Step 1 Description]"
    result_h2 "$subTestTitle"
    report_start_test "$subTestTitle"
    Login $DUT1_CONNECT

      SendACmd "clear fdb"

    report_end_test

    ### Cleanup (always last step)
    set subTestTitle "Cleanup"
    result_h2 "$subTestTitle"
    report_start_test "$subTestTitle"
    Login $DUT1_CONNECT

      SendACmd "delete vlan test_vlan"

    report_end_test

  set time2 [clock seconds]
  result_p "*** Time for $testcase_id = [expr $time2-$time1] secs\n\n"
  close_result_file
  report_end_test
}
```

### Template Non-Negotiable Rules
- proc name MUST match test case ID. NEVER quote proc name: `proc 9.1.1 {}` NOT `proc "9.1.1" {}`
- MUST declare: `global DUT1_CONNECT`, `global DUT2_CONNECT`, `global DUTs_info`
- MUST use `open_result_file` / `close_result_file`
- MUST include `clock seconds` time tracking
- Every step MUST have paired `report_start_test` / `report_end_test`
- NEVER add a bare proc call at the end of the script
- NEVER include `-fd $fd_res` in CheckKeyValue calls
- Inline comments use `;#` not `#`: `set port [MapDUTPortId 1 1] ;# Get port`

---

## Core Procedures

### 1. SendACmd — Send CLI Command to Switch
**Source:** `automation/Tools/Setup/SendSwCmd.tcl`

```tcl
proc SendACmd {{cmd "NULL"} {fd_result "NULL"} {fd_input "NULL"} {showError "true"}}
```

```tcl
# Configure — fire and forget
SendACmd "create vlan test_vlan tag 100"
SendACmd "configure vlan test_vlan ipaddress 192.168.1.1/24"
SendACmd "enable ipforwarding"

# With error detection (built-in — any ERROR/error/Invalid in output auto-detected)
SendACmd "configure stpd s1 mode dot1w"
```

> ❌ WRONG: `SendCliCommand`, `SendCmd`, `send_cmd`, `ExecCmd`
> ✅ CORRECT: `SendACmd`

Also available: `sw_cmd` (thin wrapper around SendACmd), `send_a_sw_cmd_by_s_comm` (serial comm).

---

### 2. Login / Logout — Switch to DUT

```tcl
Login $DUT1_CONNECT
SendACmd "show vlan"

Login $DUT2_CONNECT
SendACmd "show port 1:1 information detail"

LogoutDUT
LogoutFast "1 2"
```

- Always call `Login $DUT_CONNECT` before sending commands to that DUT
- Use `LoginDUT {1 2}` to log into multiple DUTs at once

---

### 3. CheckKeyValue — Verify CLI Output Patterns
**Source:** `automation/Lib/OptionCheck.tcl`

```tcl
proc CheckKeyValue {command parameterList args}
```

```tcl
# Basic existence check
set parameterList ""
lappend parameterList "{test_vlan} exist"
CheckKeyValue "show vlan" $parameterList -comment "Verify VLAN exists"
unset parameterList

# NotExist check
set parameterList ""
lappend parameterList "{test_vlan} notExist"
CheckKeyValue "show vlan" $parameterList -comment "Verify VLAN deleted"
unset parameterList

# With retry/time window (for async operations)
set parameterList ""
lappend parameterList "{192.168.1.100} exist"
CheckKeyValue "show iparp" $parameterList -time {s: 1 i: 5 d: 15 f: 15 r} -comment "Wait for ARP"
unset parameterList

# Multiple patterns
set parameterList ""
lappend parameterList "{Port.*Active} exist"
lappend parameterList "{Error} notExist"
CheckKeyValue "show ports" $parameterList -comment "Port active, no errors"
unset parameterList
```

**Critical syntax rules:**
- Pattern and keyword MUST be in `{}`: `"{pattern} exist"` NOT `"pattern exist"`
- Use `exist` / `notExist` keywords
- NEVER include `-fd $fd_res` in CheckKeyValue calls
- `unset parameterList` after each CheckKeyValue block

---

### 4. GetKeyValue — Extract Counter/Value from Output

```tcl
set value 0
set parameters ""
lappend parameters "Total 1"
set value [GetKeyValue "show ports" $parameters]
unset parameters
result_debug "Port counter: $value"
```

---

### 5. MapDUTPortId — Port Mapping (NEVER hardcode ports)

```tcl
# 2-Node topology
set dut1_port1 [MapDUTPortId 1 1]  ;# Port 1 on DUT1
set dut1_port2 [MapDUTPortId 2 1]  ;# Port 2 on DUT1
set dut2_port1 [MapDUTPortId 9 2]  ;# Port 9 on DUT2 (first DUT2 port in 2-node)
set dut2_port2 [MapDUTPortId 10 2] ;# Port 10 on DUT2
```

- ❌ NEVER hardcode port numbers like `"1:1"` or `"1"` — always use `MapDUTPortId`
- ❌ NEVER use same first param for different DUTs: `[MapDUTPortId 1 1]` and `[MapDUTPortId 1 2]`

---

### 6. Result Reporting Procedures

| Procedure | Use |
|-----------|-----|
| `result_h1 "title"` | Main test case title |
| `result_h2 "step"` | Sub-test / step title |
| `result_debug "msg"` | Debug/info messages |
| `result_ok "msg"` | Step passed |
| `result_error "msg"` | Step failed |
| `result_skip "msg"` | Step skipped |
| `result_p "msg"` | General print (timing) |
| `result_warning "msg"` | Warning message |
| `report_start_test "title"` | Begin test step |
| `report_end_test` | End test step |

---

### 7. Timing and Sleep

```tcl
exSleep 30         ;# Sleep N seconds (framework proc — NOT Tcl's after)
after 1000         ;# Sleep 1000ms (use for short waits only)
```

---

### 8. CheckReboot — Reboot DUT

```tcl
CheckReboot 1 -save yes            ;# Reboot DUT1, save config first
CheckReboot 1 -save yes maxWait 100 ;# Extended wait for BCM platforms
```

---

### 9. IXIA Traffic Procedures

#### ARP (MANDATORY before L3 traffic)
```tcl
# Positional args ONLY — no -tag named param
SendArpRequest $IxiaPort1 $ixia_src_ip $gateway_ip $vlan_tag
after 1000

# MANDATORY: verify ARP
set parameterList ""
lappend parameterList "{$ixia_src_ip} exist"
CheckKeyValue "show iparp" $parameterList -time {s: 1 i: 5 d: 15 f: 15 r} -comment "Verify ARP"
unset parameterList
```

#### L3 Traffic
```tcl
SendIpFrame -txPortId $IxiaPort1 \
            -sourceIp $ixia_src_ip \
            -destIp $ixia_dst_ip \
            -streamType "contPacket" \
            -frameSize 64
```

#### L2 Traffic
```tcl
SendFrame -txPortId $IxiaPort1 \
          -sourceMac $ixia_src_mac \
          -destMac "FF:FF:FF:FF:FF:FF" \
          -rxPortId $IxiaPort2 \
          -streamType "contPacket" \
          -frameSize 64
```

#### Rate Verification (ALWAYS stop immediately after)
```tcl
set checkRateList ""
lappend checkRateList "$IxiaPort1 0"    ;# Sending port: 0 rx rate
lappend checkRateList "$IxiaPort2 100"  ;# Receiving port: expected rate
CheckRates $IxiaPort1 $checkRateList "Verify traffic" 2
unset checkRateList
StopPortsTransmit $IxiaPort1           ;# MANDATORY immediately after CheckRates
```

---

## Cleanup Rules (NON-NEGOTIABLE)
- Remove policy/dynamic ACL bindings BEFORE deletion
- Do NOT verify (`CheckKeyValue`) objects AFTER deleting them
- Stop all traffic streams before cleanup
- Delete VLANs only after removing all port members

---

## Self-Check Before Output (Agent must validate)

| # | Check |
|---|-------|
| SC01 | `SendArpRequest` uses positional 4th arg for VLAN tag (NOT `-tag`) |
| SC02 | ARP verified with `CheckKeyValue "show iparp"` after every `SendArpRequest` |
| SC03 | `StopPortsTransmit` immediately after every `CheckRates` |
| SC04 | `CheckRates` lists both sending (rate 0) AND receiving port |
| SC05 | No `CheckKeyValue` after `delete` in cleanup |
| SC06 | No hardcoded IPs or port numbers — use variables / `MapDUTPortId` |


## Core CLI Procedures

### 1. SendCliCommand
**Purpose:** Send CLI command and capture output

**Syntax:**
```tcl
set output [SendCliCommand $DUT1_CONNECT "show vlan" -timeout 10]
```

**Parameters:**
- `connect` - Connection handle (DUT1_CONNECT, DUT2_CONNECT, etc.)
- `command` - CLI command string
- `-timeout` - Command timeout in seconds (default: 30)

**Returns:**
- Command output as string

**Example:**
```tcl
# Get VLAN information
set output [SendCliCommand $DUT1_CONNECT "show vlan"]
if {[string first "Default" $output] >= 0} {
    puts "Default VLAN exists"
}

# Configure with error handling
if {[catch {SendCliCommand $DUT1_CONNECT "create vlan test tag 100"} result]} {
    puts "ERROR: Failed to create VLAN - $result"
    return FAIL
}
```

---

### 2. GetKeyValue
**Purpose:** Extract specific value from CLI output

**Syntax:**
```tcl
set value [GetKeyValue $output "Key Pattern"]
```

**Use Cases:**
- Parse show command output
- Extract counter values
- Get port status
- Retrieve configuration parameters

**Example:**
```tcl
# Get port state
set output [SendCliCommand $DUT1_CONNECT "show port 1:1 information detail"]
set state [GetKeyValue $output "Port State:"]
if {$state == "Enabled"} {
    puts "Port is enabled"
}

# Get ACL counter
set output [SendCliCommand $DUT1_CONNECT "show access-list counter acl_test"]
set counter [GetKeyValue $output "Packets:"]
if {$counter > 0} {
    puts "ACL matched $counter packets"
}
```

**Implementation:**
```tcl
proc GetKeyValue {text key} {
    # Find the line containing the key
    set lines [split $text "\n"]
    foreach line $lines {
        if {[string first $key $line] >= 0} {
            # Extract value after the key
            set idx [string first $key $line]
            set valueStart [expr {$idx + [string length $key]}]
            set value [string trim [string range $line $valueStart end]]
            return $value
        }
    }
    return ""
}
```

---

## Common EXOS CLI Patterns

### VLAN Commands

#### Create VLAN
```tcl
# Basic VLAN creation
SendCliCommand $DUT1_CONNECT "create vlan production tag 100"

# Add ports to VLAN
SendCliCommand $DUT1_CONNECT "configure vlan production add port 1:1-1:10"

# Configure VLAN IP address
SendCliCommand $DUT1_CONNECT "configure vlan production ipaddress 192.168.1.1 255.255.255.0"

# Enable IP forwarding
SendCliCommand $DUT1_CONNECT "enable ipforwarding vlan production"
```

#### Verify VLAN
```tcl
set output [SendCliCommand $DUT1_CONNECT "show vlan production"]
if {[string first "100" $output] >= 0} {
    puts "VLAN tag correct"
}

# Check VLAN membership
set output [SendCliCommand $DUT1_CONNECT "show vlan production"]
if {[string first "1:1" $output] >= 0} {
    puts "Port 1:1 is member of VLAN"
}
```

#### Delete VLAN
```tcl
SendCliCommand $DUT1_CONNECT "configure vlan production delete port all"
SendCliCommand $DUT1_CONNECT "delete vlan production"
```

---

### Port Commands

#### Configure Port
```tcl
# Enable/disable port
SendCliCommand $DUT1_CONNECT "enable port 1:1"
SendCliCommand $DUT1_CONNECT "disable port 1:1"

# Set port speed
SendCliCommand $DUT1_CONNECT "configure port 1:1 speed 1000 duplex full"

# Configure port description
SendCliCommand $DUT1_CONNECT "configure port 1:1 description \"Server Port\""

# Configure port VLAN tagging
SendCliCommand $DUT1_CONNECT "configure vlan production add port 1:1 tagged"
SendCliCommand $DUT1_CONNECT "configure vlan production add port 1:1 untagged"
```

#### Verify Port
```tcl
# Check port state
set output [SendCliCommand $DUT1_CONNECT "show port 1:1"]
if {[string first "Active" $output] >= 0} {
    puts "Port is active"
}

# Check port statistics
set output [SendCliCommand $DUT1_CONNECT "show port 1:1 statistics"]
set txPackets [GetKeyValue $output "Tx Packets:"]
set rxPackets [GetKeyValue $output "Rx Packets:"]
puts "Port stats - TX: $txPackets, RX: $rxPackets"
```

---

### ACL Commands

#### Policy-Based ACL
```tcl
# Create ACL policy file
SendCliCommand $DUT1_CONNECT "edit policy acl_test.pol"
SendCliCommand $DUT1_CONNECT "entry permit_http {\n  if {\n    protocol tcp;\n    destination-port 80;\n  } then {\n    permit;\n  }\n}"
SendCliCommand $DUT1_CONNECT "save"

# Apply policy to port
SendCliCommand $DUT1_CONNECT "configure access-list apply acl_test port 1:1 ingress"

# Verify policy
set output [SendCliCommand $DUT1_CONNECT "show policy"]
if {[string first "acl_test" $output] >= 0} {
    puts "Policy applied"
}

# Check counter
set output [SendCliCommand $DUT1_CONNECT "show access-list counter"]
set counter [GetKeyValue $output "permit_http:"]
puts "ACL matched $counter packets"
```

#### Dynamic ACL
```tcl
# Create dynamic ACL (must use 'add' keyword)
SendCliCommand $DUT1_CONNECT "configure access-list add acl_deny_icmp source 10.0.0.0/24 protocol icmp deny"

# Apply to port
SendCliCommand $DUT1_CONNECT "configure access-list apply acl_deny_icmp port 1:1 ingress"

# Verify
set output [SendCliCommand $DUT1_CONNECT "show access-list dynamic"]
if {[string first "acl_deny_icmp" $output] >= 0} {
    puts "Dynamic ACL created"
}

# Check counter
set output [SendCliCommand $DUT1_CONNECT "show access-list dynamic counter acl_deny_icmp"]
set dropped [GetKeyValue $output "Packets:"]
puts "Dropped $dropped ICMP packets"
```

#### Cleanup ACL
```tcl
# Remove policy
SendCliCommand $DUT1_CONNECT "unconfigure access-list acl_test port 1:1 ingress"
SendCliCommand $DUT1_CONNECT "delete access-list acl_test"

# Delete policy file
SendCliCommand $DUT1_CONNECT "rm acl_test.pol"
```

---

### Routing Commands

#### Configure Static Route
```tcl
SendCliCommand $DUT1_CONNECT "configure iproute add 192.168.2.0/24 192.168.1.254"

# Verify route
set output [SendCliCommand $DUT1_CONNECT "show iproute"]
if {[string first "192.168.2.0" $output] >= 0} {
    puts "Static route configured"
}
```

#### Configure OSPF
```tcl
# Enable OSPF
SendCliCommand $DUT1_CONNECT "enable ospf"

# Configure router ID
SendCliCommand $DUT1_CONNECT "configure ospf routerid 1.1.1.1"

# Add area
SendCliCommand $DUT1_CONNECT "configure ospf add vlan production area 0.0.0.0"

# Verify OSPF neighbors
set output [SendCliCommand $DUT1_CONNECT "show ospf neighbor"]
if {[string first "Full" $output] >= 0} {
    puts "OSPF neighbor adjacency established"
}
```

#### Configure BGP
```tcl
# Enable BGP
SendCliCommand $DUT1_CONNECT "enable bgp"

# Configure AS number
SendCliCommand $DUT1_CONNECT "configure bgp as-number 65001"

# Add neighbor
SendCliCommand $DUT1_CONNECT "configure bgp neighbor 10.0.0.2 remote-as-number 65002"

# Verify BGP session
set output [SendCliCommand $DUT1_CONNECT "show bgp neighbor"]
if {[string first "Established" $output] >= 0} {
    puts "BGP session established"
}
```

---

### QoS Commands

#### Configure QoS Profile
```tcl
# Create QoS profile
SendCliCommand $DUT1_CONNECT "create qosprofile qos_high"

# Set rate limit (1 Mbps = 1000 kbps)
SendCliCommand $DUT1_CONNECT "configure qosprofile qos_high maxrate 1000"

# Apply to port
SendCliCommand $DUT1_CONNECT "configure qosprofile qos_high port 1:1"

# Verify
set output [SendCliCommand $DUT1_CONNECT "show qosprofile qos_high"]
if {[string first "1000" $output] >= 0} {
    puts "QoS rate limit configured"
}
```

---

### Link Aggregation Commands

#### Configure LAG
```tcl
# Create LAG
SendCliCommand $DUT1_CONNECT "enable sharing 1:1 grouping 1:1-1:4 algorithm address-based L2"

# Verify LAG
set output [SendCliCommand $DUT1_CONNECT "show sharing"]
if {[string first "1:1-1:4" $output] >= 0} {
    puts "LAG configured"
}

# Check LAG status
set output [SendCliCommand $DUT1_CONNECT "show port 1:1 sharing"]
set active [GetKeyValue $output "Active Ports:"]
if {$active == 4} {
    puts "All LAG members active"
}
```

---

### SNMP Commands

#### Configure SNMP
```tcl
# Enable SNMP
SendCliCommand $DUT1_CONNECT "enable snmp"

# Configure community
SendCliCommand $DUT1_CONNECT "configure snmpv1v2c add community public readonly"

# Configure trap receiver
SendCliCommand $DUT1_CONNECT "configure snmp add trapreceiver 10.0.0.10 community public"

# Verify
set output [SendCliCommand $DUT1_CONNECT "show snmp"]
if {[string first "Enabled" $output] >= 0} {
    puts "SNMP enabled"
}
```

---

### System Commands

#### Save Configuration
```tcl
SendCliCommand $DUT1_CONNECT "save configuration"
```

#### Reboot
```tcl
SendCliCommand $DUT1_CONNECT "reboot" -timeout 10
```

#### Show Version
```tcl
set output [SendCliCommand $DUT1_CONNECT "show version"]
set version [GetKeyValue $output "ExtremeXOS version:"]
puts "Switch running version: $version"
```

#### Show System Info
```tcl
set output [SendCliCommand $DUT1_CONNECT "show switch"]
set model [GetKeyValue $output "System Type:"]
set serial [GetKeyValue $output "SysID:"]
puts "Model: $model, Serial: $serial"
```

---

## Advanced CLI Patterns

### Pattern 1: Configuration with Verification
```tcl
proc ConfigureAndVerify {connect configCmd verifyCmd expectedOutput} {
    # Step 1: Configure
    if {[catch {SendCliCommand $connect $configCmd} result]} {
        puts "ERROR: Configuration failed - $result"
        return FAIL
    }
    
    # Step 2: Verify
    set output [SendCliCommand $connect $verifyCmd]
    if {[string first $expectedOutput $output] >= 0} {
        puts "PASS: Configuration verified"
        return PASS
    } else {
        puts "FAIL: Configuration not verified"
        return FAIL
    }
}

# Example usage
set result [ConfigureAndVerify $DUT1_CONNECT \
    "create vlan test tag 100" \
    "show vlan test" \
    "100"]
```

### Pattern 2: Counter-Based Verification
```tcl
proc VerifyCounter {connect showCmd keyPattern minValue} {
    set output [SendCliCommand $connect $showCmd]
    set counter [GetKeyValue $output $keyPattern]
    
    if {$counter eq ""} {
        puts "ERROR: Could not find counter '$keyPattern'"
        return FAIL
    }
    
    if {$counter >= $minValue} {
        puts "PASS: Counter $counter >= $minValue"
        return PASS
    } else {
        puts "FAIL: Counter $counter < $minValue"
        return FAIL
    }
}

# Example usage - verify ACL matched packets
set result [VerifyCounter $DUT1_CONNECT \
    "show access-list counter acl_test" \
    "Packets:" \
    100]
```

### Pattern 3: Multi-Switch Configuration
```tcl
proc ConfigureAllSwitches {connectList configCmd} {
    foreach connect $connectList {
        if {[catch {SendCliCommand $connect $configCmd} result]} {
            puts "ERROR: Configuration failed on $connect - $result"
            return FAIL
        }
        puts "Configured $connect successfully"
    }
    return PASS
}

# Example usage - configure VLAN on all switches
set switches [list $DUT1_CONNECT $DUT2_CONNECT $DUT3_CONNECT]
ConfigureAllSwitches $switches "create vlan test tag 100"
```

---

## Best Practices

1. **Always Check Command Success**
   ```tcl
   if {[catch {SendCliCommand $connect $cmd} result]} {
       puts "ERROR: Command failed - $result"
       return FAIL
   }
   ```

2. **Verify After Configuration**
   ```tcl
   SendCliCommand $connect "create vlan test tag 100"
   set output [SendCliCommand $connect "show vlan test"]
   if {[string first "100" $output] < 0} {
       puts "ERROR: VLAN not created"
       return FAIL
   }
   ```

3. **Use Proper Timeouts**
   ```tcl
   # Long-running commands need longer timeout
   SendCliCommand $connect "show log" -timeout 60
   ```

4. **Clean Up After Tests**
   ```tcl
   # Remove test configuration
   SendCliCommand $connect "delete vlan test"
   SendCliCommand $connect "unconfigure access-list acl_test port 1:1"
   ```

5. **Save Configuration When Needed**
   ```tcl
   SendCliCommand $connect "save configuration"
   ```

6. **Handle Platform Differences**
   ```tcl
   set output [SendCliCommand $connect "show version"]
   if {[string first "SummitStack" $output] >= 0} {
       # Use stack-specific commands
       SendCliCommand $connect "show stacking"
   }
   ```

---

## Troubleshooting CLI Issues

### Issue 1: Command Not Found
```tcl
# Check if feature is enabled
set output [SendCliCommand $connect "show management"]
if {[string first "SSH" $output] < 0} {
    SendCliCommand $connect "enable ssh2"
}
```

### Issue 2: Syntax Error
```tcl
# Use proper command syntax
# WRONG: SendCliCommand $connect "create vlan 100"
# CORRECT:
SendCliCommand $connect "create vlan test tag 100"
```

### Issue 3: Permission Denied
```tcl
# Ensure admin privileges
set output [SendCliCommand $connect "show session"]
if {[string first "Admin" $output] < 0} {
    puts "ERROR: Not logged in as admin"
    return FAIL
}
```

### Issue 4: Output Parsing Fails
```tcl
# Use regex for flexible matching
set output [SendCliCommand $connect "show vlan"]
if {[regexp {test.*100} $output]} {
    puts "VLAN found with tag 100"
}
```
