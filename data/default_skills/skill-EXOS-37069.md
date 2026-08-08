# FIPS Mode Support for Telegraf - Skill File
## JIRA: EXOS-37069

## Feature Overview
Implementation of **FIPS 140-3 compliant telegraf** to enable Federal Risk and Authorization Management Program (FedRAMP) compliance for Network Operating System (NOS) components that interface with ExtremeCloud IQ (XIQ), Wireless Solutions (WS), and Extreme Platform ONE (EP1).

This feature ensures that the **Telegraf telemetry agent** uses FIPS-certified cryptographic libraries when EXOS operates in FIPS mode, meeting federal government security requirements for cloud-connected network infrastructure.

## Business Context
- **FedRAMP Compliance**: WS/EP1/XIQ platforms require FedRAMP compliance starting in 25r1 timeframe
- **Regulatory Requirement**: All NOS components interfacing with cloud services must use FIPS 140-3 certified cryptography
- **Target Components**: Inlets and Telegraf libraries used for telemetry data collection and transmission to EP1
- **Federal Deployment**: Required for switches deployed in U.S. government and federal agency networks
- **Crypto Module**: Uses FIPS-validated OpenSSL cryptographic module integrated with Golang

## Feature Behavior

### Normal Operation (Non-FIPS Mode)
- Telegraf runs with standard cryptographic libraries
- `GOLANG_FIPS=0` environment variable set
- No OpenSSL FIPS provider constraints
- Compatible with all switch platforms (arm64, x86_64, PowerPC)

### FIPS Mode Operation (FIPS Enabled)
When EXOS is configured in FIPS mode:
- Telegraf executable uses FIPS-certified OpenSSL libraries
- Environment variables automatically configured on telegraf startup:
  - `GOLANG_FIPS=1` - Enables FIPS mode in Golang runtime
  - `OPENSSL_CONF=/etc/openssl.cnf` - Points to OpenSSL configuration
  - `OPENSSL_MODULES=/exos/lib` - Points to FIPS provider module (`fips.so`)
- Telegraf validates FIPS mode on startup (fails if crypto unavailable)
- All cryptographic operations use FIPS 140-3 validated algorithms
- Compatible with **Universal platforms only**: arm64 and x86_64

### Platform Compatibility
| Platform | FIPS-Capable Telegraf | Notes |
|----------|----------------------|-------|
| arm64 (Universal) | ✅ Yes | Full FIPS support |
| x86_64 (Universal) | ✅ Yes | Full FIPS support |
| PowerPC | ❌ No | Non-universal platforms excluded |

### Runtime Behavior
1. **Telegraf Startup**: `telemetry.c` checks system FIPS mode via `dmCapGetFIPSMode()`
2. **Environment Setup**: Sets GOLANG_FIPS and OpenSSL paths before `execv()`
3. **FIPS Validation**: Telegraf binary validates access to FIPS provider on launch
4. **Mode Changes**: FIPS mode changes require system reboot (telegraf NOT restarted dynamically)
5. **EPM Notifications**: System listens for `EPM_MSG_SYSTEM_MODE_UPDATE` events to track FIPS state

## Technical Implementation

### Code Changes
**Modified File**: `nettools/telemetry/src/telemetry.c`

Key changes in `fork_exec_telegraf()`:
```c
if (dmCapGetFIPSMode(0)) {
    EMS_Telemetry_DebugSummary("Execute telegraf with FIPS mode enabled");
    setenv("GOLANG_FIPS", "1", 1);
    setenv("OPENSSL_CONF", "/etc/openssl.cnf", 1);
    setenv("OPENSSL_MODULES", "/exos/lib", 1);
} else {
    EMS_Telemetry_DebugSummary("Execute telegraf with FIPS mode disabled");
    setenv("GOLANG_FIPS", "0", 1);
}
```

Added EPM callback handler for `EPM_MSG_SYSTEM_MODE_UPDATE` to track FIPS mode state changes.

**Telegraf Binary Updates**: 
- FIPS-capable executables built with OpenSSL support (linked against FIPS provider)
- See: https://github.com/extremenetworks/telegraf/pull/42
- Build changes: https://github.com/extremenetworks/telegraf/compare/9fb65304...extremenetworks:telegraf:b3945161

**Manifest Update**: `exos_core/code/artifactory_manifest` updated with FIPS-capable telegraf binaries

### External Dependencies
- OpenSSL FIPS Provider: `/exos/lib/fips.so`
- OpenSSL Configuration: `/etc/openssl.cnf`
- EXOS FIPS mode configuration (set via `enable/disable fipsmode`)

## CLI Commands

