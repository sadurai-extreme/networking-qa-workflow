# ONEPolicy (Policy Manager) - Skill File

## Feature Overview

### ONEPolicy Introduction

ONEPolicy provides for the configuration of role-based profiles for securing and provisioning network resources based upon the role the user or device plays within the enterprise. By first defining the user or device role, network resources can be granularly tailored to a specific user, system, service, or port-based context by configuring and assigning rules to the policy role.

### Key Benefits

1. **Provisioning and Control**: Create policy roles that determine network provisioning and control at appropriate network layers
2. **Security Enhancement**: Allow only intended users and devices access to network protocols and capabilities
3. **Centralized Operational Efficiency**: Manage policies from a central location with consistent enforcement

### Core Capabilities

- **Role-Based Profiles**: Define user/device roles (sales, admin, engineering, etc.)
- **Traffic Classification**: Support for L2, L3, and L4 packet fields (up to 15 classification types)
- **VLAN Assignment**: Dynamic and static VLAN assignments per role
- **Class of Service (CoS)**: Priority, forwarding queue, rate limiting, and rate shaping
- **Hybrid Authentication**: RADIUS filter-ID and tunnel attributes for dynamic policy/VLAN assignment
- **Policy Actions**: VLAN assignment, filtering, rate limiting, rate shaping, priority mapping

### Policy Implementation Steps

1. Identify roles of users and devices that access the network
2. Create a policy role for each identified user role
3. Associate classification rules and administrative profiles with each policy role
4. Configure Class of Service and associate with policy role (optional)
5. Enable hybrid authentication for dynamic policy/VLAN assignment (optional)
6. Set device response to invalid policy (optional)
7. Configure captive portal for HTTP redirection (optional)

### Important Notes and Limitations

- Software only allows policy to be enabled if all stack devices support policy
- Configurations requiring first stage ACL/VLAN processor don't work when ONEPolicy is enabled (MPLS, PSTag, VXLAN, OAM/CFM)
- IDM and ONEPolicy are not supported together (except for Kerberos with NAC)
- NetLogin process restart not supported when policy is enabled
- NetLogin web-based requires port to be part of default VLAN

## ONEPolicy Features

### 1. Convergence End Point (CEP) Detection

**Purpose**: Mechanism to detect remote IP telephony or video devices and dynamically apply policy

**Key Points**:
- Only active when ONEPolicy is enabled and configured
- Detects devices via CDP and LLDP protocols
- Automatically applies configured policy for detected device type
- Supports Cisco and LLDP device types

**Important Notes**:
- New CEP entries learned only after receiving new LLDP/CDP information
- Changing profile index requires disable/enable CEP or port to refresh
- NetLogin takes precedence over CEP profile when both enabled

### 2. Captive Portal Redirection

**Purpose**: Use HTTP redirection to force client's web browser to specific administrative page

**Use Cases**:
- Authentication (user login/password)
- Payment (e.g., airport hotspot)
- Use-policy enforcement (software installation, TOS agreement)

**Configuration**:
- Up to 3 listening ports for client traffic
- Up to 10 web-redirect groups (each with 2 servers)
- Web redirection class index (1-10) associates role with server
- Can use reserved or unreserved ACL rule space

**Limitations**:
- HTTPS redirection not supported (HTTP only)
- Captive portal doesn't work with tagged frames
- Server selection algorithm: ((Last byte of client MAC)%(numServers)) + 1

**Dynamic Captive Portal (Version 33.5.1+)**:
- RADIUS VSA support (Extreme-URL-Redirect, value 234)
- Accepts IPv4 address or FQDN
- Maximum 20 unique URL redirects simultaneously
- HTTP traffic only

### 3. VLAN/VXLAN to Policy Mapping

**Purpose**: Manually configure VLAN-to-policy associations for distribution layer

**Use Case**: Environments with non-policy-capable edge switches

**Configuration**:
- Create policy maptable entry between VLAN and policy role
- Tagged frames received have associated policy applied
- Support for VXLAN mapping (VNI to profile) starting ExtremeXOS 22.5

### 4. Policy-Based Mirrors

**Purpose**: Apply mirrors to policy profile rules using control group mirrors

**Configuration**:
- Uses Mirror MIB (ENTERASYS-MIRROR-CONFIG-MIB)
- Control index associates with up to 4 "physical" mirrors
- Maximum 4 concurrently enabled mirrors

**Limitations**:
- Multiple destination ports not supported
- Maximum 4 control group instances via CLI
- Admin profile rules not supported
- Cannot enable on LAG/MLAG ports
- Cannot assign index for default mirrors

