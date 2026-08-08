# configure policy rule admin-profile macsource 00-00-00-00-00-01 mask 48 port-string 27 - Skill File

## Feature Overview
# configure policy rule admin-profile macsource 00-00-00-00-00-01 mask 48 port-string 27 
admin-pid 2 
configure policy profile 2 name "filter" pvid-status "enable" pvid 400 egress-vlans 200 
untagged-vlans 400 tci-overwrite "enable"
configure policy maptable response both 
configure policy vlanauthorization enable 
enable policy 
In the above configuration, if a dot1x user is authenticated with Tunnel Private Group
Id as "3000" and filter id as "filter" via Radius, the static macsource rule tak...

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
