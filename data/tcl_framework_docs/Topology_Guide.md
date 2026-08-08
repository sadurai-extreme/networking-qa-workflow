# TCL Test Framework - Topology Guide

## Overview
The EXOS TCL test framework supports three primary topology configurations for different test scenarios.

## Topology Types

### 1. Single-Node Topology
**Purpose:** Configuration, show commands, and non-forwarding functional tests

**Setup:**
```
[DUT1]
```

**Use Cases:**
- CLI command verification (show commands)
- Configuration tests (enable/disable features)
- SNMP/API testing
- Non-traffic functional tests
- Feature state verification
- System resource tests (CPU, memory)

**Example Test Types:**
- Enable/disable features
- Configuration persistence after reboot
- Show command output validation
- SNMP OID verification
- ACL policy creation (without traffic)
- VLAN configuration (without forwarding)

**Limitations:**
- No traffic forwarding tests
- No inter-switch communication
- No port-based feature verification

---

### 2. Two-Node Topology
**Purpose:** Port-based features, L2/L3 forwarding, VLAN testing with IXIA traffic

**Setup:**
```
[DUT1] <---port1:1 <-> port1:1---> [DUT2]
  |                                   |
[IXIA Port A]                   [IXIA Port B]
```

**Use Cases:**
- L2 forwarding tests
- VLAN traffic isolation
- L3 routing (basic)
- Port-based features (link aggregation, mirroring)
- Traffic generation and verification
- QoS/rate limiting
- MAC learning
- ARP functionality

**IXIA Traffic Patterns:**
- Unicast traffic between IXIA ports
- Broadcast/multicast forwarding
- Frame rate verification
- Packet loss testing
- Latency measurement

**Example Test Types:**
- VLAN forwarding validation
- Port mirroring (send on DUT1, verify mirror copy)
- ACL permit/deny with traffic
- Rate limiting verification
- MAC address learning

---

### 3. Five-Node Topology
**Purpose:** Routing protocols, spanning-tree, complex multi-node scenarios

**Setup:**
```
        [DUT1]
       /      \
    [DUT2]  [DUT3]
       \      /
        [DUT4]
          |
        [DUT5]
          |
        [IXIA]
```

**Use Cases:**
- OSPF routing tests
- BGP peering and route propagation
- Spanning-tree (STP/RSTP/MSTP)
- VRRP/ESRP failover
- Multi-hop routing
- Route redistribution
- Network convergence tests
- Loop prevention

**Example Test Types:**
- OSPF neighbor adjacency
- BGP route advertisement
- Spanning-tree root bridge election
- VRRP failover (active/backup switch)
- Multi-path routing (ECMP)
- Network failure recovery (link down scenarios)

---

## Topology Selection Guidelines

| Feature Type | Recommended Topology | Rationale |
|-------------|---------------------|-----------|
| ACL | Single-node (config) + 2-node (traffic) | Config on single, traffic verification on 2-node |
| VLAN | 2-node | Requires traffic forwarding |
| OSPF/BGP | 5-node | Multi-device routing protocol |
| QoS | 2-node | Traffic rate verification |
| Port Mirroring | 2-node | Source and destination ports |
| STP/RSTP | 5-node | Loop detection across multiple switches |
| SNMP | Single-node | No traffic required |
| LLDP/CDP | 2-node | Neighbor discovery |
| LACP | 2-node | Port aggregation between switches |

---

## TCL Framework Variables

### Single-Node Variables
```tcl
global DUT1_CONNECT DUT1_IP
```

### Two-Node Variables
```tcl
global DUT1_CONNECT DUT2_CONNECT
global DUT1_IP DUT2_IP
global DUT1_PORT DUT2_PORT
global IXIA_PORT_A IXIA_PORT_B
```

### Five-Node Variables
```tcl
global DUT1_CONNECT DUT2_CONNECT DUT3_CONNECT DUT4_CONNECT DUT5_CONNECT
global DUT1_IP DUT2_IP DUT3_IP DUT4_IP DUT5_IP
```

---

## Best Practices

1. **Start Simple:** Use single-node for configuration validation before moving to traffic tests
2. **Incremental Testing:** Validate config on single-node, then verify traffic on 2-node
3. **Resource Efficiency:** Don't use 5-node topology for tests that only need 2 nodes
4. **Traffic Verification:** Always use IXIA for traffic-based tests (don't rely on CLI counters alone)
5. **Cleanup:** Unconfigure features after tests to avoid interference with subsequent tests
