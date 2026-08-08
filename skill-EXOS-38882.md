# EXOS-38882: NOS API OSPF Updates - Skill File

## Feature Overview

**Jira Ticket**: EXOS-38882  
**Feature**: NOS API: updates to OSPF  
**Type**: Story (NOS API Endpoint)  
**Priority**: P2 - High  
**Status**: Done  

### Description
Updates OSPF API to address changes introduced in YAML pull request 913. This involves REST API endpoints for OSPF configuration and state management across VRFs, VLANs, areas, redistribution, and virtual circuits.

### NOS API OSPF Endpoints

#### Configuration Endpoints

1. **Global OSPF Configuration**
   - `GET /v0/configuration/ospf` - Get OSPF configuration across all VR's and VLAN's
   - `POST /v0/configuration/ospf` - Add OSPF to a VR

2. **Per-VR OSPF Management**
   - `GET /v0/configuration/ospf/vr/{vr_name}` - Get per VR OSPF configuration
   - `PATCH /v0/configuration/ospf/vr/{vr_name}` - Update per VR OSPF configuration
   - `DELETE /v0/configuration/ospf/vr/{vr_name}` - Delete OSPF from a VR

3. **OSPF Area Management**
   - `PUT /v0/configuration/ospf/vr/{vr_name}/area/{area_id}` - Create or update OSPF area
   - `DELETE /v0/configuration/ospf/vr/{vr_name}/area/{area_id}` - Delete OSPF area

4. **OSPF Redistribution**
   - `PUT /v0/configuration/ospf/vr/{vr_name}/redistribute/{protocol}` - Create or update redistribution
   - `DELETE /v0/configuration/ospf/vr/{vr_name}/redistribute/{protocol}` - Delete redistribution entry

5. **Per-VLAN OSPF Interface**
   - `GET /v0/configuration/ospf/vlan/{vlan_id}` - Get per VLAN OSPF configuration
   - `PATCH /v0/configuration/ospf/vlan/{vlan_id}` - Update per VLAN OSPF configuration

6. **OSPF Virtual Circuits**
   - `PUT /v0/configuration/ospf/vr/{vr_name}/virtual-circuit/area/{area_id}/virtual-neighbor/{neighbor_id}` - Create or update virtual circuit
   - `DELETE /v0/configuration/ospf/vr/{vr_name}/virtual-circuit/area/{area_id}/virtual-neighbor/{neighbor_id}` - Delete virtual circuit

7. **State/Operational Data**
   - `GET /v0/state/ospf` - Get OSPF state for all interfaces on all VRF's

### Data Models

#### OspfUpdateSettings (Per VR Configuration)
```yaml
properties:
  enable: boolean              # Enabled state of OSPF on the VRF
  routerId: string (ipv4)      # Router ID (0.0.0.0 = autoderived)
  isASBoundaryRouter: boolean  # VOSS only - AS boundary router flag
  rfc1583CompatibilityEnable: boolean  # VOSS only - RFC 1583 compatibility
  routingTOSSupport: boolean   # VOSS only - Type of service routing
  badLsaIgnore: boolean        # VOSS only - Process invalid LSAs
  opaqueLsaSupport: boolean    # Opaque LSA types support
  autoVirtLinkEnable: boolean  # VOSS only - Auto virtual link creation
  holdTime: integer (0-300)    # Min seconds between SPF calculations
                               # VOSS: 0, 3-60 (default 10)
                               # EXOS: 0-300 (default 3)
  helperModeEnable: boolean    # VOSS only - Graceful Restart Helper Mode
  gracefulRestartType: enum    # EXOS only - NONE|PLANNED|UNPLANNED|PLANNED_AND_UNPLANNED
  gracefulRestartPeriod: integer (1-1800)  # EXOS only - Grace period (default 120)
  originate: object            # EXOS only - OspfOriginate settings
```

#### OspfAreaUpdateSettings
```yaml
properties:
  type: enum                   # Area type (normal, stub, nssa)
  sendAreaSummary: boolean     # Controls summary LSA import into stub/NSSA areas
```

#### OspfRedistributeSettings
```yaml
properties:
  protocol: string             # Source protocol (static, rip, bgp, connected, etc.)
  enable: boolean              # VOSS only - Enable/disable redistribution
  metricType: integer          # Metric type (1 or 2)
  metric: integer              # Metric value
```

