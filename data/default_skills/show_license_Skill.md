# show license - Skill File

## Feature Overview
# show license
Enabled License Level:
        Advanced Edge
Enabled Feature Packs:
        MACsec
4. Verify that MACsec is enabled.
show macsec ports port-list usage
5. Verify that pre-shared-keys (PSKs) are identical by looking for the event:
PortCKNMisMatch.
To have PortCKNMisMatch logged by default, change the severity of logged MACsec
events from "error" to "notice":
configure log filter DefaultFilter add events macsec severity notice
Look for the following event.
<Noti:MACsec.MKA.PortCKNMis...

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
