# RADIUS over TLS - Skill File

## Feature Overview

### Page 1483

RADIUS over TLS
TLS Connection Persistence on page 1483
PKI Authentication of TLS Connections on page 1484
Revocation Checking of Server Certificates via OCSP on page 1484
Limitations on page 1485
Supported Platforms on page 1485
RADIUS Over TLS CLI Commands on page 1486
Setting Up FreeRADIUS TLS on page 1486
RADIUS TLS Cipher Configuration on page 1488
Reference Identifier Support for RADIUS TLS on page 1488
This chapter introduces Remote Authentication Dial In User Service (RADIUS) over
Transport Layer Security (TLS), an option for transporting RADIUS packets over the
secure, reliable, and connection-oriented TLS protocol as defined by RFC 6614.
Using RADIUS over TLS enables dynamic trust relationships between RADIUS servers.
Up to eight (8) RADIUS servers are configurable. If all servers are configured as User
Datagram Protocol (UDP), then a round-robin algorithm is used to determine which
UDP server the initial transmission will be sent to. If more than one TLS server...

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
- **Switch Engine v33.6.1 User Guide** - Chapter: RADIUS over TLS
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "RADIUS over TLS"*
