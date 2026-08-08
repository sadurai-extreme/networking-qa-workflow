# Narrow it down to the primary server if a failure is seen - Skill File

## Feature Overview
# Narrow it down to the primary server if a failure is seen
run service-probe 1 query dns primary www.extremenetworks.com
Example: Static IP Probe with Gateway and DNS Checks
This example creates a probe with a fixed IP address and validates both gateway
reachability and DNS resolution — useful when you want repeatable results
independent of DHCP.
...

## Test Scenarios

### Functional Testing
1. **Basic Configuration**
   - Verify feature can be enabled/disabled
   - Validate default settings
   - Test configuration persistence

### Configuration Testing

### Interoperability Testing
- Test with different switch models
- Validate with various firmware versions
- Check interaction with other features

### Negative Testing
- Invalid configurations
- Resource exhaustion scenarios
- Error handling validation

### Performance Testing
- Load testing
- Scalability validation
- Resource utilization

## Expected Results
- Feature functions as documented
- No unexpected behavior
- Performance within acceptable limits

## References
- Concept Guide Section: {title}
- Related Documentation: [Add links]

---
*Auto-generated from PDF Concept Guide*
