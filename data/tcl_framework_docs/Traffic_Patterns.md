# TCL Test Framework - IXIA Traffic Patterns

## Overview
IXIA traffic generator procedures for L2/L3 traffic testing in the EXOS TCL framework.

## Core IXIA Procedures

### 1. SendFrame (L2 Ethernet Frames)
**Purpose:** Send raw Ethernet frames for L2 testing

**Syntax:**
```tcl
SendFrame $IXIA_PORT_A $IXIA_PORT_B \
    -srcMac "00:04:96:98:65:1C" \
    -destMac "00:04:96:98:65:1D" \
    -frameCount 1000 \
    -frameRate 100 \
    -vlanId 10 \
    -etherType "0x0800"
```

**Parameters:**
- `srcMac` - Source MAC address
- `destMac` - Destination MAC address
- `frameCount` - Number of frames to send
- `frameRate` - Frames per second (fps)
- `vlanId` - VLAN tag (optional)
- `etherType` - Ethernet type (0x0800 for IPv4)

**Use Cases:**
- MAC learning tests
- VLAN forwarding validation
- Broadcast/multicast testing
- Port mirroring verification

**Example:**
```tcl
# Send 1000 frames on VLAN 10
SendFrame $IXIA_PORT_A $IXIA_PORT_B \
    -srcMac "00:00:00:00:00:01" \
    -destMac "00:00:00:00:00:02" \
    -frameCount 1000 \
    -frameRate 100 \
    -vlanId 10

# Verify reception
set rxCount [GetIxiaRxCount $IXIA_PORT_B]
if {$rxCount < 990} {
    puts "ERROR: Only $rxCount frames received (expected ~1000)"
    return FAIL
}
```

---

### 2. SendIpFrame (L3 IP Packets)
**Purpose:** Send IP packets for L3 routing tests

**Syntax:**
```tcl
SendIpFrame $IXIA_PORT_A $IXIA_PORT_B \
    -srcIp "10.0.0.1" \
    -destIp "10.0.0.2" \
    -srcMac "00:04:96:98:65:1C" \
    -destMac "00:04:96:98:65:1D" \
    -frameCount 1000 \
    -frameRate 100 \
    -protocol "tcp" \
    -srcPort 12345 \
    -destPort 80
```

**Parameters:**
- `srcIp` - Source IP address
- `destIp` - Destination IP address
- `srcMac` - Source MAC address
- `destMac` - Destination MAC (router MAC)
- `frameCount` - Number of packets
- `frameRate` - Packets per second
- `protocol` - IP protocol (tcp, udp, icmp)
- `srcPort` - Source TCP/UDP port
- `destPort` - Destination TCP/UDP port

**Use Cases:**
- L3 routing verification
- ACL permit/deny with IP addresses
- QoS DSCP marking
- NAT testing
- Firewall rule testing

**Example:**
```tcl
# Send TCP traffic from subnet A to subnet B
SendIpFrame $IXIA_PORT_A $IXIA_PORT_B \
    -srcIp "192.168.1.10" \
    -destIp "192.168.2.10" \
    -srcMac "00:00:00:00:00:01" \
    -destMac $DUT1_MAC \
    -frameCount 5000 \
    -frameRate 500 \
    -protocol "tcp" \
    -destPort 80

# Verify routing worked
set rxCount [GetIxiaRxCount $IXIA_PORT_B]
if {$rxCount < 4900} {
    puts "ERROR: Routing failed - only $rxCount packets received"
    return FAIL
}
```

---

### 3. CheckRates (Traffic Rate Verification)
**Purpose:** Verify traffic forwarding rates and packet loss

**Syntax:**
```tcl
CheckRates $IXIA_PORT_A $IXIA_PORT_B \
    -expectedRate 1000 \
    -tolerance 5 \
    -duration 10
```

**Parameters:**
- `expectedRate` - Expected fps/Mbps
- `tolerance` - Acceptable deviation percentage
- `duration` - Measurement duration in seconds

**Returns:**
- `actualRate` - Measured rate
- `packetLoss` - Percentage lost
- `result` - PASS/FAIL

**Use Cases:**
- QoS rate limiting verification
- Port bandwidth testing
- Storm control validation
- Traffic shaping verification

**Example:**
```tcl
# Verify QoS rate limit of 1000 fps
SendFrame $IXIA_PORT_A $IXIA_PORT_B \
    -srcMac "00:00:00:00:00:01" \
    -destMac "00:00:00:00:00:02" \
    -frameCount 20000 \
    -frameRate 2000 \
    -vlanId 10

# Check that rate is limited to ~1000 fps
set result [CheckRates $IXIA_PORT_B \
    -expectedRate 1000 \
    -tolerance 10 \
    -duration 10]

if {[lindex $result 2] != "PASS"} {
    puts "ERROR: Rate limiting failed"
    puts "Expected: 1000 fps, Actual: [lindex $result 0] fps"
    return FAIL
}
```

---

## Advanced Traffic Patterns

### 4. Multicast Traffic
```tcl
SendFrame $IXIA_PORT_A $IXIA_PORT_B \
    -srcMac "00:00:00:00:00:01" \
    -destMac "01:00:5E:00:00:01" \
    -frameCount 1000 \
    -frameRate 100 \
    -vlanId 10

# Verify multicast forwarding on multiple ports
set rx1 [GetIxiaRxCount $IXIA_PORT_B]
set rx2 [GetIxiaRxCount $IXIA_PORT_C]
if {$rx1 < 990 || $rx2 < 990} {
    puts "ERROR: Multicast forwarding failed"
    return FAIL
}
```

