# BGP Routing Protocol - Skill File Template

## Feature Overview
Border Gateway Protocol (BGP) is the standardized exterior gateway protocol designed to exchange routing information among autonomous systems (AS) on the Internet. BGP is used to make routing decisions based on paths, network policies, and rulesets.

## Technical Details

### Protocol Specifications
- **RFC 4271**: BGP-4 base specification
- **Port**: TCP 179
- **Version**: BGP-4
- **AS Number Range**: 1-65535 (2-byte), 1-4294967295 (4-byte)

### BGP Session States
1. **Idle**: Initial state, waiting to initiate connection
2. **Connect**: Waiting for TCP connection to complete
3. **Active**: Trying to acquire peer
4. **OpenSent**: Waiting for Open message from peer
5. **OpenConfirm**: Waiting for KeepAlive or Notification
6. **Established**: Session established, exchanging routes

### Key Algorithms
- **Path Selection**: Best path algorithm using attributes (AS_PATH, LOCAL_PREF, MED, etc.)
- **Loop Prevention**: AS_PATH attribute prevents routing loops
- **Route Advertisement**: Only advertise best routes to peers

## API Endpoints

### REST API Structure
```
GET    /api/v1/bgp/neighbors          - List all BGP neighbors
GET    /api/v1/bgp/neighbors/{ip}     - Get specific neighbor details
POST   /api/v1/bgp/neighbors          - Add new BGP neighbor
PUT    /api/v1/bgp/neighbors/{ip}     - Update neighbor configuration
DELETE /api/v1/bgp/neighbors/{ip}     - Remove BGP neighbor
GET    /api/v1/bgp/routes             - List BGP routing table
GET    /api/v1/bgp/summary            - Get BGP summary statistics
POST   /api/v1/bgp/clear              - Clear BGP sessions
```

### Request/Response Examples

**Add BGP Neighbor (POST /api/v1/bgp/neighbors)**
```json
{
  "neighbor_ip": "192.168.1.1",
  "remote_as": 65001,
  "description": "ISP Peering",
  "authentication": {
    "type": "md5",
    "password": "encrypted_password"
  },
  "timers": {
    "keepalive": 30,
    "holdtime": 90
  }
}
```

**Response:**
```json
{
  "status": "success",
  "neighbor": {
    "ip": "192.168.1.1",
    "state": "Idle",
    "uptime": 0,
    "routes_received": 0
  }
}
```

## CLI Commands

### Configuration Commands
```
configure bgp as <as-number>
configure bgp neighbor <ip> remote-as <as-number>
configure bgp neighbor <ip> description <text>
configure bgp neighbor <ip> password <password>
enable bgp
disable bgp
```

### Show Commands
```
show bgp summary
show bgp neighbors
show bgp routes
show bgp routes <prefix>
show bgp neighbor <ip>
```

## Configuration Parameters

| Parameter | Description | Default | Valid Range |
|-----------|-------------|---------|-------------|
| local_as | Local AS number | - | 1-4294967295 |
| router_id | BGP Router ID | Lowest loopback IP | Valid IPv4 |
| keepalive_time | Keepalive interval | 30 sec | 1-65535 sec |
| hold_time | Hold time | 90 sec | 3-65535 sec |
| connect_retry | Connection retry timer | 120 sec | 1-65535 sec |
| max_prefix | Maximum prefixes from peer | Unlimited | 1-4294967295 |

## Test Parameters

### Boundary Values
- **AS Numbers**: Test with 1, 65534, 65535 (2-byte max), 65536, 4294967295 (4-byte max)
- **Prefix Limits**: 0, 1, 1000, 10000, maximum supported
- **Timer Values**: Minimum (1), default (30/90), maximum (65535)
- **Neighbor Count**: 1, 10, 100, maximum supported neighbors

