# EXOS Automation Topology Reference
## **Extracted from Automation Framework Documentation**

**Date**: July 24, 2026  
**Source**: TCL Framework Topology Guide + Automation Ready Checklist  
**Purpose**: Reference for test plan generation with topology understanding

---

## 📐 Standard EXOS Automation Topologies

### 1. **Single-Node Topology**

**Visual Diagram:**
```
┌─────────┐
│  DUT1   │
└─────────┘
```

**Purpose:** Configuration, show commands, non-forwarding functional tests

**Characteristics:**
- No traffic generation
- One EXOS switch only
- CLI/SNMP/API testing
- Feature enable/disable verification

**Use Cases:**
- ✅ CLI command verification
- ✅ Configuration persistence after reboot
- ✅ Show command validation
- ✅ SNMP OID verification
- ✅ Feature state checking
- ✅ System resource tests (CPU, memory)
- ❌ NO traffic forwarding tests
- ❌ NO inter-switch communication

**TCL Variables:**
```tcl
global DUT1_CONNECT DUT1_IP
```

**Example Test Types:**
- Enable/disable features
- Configuration changes
- VLAN creation (without traffic)
- ACL policy creation (without traffic verification)

---

### 2. **Two-Node Topology** ⭐ MOST COMMON

**Visual Diagram:**
```
  ┌─────────────────────────────────────────┐
  │                                         │
  │  [IXIA Port A]                         │
  │       │                                 │
  │       ↓                                 │
  │  ┌─────────┐  port1:1 ←→ port1:1  ┌─────────┐
  │  │  DUT1   │────────────────────────│  DUT2   │
  │  └─────────┘                        └─────────┘
  │                                           │
  │                                           ↓
  │                                     [IXIA Port B]
  │                                         │
  └─────────────────────────────────────────┘
```

**Purpose:** Port-based features, L2/L3 forwarding, traffic verification

**Characteristics:**
- 2 EXOS switches interconnected
- IXIA traffic generator with 2 ports
- Supports forwarding, filtering, rate-limiting tests
- Most common topology for functional tests

**Use Cases:**
- ✅ L2 forwarding (VLAN traffic)
- ✅ L3 routing (basic IP forwarding)
- ✅ Port-based features (mirroring, LAG)
- ✅ QoS and rate limiting
- ✅ Traffic generation and verification
- ✅ MAC learning and ARP
- ✅ ACL permit/deny with traffic
- ✅ Broadcast/multicast forwarding

**TCL Variables:**
```tcl
global DUT1_CONNECT DUT2_CONNECT
global DUT1_IP DUT2_IP
global DUT1_PORT DUT2_PORT
global IXIA_PORT_A IXIA_PORT_B
```

**IXIA Traffic Patterns:**
- Unicast traffic between IXIA ports
- Broadcast/multicast forwarding
- Frame rate verification (pps)
- Packet loss/drop testing
- Latency measurement
- Burst traffic patterns

**Port Mapping:**
```tcl
# Dynamic port mapping (REQUIRED for automation)
set port1 [MapDUTPortId 1 1]  # DUT1 port connected to DUT2
set port2 [MapDUTPortId 1 2]  # DUT1 port connected to IXIA
set dut2_port1 [MapDUTPortId 2 1]  # DUT2 port connected to DUT1
set dut2_port2 [MapDUTPortId 2 2]  # DUT2 port connected to IXIA
```

**Example Test Scenarios:**
1. **VLAN Forwarding:**
   - Configure VLAN 100 on DUT1 and DUT2
   - Send tagged traffic from IXIA Port A
   - Verify reception on IXIA Port B

2. **Rate Limiting:**
   - Configure rate limit on DUT1 port
   - Send burst traffic from IXIA
   - Verify drops/exceeded counters

3. **Port Mirroring:**
   - Configure source port and mirror port on DUT1
   - Send traffic on source port
   - Verify mirrored copy on mirror port

---

### 3. **Five-Node Topology**

