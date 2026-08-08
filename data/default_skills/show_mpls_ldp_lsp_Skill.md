# show mpls ldp lsp - Skill File

## Feature Overview
# show mpls ldp lsp
Prefix            Adv Label Peer Label Next Hop        VLAN
192.168.0.4/32     0x80402   --         --              lpbk
192.168.0.2/32     0x00039   0x80400    11.0.2.2        vlan2
11.0.4.0/24        0x0003A   0x80401    11.0.2.2        vlan2
192.168.0.4/32     0x0003B   0x00013    11.0.2.2        vlan2
* BD-10K.6 # show mpls rsvp-te lsp
Ingress LSP Name Path Name        Destination     Transmit I/F     UpTm
Flags
---------------- ---------------- --------------- ----------...

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
