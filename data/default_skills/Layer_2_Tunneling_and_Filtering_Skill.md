# Layer 2 Tunneling and Filtering - Skill File

## Feature Overview

### Page 1013

Layer 2 Tunneling and Filtering
Layer 2 Protocol Tunneling on page 1013
Protocol Tunneling on page 1015
Protocol Filtering on page 1018
L2PT Limitations on page 1020
This ExtremeXOS feature introduces the ability to tunnel and filter Layer 2 PDUs.
Tunneling allows you to send Layer 2 PDUs across a service provider network, and be
delivered to remote switches. It is useful when a network includes remote sites that
are connected through a service provider network. Using tunneling, you can make the
service provider network transparent to the customer network.
Filtering prevents Layer 2 PDUs from being received on a port.
Layer 2 Protocol Tunneling
Layer 2 protocol tunneling (L2PT) is achieved by encapsulating the PDUs at the
ingress PE device before transmitting them over the service provider network. The
encapsulation prevents the PDUs from being processed by the switches in the SP
network. At the egress PE device, the encapsulated packets are de-encapsulated, and
transmitt...

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
- **Switch Engine v33.6.1 User Guide** - Chapter: Layer 2 Tunneling and Filtering
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "Layer 2 Tunneling and Filtering"*