### Check FIPS Mode Status
```bash
# Verify if EXOS is in FIPS mode
show management

# Check telegraf process and environment
show process telemetry

# View telemetry configuration and status
show telemetry
show telemetry detail

# Verify FIPS mode enabled (look for "FIPS Mode: Enabled")
show switch
```

### Enable/Disable FIPS Mode
```bash
# Enable FIPS mode (requires reboot)
enable fipsmode
reboot

# Disable FIPS mode (requires reboot)
disable fipsmode
reboot
```

### Verify Telegraf Operation
```bash
# Check if telegraf is running
show process telemetry

# View telemetry logs for FIPS initialization
debug cfgmgr show log telemetry
```

### Manual Verification (via EXOS shell)
```bash
# Access EXOS shell
start shell

# Check telegraf binary symbols (should contain OPENSSL references)
strings /usr/local/bin/telegraf | grep OPENSSL

# Verify telegraf can initialize in FIPS mode
GOLANG_FIPS=1 OPENSSL_CONF=/etc/openssl.cnf OPENSSL_MODULES=/exos/lib /usr/local/bin/telegraf --version

# Exit shell
exit
```

## Topology Requirements
- **Single-node or SummitStack**: Feature applies to all topology types
- **Universal Platform**: arm64 or x86_64 architecture (PowerPC not supported)
- **EXOS Version**: 33.3.0.255+ (tagged as `builds/xos_master/33.3.0.255`)
- **ExtremeCloud IQ Connection**: Required for telemetry data transmission (HTTPS to cloud endpoints)
- **Federal Deployment**: Primarily for switches in FedRAMP-compliant environments

## Test Scenarios

### Functional Testing (Category 1: Basic Functionality)

#### 5.1.1 Verify telegraf startup with FIPS mode enabled
**Objective**: Confirm telegraf starts successfully and uses FIPS-certified crypto when FIPS mode is enabled

**Topology**: Single Universal platform switch (arm64 or x86_64)

**Prerequisites**:
- EXOS version 33.3.0.255 or later with FIPS-capable telegraf binary
- Universal platform hardware (not PowerPC)
- FIPS mode enabled: `enable fipsmode` (requires prior reboot)

**Test Methodology**:
1. Verify FIPS mode: `show management` (confirm "FIPS Mode: Enabled")
2. Enable telemetry: `enable telemetry`
3. Check telegraf process: `show process telemetry`
4. Verify environment variables via debug logs: `debug cfgmgr show log telemetry`
5. Look for log entry: "Execute telegraf with FIPS mode enabled"

**Expected Results**:
- Telegraf process starts successfully (PID shown in `show process telemetry`)
- Debug logs show: "Execute telegraf with FIPS mode enabled"
- No error messages about missing FIPS provider or OpenSSL configuration
- Telemetry data successfully transmitted to ExtremeCloud IQ (if configured)

**Sanity**: Yes

---

#### 5.1.2 Verify telegraf startup with FIPS mode disabled
**Objective**: Confirm telegraf operates normally without FIPS constraints when FIPS mode is disabled

**Topology**: Any platform (Universal or PowerPC)

**Prerequisites**:
- EXOS version 33.3.0.255 or later
- FIPS mode disabled: `disable fipsmode` (requires prior reboot if previously enabled)

**Test Methodology**:
1. Verify FIPS mode: `show management` (confirm "FIPS Mode: Disabled")
2. Enable telemetry: `enable telemetry`
3. Check telegraf process: `show process telemetry`
4. Verify environment variables: `debug cfgmgr show log telemetry`
5. Look for log entry: "Execute telegraf with FIPS mode disabled"

**Expected Results**:
- Telegraf starts successfully on all platforms (including PowerPC)
- Debug logs show: "Execute telegraf with FIPS mode disabled"
- `GOLANG_FIPS=0` set (non-FIPS operation)
- Normal telemetry functionality

**Sanity**: Yes

---

#### 5.1.3 Verify telegraf fails to start without FIPS provider when FIPS enabled
**Objective**: Negative test - confirm telegraf detects missing FIPS components and fails gracefully

**Topology**: Universal platform with intentionally broken FIPS configuration

**Prerequisites**:
- FIPS mode enabled
- Temporarily rename or remove FIPS provider: `mv /exos/lib/fips.so /exos/lib/fips.so.bak`
- Or corrupt OpenSSL configuration: `mv /etc/openssl.cnf /etc/openssl.cnf.bak`

**Test Methodology**:
1. Enable FIPS mode and reboot
2. Remove/rename FIPS provider or OpenSSL config
3. Attempt to start telemetry: `enable telemetry`
4. Check process status: `show process telemetry`
5. Review error logs: `debug cfgmgr show log telemetry`