### Valid Test Scenarios
1. **Basic Peering**: Two routers with simple eBGP session
2. **iBGP Full Mesh**: Multiple routers in same AS
3. **Route Reflector**: Hub-spoke topology
4. **AS Path Prepending**: Influence path selection
5. **Community Tagging**: Route marking and filtering
6. **Prefix Filtering**: Import/export route filters
7. **Authentication**: MD5 password authentication
8. **Graceful Restart**: Session recovery without route loss

### Invalid/Error Scenarios
1. Mismatched AS numbers in eBGP
2. Invalid IP addresses
3. Port blocking (TCP 179)
4. Incorrect authentication
5. Timer mismatch (holdtime < keepalive * 3)
6. Maximum prefix exceeded
7. Route loops detected

## Edge Cases

### Timing & Synchronization
- Session flapping (rapid up/down cycles)
- Slow convergence with large routing tables
- Timer expiration during high CPU load
- Simultaneous session initialization from both sides

### Network Conditions
- Packet loss causing keepalive misses
- High latency affecting convergence time
- MTU issues with large UPDATE messages
- TCP connection timeout vs BGP timers

### Scale & Resource
- Maximum neighbors reached
- Memory exhaustion with large routing tables
- CPU spikes during route recalculation
- Maximum prefix limit triggered

### Protocol Behavior
- BGP session reset during route refresh
- Notification messages causing session teardown
- Attribute parsing errors
- Unknown or unsupported capabilities

## Dependencies

### Required Features
- **IP Routing**: Basic IP forwarding must be operational
- **TCP Stack**: Reliable TCP connection for BGP sessions
- **Routing Table**: FIB/RIB integration

### Optional Features
- **OSPF/IS-IS**: For iBGP next-hop reachability
- **BFD**: Bidirectional Forwarding Detection for fast failure detection
- **SNMP**: For monitoring and management
- **Syslog**: For logging BGP events

## Integration Points

### Routing Protocol Interaction
- **IGP Sync**: BGP routes should not be advertised until IGP converges
- **Redistribution**: Importing/exporting routes between BGP and IGP
- **Route Preference**: BGP admin distance vs other protocols

### Management Integration
- **CLI**: Configuration and show commands
- **REST API**: Programmatic configuration
- **NETCONF/RESTCONF**: Standards-based management
- **WebUI**: Graphical configuration interface

### Monitoring Integration
- **SNMP Traps**: BGP state change notifications
- **Streaming Telemetry**: Real-time BGP metrics
- **Syslog**: Event logging
- **Performance Monitoring**: Session statistics, route counts

## Regression Risks

### High-Risk Areas
1. **Existing BGP Sessions**: Changes might disrupt established peers
2. **Route Redistribution**: IGP-BGP interaction might break
3. **Routing Policies**: Filter changes could affect traffic flow
4. **Management Interfaces**: CLI/API changes might break automation

### Affected Features
- **OSPF/IS-IS**: If BGP changes affect route import/export
- **Multicast**: If changes affect multicast routing integration
- **MPLS**: BGP-LU or L3VPN functionality
- **QoS**: Policy-based QoS tied to BGP communities
- **ACLs**: Prefix-list or route-map changes

### Testing Recommendations
- Verify existing configurations still load correctly
- Test backward compatibility with older software versions
- Validate upgrade/downgrade paths
- Check CLI/API backward compatibility
- Perform soak testing with large routing tables

## Test Case Categories

1. **Functional Testing**: Basic feature operation
2. **Negative Testing**: Error handling and invalid inputs
3. **Scale Testing**: Maximum neighbors, routes, updates
4. **Performance Testing**: Convergence time, CPU/memory usage
5. **Stress Testing**: Continuous session flapping, route churn
6. **Interoperability**: Testing with different vendor equipment
7. **Upgrade/Downgrade**: Software version compatibility
8. **High Availability**: Hitless restart, graceful restart

## Reference Documents
- RFC 4271: BGP-4
- RFC 4760: Multiprotocol Extensions for BGP-4
- RFC 2918: Route Refresh Capability
- RFC 4724: Graceful Restart Mechanism
- Vendor-specific implementation guides