### 5. Rule Trap and Syslog

**Purpose**: Notification when policy rule is used

**Actions**:
- Syslog: Sends log entry with EMS tag "Policy.LogRuleHit"
- Trap: Sends etsysPolicyRulePortHitNotification SNMP trap
- Rule counter tracks number of times packet triggers rule

**Configuration**:
- Default: Syslog/trap only on first rule use
- Can configure Syslog for every use (max once per 5 seconds)
- Counter interval configurable or manual clear

**Limitations**: Not supported on admin profile rules

### 6. Layer 7 Policy/Application Signature

**Purpose**: Additional traffic classification via DNS packet snooping

**Key Points**:
- Activates automatically when policy enabled and AS rule created
- Uses shared TCAM resources (VCAP partitioning required)
- Dynamic rules created using DNS-discovered destination IPs
- TTL-based timeout for IP addresses and dynamic rules

**Limitations**:
- IPv6 not supported
- TTL timer: 5 seconds (configurable: 1, 5, or 10 minutes)
- When VCAP space exhausted, uninstalled rules wait for timeout

### 7. Device Response to Invalid Policy

**Actions Available**:
- Ignore and search for next policy assignment rule (apply default if all missed)
- Block traffic
- Forward traffic using 802.1D/Q rules (no policy assigned)

### 8. VCAP Partitioning

**Purpose**: Share VCAP slices among multiple applications

**Configuration**:
- Shared pool for Layer 7 policy and dynamic ACLs
- TCI overwrite uses separate pool (0-4 slices)
- Unused slices available for general system use

## Test Scenarios

### Functional Testing

#### TC-POL-001: Basic Policy Enablement
**Objective**: Verify ONEPolicy can be enabled successfully  
**Prerequisites**: Stack devices support policy, no conflicting features enabled  
**Steps**:
1. Verify all stack members support policy
2. Enable policy on the switch
3. Verify policy status shows enabled
4. Check system logs for any errors

**Expected**: Policy enabled successfully, no errors in logs

#### TC-POL-002: Policy Role Creation
**Objective**: Create and verify policy roles  
**Steps**:
1. Create policy profile with unique index
2. Assign profile name
3. Configure PVID for profile
4. Verify profile configuration with show commands

**Expected**: Profile created with correct parameters

#### TC-POL-003: Classification Rule Assignment
**Objective**: Add traffic classification rules to policy role  
**Steps**:
1. Create policy profile
2. Add MAC address classification rule
3. Add IP subnet classification rule
4. Add port-based classification rule
5. Verify rules with show policy rule command

**Expected**: All classification rules added successfully

#### TC-POL-004: CoS Assignment to Policy Role
**Objective**: Verify CoS can be assigned to policy role  
**Steps**:
1. Create policy profile
2. Associate CoS value with profile
3. Configure rate limiting parameters
4. Verify CoS assignment

**Expected**: CoS properly associated with profile

#### TC-POL-005: Hybrid Authentication Mode
**Objective**: Test dynamic policy assignment via RADIUS  
**Prerequisites**: RADIUS server configured  
**Steps**:
1. Enable hybrid authentication
2. Configure RADIUS server with filter-ID
3. Authenticate user via NetLogin
4. Verify policy assigned via RADIUS filter-ID

**Expected**: Policy dynamically assigned from RADIUS

### CEP (Convergence End Point) Testing

#### TC-CEP-001: CEP Detection via LLDP
**Objective**: Verify CEP device detected via LLDP  
**Steps**:
1. Enable ONEPolicy
2. Configure CEP with policy profile
3. Enable LLDP on port
4. Connect IP phone/video device
5. Verify CEP detection with show command

**Expected**: CEP device detected and policy applied

#### TC-CEP-002: CEP Detection via CDP
**Objective**: Verify CEP device detected via CDP  
**Steps**:
1. Enable ONEPolicy and CEP
2. Configure policy profile for Cisco devices
3. Enable CDP on port
4. Connect Cisco IP phone
5. Verify detection with show cdp neighbor
6. Check policy application

**Expected**: Cisco CEP detected and configured policy applied

#### TC-CEP-003: CEP and NetLogin Precedence
**Objective**: Verify NetLogin takes precedence over CEP  
**Steps**:
1. Enable CEP and NetLogin on same port
2. Configure different policies for each
3. Connect device with both CEP and NetLogin capability
4. Authenticate via NetLogin
5. Verify which policy is active

**Expected**: NetLogin policy active, CEP shows session applied false

