# VLAN (Virtual LAN) - Skill File Template

## Feature Overview
Virtual LANs (VLANs) are logical network segments that partition a physical network into multiple broadcast domains. VLANs provide network segmentation, security, and traffic management without requiring separate physical infrastructure.

## Technical Details

### Protocol Specifications
- **IEEE 802.1Q**: VLAN Tagging standard
- **VLAN ID Range**: 1-4094 (0 and 4095 reserved)
- **Tag Size**: 4 bytes (TPID + TCI)
- **Native VLAN**: Untagged traffic on trunk ports

### VLAN Types
1. **Data VLAN**: Regular user traffic
2. **Voice VLAN**: VoIP traffic (priority tagging)
3. **Management VLAN**: Switch management traffic
4. **Native VLAN**: Default VLAN for untagged traffic

### Port Types
- **Access Port**: Belongs to single VLAN, untagged
- **Trunk Port**: Carries multiple VLANs, tagged
- **Hybrid Port**: Mix of tagged and untagged VLANs

## API Endpoints

### REST API Structure
```
GET    /api/v1/vlans              - List all VLANs
GET    /api/v1/vlans/{vlan_id}    - Get specific VLAN
POST   /api/v1/vlans              - Create new VLAN
PUT    /api/v1/vlans/{vlan_id}    - Update VLAN configuration
DELETE /api/v1/vlans/{vlan_id}    - Delete VLAN
GET    /api/v1/ports/{port}/vlan  - Get port VLAN config
PUT    /api/v1/ports/{port}/vlan  - Configure port VLAN
```

### Request/Response Examples

**Create VLAN (POST /api/v1/vlans)**
```json
{
  "vlan_id": 100,
  "name": "Engineering",
  "description": "Engineering Department VLAN",
  "status": "active"
}
```

**Configure Trunk Port (PUT /api/v1/ports/1:1/vlan)**
```json
{
  "mode": "trunk",
  "native_vlan": 1,
  "allowed_vlans": [1, 10, 20, 100],
  "tagging": "tag"
}
```

## CLI Commands

### VLAN Configuration
```
create vlan <vlan-name> tag <vlan-id>
delete vlan <vlan-name>
configure vlan <vlan-name> description <text>
configure vlan <vlan-name> add ports <port-list> [tagged|untagged]
configure vlan <vlan-name> delete ports <port-list>
enable vlan <vlan-name>
disable vlan <vlan-name>
```

### Show Commands
```
show vlan
show vlan <vlan-name>
show vlan detail
show ports <port> vlan
show ports <port> information detail
```

## Configuration Parameters

| Parameter | Description | Default | Valid Range |
|-----------|-------------|---------|-------------|
| vlan_id | VLAN identifier | - | 1-4094 |
| vlan_name | VLAN name | vlan<id> | 1-32 chars |
| native_vlan | Native VLAN on trunk | 1 | 1-4094 |
| port_mode | Port VLAN mode | access | access, trunk, hybrid |
| max_vlans | Maximum VLANs | Device-specific | Up to 4094 |

## Test Parameters

### Boundary Values
- **VLAN IDs**: 1, 2, 100, 4093, 4094
- **Invalid IDs**: 0, 4095, 4096, -1
- **VLAN Name Length**: 1 char, 32 chars, 33 chars (invalid)
- **Port Count**: 1 port, all ports, maximum ports

### Valid Test Scenarios
1. **Basic VLAN Creation**: Create VLAN with valid ID and name
2. **Access Port Assignment**: Assign port to VLAN (untagged)
3. **Trunk Port Configuration**: Configure trunk with multiple VLANs
4. **Native VLAN**: Test untagged traffic on trunk
5. **VLAN Membership**: Add/remove ports dynamically
6. **VLAN Deletion**: Delete VLAN with/without assigned ports
7. **Inter-VLAN Routing**: Test Layer 3 between VLANs
8. **Voice VLAN**: Test priority tagging for VoIP

