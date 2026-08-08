# configure ip nat rule DestNAPT destination protocol udp port 8080 new-port 80 - Skill File

## Feature Overview
# configure ip nat rule DestNAPT destination protocol udp port 8080 new-port 80
Limitations
NAT is not supported for the following: VXLAN tenant VLANs, MPLS service VLANs, MAC
based VLANs, Netlogin VLANs, VPEX switches.
NAT is not supported with MLAG.
NEW!IP Multicast NAT
Overview
In a typical enterprise network, multicast sources use private IP addresses (RFC 1918
ranges such as 10.0.0.0/8). When multicast streams need to reach receivers in a public
or external network, the source IP address mu...

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