### 5. Broadcast Storm Testing
```tcl
SendFrame $IXIA_PORT_A $IXIA_PORT_B \
    -srcMac "00:00:00:00:00:01" \
    -destMac "FF:FF:FF:FF:FF:FF" \
    -frameCount 100000 \
    -frameRate 10000 \
    -vlanId 10

# Verify storm control blocked excessive broadcast
set rxCount [GetIxiaRxCount $IXIA_PORT_B]
if {$rxCount > 5000} {
    puts "ERROR: Storm control not working - $rxCount frames received"
    return FAIL
}
puts "PASS: Storm control working - only $rxCount frames forwarded"
```

### 6. VLAN Isolation Testing
```tcl
# Send on VLAN 10
SendFrame $IXIA_PORT_A $IXIA_PORT_B \
    -srcMac "00:00:00:00:00:01" \
    -destMac "00:00:00:00:00:02" \
    -frameCount 1000 \
    -vlanId 10

# Verify NOT received on VLAN 20 port
set rxVlan20 [GetIxiaRxCount $IXIA_PORT_C]
if {$rxVlan20 > 0} {
    puts "ERROR: VLAN isolation broken - VLAN 10 traffic leaked to VLAN 20"
    return FAIL
}
```

---

## Traffic Verification Procedures

### GetIxiaRxCount
```tcl
proc GetIxiaRxCount {port} {
    # Returns number of frames received on IXIA port
    set count [ixia get $port -rx_frames]
    return $count
}
```

### GetIxiaTxCount
```tcl
proc GetIxiaTxCount {port} {
    # Returns number of frames transmitted from IXIA port
    set count [ixia get $port -tx_frames]
    return $count
}
```

### ClearIxiaStats
```tcl
proc ClearIxiaStats {portList} {
    # Clear IXIA statistics before test
    foreach port $portList {
        ixia clear $port
    }
}
```

---

## Best Practices

1. **Always Clear Stats First**
   ```tcl
   ClearIxiaStats [list $IXIA_PORT_A $IXIA_PORT_B]
   ```

2. **Use Tolerance for Rate Tests**
   - Allow 5-10% tolerance due to timing variations
   - 100% match is unrealistic in real networks

3. **Wait for Traffic Stabilization**
   ```tcl
   SendFrame ...
   after 2000  ;# Wait 2 seconds for traffic to stabilize
   set rxCount [GetIxiaRxCount $IXIA_PORT_B]
   ```

4. **Verify Both Tx and Rx**
   ```tcl
   set txCount [GetIxiaTxCount $IXIA_PORT_A]
   set rxCount [GetIxiaRxCount $IXIA_PORT_B]
   set lossPercent [expr {(($txCount - $rxCount) * 100.0) / $txCount}]
   if {$lossPercent > 1.0} {
       puts "ERROR: Packet loss $lossPercent%"
       return FAIL
   }
   ```

5. **Use Realistic Frame Rates**
   - Low rate (100 fps): Configuration tests
   - Medium rate (1000 fps): Functional tests
   - High rate (10000+ fps): Performance tests

---

## Common Traffic Test Patterns

### Pattern 1: Basic Forwarding Test
```tcl
# 1. Clear stats
ClearIxiaStats [list $IXIA_PORT_A $IXIA_PORT_B]

# 2. Send traffic
SendFrame $IXIA_PORT_A $IXIA_PORT_B \
    -srcMac "00:00:00:00:00:01" \
    -destMac "00:00:00:00:00:02" \
    -frameCount 1000 \
    -frameRate 100

# 3. Wait for completion
after 12000

# 4. Verify
set rxCount [GetIxiaRxCount $IXIA_PORT_B]
if {$rxCount >= 990} {
    puts "PASS: Forwarding working ($rxCount/1000 frames)"
    return PASS
} else {
    puts "FAIL: Only $rxCount/1000 frames received"
    return FAIL
}
```

### Pattern 2: ACL Deny Test
```tcl
# Configure ACL to deny traffic
SendCliCommand $DUT1_CONNECT "configure access-list acl_test deny tcp any any"
SendCliCommand $DUT1_CONNECT "configure access-list apply acl_test port $DUT1_PORT ingress"

# Send TCP traffic
SendIpFrame $IXIA_PORT_A $IXIA_PORT_B \
    -srcIp "10.0.0.1" -destIp "10.0.0.2" \
    -protocol "tcp" -frameCount 1000

# Verify traffic blocked
set rxCount [GetIxiaRxCount $IXIA_PORT_B]
if {$rxCount == 0} {
    puts "PASS: ACL correctly blocked traffic"
    return PASS
} else {
    puts "FAIL: ACL failed - $rxCount frames leaked through"
    return FAIL
}
```

### Pattern 3: QoS Rate Limiting
```tcl
# Configure rate limit 1 Mbps
SendCliCommand $DUT1_CONNECT "configure qos profile qos1 maxrate 1000"
SendCliCommand $DUT1_CONNECT "configure qos profile qos1 port $DUT1_PORT"

# Send high-rate traffic
SendFrame $IXIA_PORT_A $IXIA_PORT_B \
    -srcMac "00:00:00:00:00:01" \
    -destMac "00:00:00:00:00:02" \
    -frameCount 50000 \
    -frameRate 5000

# Check rate limited to ~1000 fps
set result [CheckRates $IXIA_PORT_B -expectedRate 1000 -tolerance 10 -duration 10]
if {[lindex $result 2] == "PASS"} {
    puts "PASS: Rate limiting working"
    return PASS
} else {
    puts "FAIL: Rate limit not applied"
    return FAIL
}
```