#### TC-CEP-004: CEP Profile Change
**Objective**: Verify CEP profile update requires refresh  
**Steps**:
1. Configure CEP with profile index 1
2. Detect CEP devices
3. Change profile index to 2
4. Verify old profile still active
5. Disable/enable CEP
6. Verify new profile applied

**Expected**: Profile change requires CEP disable/enable to take effect

### Captive Portal Testing

#### TC-CP-001: Captive Portal Redirection
**Objective**: Verify HTTP redirection to captive portal  
**Steps**:
1. Configure captive portal listening ports (80, 8080)
2. Create web-redirect group with server URL
3. Configure policy profile with web-redirect index
4. Apply profile to test port
5. Generate HTTP traffic from client
6. Verify redirection to portal server

**Expected**: HTTP traffic redirected to configured portal

#### TC-CP-002: Captive Portal Server Selection
**Objective**: Test dual-server selection algorithm  
**Steps**:
1. Configure web-redirect group with 2 servers
2. Apply profile with web-redirect
3. Test with clients having different MAC addresses
4. Verify server selection based on MAC algorithm

**Expected**: Server selected per ((MAC_last_byte)%(2)) + 1

#### TC-CP-003: Captive Portal HTTPS Limitation
**Objective**: Verify HTTPS traffic not redirected  
**Steps**:
1. Configure captive portal
2. Apply policy profile
3. Generate HTTPS traffic from client
4. Verify no redirection occurs

**Expected**: HTTPS traffic not redirected (HTTP only)

#### TC-CP-004: Dynamic Captive Portal via RADIUS
**Objective**: Test RADIUS VSA URL redirect (v33.5.1+)  
**Prerequisites**: RADIUS server with Extreme-URL-Redirect VSA  
**Steps**:
1. Configure RADIUS with VSA (value 234)
2. Set redirect URL (IPv4 or FQDN)
3. Authenticate user via NetLogin
4. Verify dynamic web-redirect applied
5. Check with show netlogin session

**Expected**: Dynamic URL redirect from RADIUS applied successfully

#### TC-CP-005: Tagged Frames with Captive Portal
**Objective**: Verify captive portal doesn't work with tagged frames  
**Steps**:
1. Configure captive portal on port
2. Send tagged VLAN traffic
3. Verify no redirection occurs

**Expected**: Tagged frames not redirected by captive portal

### VLAN/Policy Mapping Testing

#### TC-VLAN-001: VLAN to Policy Mapping
**Objective**: Create VLAN-to-policy maptable entry  
**Steps**:
1. Create policy profile
2. Create VLAN
3. Configure policy maptable (VLAN to profile)
4. Send tagged traffic for mapped VLAN
5. Verify policy applied to traffic

**Expected**: Tagged VLAN traffic has associated policy applied

#### TC-VLAN-002: VXLAN to Policy Mapping
**Objective**: Map VXLAN (VNI) to policy profile  
**Steps**:
1. Configure policy profile with NSI (VNI)
2. Create maptable entry
3. Send VXLAN traffic
4. Verify policy applied

**Expected**: VXLAN traffic mapped to policy successfully

### Policy-Based Mirror Testing

#### TC-MIR-001: Policy-Based Mirror Configuration
**Objective**: Configure and verify policy-based mirroring  
**Steps**:
1. Create policy profile
2. Configure mirror destination port
3. Associate mirror control index with policy rule
4. Apply profile to test port
5. Generate matching traffic
6. Verify traffic mirrored to destination

**Expected**: Matching traffic mirrored successfully

#### TC-MIR-002: Multiple Mirror Instances
**Objective**: Test maximum concurrent mirrors (4)  
**Steps**:
1. Create 4 policy profiles with different mirrors
2. Configure 4 mirror control groups
3. Apply all profiles
4. Verify all 4 mirrors active simultaneously

**Expected**: All 4 mirrors function concurrently

#### TC-MIR-003: Mirror on LAG Port Limitation
**Objective**: Verify mirroring cannot be enabled on LAG  
**Steps**:
1. Create LAG port
2. Attempt to configure mirror on LAG
3. Verify error/rejection

**Expected**: Mirror configuration rejected for LAG port

### Rule Trap and Syslog Testing

#### TC-TRAP-001: Rule Hit Syslog
**Objective**: Verify Syslog generated on first rule hit  
**Steps**:
1. Create policy rule with Syslog action
2. Apply profile
3. Generate matching traffic
4. Check logs for "Policy.LogRuleHit" EMS tag
5. Verify Syslog only on first hit

