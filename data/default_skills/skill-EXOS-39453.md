# Show License Expiration Warning (No Cloud Connection) - Skill File
## JIRA: EXOS-39453

## Feature Overview
Enhancement to the `show license` command to display improved expiration warnings when the switch is **not connected to ExtremeCloud IQ**. This ensures administrators receive adequate warning to renew licenses manually when cloud connectivity is unavailable.

## Business Context
- **Cloud-based licensing**: Extreme Platform ONE Networking uses cloud-based licenses managed through ExtremeCloud IQ
- **Risk scenario**: Switches disconnected from cloud cannot auto-renew licenses or receive cloud notifications
- **Critical requirement**: CLI must provide clear, actionable warnings when both:
  1. License expiration is approaching
  2. Cloud connectivity is DOWN/unavailable

## Feature Behavior

### Normal Operation (Connected to Cloud)
- `show license` displays standard license information
- License expiration warnings (if any) indicate cloud portal availability
- System can receive cloud notifications and auto-renewal

### Enhanced Behavior (Disconnected from Cloud)
- `show license` displays **prominent expiration warning** when license approaching expiry
- Warning message indicates:
  - Days until license expiration
  - No cloud connectivity detected
  - Action required: Manual license renewal or restore cloud connection
  - Instructions on how to install license file manually

### Warning Thresholds (Likely Implementation)
- **90 days before expiry**: Informational warning
- **60 days before expiry**: Warning escalates
- **30 days before expiry**: Critical warning displayed
- **Expired**: Error message with service impact details

## CLI Commands

### Primary Command
```
show license
show licenses {[slot slot |all]} {detail}
```

### Related Commands
```bash
# Check cloud connectivity status
show iqagent discovery

# Manual license installation (when cloud unavailable)
install license file <filename> {slot <slot>}

# Check license details per slot (SummitStack)
show licenses slot all

# View switch configuration (includes license info)
show switch {detail}
```

## Topology Requirements
- **Single-node**: Standalone switch with/without cloud connectivity
- **SummitStack**: Requires checking license per slot
- **Cloud connectivity scenarios**:
  - Connected to ExtremeCloud IQ (HTTPS to hac.extremecloudiq.com:443)
  - Disconnected/air-gapped deployment
  - Intermittent connectivity (connection lost during runtime)

## Test Scenarios

### Functional Testing (Category 1: Basic Functionality)

#### 5.1.1 Verify show license with valid license and cloud connected
**Objective**: Confirm normal operation shows no expiration warning when connected

**Topology**: Single-node or SummitStack with active ExtremeCloud IQ connection

**Prerequisites**:
- Valid license installed with 100+ days until expiration
- Switch successfully connected to ExtremeCloud IQ (verify with `show iqagent discovery`)

**Test Methodology**:
1. Configure switch to connect to ExtremeCloud IQ
2. Verify cloud connectivity: `show iqagent discovery`
3. Execute `show license`
4. Examine output for warning messages

**Expected Results**:
- No expiration warnings displayed
- License information shows valid expiration date
- Cloud connectivity status visible in output (if enhancement includes this)
- All license features show as "Enabled"

**Sanity**: Yes

---

#### 5.1.2 Verify show license with approaching expiration and NO cloud connection
**Objective**: Confirm enhanced warning appears when license expiring and cloud disconnected

**Topology**: Single-node with cloud connectivity disabled or unreachable

**Prerequisites**:
- License with expiration date within 30-60 days
- Cloud connectivity disabled or ExtremeCloud IQ unreachable
- Verify disconnected: `show iqagent discovery` shows no connectivity

**Test Methodology**:
1. Disable IQAgent or block cloud connectivity: `disable iqagent`
2. Verify cloud disconnected: `show iqagent discovery`
3. Execute `show license`
4. Examine warning message content and formatting

**Expected Results**:
- **WARNING message prominently displayed** indicating:
  - License expiration date approaching
  - No cloud connectivity detected
  - Manual action required
  - Instructions for manual license renewal