**Visual Diagram:**
```
            ┌─────────┐
            │  DUT1   │
            └────┬────┘
                 │
         ┌───────┴───────┐
         │               │
    ┌────▼────┐     ┌────▼────┐
    │  DUT2   │     │  DUT3   │
    └────┬────┘     └────┬────┘
         │               │
         └───────┬───────┘
                 │
            ┌────▼────┐
            │  DUT4   │
            └────┬────┘
                 │
            ┌────▼────┐
            │  DUT5   │
            └────┬────┘
                 │
            ┌────▼────┐
            │  IXIA   │
            └─────────┘
```

**Purpose:** Routing protocols, spanning-tree, complex multi-node scenarios

**Characteristics:**
- 5 EXOS switches in mesh/ring topology
- Supports routing protocols
- Network convergence testing
- Loop prevention verification

**Use Cases:**
- ✅ OSPF routing and neighbor adjacency
- ✅ BGP peering and route propagation
- ✅ Spanning-tree (STP/RSTP/MSTP)
- ✅ VRRP/ESRP failover
- ✅ Multi-hop routing
- ✅ Route redistribution
- ✅ Network convergence tests
- ✅ Loop prevention

**TCL Variables:**
```tcl
global DUT1_CONNECT DUT2_CONNECT DUT3_CONNECT DUT4_CONNECT DUT5_CONNECT
global DUT1_IP DUT2_IP DUT3_IP DUT4_IP DUT5_IP
```

**Example Test Scenarios:**
1. **OSPF Convergence:**
   - Configure OSPF on all 5 nodes
   - Verify neighbor adjacency
   - Bring down link between DUT1-DUT2
   - Verify traffic reroutes through DUT3-DUT4

2. **Spanning-Tree:**
   - Create loop topology
   - Verify root bridge election
   - Verify blocked ports
   - Failover testing (disable root bridge)

---

## 🎯 Topology Selection Matrix

| Feature Type | Single | 2-Node | 5-Node | IXIA Required? |
|-------------|--------|--------|--------|----------------|
| **CLI Validation** | ✅ | ✅ | ✅ | ❌ |
| **Configuration** | ✅ | ✅ | ✅ | ❌ |
| **VLAN Forwarding** | ❌ | ✅ | ✅ | ✅ |
| **ACL (config only)** | ✅ | - | - | ❌ |
| **ACL (with traffic)** | ❌ | ✅ | - | ✅ |
| **QoS/Rate Limiting** | ❌ | ✅ | - | ✅ |
| **Port Mirroring** | ❌ | ✅ | - | ✅ |
| **LAG/LACP** | ❌ | ✅ | - | ✅ |
| **LLDP/CDP** | ❌ | ✅ | - | ❌ |
| **OSPF/BGP** | ❌ | ❌ | ✅ | ✅ |
| **STP/RSTP/MSTP** | ❌ | ❌ | ✅ | ❌ |
| **VRRP/ESRP** | ❌ | ✅ | ✅ | ✅ |
| **SNMP** | ✅ | - | - | ❌ |

---

## 🔧 TCL Framework Requirements

### Dynamic Port Mapping (CRITICAL)
**✅ REQUIRED:**
```tcl
set port1 [MapDUTPortId 1 1]
SendACmd "configure port $port1 rate-limit flood broadcast 1000"
```

**❌ FORBIDDEN:**
```tcl
SendACmd "configure port 1 rate-limit flood broadcast 1000"
```

### IXIA Traffic Generation (Complete Parameters)
**✅ REQUIRED - All 7 Parameters:**
```tcl
SendFrame -txPortId 1 \
          -destMac    "ff:ff:ff:ff:ff:ff" \
          -sourceMac  "00:00:01:00:09:01" \
          -numFrames  2000 \
          -frameRate  1000 \
          -streamType "singleBurst" \
          -frameSize  128
```

**❌ FORBIDDEN:**
```tcl
Send traffic from IXIA with 2000 frames
```