**Expected**: Syslog entry generated on first rule hit only

#### TC-TRAP-002: Rule Hit SNMP Trap
**Objective**: Verify SNMP trap sent on rule hit  
**Prerequisites**: SNMP trap receiver configured  
**Steps**:
1. Configure trap receiver
2. Create policy rule with trap action
3. Apply profile and generate traffic
4. Verify etsysPolicyRulePortHitNotification trap received

**Expected**: SNMP trap received on first rule hit

#### TC-TRAP-003: Rule Counter Tracking
**Objective**: Verify rule counter tracks hits  
**Steps**:
1. Create policy rule with counter enabled
2. Generate multiple matching packets
3. Check rule counter value
4. Clear counter and verify reset

**Expected**: Counter increments per hit, clears on command

#### TC-TRAP-004: Continuous Syslog Mode
**Objective**: Test Syslog every hit (max once per 5 sec)  
**Steps**:
1. Configure rule with continuous Syslog
2. Generate steady traffic stream
3. Monitor Syslog entries
4. Verify max rate of once per 5 seconds

**Expected**: Syslog generated continuously at max rate

### Layer 7 Policy Testing

#### TC-L7-001: Application Signature Detection
**Objective**: Verify DNS snooping and dynamic rule creation  
**Steps**:
1. Enable policy and configure shared TCAM
2. Create application signature rule
3. Generate DNS query for signature pattern
4. Verify dynamic rule created with discovered IP
5. Check rule timeout per TTL

**Expected**: Dynamic rule created, times out per DNS TTL

#### TC-L7-002: VCAP Space Exhaustion
**Objective**: Test behavior when VCAP space full  
**Steps**:
1. Configure maximum AS rules
2. Fill VCAP space with rules
3. Generate additional DNS queries
4. Verify new rules wait for space/timeout
5. Check rule installation after timeout

**Expected**: New rules installed only after space available

#### TC-L7-003: IPv6 Limitation
**Objective**: Verify Layer 7 policy doesn't support IPv6  
**Steps**:
1. Configure application signature rules
2. Generate IPv6 DNS queries
3. Verify no dynamic rules created for IPv6

**Expected**: IPv6 addresses not processed by Layer 7 policy

### Invalid Policy Response Testing

#### TC-INV-001: Invalid Policy Ignore Action
**Objective**: Test ignore action for invalid policy  
**Steps**:
1. Configure invalid action as "ignore"
2. Apply non-existent policy to port
3. Verify next rule searched
4. Confirm default policy applied if all rules miss

**Expected**: System ignores invalid policy and applies default

#### TC-INV-002: Invalid Policy Block Action
**Objective**: Test block action for invalid policy  
**Steps**:
1. Configure invalid action as "block"
2. Apply invalid policy
3. Generate traffic
4. Verify traffic blocked

**Expected**: Traffic blocked when invalid policy applied

#### TC-INV-003: Invalid Policy Forward Action
**Objective**: Test forward action (802.1D/Q rules)  
**Steps**:
1. Configure invalid action as "forward"
2. Apply invalid policy
3. Generate traffic
4. Verify traffic forwarded per 802.1D/Q rules

**Expected**: Traffic forwarded without policy enforcement

## Test Scenarios

## Test Scenarios

### Configuration Testing

#### TC-CFG-001: Policy Profile Configuration
**Objective**: Test complete policy profile configuration  
**Steps**:
1. Create profile with all parameters (name, PVID, CoS, egress VLANs)
2. Configure forbidden and untagged VLANs
3. Set TCI overwrite and precedence
4. Configure auth-override and NSI
5. Verify all parameters with show policy profile

**Expected**: Profile configured with all specified parameters

#### TC-CFG-002: Configuration Persistence
**Objective**: Verify policy configuration survives reboot  
**Steps**:
1. Configure multiple policy profiles and rules
2. Enable CEP and captive portal
3. Save configuration
4. Reboot switch
5. Verify all policy settings intact

**Expected**: All policy configurations preserved after reboot

#### TC-CFG-003: Maximum Policy Profiles
**Objective**: Test maximum number of policy profiles  
**Steps**:
1. Create policy profiles up to system maximum
2. Verify all profiles active
3. Attempt to create one more profile
4. Verify proper error handling

**Expected**: Maximum profiles supported, excess rejected with error

#### TC-CFG-004: Policy Profile Modification
**Objective**: Modify existing policy profile  
**Steps**:
1. Create and apply policy profile
2. Modify profile parameters (CoS, VLAN, etc.)
3. Verify changes applied to active sessions
4. Check traffic treatment reflects updates

