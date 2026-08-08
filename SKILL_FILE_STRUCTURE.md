# Skill File Structure & Content

## Overview
Skill files are **detailed functional documentation** that describes HOW features work and HOW they are implemented in EXOS (Extreme Networks Operating System). They are NOT test plans - they are comprehensive reference documents that explain feature behavior, implementation details, and operational characteristics.

**Purpose**: Document the functional behavior and EXOS-specific implementation of network features, similar to chapters in the Switch Engine User Guide.

---

## Complete Skill File Structure

### 1. FEATURE OVERVIEW
- High-level description of what the feature does
- Purpose and business value
- Use cases and target scenarios
- Related RFCs, standards, or protocols (e.g., RFC 4271 for BGP)
- Prerequisites and dependencies

### 2. FUNCTIONAL DESCRIPTION ⭐
**Purpose**: Detailed explanation of how the feature works operationally

**Content Includes**:
- Core functionality and behavior
- Step-by-step operational flow
- How administrators interact with the feature
- Input/output behavior
- State transitions and lifecycle
- Default behaviors and settings
- User workflow examples

**Example Topics**:
- BGP session establishment process
- OSPF neighbor discovery and adjacency formation
- VLAN tagging and forwarding behavior
- How routes are advertised and learned
- Protocol state machines

---

### 3. EXOS IMPLEMENTATION DETAILS ⭐
**Purpose**: Technical details of how the feature is implemented in EXOS

**Content Includes**:
- Software architecture and design
- Key EXOS modules, daemons, or processes (e.g., bgpd, ospfd, fdb)
- Data structures and internal representations
- Algorithms and processing logic
- Protocol implementations (state machines, message formats)
- Hardware acceleration details (if applicable)
- Internal communication mechanisms
- Memory and resource management
- Platform-specific implementations

**Example Topics**:
- BGP daemon (bgpd) architecture
- RIB (Routing Information Base) structure
- FDB (Forwarding Database) lookup algorithms
- How EXOS handles route redistribution internally
- ACL hardware offload mechanisms
- Stack-specific processing

---

### 4. SUPPORTED ATTRIBUTES AND PARAMETERS ⭐
**Purpose**: Complete list of all configurable options

**Content Includes**:
- Protocol attributes supported (BGP path attributes, OSPF LSA types, etc.)
- All configurable parameters with valid ranges
- Default values and recommended settings
- Platform-specific variations
- Version-specific features
- License requirements (Advanced Edge, Core, Base, etc.)

**Example Table**:
| Parameter | Range | Default | License | Notes |
|-----------|-------|---------|---------|-------|
| BGP hold-time | 0, 3-65535 | 180 | Advanced Edge | 0 disables keepalives |
| OSPF hello-interval | 1-65535 | 10 | Base | Per interface |
| Max VLAN count | - | 4096 | - | Platform dependent |

---

### 5. CLI COMMANDS AND SYNTAX ⭐
**Purpose**: Complete CLI command reference

**Content Includes**:
- Configuration commands with full syntax
- Show commands for monitoring
- Debug commands
- Command examples with actual output
- Command interdependencies
- Configuration persistence behavior

**Example**:
```
# Configure BGP router
configure bgp AS-number <asn>
configure bgp neighbor <ip> remote-AS-number <asn>

# Show BGP status
show bgp neighbor
show bgp routes [detail]

# Example output
BGP Neighbor: 10.0.0.1  AS: 64500  State: Established
  Uptime: 2d 4h 32m
  Routes: Received: 150, Sent: 120, Active: 145
```

---

### 6. FEATURE INTERACTIONS ⭐
**Purpose**: How this feature integrates with other EXOS features

**Content Includes**:
- Integration with routing protocols
- Integration with VLANs and Virtual Routers
- Integration with security features (ACLs, filtering)
- Integration with management features
- Protocol interworking
- Shared resources or dependencies
- Order of operations and precedence rules

**Example**:
- BGP route redistribution into OSPF
- VLAN-aware BGP peering
- ACL filtering of routing updates
- QoS interaction with routing decisions
- NetLogin integration with VLAN assignment

---

### 7. OPERATIONAL CHARACTERISTICS ⭐
**Purpose**: How the feature behaves during operation