---

## 📊 Automation Readiness Criteria

### For Test Plans to Be Automation-Ready:

**1. Topology Must Be Specified:**
- ASCII diagram showing device connections
- Port mappings documented
- IXIA port assignments clear

**2. Dynamic Port Mapping:**
- NO hardcoded ports (e.g., "port 1")
- ALL ports use `MapDUTPortId`
- Variables used in all CLI commands

**3. Complete IXIA Parameters:**
- All 7 parameters specified
- No placeholders like `<value>`
- Exact frame sizes, rates, counts

**4. Traffic Patterns Documented:**
- Source/destination MACs
- VLAN tags (if applicable)
- Frame types (broadcast, unicast, multicast)
- Expected behavior (forwarded, dropped, rate-limited)

**5. Verification Logic:**
- Counter parsing code included
- Expected value ranges specified
- Pass/fail criteria clear

---

## 💡 Best Practices

### Topology Selection:
1. **Start simple:** Use single-node for config validation
2. **Add traffic:** Move to 2-node for forwarding tests
3. **Scale up:** Use 5-node only when needed (routing protocols, STP)

### Test Design:
1. **Incremental approach:** Config → Traffic → Verification
2. **Resource efficiency:** Don't over-provision topology
3. **Clear separation:** Config tests vs. forwarding tests
4. **Cleanup:** Reset state between tests

### Common Mistakes to Avoid:
- ❌ Using 5-node for simple L2 forwarding tests
- ❌ Hardcoding port numbers
- ❌ Missing IXIA parameters
- ❌ No traffic verification (relying only on CLI counters)
- ❌ Unclear topology diagrams

---

## 🎓 Example Topology Diagrams

### Example 1: Rate Limiting Test (2-Node)
```
Topology: 2-node with IXIA traffic generator

    [IXIA Port 1]
         │
         │ 1000 pps broadcast traffic
         ↓
    ┌─────────┐ port1:1 ───────────── port1:1 ┌─────────┐
    │  DUT1   │                                 │  DUT2   │
    │ (5720)  │ Rate limit: 500 pps             │ (X460)  │
    └─────────┘                                 └─────────┘
         │                                           │
         │                                           ↓
    [IXIA Port 2]                              Verify: ~500 frames
                                                Drop: ~500 frames
```

### Example 2: OSPF Convergence Test (5-Node)
```
Topology: 5-node mesh for OSPF testing

         ┌─────────┐
         │  DUT1   │ OSPF Area 0
         │ (ABR)   │ Router ID: 1.1.1.1
         └────┬────┘
              │
     ┌────────┴────────┐
     │                 │
┌────▼────┐       ┌────▼────┐
│  DUT2   │       │  DUT3   │
│ Area 1  │       │ Area 2  │
└────┬────┘       └────┬────┘
     │                 │
     └────────┬────────┘
              │
         ┌────▼────┐
         │  DUT4   │ OSPF Area 0
         └────┬────┘
              │
         ┌────▼────┐
         │  DUT5   │ Traffic Source
         └────┬────┘
              │
         ┌────▼────┐
         │  IXIA   │ Traffic Verification
         └─────────┘
```

---

## 📝 Summary for Test Plan Generation

When generating test plans, the system should:

1. **Analyze feature type** → Select appropriate topology
2. **Generate ASCII diagram** → Show device connections
3. **Use dynamic port mapping** → `MapDUTPortId` for all ports
4. **Include IXIA parameters** → Complete 7-parameter traffic specs
5. **Document traffic flows** → Source → DUT → Destination
6. **Specify verification** → Counter locations, expected values

**Result:** 95%+ automation-ready test plans that can be converted to TCL in 30 minutes (vs 4-6 hours previously).

---

*This document extracted from:*
- *data/tcl_framework_docs/Topology_Guide.md*
- *AUTOMATION_READY_CHECKLIST.md*
- *AUTOMATION_READY_FRAMEWORK_INDEX.md*