#### OspfInterfaceSettings (Per VLAN)
```yaml
properties:
  enable: boolean              # OSPF enabled on this interface
  area: string                 # Area ID (IPv4 format)
  cost: integer                # Interface cost
  priority: integer            # Router priority for DR election
  helloInterval: integer       # Hello packet interval (seconds)
  deadInterval: integer        # Router dead interval (seconds)
  retransmitInterval: integer  # LSA retransmit interval (seconds)
  transitDelay: integer        # Transit delay (seconds)
  authType: enum               # Authentication type (none, simple, md5)
  authKey: string              # Authentication key
```

#### OspfVirtualCircuitSettings
```yaml
properties:
  transitAreaId: string        # Transit area ID (IPv4 format)
  virtualNeighborId: string    # Virtual neighbor router ID (IPv4 format)
  enable: boolean              # Virtual link enabled
  helloInterval: integer       # Hello interval for virtual link
  deadInterval: integer        # Dead interval for virtual link
  retransmitInterval: integer  # Retransmit interval
  transitDelay: integer        # Transit delay
  authType: enum               # Authentication type
  authKey: string              # Authentication key
```

### CLI Equivalents (EXOS)

#### Enable OSPF on VR
```
enable ospf [vr <vr_name>]
configure ospf routerid <router_id> [vr <vr_name>]
```

#### Configure OSPF Area
```
create ospf area <area_id> [vr <vr_name>]
configure ospf area <area_id> [normal | stub | nssa] [vr <vr_name>]
```

#### Enable OSPF on VLAN
```
enable ospf vlan <vlan_name> area <area_id>
configure ospf vlan <vlan_name> {cost <cost>} {priority <priority>} 
  {hello-interval <seconds>} {dead-interval <seconds>}
```

#### Configure Redistribution
```
enable ospf export {static | rip | bgp | direct} [cost <cost>] 
  [type {ase-type-1 | ase-type-2}] [vr <vr_name>]
```

#### Configure Virtual Link
```
configure ospf virtual-link <neighbor_routerid> transit-area <area_id> 
  [hello-interval <seconds>] [dead-interval <seconds>] [vr <vr_name>]
```

### Show Commands for Verification

```bash
# Global OSPF status
show ospf [vr <vr_name>]
show ospf neighbor [vr <vr_name>]

# Area information
show ospf area [<area_id>] [vr <vr_name>]

# Interface/VLAN information
show ospf interface [vlan <vlan_name>] [vr <vr_name>]

# Virtual links
show ospf virtual-links [vr <vr_name>]

# Redistribution
show ospf export [vr <vr_name>]

# LSDB (Link State Database)
show ospf lsdb [<lsa_type>] [vr <vr_name>]

# Routes
show iproute ospf [vr <vr_name>]
```

### Platform Differences (EXOS vs VOSS)

| Feature | EXOS | VOSS |
|---------|------|------|
| Default VR | VR-Default (cannot delete OSPF) | Can delete OSPF from non-default VRs |
| Router ID | Auto-derived from interface IPs | Auto-derived from chassis MAC |
| AS Boundary Router | Read-only, determined by redistribution | Settable, must be true for redistribution |
| Graceful Restart | Type + Period parameters | Helper Mode Enable only |
| RFC 1583 Compatibility | Not supported | Supported |
| Bad LSA Ignore | Not supported | Supported |
| Auto Virtual Link | Not supported | Supported |
| Hold Time Range | 0-300 seconds (default 3) | 0, 3-60 seconds (default 10) |

### Common Test Scenarios

1. **Basic OSPF Configuration**
   - Enable OSPF on VR-Default
   - Configure router ID (manual and auto-derived)
   - Verify OSPF process is running

2. **Area Configuration**
   - Create backbone area (0.0.0.0)
   - Create normal areas
   - Create stub areas
   - Create NSSA areas
   - Verify area types and settings

3. **Interface/VLAN Configuration**
   - Enable OSPF on VLAN interfaces
   - Configure interface parameters (cost, priority, timers)
   - Configure authentication (none, simple, MD5)
   - Verify neighbor adjacencies

4. **Redistribution Testing**
   - Redistribute static routes
   - Redistribute connected routes
   - Redistribute BGP routes
   - Configure metric and metric-type
   - Verify redistributed routes in LSDB

5. **Virtual Links**
   - Create virtual links through transit areas
   - Configure virtual link parameters
   - Verify virtual adjacencies

6. **State/Operational Data**
   - Query OSPF neighbors
   - Query LSDB contents
   - Query OSPF routes
   - Query interface statistics

7. **Error Handling**
   - Invalid router ID format
   - Duplicate area creation
   - Invalid area types
   - Interface not in IP routing mode
   - Invalid timer values
   - Authentication mismatches

8. **Edge Cases**
   - OSPF on non-existent VR
   - OSPF on non-existent VLAN
   - Delete OSPF with active neighbors
   - Modify area type with active interfaces
   - Multiple redistribution protocols

