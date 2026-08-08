# EVPN - Ethernet Virtual Private Network - Skill File

## Feature Overview

### Page 647

Ethernet Virtual Private Network
(EVPN)
EVPN Overview on page 647
Configuring EVPN Overview on page 649
Displaying EVPN Information on page 652
EVPN Configuration Examples on page 654
This chapter explains the ExtremeXOS® implementation of BGP (Border Gateway
Protocol)-based Ethernet VPNs (EVPNs) as described in RFC 7209, RFC 7432, and RFC
8365.
This chapter provides information on configuring and managing EVPN, displaying
EVPN information, and configuration examples.
EVPN Overview
BGP was standardized in RFC 7432 and RFC 8365 to carry Layer-2 information for
virtualized networks. Ethernet virtual private network (EVPN) was initially targeted for
MPLS (Multiprotocol Label Switching) and WAN, but later adopted as a VXLAN (Virtual
Extensible LAN) control plane protocol. ExtremeXOS supports EVPN control plane for
VXLAN. At a high level, BGP supports the following constructs to distribute information
for any virtualized network:
•
Identify the network address family with AFI/S...

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
- **Switch Engine v33.6.1 User Guide** - Chapter: EVPN - Ethernet Virtual Private Network
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "EVPN - Ethernet Virtual Private Network"*