**Expected**: Profile modifications applied successfully

### Interoperability Testing

#### TC-INTOP-001: Policy with NetLogin MAC
**Objective**: Test policy with NetLogin MAC authentication  
**Steps**:
1. Enable policy and NetLogin MAC
2. Configure RADIUS with filter-ID
3. Authenticate MAC address
4. Verify policy applied from RADIUS
5. Check VLAN assignment

**Expected**: NetLogin MAC works with policy assignment

#### TC-INTOP-002: Policy with NetLogin 802.1X
**Objective**: Test policy with 802.1X authentication  
**Steps**:
1. Enable policy and NetLogin dot1x
2. Configure supplicant credentials
3. Perform 802.1X authentication
4. Verify policy profile applied
5. Check session with show netlogin session

**Expected**: 802.1X authentication applies correct policy

#### TC-INTOP-003: Policy with LLDP
**Objective**: Verify policy interoperability with LLDP  
**Steps**:
1. Enable policy and LLDP
2. Configure LLDP neighbors
3. Enable CEP detection
4. Verify LLDP neighbor discovery
5. Check CEP detection via LLDP

**Expected**: LLDP and policy/CEP work together seamlessly

#### TC-INTOP-004: Policy with CDP
**Objective**: Verify policy interoperability with CDP  
**Steps**:
1. Enable policy and CDP
2. Connect Cisco devices
3. Enable CEP for Cisco devices
4. Verify CDP neighbor information
5. Check CEP detection status

**Expected**: CDP and policy/CEP coexist properly

#### TC-INTOP-005: Policy with STP
**Objective**: Test policy interaction with Spanning Tree  
**Steps**:
1. Enable policy on ports
2. Configure STP on same ports
3. Verify STP state transitions
4. Check policy enforcement during STP changes
5. Test with different STP modes (RSTP, MSTP)

**Expected**: Policy and STP function correctly together

#### TC-INTOP-006: Policy with VLAN
**Objective**: Test policy with VLAN features  
**Steps**:
1. Create multiple VLANs
2. Configure policy profiles with VLAN assignments
3. Test dynamic VLAN assignment
4. Verify VLAN egress lists
5. Test VLAN-to-policy mapping

**Expected**: Policy VLAN features work correctly

### Negative Testing

#### TC-NEG-001: Invalid Profile Index
**Objective**: Test behavior with invalid profile index  
**Steps**:
1. Attempt to apply profile with non-existent index
2. Verify error handling
3. Check system remains stable
4. Verify logs for appropriate error message

**Expected**: Graceful error handling, no system disruption

#### TC-NEG-002: Conflicting Feature Enablement
**Objective**: Verify policy blocks conflicting features  
**Steps**:
1. Enable features requiring first stage ACL (MPLS, VXLAN)
2. Attempt to enable policy
3. Verify policy enablement rejected
4. Confirm appropriate error message

**Expected**: Policy enablement rejected with clear error

#### TC-NEG-003: Policy Enable with IDM
**Objective**: Test mutual exclusion of Policy and IDM  
**Steps**:
1. Enable IDM on switch
2. Attempt to enable ONEPolicy
3. Verify rejection and warning message
4. Test reverse scenario (Policy first, then IDM)

**Expected**: System prevents simultaneous Policy and IDM enablement

#### TC-NEG-004: CEP Profile Change Without Refresh
**Objective**: Verify stale CEP profile behavior  
**Steps**:
1. Detect CEP devices with profile A
2. Change CEP profile to B without refresh
3. Verify old profile A still active
4. Check show commands reflect old profile

**Expected**: Old profile remains until explicit refresh

#### TC-NEG-005: NetLogin Restart with Policy Enabled
**Objective**: Verify NetLogin restart not supported  
**Steps**:
1. Enable policy
2. Attempt to restart NetLogin process
3. Document resulting behavior
4. Check system logs

**Expected**: Warning about indeterminate behavior, avoid restart

#### TC-NEG-006: Maximum VCAP Exhaustion
**Objective**: Test system behavior when VCAP full  
**Steps**:
1. Create maximum number of policy rules
2. Fill VCAP space completely
3. Attempt to add more rules
4. Verify graceful handling
5. Check error messages

**Expected**: New rules rejected or queued, no crash

### Performance Testing