### Invalid/Error Scenarios
1. Duplicate VLAN ID
2. Invalid VLAN ID (0, 4095+)
3. VLAN name too long (>32 chars)
4. Delete VLAN with active ports
5. Trunk port with invalid VLAN list
6. Native VLAN mismatch on trunk links
7. Maximum VLAN count exceeded

## Edge Cases

### VLAN Conflicts
- VLAN ID conflicts between switches
- Native VLAN mismatch causing traffic loops
- Port in multiple VLANs (hybrid mode)
- VLAN pruning on trunk ports

### Port States
- Port in disabled VLAN
- Trunk port with no allowed VLANs
- Access port with non-existent VLAN
- Port mode change with active traffic

### Scale Issues
- Maximum VLANs configured
- Large number of ports per VLAN
- Excessive VLAN spanning (STP complexity)
- Memory exhaustion with many VLANs

### Timing Issues
- VLAN creation during high CPU load
- Port reassignment during traffic
- STP reconvergence after VLAN change
- MAC address table updates

## Dependencies

### Required Features
- **Switching**: Basic Layer 2 switching
- **Port Management**: Physical port configuration
- **MAC Learning**: MAC address table

### Optional Features
- **STP/RSTP**: Spanning Tree Protocol for loop prevention
- **LACP**: Link Aggregation (trunk groups)
- **Layer 3 Routing**: Inter-VLAN routing
- **QoS**: Priority tagging (802.1p)
- **Voice VLAN**: Cisco-compatible voice VLAN
- **GVRP**: VLAN registration protocol

## Integration Points

### Switching Integration
- **MAC Table**: VLAN-aware MAC address learning
- **Forwarding**: VLAN-based forwarding decisions
- **Flooding**: Broadcast/unknown unicast within VLAN

### Routing Integration
- **Inter-VLAN Routing**: Routing between VLANs (Layer 3 switch)
- **VLAN Interface**: SVI (Switch Virtual Interface)
- **Default Gateway**: Per-VLAN gateway configuration

### Management Integration
- **SNMP**: VLAN MIB (RFC 4363)
- **CLI**: VLAN configuration commands
- **REST API**: Programmatic VLAN management
- **WebUI**: Graphical VLAN configuration

## Regression Risks

### High-Risk Areas
1. **Existing VLAN Traffic**: Changes might disrupt active VLANs
2. **Spanning Tree**: VLAN changes can trigger STP reconvergence
3. **Inter-VLAN Routing**: L3 interface configuration might break
4. **Port Configuration**: Port mode changes affect connectivity

### Affected Features
- **STP/RSTP**: Per-VLAN spanning tree instances
- **LACP**: Trunk group VLAN membership
- **QoS**: VLAN-based QoS policies
- **ACLs**: VLAN-based access control
- **Multicast**: VLAN-specific multicast groups
- **DHCP Snooping**: Per-VLAN DHCP configuration

### Testing Recommendations
- Test existing VLAN configurations still work
- Verify STP stability after changes
- Check inter-VLAN routing functionality
- Validate port assignments remain correct
- Test VLAN database persistence across reboots
- Verify backward compatibility with saved configs

## Test Case Categories

1. **Functional Testing**: Basic VLAN creation, assignment, deletion
2. **Negative Testing**: Invalid inputs, error handling
3. **Scale Testing**: Maximum VLANs, ports per VLAN
4. **Performance Testing**: Switching performance with many VLANs
5. **Stress Testing**: Rapid VLAN creation/deletion
6. **Interoperability**: 802.1Q compatibility with other vendors
7. **Upgrade/Downgrade**: Config migration between versions
8. **High Availability**: VLAN state during failover

## Reference Documents
- IEEE 802.1Q: Virtual LANs
- RFC 4363: VLAN MIB
- Vendor-specific VLAN implementation guides