### API-Specific Test Considerations

1. **HTTP Method Validation**
   - GET returns 200 with data
   - POST returns 204 on success, 400/409 on error
   - PATCH returns 204 on success
   - PUT returns 204 on success (create or update)
   - DELETE returns 204 on success, 404 if not found

2. **Request Body Validation**
   - Missing required fields → 400 Bad Request
   - Invalid field types → 400 Bad Request
   - Out-of-range values → 400 Bad Request
   - Unknown fields → Should be ignored or rejected

3. **Path Parameter Validation**
   - Non-existent VR → 404 Not Found
   - Non-existent VLAN → 404 Not Found
   - Invalid area ID format → 400 Bad Request
   - Invalid router ID format → 400 Bad Request

4. **Idempotency**
   - Multiple identical POSTs → First succeeds, subsequent fail
   - Multiple identical PUTs → All succeed (idempotent)
   - Multiple identical PATCHes → All succeed (idempotent)
   - Multiple identical DELETEs → First succeeds, subsequent 404

5. **Platform-Specific Fields**
   - EXOS-only fields sent to VOSS → Should be ignored or error
   - VOSS-only fields sent to EXOS → Should be ignored or error

6. **State Consistency**
   - Configuration changes via API immediately visible via CLI
   - Configuration changes via CLI immediately visible via API
   - State data reflects actual operational status

### Test Environment Requirements

#### Hardware
- EXOS switch (e.g., X440-G2, X465, X690, X770) with OSPF support
- At least 2 VLANs configured with IP addresses
- Optional: Second EXOS switch for neighbor adjacency testing
- Optional: External OSPF router for interoperability testing

#### Software
- EXOS version with YAML PR 913 changes incorporated
- REST API enabled (`enable web http`/`enable web https`)
- Advanced Edge or Core license (for OSPF features)

#### Network Topology
```
[Test Client] --API--> [EXOS DUT] <--OSPF--> [OSPF Neighbor]
                         |
                         +-- VLAN 10 (10.0.10.1/24) - Area 0
                         +-- VLAN 20 (10.0.20.1/24) - Area 1
                         +-- VLAN 30 (10.0.30.1/24) - Area 2
```

### Automation Considerations

1. **Setup/Teardown**
   - Disable OSPF on all VLANs
   - Clear all OSPF configuration
   - Reset VLANs to known state
   - Clear LSDB

2. **Validation Methods**
   - Parse JSON responses from GET operations
   - Verify HTTP status codes
   - Cross-check with CLI `show` commands
   - Validate operational state reflects configuration

3. **Wait Times**
   - After OSPF enable: 5-10 seconds for process initialization
   - After neighbor config: 40-120 seconds for adjacency (based on hello/dead timers)
   - After redistribution: 10-15 seconds for LSA propagation
   - After area changes: 5-10 seconds for SPF recalculation

4. **Error Recovery**
   - On API error, log full request/response
   - On timeout, check switch accessibility
   - On validation failure, capture `show ospf` output
   - On adjacency failure, capture `show ospf neighbor detail`

### References

- **RFC 2328**: OSPF Version 2
- **RFC 3101**: OSPF Not-So-Stubby Area (NSSA) Option
- **RFC 3623**: Graceful OSPF Restart
- **EXOS User Guide**: OSPF chapter (typically chapter 40+)
- **NOS API Specification**: `/v0/configuration/ospf` endpoints
- **YAML PR 913**: (specific changes - reference internal documentation)

---

## Test Strategy Summary

### Priority 1 (Critical - Must Test)
- Basic OSPF enable/disable via API
- Router ID configuration and auto-derivation
- Area creation (backbone, normal, stub)
- VLAN interface enable/disable
- GET operations for configuration and state
- Error handling for invalid inputs

### Priority 2 (High - Should Test)
- Redistribution configuration for all protocols
- VLAN interface parameter configuration (cost, priority, timers)
- Authentication configuration (simple, MD5)
- Area type changes (normal ↔ stub ↔ NSSA)
- DELETE operations and cleanup
- Cross-verification with CLI

### Priority 3 (Medium - Good to Test)
- Virtual link configuration
- NSSA area configuration
- Graceful restart configuration (EXOS)
- Platform-specific fields (EXOS vs VOSS)
- Multiple VR scenarios (non-default VRs)
- Idempotency validation

### Priority 4 (Low - Nice to Test)
- Opaque LSA support
- RFC 1583 compatibility (VOSS)
- Bad LSA handling (VOSS)
- Auto virtual link (VOSS)
- Performance/scale testing (many areas, many VLANs)
- Concurrent API requests