#### TC-PERF-001: High Volume Traffic with Policy
**Objective**: Test policy performance under heavy traffic  
**Test Setup**: Traffic generator with line-rate traffic  
**Steps**:
1. Configure multiple policy profiles
2. Apply complex classification rules
3. Generate line-rate traffic (64-byte packets)
4. Monitor CPU, memory, packet forwarding rate
5. Verify no packet loss

**Expected**: Minimal performance impact, no packet loss

#### TC-PERF-002: Large Number of Policy Profiles
**Objective**: Test scalability with maximum profiles  
**Steps**:
1. Create maximum supported policy profiles
2. Apply profiles to different ports
3. Generate traffic matching various rules
4. Monitor system resources
5. Verify all profiles enforced correctly

**Expected**: All profiles function with acceptable performance

#### TC-PERF-003: Dynamic Rule Creation Rate (Layer 7)
**Objective**: Test Layer 7 dynamic rule creation rate  
**Steps**:
1. Enable application signature rules
2. Generate high rate of DNS queries
3. Monitor dynamic rule creation
4. Check TTL-based timeout behavior
5. Measure rule installation latency

**Expected**: Dynamic rules created/removed per 5-sec TTL timer

#### TC-PERF-004: CEP Detection Scale
**Objective**: Test CEP detection with multiple devices  
**Steps**:
1. Enable CEP on multiple ports
2. Connect maximum number of CEP devices
3. Verify all devices detected
4. Monitor detection time
5. Check system resource utilization

**Expected**: All CEP devices detected within acceptable time

#### TC-PERF-005: Captive Portal Redirection Performance
**Objective**: Test captive portal under load  
**Steps**:
1. Configure captive portal
2. Generate high volume of HTTP requests
3. Monitor redirection success rate
4. Check latency of redirections
5. Verify no failures under load

**Expected**: All redirections successful with minimal latency

### Security Testing

#### TC-SEC-001: Unauthorized Access Prevention
**Objective**: Verify policy blocks unauthorized access  
**Steps**:
1. Create restrictive policy profile
2. Configure drop rules for specific traffic
3. Attempt unauthorized access (SNMP, FTP, etc.)
4. Verify traffic blocked
5. Check rule counters and logs

**Expected**: Unauthorized traffic blocked per policy

#### TC-SEC-002: RADIUS Authentication Security
**Objective**: Test secure policy assignment via RADIUS  
**Steps**:
1. Configure RADIUS with shared secret
2. Test authentication with valid credentials
3. Attempt authentication with invalid credentials
4. Verify policy only applied for valid auth
5. Check authentication logs

**Expected**: Policy assigned only after successful authentication

#### TC-SEC-003: MAC Spoofing with Policy
**Objective**: Test policy enforcement against MAC spoofing  
**Steps**:
1. Configure MAC-based policy rules
2. Authenticate legitimate MAC address
3. Attempt access with spoofed MAC
4. Verify policy enforcement
5. Check security logs

**Expected**: Policy enforces MAC-based rules correctly

#### TC-SEC-004: DoS Prevention with Rate Limiting
**Objective**: Test policy-based rate limiting  
**Steps**:
1. Configure policy with rate limit rules
2. Generate flood traffic
3. Verify rate limiting enforced
4. Check affected and forwarded packet counts
5. Verify legitimate traffic unaffected

**Expected**: Rate limiting prevents DoS, allows legitimate traffic

### Hybrid Authentication Testing

#### TC-HYB-001: Filter-ID Based Policy Assignment
**Objective**: Test policy assignment via RADIUS filter-ID  
**Prerequisites**: RADIUS server with filter-ID attribute  
**Steps**:
1. Enable hybrid authentication
2. Configure RADIUS with filter-ID matching policy name
3. Authenticate user
4. Verify policy applied per filter-ID
5. Check with show netlogin session

**Expected**: Policy dynamically assigned from RADIUS filter-ID

#### TC-HYB-002: Tunnel Attribute VLAN Assignment
**Objective**: Test VLAN assignment via RADIUS tunnel attribute  
**Steps**:
1. Enable hybrid authentication
2. Configure RADIUS with tunnel attributes
3. Authenticate user
4. Verify VLAN assigned from RADIUS
5. Check session VLAN assignment

**Expected**: VLAN dynamically assigned from RADIUS tunnel attribute

#### TC-HYB-003: Combined Policy and VLAN Assignment
**Objective**: Test both policy and VLAN from RADIUS  
**Steps**:
1. Configure maptable response mode "both"
2. Set RADIUS with both filter-ID and tunnel attributes
3. Authenticate user
4. Verify both policy and VLAN applied
5. Check traffic treatment