**Expected Results**:
- Telegraf process fails to start or exits immediately
- Error message indicates inability to enable FIPS mode
- Log contains: "can't enable FIPS mode" or OpenSSL initialization error
- System remains stable (no crash or hang)

**Cleanup**: Restore FIPS provider or OpenSSL config and restart telemetry

**Sanity**: No (Negative test)

---

### Integration Testing (Category 2: Feature Interaction)

#### 5.2.1 Verify FIPS mode change does not restart running telegraf
**Objective**: Confirm that changing FIPS mode after telegraf is running does NOT restart telegraf (requires reboot)

**Topology**: Universal platform

**Prerequisites**:
- FIPS mode enabled
- Telegraf running: `show process telemetry`

**Test Methodology**:
1. Note telegraf PID: `show process telemetry`
2. Disable FIPS mode: `disable fipsmode`
3. Wait 30 seconds
4. Check telegraf PID again: `show process telemetry`
5. Verify PID unchanged (telegraf still running with old FIPS setting)
6. Reboot switch
7. After reboot, verify telegraf started with new FIPS setting

**Expected Results**:
- FIPS mode change does NOT terminate telegraf immediately
- Telegraf PID remains unchanged until reboot
- After reboot, telegraf starts with new FIPS environment variables
- Debug log shows correct FIPS mode setting after reboot

**Sanity**: No

---

#### 5.2.2 Verify telemetry with FIPS mode and ExtremeCloud IQ connectivity
**Objective**: End-to-end test of FIPS-compliant telemetry data transmission to cloud

**Topology**: Universal platform connected to ExtremeCloud IQ

**Prerequisites**:
- FIPS mode enabled
- Switch onboarded to ExtremeCloud IQ
- IQAgent connected: `show iqagent` (status: Connected)
- Telemetry configured to send metrics to EP1

**Test Methodology**:
1. Enable FIPS mode and reboot
2. Configure telemetry collector: `configure telemetry collector <endpoint>`
3. Enable telemetry: `enable telemetry`
4. Verify telegraf running: `show process telemetry`
5. Verify IQAgent connection: `show iqagent`
6. Wait 5 minutes for data transmission
7. Log into ExtremeCloud IQ portal
8. Navigate to switch monitoring page
9. Verify telemetry metrics being received (CPU, memory, interface stats)

**Expected Results**:
- Telegraf starts with FIPS mode enabled
- Telemetry data successfully transmitted using FIPS-certified crypto
- ExtremeCloud IQ displays real-time metrics from switch
- No errors in telemetry or IQAgent logs
- HTTPS connections use FIPS-approved cipher suites

**Sanity**: Yes (Critical integration path)

---

### Platform Testing (Category 3: Platform Validation)

#### 5.3.1 Verify FIPS telegraf on arm64 Universal platform
**Objective**: Validate FIPS-capable telegraf on ARM architecture

**Topology**: Universal arm64 platform switch (e.g., X465-48W, X695)

**Prerequisites**:
- Universal arm64 hardware
- EXOS 33.3.0.255+ with FIPS-capable telegraf binary
- FIPS mode enabled

**Test Methodology**:
1. Boot arm64 switch with FIPS mode enabled
2. Enable telemetry: `enable telemetry`
3. Verify telegraf process: `show process telemetry`
4. Check binary architecture: `file /usr/local/bin/telegraf` (should show ARM aarch64)
5. Verify FIPS initialization in logs
6. Test telemetry data collection for 10 minutes

**Expected Results**:
- Telegraf binary is arm64/aarch64 architecture
- FIPS mode enabled successfully
- All telemetry functionality works normally
- No platform-specific errors

**Sanity**: Yes

---

#### 5.3.2 Verify FIPS telegraf on x86_64 Universal platform
**Objective**: Validate FIPS-capable telegraf on Intel/AMD x86 architecture

**Topology**: Universal x86_64 platform switch (e.g., VM9000 Series)

**Prerequisites**:
- Universal x86_64 hardware
- EXOS 33.3.0.255+ with FIPS-capable telegraf binary
- FIPS mode enabled

**Test Methodology**:
1. Boot x86_64 switch with FIPS mode enabled
2. Enable telemetry: `enable telemetry`
3. Verify telegraf process: `show process telemetry`
4. Check binary architecture: `file /usr/local/bin/telegraf` (should show x86-64)
5. Verify FIPS initialization in logs
6. Test telemetry data collection for 10 minutes

**Expected Results**:
- Telegraf binary is x86_64 architecture
- FIPS mode enabled successfully
- All telemetry functionality works normally
- No platform-specific errors

