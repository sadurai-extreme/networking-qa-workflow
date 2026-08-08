# IPv6 Unicast Routing - Skill File

## Feature Overview

### Page 952

IPv6 Unicast Routing
IPv6 Unicast Overview on page 952
Neighbor Discovery Protocol on page 956
Managing Duplicate Address Detection on page 961
Managing IPv6 Unicast Routing on page 966
IPv6 ECMP and 32-Way ECMP on page 970
DHCPv6 Relay Remote-ID Option on page 971
DHCPv6 Relay Agent Prefix Delegation on page 972
DHCPv6 Client on page 975
Configuring DHCPv6 BOOTP Relay on page 978
Configure Route Compression on page 979
Hardware Forwarding Behavior on page 979
Routing Configuration Example on page 981
Tunnel Configuration Examples on page 982
This chapter assumes that you are already familiar with IPv6 unicast routing. If not, refer
to the following publications for additional information:
•
RFC 2460—Internet Protocol, Version 6 (IPv6) Specification
•
RFC 4291—IP Version 6 Addressing Architecture
For IPv6 PIM support, see Multicast Routing and Switching on page 1153.
Note
For more information on interior gateway protocols, see RIPng or IPv6 Unicast
Routing.
IPv6 Unicast Ov...

## Test Scenarios

### Functional Testing
1. **Basic Configuration**
   - Verify feature can be enabled/disabled
   - Validate default settings
   - Test configuration persistence across reboots
   - Verify show commands display correct information

2. **Feature-Specific Tests**
   - Test primary feature functionality
   - Validate configuration options
   - Test interaction with related features
   - Verify state transitions

### Configuration Testing
- Valid configuration commands
- Invalid configuration handling
- Configuration limits and boundaries
- Configuration file backup and restore

### Interoperability Testing
- Test with different switch models
- Validate with various firmware versions
- Check interaction with other protocols/features
- Multi-vendor interoperability (if applicable)

### Negative Testing
- Invalid configurations
- Resource exhaustion scenarios
- Error handling validation
- Recovery from failure conditions

### Performance Testing
- Load testing under heavy traffic
- Scalability validation (maximum entries/sessions)
- Resource utilization monitoring
- Performance degradation testing

### Security Testing
- Authentication and authorization
- Access control verification
- Security policy enforcement
- Vulnerability testing

## Expected Results
- Feature functions as documented in Switch Engine User Guide
- No unexpected behavior or crashes
- Performance within acceptable limits
- Proper error messages for invalid operations
- Clean logs without errors

## Test Cases

### TC001: Basic Feature Enablement
**Objective:** Verify feature can be enabled  
**Steps:**
1. Configure feature with minimum required parameters
2. Verify configuration is accepted
3. Check feature status shows "enabled"

**Expected:** Feature enabled successfully

### TC002: Configuration Persistence
**Objective:** Verify configuration survives reboot  
**Steps:**
1. Configure feature fully
2. Save configuration
3. Reboot switch
4. Verify configuration intact after boot

**Expected:** All settings preserved

### TC003: Show Commands
**Objective:** Verify all show commands work  
**Steps:**
1. Execute all relevant show commands
2. Verify output format is correct
3. Check all fields display accurate data

**Expected:** Commands return valid output

## References
- **Switch Engine v33.6.1 User Guide** - Chapter: IPv6 Unicast Routing
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "IPv6 Unicast Routing"*