**Expected**: Both policy and VLAN applied simultaneously

#### TC-HYB-004: Fallback VLAN Configuration
**Objective**: Test fallback VLAN when auth service unavailable  
**Prerequisites**: ExtremeXOS 33.2.1+  
**Steps**:
1. Enable ONEPolicy with fallback VLAN
2. Configure fallback VLAN ID
3. Make authentication service unavailable
4. Attempt authentication
5. Verify fallback VLAN assigned

**Expected**: Fallback VLAN assigned when auth service fails

### Stack and LCD Testing

#### TC-STACK-001: Policy in Stacked Environment
**Objective**: Verify policy in stack configuration  
**Steps**:
1. Configure stack with multiple switches
2. Verify all members support policy
3. Enable policy on stack
4. Apply profiles across stack members
5. Verify consistent policy enforcement

**Expected**: Policy works across all stack members

#### TC-STACK-002: Lowest Common Denominator
**Objective**: Test LCD policy functionality in stack  
**Steps**:
1. Stack switches with different capabilities
2. Enable policy
3. Verify system provisions LCD functionality
4. Attempt to add switch with insufficient capability
5. Verify rejection of incompatible member

**Expected**: Stack enforces LCD, rejects incompatible members

#### TC-STACK-003: Policy with Stack Master Failover
**Objective**: Test policy during master failover  
**Steps**:
1. Enable policy on stack
2. Configure multiple profiles and rules
3. Force master failover (reboot/disconnect)
4. Verify policy remains enforced during transition
5. Check all profiles remain active after failover

**Expected**: Policy survives master failover without disruption

### TCI Overwrite Testing

#### TC-TCI-001: TCI Overwrite Enable
**Objective**: Test TCI overwrite feature  
**Steps**:
1. Create policy profile with tci-overwrite enabled
2. Configure user priority value
3. Apply profile to port
4. Send traffic with existing VLAN tag
5. Capture and verify TCI field overwritten

**Expected**: TCI field (user priority) overwritten per policy

#### TC-TCI-002: TCI VCAP Resource Pool
**Objective**: Verify TCI uses separate VCAP pool  
**Steps**:
1. Configure multiple TCI overwrite profiles
2. Verify VCAP slice allocation (0-4 slices)
3. Check shared pool unaffected
4. Monitor VCAP resource usage

**Expected**: TCI profiles use dedicated VCAP slice pool

### Rule Precedence Testing

#### TC-PREC-001: Default Rule Precedence
**Objective**: Test fixed rule precedence (pre-33.6.1)  
**Steps**:
1. Create multiple rules on same profile
2. Verify fixed precedence order applied
3. Send traffic matching multiple rules
4. Verify first matching rule applied

**Expected**: Rules processed in fixed precedence order

#### TC-PREC-002: Custom Rule Precedence (33.6.1+)
**Objective**: Test configurable rule precedence  
**Steps**:
1. Create multiple policy rules
2. Configure custom precedence values
3. Apply rules to profile
4. Send traffic and verify precedence honored
5. Modify precedence and re-test

**Expected**: Custom precedence order enforced correctly

## Expected Results

- ONEPolicy enables successfully when prerequisites met
- Policy profiles create and apply correctly
- Traffic classification rules match expected patterns
- Dynamic policy assignment via RADIUS works reliably
- CEP detection identifies IP phones/video devices
- Captive portal redirects HTTP traffic appropriately
- VLAN-to-policy mapping functions at distribution layer
- Policy-based mirrors operate within documented limits
- Rule traps and syslogs generate proper notifications
- Layer 7 signatures detect applications via DNS snooping
- Performance meets specifications under load
- Configuration persists across reboots
- No memory leaks or resource exhaustion
- Proper error messages for invalid operations
- Clean logs without unexpected errors
- Interoperability with NetLogin, LLDP, CDP, STP
- Security policies enforce access controls effectively

## Configuration Examples

### Basic Policy Profile Configuration
```
# Enable policy
enable policy

# Create policy profile
create policy profile 1
configure policy profile 1 name "Engineering"
configure policy profile 1 pvid 100
configure policy profile 1 cos 5

# Add classification rules
configure policy rule 1.1 ipaddresssource 10.1.1.0/24
configure policy rule 1.2 macsource 00:11:22:33:44:55
configure policy rule 1.3 tcpdestportip 80
```