**Sanity**: Yes

---

#### 5.3.3 Verify non-FIPS telegraf on PowerPC platform
**Objective**: Confirm PowerPC platforms continue to work in non-FIPS mode (no FIPS support)

**Topology**: PowerPC platform switch (e.g., legacy switches)

**Prerequisites**:
- PowerPC hardware
- EXOS 33.3.0.255+
- FIPS mode disabled (cannot enable on PowerPC)

**Test Methodology**:
1. Attempt to enable FIPS mode: `enable fipsmode`
2. Verify error message or restriction (FIPS not available on PowerPC)
3. Enable telemetry: `enable telemetry`
4. Verify telegraf runs with `GOLANG_FIPS=0`
5. Confirm normal telemetry operation

**Expected Results**:
- FIPS mode cannot be enabled on PowerPC (expected limitation)
- Telegraf runs in non-FIPS mode successfully
- All telemetry features work normally (without FIPS constraints)
- No functional regression on non-Universal platforms

**Sanity**: No

---

### Stress and Scale Testing (Category 4: Robustness)

#### 5.4.1 Verify telemetry performance with FIPS overhead
**Objective**: Measure CPU/memory impact of FIPS-mode telegraf vs non-FIPS mode

**Topology**: Universal platform with high telemetry load

**Prerequisites**:
- Universal platform
- Configure telegraf to collect maximum metrics (all interfaces, frequent polling)
- Baseline metrics captured in non-FIPS mode

**Test Methodology**:
1. **Baseline (non-FIPS)**:
   - Disable FIPS mode, reboot
   - Enable telemetry with max metric collection
   - Monitor CPU/memory: `show cpu-monitoring` every 5 minutes for 1 hour
   - Record average CPU usage and telegraf memory consumption
2. **FIPS Mode Test**:
   - Enable FIPS mode, reboot
   - Enable telemetry with same configuration
   - Monitor CPU/memory: `show cpu-monitoring` every 5 minutes for 1 hour
   - Record average CPU usage and telegraf memory consumption
3. Compare metrics: FIPS vs non-FIPS overhead

**Expected Results**:
- CPU overhead: <5% increase with FIPS mode (crypto operations slightly slower)
- Memory usage: Comparable (no significant memory increase)
- Telemetry data collection rate: No degradation
- Data transmission latency: <10% increase acceptable
- System remains stable under load

**Sanity**: No

---

#### 5.4.2 Long-term stability test with FIPS-enabled telegraf
**Objective**: Verify telegraf runs reliably in FIPS mode for extended periods without memory leaks or crashes

**Topology**: Universal platform connected to ExtremeCloud IQ

**Prerequisites**:
- FIPS mode enabled
- Telemetry configured and running
- ExtremeCloud IQ connectivity active

**Test Methodology**:
1. Enable FIPS mode and start telemetry
2. Run for **7 days** continuous operation
3. Monitor every 6 hours:
   - Telegraf process status: `show process telemetry`
   - Memory usage: `show memory`
   - Telemetry logs for errors: `debug cfgmgr show log telemetry`
4. Verify data continuously received in ExtremeCloud IQ
5. Check for process restarts or failures

**Expected Results**:
- Telegraf runs continuously for 7 days without restart
- No memory leaks (memory usage stable)
- No telegraf crashes or hangs
- Continuous telemetry data flow to cloud
- No FIPS-related errors in logs

**Sanity**: No

---

### Upgrade and Downgrade Testing (Category 5: Software Lifecycle)

#### 5.5.1 Verify upgrade from non-FIPS to FIPS-capable telegraf
**Objective**: Ensure smooth upgrade path when FIPS-capable telegraf is introduced

**Topology**: Universal platform running pre-33.3.0.255 EXOS

**Prerequisites**:
- Current EXOS version without FIPS-capable telegraf (e.g., 33.2.x)
- Telemetry enabled and running
- Upgrade image: 33.3.0.255+ with FIPS telegraf

**Test Methodology**:
1. Verify current telemetry operation
2. Download upgrade image: `download image <server> <filename>`
3. Install image: `use image secondary`
4. Reboot: `reboot`
5. After boot, verify EXOS version: `show version`
6. Enable FIPS mode: `enable fipsmode` and reboot
7. Enable telemetry: `enable telemetry`
8. Verify FIPS-capable telegraf running

**Expected Results**:
- Upgrade completes successfully
- Configuration preserved (telemetry settings retained)
- New telegraf binary supports FIPS mode
- No errors after enabling FIPS and telemetry
- Data continues flowing to ExtremeCloud IQ

**Sanity**: Yes (Critical upgrade path)