- License details still visible
- Warning uses attention-grabbing formatting (asterisks, separators, bold text)

**Sanity**: Yes

---

#### 5.1.3 Verify show license with approaching expiration and cloud connected
**Objective**: Confirm warning differs when cloud connected vs disconnected

**Topology**: Single-node with active ExtremeCloud IQ connection

**Prerequisites**:
- License with expiration date within 30-60 days
- Switch connected to ExtremeCloud IQ
- Verify connected: `show iqagent discovery`

**Test Methodology**:
1. Configure switch to connect to ExtremeCloud IQ
2. Verify cloud connectivity: `show iqagent discovery`
3. Execute `show license`
4. Compare warning message with Test 5.1.2 above

**Expected Results**:
- Warning message displayed (less critical than disconnected scenario)
- Message may reference ExtremeCloud IQ portal for renewal
- Does NOT include "no cloud connectivity" language
- May provide cloud portal URL or renewal instructions

**Sanity**: Yes

---

### Boundary Value Testing (Category 2)

#### 5.2.1 Test expiration warning at various day thresholds
**Objective**: Verify warning appears at correct day thresholds

**Topology**: Single-node with cloud disconnected

**Test Methodology**:
1. Test with license expiring in: 90 days, 60 days, 30 days, 15 days, 7 days, 1 day
2. For each threshold, disable cloud and execute `show license`
3. Document when warnings first appear and severity level

**Expected Results**:
- Warnings appear at configured thresholds (likely 90/60/30 days)
- Warning severity increases as expiration approaches
- Consistent warning format across thresholds

**Sanity**: No

---

#### 5.2.2 Test license on expiration day
**Objective**: Verify behavior on exact expiration date

**Topology**: Single-node with cloud disconnected

**Test Methodology**:
1. Use license expiring "today" (day 0)
2. Disable cloud connectivity
3. Execute `show license`
4. Verify license features are still enabled vs disabled

**Expected Results**:
- **CRITICAL** warning or ERROR displayed
- License features may still function on expiration day
- Message indicates immediate action required
- Clear indication of service impact

**Sanity**: No

---

#### 5.2.3 Test expired license (1 day past expiration)
**Objective**: Verify behavior with expired license and no cloud

**Topology**: Single-node with cloud disconnected

**Test Methodology**:
1. Use license expired 1 day ago
2. Disable cloud connectivity
3. Execute `show license`
4. Test access to licensed features

**Expected Results**:
- ERROR message displayed
- License features may be disabled or limited
- Clear indication of expired status
- Instructions on how to restore service

**Sanity**: No

---

### Switch Events Testing (Category 4)

#### 5.4.1 Test cloud disconnection during runtime
**Objective**: Verify warning appears when cloud connectivity is lost

**Topology**: Single-node initially connected to cloud

**Prerequisites**:
- License expiring within 60 days
- Switch initially connected to ExtremeCloud IQ

**Test Methodology**:
1. Verify cloud connected: `show iqagent discovery`
2. Execute `show license` - capture baseline output
3. Disable cloud connectivity: `disable iqagent` or block network access
4. Wait 60 seconds for cloud status to update
5. Execute `show license` again
6. Compare outputs

**Expected Results**:
- Initial output shows standard expiration warning (if any)
- After cloud disconnect, warning changes to "no cloud connectivity" version
- Warning appears immediately or within detection timeout period
- No system reboot required for warning to appear

**Sanity**: Yes

---

#### 5.4.2 Test cloud reconnection during runtime
**Objective**: Verify warning changes when cloud connectivity restored

**Topology**: Single-node initially disconnected from cloud

**Prerequisites**:
- License expiring within 60 days
- Switch initially disconnected from ExtremeCloud IQ
- "No cloud" warning currently displayed

**Test Methodology**:
1. Verify cloud disconnected and warning present: `show license`
2. Re-enable cloud connectivity: `enable iqagent` or restore network access
3. Wait for cloud connection to establish (check `show iqagent discovery`)
4. Execute `show license` again
5. Compare warning message