### CEP Detection Configuration
```
# Enable policy and LLDP
enable policy
enable lldp ports all

# Configure CEP
configure policy convergence-endpoint enable
configure policy convergence-endpoint lldp profile-index 5

# Map Cisco devices to profile
configure policy convergence-endpoint cisco profile-index 10

# Verify CEP connections
show policy convergence-endpoint connections ports all
```

### Captive Portal Configuration
```
# Configure listening ports
configure policy captive-portal listening 80,8080

# Create web-redirect group
configure policy captive-portal web-redirect 1 server 1 ip 192.168.1.100 port 80 path /portal

# Apply to profile
configure policy profile 2 web-redirect 1
```

### VLAN-to-Policy Mapping
```
# Create policy profile for distribution layer
create policy profile 20 name "GuestAccess"
configure policy profile 20 pvid 200

# Map VLANs to policy
configure policy maptable 100-110 20
```

### Policy-Based Mirror
```
# Configure mirror destination
enable mirroring to port 24

# Create policy with mirror
configure policy rule 5.1 ipaddresssource 10.2.2.0/24 mirror-index 1
```

## References
- **Switch Engine v33.6.1 User Guide** - Chapter: ONEPolicy (Pages 1312-1440)
- **ExtremeXOS Release Notes** - Check for version-specific features and known issues
- **ENTERASYS-APPLICATION-SIGNATURE-MIB** - Layer 7 policy configuration
- **ENTERASYS-MIRROR-CONFIG-MIB** - Policy-based mirror configuration
- **etsysPolicyProfileMIB** - Policy profile management
- **RFC 3580** - RADIUS VLAN authorization

## Key Commands

### Policy Management
- `enable policy` / `disable policy`
- `show policy` / `show policy profile [index]`
- `show policy rule [profile.rule]`
- `show policy maptable`
- `show policy invalid`

### Profile Configuration
- `create policy profile [index]`
- `configure policy profile [index] name [name]`
- `configure policy profile [index] pvid [vlan]`
- `configure policy profile [index] cos [cos]`
- `delete policy profile [index]`

### Rule Configuration
- `configure policy rule [profile.rule] [classification] [action]`
- `configure policy rule [profile.rule] storage [volatile|nonvolatile]`
- `show policy rule precedence`

### CEP Commands
- `configure policy convergence-endpoint [enable|disable]`
- `configure policy convergence-endpoint [lldp|cisco] profile-index [index]`
- `configure policy convergence-endpoint clear ports [ports]`
- `show policy convergence-endpoint connections`

### Captive Portal Commands
- `configure policy captive-portal listening [ports]`
- `configure policy captive-portal web-redirect [index] server [id] ip [ip] port [port] path [path]`
- `configure policy captive-portal rule-use [reserved|unreserved]`
- `show policy captive-portal`

### Hybrid Authentication
- `configure policy maptable response [tunnel|policy|both]`
- `show netlogin session`

## Notes

### Version-Specific Features
- **ExtremeXOS 22.5**: VXLAN-to-policy mapping support
- **ExtremeXOS 30.2**: Fallback VLAN for OnePolicy
- **ExtremeXOS 30.4**: Captive portal reserved ACL space, Layer 7 signatures
- **ExtremeXOS 33.5.1**: Dynamic captive portal redirection via RADIUS VSA
- **ExtremeXOS 33.6.1**: Configurable rule precedence

### Best Practices
1. Plan policy roles based on organizational structure before implementation
2. Use descriptive policy profile names for easy identification
3. Test policy in lab environment before production deployment
4. Monitor VCAP resource utilization to avoid exhaustion
5. Use CEP for automated IP phone/video device provisioning
6. Implement captive portal for guest access scenarios
7. Configure fallback VLANs for authentication failure scenarios
8. Document policy design and rule precedence logic
9. Regular review and cleanup of unused policy profiles
10. Monitor rule hit counters to identify unused rules

### Common Issues and Troubleshooting
1. **Policy won't enable**: Check stack member compatibility and conflicting features
2. **CEP not detecting**: Verify LLDP/CDP enabled, check profile index configured
3. **Captive portal not redirecting**: Verify HTTP (not HTTPS), untagged frames, listening ports
4. **Dynamic rules not created**: Check VCAP space, verify DNS snooping active
5. **NetLogin takes precedence over CEP**: Expected behavior, use for authentication
6. **RADIUS policy not applied**: Verify filter-ID matches policy profile name exactly
7. **Performance degradation**: Review number of active rules, check VCAP utilization
8. **CEP profile doesn't update**: Disable/enable CEP or ports to force refresh

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages 1312-1440, ONEPolicy Chapter*
*Last Updated: {{CURRENT_DATE}}*
