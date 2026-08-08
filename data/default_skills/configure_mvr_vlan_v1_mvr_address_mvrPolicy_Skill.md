# configure mvr vlan v1 mvr-address mvrPolicy - Skill File

## Feature Overview
# configure mvr vlan v1 mvr-address mvrPolicy
When the policy file contains "permit", the traffic flows to v2,v3 and the second port in
MVR vlan.
When the policy file is changed to "deny", the second port in MVR VLAN v1 continues
receiving traffic, but VLAN v2 and v3 stop receiving traffic, in spite of IGMP groups being
learned. This is because the join on v2 and v3 will not be leaked to MVR VLAN.
Essentially, the dynamic policy does not directly apply on traffic, but it affects the joins,
based...

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