**Expected Results**:
- "No cloud connectivity" warning disappears or changes
- Standard expiration warning may still display
- Cloud connectivity status updates in license display
- System behavior changes dynamically without reboot

**Sanity**: Yes

---

#### 5.4.3 Test configuration persistence after reboot with disconnected cloud
**Objective**: Verify warning persists across reboots

**Topology**: Single-node with cloud disconnected

**Prerequisites**:
- License expiring within 60 days
- Cloud connectivity disabled before reboot

**Test Methodology**:
1. Disable cloud: `disable iqagent`
2. Execute `show license` - verify warning displayed
3. Save configuration: `save`
4. Reboot switch: `reboot`
5. After boot, execute `show license` before enabling cloud

**Expected Results**:
- Warning reappears immediately after boot
- Cloud disconnected state persists
- License expiration date calculated correctly after reboot
- Warning content identical to pre-reboot

**Sanity**: Yes

---

### Negative Testing (Category 7)

#### 5.7.1 Test invalid license with no cloud
**Objective**: Verify appropriate error handling

**Topology**: Single-node with cloud disconnected

**Test Methodology**:
1. Install invalid or corrupted license file
2. Disable cloud connectivity
3. Execute `show license`

**Expected Results**:
- ERROR message displayed
- Indicates invalid license detected
- May reference cloud unavailability
- Does NOT crash or produce unclear errors

**Sanity**: No

---

#### 5.7.2 Test show license with no license installed and no cloud
**Objective**: Verify behavior with missing license

**Topology**: Single-node with cloud disconnected

**Test Methodology**:
1. Remove all licenses (or use switch without license installed)
2. Disable cloud connectivity
3. Execute `show license`

**Expected Results**:
- Message indicates no license installed
- May reference standard/evaluation license mode
- Does NOT display expiration warning (nothing to expire)
- Provides instructions on license installation

**Sanity**: No

---

#### 5.7.3 Test show license in SummitStack with mixed cloud connectivity
**Objective**: Verify behavior when some slots connected, others disconnected

**Topology**: SummitStack with 2+ nodes

**Test Methodology**:
1. Configure stack with master node connected to cloud
2. Block cloud access on standby node (if possible via network isolation)
3. Execute `show licenses slot all`
4. Examine per-slot warnings

**Expected Results**:
- Per-slot warnings displayed based on each slot's cloud connectivity
- Master node may show different warning than standby
- Clear indication of which slots have cloud access
- Stack operation continues normally

**Sanity**: No

---

## Expected Results Summary
- Feature functions as documented
- Warning messages are clear, actionable, and appropriately urgent
- No unexpected behavior or system crashes
- Performance within acceptable limits (show command response time <2 seconds)
- Warnings update dynamically based on cloud connectivity state

## Integration Points
- **ExtremeCloud IQ Agent**: Monitors cloud connectivity status
- **Licensing subsystem**: Tracks license expiration dates
- **SNMP MIBs**: May expose license status via SNMP (check EXTREME-SYSTEM-MIB)
- **EMS logging**: License warnings may generate syslog events

## References
- **Jira**: EXOS-39453 - Show License improvement for expiration warning when not connected to cloud
- **User Guide**: Switch Engine v33.6.1 User Guide, "Extreme Platform ONE Networking Licensing Support" section
- **Related Features**: ExtremeCloud IQ Agent Support, IQAgent configuration
- **CLI Reference**: show license, show licenses, show iqagent discovery

---

## Notes for Test Plan Generation
- Focus on **cloud connectivity state** as the key variable
- Test both **standalone** and **SummitStack** topologies
- Verify **warning message content and formatting** in detail
- Check for **dynamic behavior** (warnings appear/disappear without reboot)
- Validate **expiration day thresholds** (30/60/90 days)
- Ensure warnings are **administrator-visible** and actionable