---

#### 5.5.2 Verify downgrade from FIPS-capable to non-FIPS telegraf
**Objective**: Ensure backward compatibility when downgrading EXOS versions

**Topology**: Universal platform running 33.3.0.255+ with FIPS mode enabled

**Prerequisites**:
- Current version: 33.3.0.255 with FIPS telegraf
- FIPS mode enabled
- Downgrade target: Pre-FIPS EXOS version (e.g., 33.2.x)

**Test Methodology**:
1. Note current FIPS status: `show management`
2. Switch to previous image: `use image secondary`
3. Reboot: `reboot`
4. After boot, verify downgraded version
5. Check telemetry status: `show telemetry`
6. Verify telegraf operation (non-FIPS mode)

**Expected Results**:
- Downgrade completes successfully
- Telemetry continues to function (non-FIPS mode)
- FIPS mode setting reverts or is ignored on older version
- No critical errors (warnings acceptable)
- Configuration preserved

**Sanity**: No

---

## Regression Testing

### Related Features to Test
1. **Standard Telemetry Operation**: All existing telemetry tests must pass in both FIPS and non-FIPS modes
2. **IQAgent Cloud Connectivity**: ExtremeCloud IQ agent must function with FIPS-mode telegraf
3. **SNMP Integration**: Telegraf SNMP input plugin must work in FIPS mode
4. **CLI Operations**: All telemetry CLI commands functional in FIPS mode
5. **SummitStack**: Telegraf on master and backup nodes in FIPS mode
6. **Process Management**: Telegraf process lifecycle (start/stop/restart) in FIPS mode

### Known Limitations
- **Platform Restriction**: FIPS-capable telegraf available only on Universal platforms (arm64, x86_64)
- **Reboot Required**: FIPS mode changes require system reboot (telegraf not restarted dynamically)
- **No Runtime Toggle**: Cannot switch telegraf between FIPS/non-FIPS without reboot
- **FedRAMP Scope**: Feature primarily targets federal government deployments

## Dependencies
- **OpenSSL FIPS Provider**: `/exos/lib/fips.so` must be present and valid
- **OpenSSL Configuration**: `/etc/openssl.cnf` correctly configured for FIPS
- **EXOS FIPS Mode**: System-wide FIPS mode must be enabled via `enable fipsmode`
- **Golang FIPS Support**: Telegraf built with Golang FIPS runtime support
- **External Repository**: Changes in https://github.com/extremenetworks/telegraf

## Test Tools & Utilities
- **Manual Validation**: `strings`, `strace`, `file` commands (via EXOS shell)
- **Environment Check**: `printenv` or process inspection to verify environment variables
- **OpenSSL Test**: `openssl version` and `openssl provider` commands
- **Telemetry Logs**: `debug cfgmgr show log telemetry`
- **Process Monitoring**: `show process telemetry`, `show cpu-monitoring`

## API/Automation Testing
- **REST API**: Verify telemetry configuration via EXOS REST API in FIPS mode
- **JSONRPC**: Test telemetry enable/disable via JSONRPC with FIPS enabled
- **ExtremeCloud IQ API**: Verify metrics reception via XIQ API endpoints

## Documentation References
- **User Guide**: "Telemetry" chapter - Add FIPS mode section
- **Release Notes**: Document FIPS support for telegraf in 33.3.0.255+
- **Security Guide**: FedRAMP compliance and FIPS mode configuration
- **Telegraf Documentation**: https://github.com/extremenetworks/telegraf/pull/42

## Related Features
- **FIPS Mode**: System-wide FIPS 140-3 compliance framework
- **ExtremeCloud IQ Integration**: Cloud telemetry and device management
- **IQAgent**: Device-to-cloud communication agent
- **Telemetry Framework**: EXOS metrics collection and export system
- **Federal Compliance**: FedRAMP and government security requirements

## Commit Information
- **Commit Hash**: `faff7b1e504af4dc7feb2a159f98c701080ef269`
- **Tag**: `builds/xos_master/33.3.0.255`
- **Author**: Sumit Garg <sugarg@extremenetworks.com>
- **Date**: Wed Feb 5 07:00:17 2025 -0500
- **Modified Files**: 
  - `nettools/telemetry/src/telemetry.c`
  - `exos_core/code/artifactory_manifest`

## Test Priority Summary
| Category | Test Count | Sanity Tests |
|----------|------------|--------------|
| Functional | 3 | 2 |
| Integration | 2 | 1 |
| Platform | 3 | 2 |
| Stress/Scale | 2 | 0 |
| Upgrade/Downgrade | 2 | 1 |
| **Total** | **12** | **6** |