**Content Includes**:
- Performance characteristics and scalability limits
- Resource utilization (CPU, memory, hardware table usage)
- Maximum supported values (routes, sessions, entries)
- Convergence time and timing behavior
- High availability behavior
- Failover and redundancy mechanisms
- Graceful restart procedures
- Logging and SNMP trap generation

**Example Table**:
| Characteristic | Value | Platform |
|----------------|-------|----------|
| Max BGP routes | 32,000 | X460-G2 |
| Max OSPF neighbors | 256 | X670-G2 |
| BGP convergence | ~5 sec | Typical |
| Stack failover | <1 sec | Active standby |

---

### 8. SPECIAL BEHAVIORS AND EDGE CASES
**Purpose**: Notable behaviors and corner cases

**Content Includes**:
- Default route handling
- Behavior with invalid or missing configurations
- Backward compatibility considerations
- Migration from older EXOS versions
- Behavior during upgrades
- Platform-specific quirks
- Known differences from RFCs or standards
- Interaction with stacking
- Behavior during failover

---

### 9. CONFIGURATION EXAMPLES ⭐
**Purpose**: Real-world configuration scenarios

**Content Includes**:
- Basic configuration example
- Advanced configuration example
- Common deployment patterns
- Multi-feature integration examples
- Typical network topologies

**Example**:
```
# Basic BGP Configuration
create vlan "bgp_peer"
configure vlan bgp_peer tag 100
configure vlan bgp_peer ipaddress 10.0.0.1/24

enable bgp
configure bgp AS-number 64500
configure bgp router-id 10.0.0.1
configure bgp neighbor 10.0.0.2 remote-AS-number 64501
enable bgp neighbor 10.0.0.2
```

---

### 10. VERIFICATION AND MONITORING
**Purpose**: How to verify the feature is working correctly

**Content Includes**:
- Show commands to check operational status
- Log messages indicating proper operation
- SNMP OIDs for monitoring
- Counters and statistics to monitor
- Troubleshooting commands
- Common operational states
- Expected output examples

**Example**:
```
# Verify BGP session
show bgp neighbor
# Expected: State = Established

# Check route count
show bgp routes summary
# Expected: Non-zero active routes

# Check logs
show log | include bgp
# Expected: "BGP neighbor 10.0.0.2 up"
```

---

## How Sections Work Together

1. **Overview & Description (1-2)**: Understand WHAT the feature is and HOW it works
2. **Implementation (3)**: Understand the technical HOW - EXOS architecture and internals
3. **Configuration (4-5)**: Know WHAT can be configured and HOW to configure it
4. **Integration (6-7)**: Understand how feature interacts with EXOS ecosystem and performs
5. **Practical Use (8-9)**: Learn edge cases and see real configuration examples
6. **Operations (10)**: Know how to verify and monitor the feature

---

## Quality Standards

Each generated skill file will:
- ✅ Document actual EXOS behavior and implementation
- ✅ Include all 10 sections with comprehensive functional content
- ✅ Provide specific CLI command syntax and examples
- ✅ Include realistic configuration examples from EXOS
- ✅ Be formatted in clean, readable Markdown
- ✅ Contain 5-10+ substantive points per major section
- ✅ Reference Switch Engine User Guide where applicable
- ✅ Document platform-specific and version-specific details
- ✅ Cite relevant RFCs and standards

---

## Usage in QA Workflow

1. **Read Sections 1-3**: Understand what the feature is and how it's implemented
2. **Review Section 4-5**: Learn all configuration options and CLI commands
3. **Study Section 6-7**: Understand feature interactions and operational characteristics
4. **Reference Section 8-9**: Learn edge cases and see configuration examples
5. **Use Section 10**: Verify feature is working correctly

QA engineers can use this functional documentation to:
- Understand feature behavior for test case creation
- Identify configuration parameters to vary in tests
- Learn about feature interactions to test integration
- Understand scalability limits for performance testing
- Get realistic configuration examples for test setups

---

## Benefits

✅ **Complete Functional Understanding**: Comprehensive documentation of how features work
✅ **EXOS-Specific Details**: Implementation details specific to EXOS platform
✅ **Configuration Reference**: All CLI commands and parameters documented
✅ **Operational Guidance**: How to verify and monitor features
✅ **Integration Context**: How features work with other EXOS components
✅ **Reusable**: Reference documentation for multiple releases
