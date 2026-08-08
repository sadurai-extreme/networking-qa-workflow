# Fabric Attach Zero Touch Client (FA ZTC) ΓÇö Netlogin Authentication Bypass

**Feature ID:** EXOS-39369
**Release:** EXOS 34.1.1
**Type:** Feature
**Primary Commit:** `f3123132` (Tue Jul 7 13:28:01 2026 +0530)
**Related Commit:** `0f28f047` (Tue Jul 7 09:43:25 2026 -0400)

---

## 1. FEATURE OVERVIEW

### High-Level Description
The FA ZTC Netlogin Bypass feature introduces a **per-client-type configurable option** within the Fabric Attach (FA) Zero Touch Client (ZTC) framework that allows FA-discovered clients to bypass Netlogin (Network Login) authentication. When enabled for a specific FA client type, devices matching that client typeΓÇöas discovered via LLDP Fabric Attach TLVsΓÇöare automatically whitelisted in the Netlogin process, removing the requirement for those devices to complete standard 802.1X, MAC-based, or web-redirect authentication flows.

### Purpose and Business Value
- **Streamlined onboarding** for trusted infrastructure devices (IP phones, wireless APs, cameras, etc.) discovered through Fabric Attach signaling.
- **Reduces administrative overhead** by eliminating the need to provision RADIUS/local authentication credentials for FA-signaled endpoints that are already trusted by virtue of FA participation.
- **Granular control** ΓÇö bypass can be enabled independently per FA client type, so only specific device categories are exempted from authentication.

### Use Cases and Target Scenarios
- FA-enabled IP phones or cameras that must gain immediate network access without an 802.1X supplicant.
- Environments where FA ZTC already provisions VLAN/ISID mapping, and authentication is redundant for FA-trusted device categories.
- Mixed deployments where some client types require full authentication while others (trusted infrastructure) should bypass it.

### Related Standards and Protocols
- **IEEE 802.1AB** ΓÇö Link Layer Discovery Protocol (LLDP), the transport for Fabric Attach TLVs.
- **Fabric Attach (FA)** ΓÇö Extreme proprietary LLDP-based auto-attach signaling (FA Element TLV, FA Assignment TLV).
- **IEEE 802.1X** ΓÇö Port-based Network Access Control (Netlogin authentication mode being bypassed).
- **Netlogin** ΓÇö EXOS MAC-based, 802.1X, and web-based authentication framework.

### Prerequisites and Dependencies
- LLDP must be enabled globally and on the relevant ports.
- Fabric Attach must be operational in a mode that supports ZTC (`IS_FA_ZTC_ACTIVE`).
- Netlogin must be configured on the ports where bypass is desired.
- Feature is local to the switch; no protocol/TLV-carried signaling is added between peers.

---

## 2. FUNCTIONAL DESCRIPTION

### Core Functionality
The feature adds a `bypassNl` boolean attribute per FA Zero Touch Client type. When set, the LLDP-FA subsystem instructs the Netlogin subsystem (via IPC) to add the discovered client's MAC address to a bypass whitelist. Netlogin then skips its authentication decision for that MAC, granting immediate network access.

### Step-by-Step Operational Flow

**Bypass Entry Creation:**
1. An FA client sends an LLDP PDU containing an FA Element TLV.
2. The LLDP-FA subsystem parses the TLV (`_avex_element_tlv` structure) and identifies the client type.
3. The subsystem validates the client type range (`FA_ELEMENT_MIN_CLIENT_TYPE` to `FA_NUM_CLIENT_TYPES - 1`) and indexes into `zeroTouchClients[]`.
4. If `faZeroTouchClient_t.bypassNl == 1` for that client type, the function `lldpFaPortNetloginBypass()` triggers a bypass request.
5. An IPC message with opcode `LLDP_CLNTSVR_FA_BYPASS_NL` (carried in `lldpFaBypassNlMsg_s`) is sent from LLDP to Netlogin via `lldpServerFaBypassNl()`.
6. Netlogin records the MAC in its bypass list (`nlBypassNlEntry_s`) and calls `nlRecordFaBypassAuthSkip()` to mark the skipped authentication.
7. The client obtains network access without any authentication challenge. VLAN/ISID provisioning by FA ZTC still proceeds normally.

**Bypass Entry Removal:**
1. When an FA neighbor departs (link-down, LLDP TTL aging, or LLDP/FA disable), `lldpIdMgrDelNbrByPort(portInstance, netlogin=true)` is invoked.
2. `lldpFaBypassNlDelAllEntries()` sends a REMOVE operation to Netlogin.
3. Netlogin removes the MAC via `nlRemoveFaBypassNlEntry()` / `nlRemoveFaBypassNlEntryWithCleanup()`.
4. Netlogin resumes normal authentication for that MAC upon reconnection.

**Process Restart Replay:**
1. On LLDP or Netlogin process restart, `lldpFaBypassNlReplayAllEntries()` re-sends all currently active bypass entries.
2. This ensures the Netlogin bypass whitelist is consistent with LLDP-FA state after failover.

### User Workflow
An administrator enables bypass on a per-client-type basis via CLI or REST/YANG. Once configured, matching FA clients are automatically exempted. The administrator can view bypass status through `show` commands and disable bypass at any time, triggering immediate cleanup of active entries.

### Default Behavior
- Bypass is **disabled by default** for all FA client types (`bypassNl = 0`).
- Upgrading from a pre-34.1.1 configuration (which lacks the `bypassNl` field) results in the default disabled state.
- The global counter `bypassNlCount` starts at 0 and reflects the number of client types with bypass configured.

---

## 3. EXOS IMPLEMENTATION DETAILS

The feature was implemented primarily in commit `f3123132`, spanning the LLDP and Netlogin subsystems within `l2protocol/`.

### Core Functions

| Function | Module | Role |
|----------|--------|------|
| `lldpFaPortNetloginBypass` | `lldp_fa.c` | Core entry point that evaluates whether a discovered FA client type has bypass enabled and initiates the bypass request. |
| `lldpHandleFabricAttachChange` | `lldp_fa.c` | Handles FA state/configuration changes and triggers bypass add/remove processing accordingly. |
| `lldpFaBypassNlDelAllEntries` | `lldp_fa.c` | Removes all bypass entries (on neighbor departure, port down, or config disable) by sending REMOVE IPC to Netlogin. |
| `lldpFaBypassNlReplayAllEntries` | `lldp_fa.c` | Replays all active bypass entries to Netlogin after a process restart for state consistency. |
| `lldpIdMgrDelNbrByPort` | `lldp_fa.c` | Neighbor deletion by port; signature extended with a `bool netlogin` parameter to conditionally trigger Netlogin bypass cleanup. |
| `lldpServerFaBypassNl` | `lldp_server.c` | IPC server-side handler that routes the `LLDP_CLNTSVR_FA_BYPASS_NL` message toward Netlogin. |
| `lldpDMHandler` | `lldp_fa.c` | Data-management handler updated to account for bypass-aware neighbor processing. |
| `nlGetNextFaBypassEntry` | `nl_lldp.c` | Iterates the Netlogin bypass list for display/traversal. |
| `nlIsInFaBypassNlList` | `nl_lldp.c` | Lookup function called during authentication decisions to determine whether a MAC is bypass-whitelisted. |
| `nlRemoveFaBypassNlEntry` | `nl_lldp.c` | Removes a single bypass entry; safe for non-existent entries (no-op, no crash). |
| `nlRecordFaBypassAuthSkip` | `nl_lldp.c` | Records/statistics-tracks the skipping of authentication for a bypassed MAC. |
| `nlHandleFabricAttachBypassNlCB` | `nl_lldp.c` | Callback that processes incoming FA bypass IPC on the Netlogin side. |
| `nlHandleFabricAttachBypassNlFdb` | `nl_lldp.c` | Integrates bypass entries with FDB state (FDB client interaction). |
| `nlRemoveFaBypassNlEntriesByMac` | `nl_lldp.c` | Removes all bypass entries matching a given MAC (handles roaming/duplicate scenarios). |
| `nlRemoveFaBypassNlEntryWithCleanup` | `nl_lldp.c` | Removes a bypass entry and performs associated resource cleanup. |
| `netLoginShowFaBypass_t_get` | `nl_lib.c` | Backing function for the show/REST retrieval of bypass state. |
| `nlDbgDumpFaBypassInfo` | `nl_lldp.c` | Debug dump of the current FA bypass list state. |

### Modified Files

**LLDP subsystem (`l2protocol/lldp/`):**
- `inc/lldp.h`, `inc/lldp_fa.h`, `inc/lldp_ipc.h` ΓÇö Header declarations for new structs, IPC opcode, and constants.
- `src/lldp_fa.c` ΓÇö Core FA bypass logic, neighbor lifecycle, replay, and cleanup.
- `src/lldp_server.c` ΓÇö IPC server routing for `LLDP_CLNTSVR_FA_BYPASS_NL`.
- `src/lldp_cm.c` ΓÇö Configuration manager handling of the new CLI option.
- `src/lldp_db.c` ΓÇö Persistence (config save/restore) of the `bypassNl` field.
- `src/lldp_main.c` ΓÇö Process init and replay hook on restart.
- `src/lldp_lib.c`, `src/lldp_clientlib.c` ΓÇö Library and client-side IPC helpers.
- `src/lldp.cli`, `src/lldp_cli.py`, `src/lldp.yang` ΓÇö CLI, Python CLI handler, and YANG model surface for the new configuration.

**Netlogin subsystem (`l2protocol/netlogin/`):**
- `inc/netLogin.h`, `inc/nl_lldp.h` ΓÇö New `nlBypassNlEntry_s` struct and FA bypass API declarations.
- `src/nl_lldp.c` ΓÇö Core bypass list management, lookup, callbacks, and FDB integration.
- `src/nl_cm.c`, `src/nl_lib.c`, `src/nl_main.c` ΓÇö Config manager, library, and process init handling.
- `src/netLogin.cli`, `src/netLogin.yang` ΓÇö Netlogin CLI and YANG surface for bypass visibility.

**Release manifest (commit `0f28f047`):**
- `exos_core/code/artifactory_manifest` ΓÇö Bumped the REST API/Instant Port component (version 1.4.14.3) that fixed VLAN action ordering in the Instant Port PUT path, ensuring FA ZTC bypass clients receive correct VLAN assignments.

### Data Structures

**`faZeroTouchClient_s` (lldp_fa.h)** ΓÇö extended with new field:
```c
typedef struct faZeroTouchClient_s {
    uint16_t vlanId;
    uint32_t vlanIfInstance;
    uint32_t nsi;
    uint8_t  priority;
    uint8_t  enabled;
    uint8_t  bypassNl;   /* NEW: 1 = bypass netlogin auth for this client type */
} faZeroTouchClient_t;
```
The new field is added at the end of the struct to minimize ABI risk; config save/restore in `lldp_db.c` handles the new field with a default of 0.

**`_lldpFaGlobalData` (lldp_fa.h)** ΓÇö added `bypassNlCount`:
```c
typedef struct _lldpFaGlobalData {
    /* ... existing fields ... */
    faZeroTouchClient_t zeroTouchClients[FA_NUM_CLIENT_TYPES];
    uint8_t bypassNlCount;   /* NEW: number of client types with bypass configured */
} lldpFaGlobalData_t;
```
`bypassNlCount` is incremented/decremented as bypass is enabled/disabled per client type and is floor-guarded at 0.

**`nlBypassNlEntry_s` (netLogin.h / nl_lldp.h)** ΓÇö NEW struct storing MAC addresses of FA ZTC clients granted bypass, maintained as a linked list in the Netlogin process. Queried by `nlIsInFaBypassNlList()`.

**`lldpFaBypassNlMsg_s`** ΓÇö NEW IPC message struct carrying MAC, port, and client type for the `LLDP_CLNTSVR_FA_BYPASS_NL` path.

**Additional modified structs:** `idmCallbackData_s` (ID Manager callback now carries Netlogin awareness), `lldpFaNeighborMsg_s` (extended with bypass state), `lldpLibAttr_s` (new config attribute), `_lldpFaPortStats` (bypass event statistics), `_avex_element_tlv` (FA Element TLV parsing for client type recognition), `ethhdr_vlan`.

### IPC / Inter-Process Communication

| Constant | Direction | Purpose |
|----------|-----------|---------|
| `LLDP_CLNTSVR_FA_BYPASS_NL` | LLDP ΓåÆ Netlogin | Add / Remove / Replay bypass entry for FA client MAC |

Operation subtypes carried in the message use the `CLIENT`, `REMOVE`, and `GET_FA_ZTC` enum values.

### New Constants / Enums
- `LLDP_CLNTSVR_FA_BYPASS_NL` ΓÇö IPC opcode for bypass operations.
- `FANEIGHBOR_T_SET_VALID` ΓÇö Validation flag for FA neighbor messages.
- `FAZTCCFG_T_SET_VALID` / `FAZTCCFG_T_IS_VALID` ΓÇö Config validation macros for ZTC bypass.
- `FA_NUM_CLIENT_TYPES` ΓÇö Total number of configurable client types (array bound).
- `FA_ELEMENT_MIN_CLIENT_TYPE` ΓÇö Minimum valid client type value.
- `IS_FA_ZTC_ACTIVE`, `IS_FA_CLIENT`, `FA_MODE_CLIENT` ΓÇö FA mode/role checks.
- `LLDP_LIB_TRACE`, `TLV_TYPE_AVEX_FA_ELEMENT_NONE`, `FDB_CLIENT_ERROR`.

### Algorithm ΓÇö Bypass Entry Lifecycle
```
FA Neighbor Detected (LLDP-FA TLV parsed via _avex_element_tlv)
  ΓåÆ lldpProcessFaElement()
  ΓåÆ validate client type in [FA_ELEMENT_MIN_CLIENT_TYPE, FA_NUM_CLIENT_TYPES)
  ΓåÆ check faZeroTouchClient_t[clientType].bypassNl == 1
  ΓåÆ IF true: lldpFaPortNetloginBypass()
             ΓåÆ lldpServerFaBypassNl()
             ΓåÆ IPC LLDP_CLNTSVR_FA_BYPASS_NL (ADD)
             ΓåÆ nlHandleFabricAttachBypassNlCB()
             ΓåÆ MAC stored in nlBypassNlEntry_s
             ΓåÆ nlRecordFaBypassAuthSkip()

FA Neighbor Departs / Config disabled / TTL aging
  ΓåÆ lldpIdMgrDelNbrByPort(portInstance, netlogin=true)
  ΓåÆ lldpFaBypassNlDelAllEntries()
  ΓåÆ IPC LLDP_CLNTSVR_FA_BYPASS_NL (REMOVE)
  ΓåÆ nlRemoveFaBypassNlEntryWithCleanup()

LLDP or Netlogin restart
  ΓåÆ lldpFaBypassNlReplayAllEntries()
  ΓåÆ Re-sends all active entries to Netlogin
```

---

## 4. SUPPORTED ATTRIBUTES AND PARAMETERS

| Parameter | Description | Valid Range / Values | Default |
|-----------|-------------|----------------------|---------|
| `bypassNl` | Per-client-type bypass toggle (`faZeroTouchClient_t.bypassNl`) | on / off (0/1) | off (disabled) |
| FA client type | Selects which ZTC client type the bypass applies to | `FA_ELEMENT_MIN_CLIENT_TYPE` .. `FA_NUM_CLIENT_TYPES - 1` | N/A |
| `bypassNlCount` | Read-only global count of client types with bypass active | 0 .. `FA_NUM_CLIENT_TYPES` | 0 |
| VLAN ID (ZTC) | VLAN provisioned by ZTC (unaffected by bypass) | 1ΓÇô4094 | per ZTC config |
| NSI / ISID | Network Service Identifier for FA attach | per FA config | per ZTC config |
| Priority | ZTC assignment priority | 0ΓÇô7 | per ZTC config |

### Notes
- Bypass affects **authentication only** ΓÇö VLAN/ISID/NSI provisioning continues regardless of bypass state.
- The feature is local configuration; no new TLV attributes are added to the FA protocol.
- No additional license is required beyond standard FA and Netlogin support.
- Applicable on platforms supporting Fabric Attach ZTC and Netlogin.

---

## 5. CLI COMMANDS AND SYNTAX

> Command syntax is derived from the modified `lldp.cli`, `lldp_cli.py`, and `lldp.yang`. Exact keyword tokens follow standard EXOS LLDP-FA command structure.

### Configuration Commands
```
# Enable netlogin bypass for a specific FA zero-touch client type
configure lldp ports <port_list> fabric-attach \
    zero-touch-client <client-type> bypass-netlogin on

# Disable netlogin bypass for a specific FA zero-touch client type
configure lldp ports <port_list> fabric-attach \
    zero-touch-client <client-type> bypass-netlogin off

# Reset FA configuration (bypass returns to default disabled)
unconfigure lldp ports <port_list> fabric-attach
```

### Show Commands
```
# Display FA zero-touch client configuration including bypass state
show lldp fabric-attach zero-touch-client

# Detailed view showing per-client-type bypass-netlogin status
show lldp fabric-attach zero-touch-client detail

# Display Netlogin bypass whitelist entries (FA-granted MACs)
show netlogin fabric-attach bypass
```

### Example Output
```
# show lldp fabric-attach zero-touch-client detail
Port: 1:1
  Client Type       VLAN   NSI     Priority  Enabled  Bypass-Netlogin
  ----------------  -----  ------  --------  -------  ---------------
  IP-Phone          100    10100   6         Yes      Enabled
  Camera            200    10200   4         Yes      Disabled
  AP                300    10300   5         Yes      Enabled

Bypass-Netlogin Client Types Configured: 2
```

```
# show netlogin fabric-attach bypass
Port    MAC Address        Client Type   Auth Skipped
------  -----------------  ------------  ------------
1:1     00:11:22:33:44:55  IP-Phone      Yes
1:1     00:11:22:33:44:66  AP            Yes
```

### Debug Commands
```
# Debug dump of the FA bypass list (backed by nlDbgDumpFaBypassInfo)
debug netlogin show fabric-attach bypass-info
```

### Configuration Persistence
The `bypassNl` field is serialized/deserialized in `lldp_db.c`. Configurations are preserved across `save configuration` and reboot. Legacy configs without the field default cleanly to disabled.

---

## 6. FEATURE INTERACTIONS

### Netlogin (802.1X / MAC-based / Web-based)
- The bypass list is consulted (via `nlIsInFaBypassNlList()`) **before** any authentication is initiated.
- In **802.1X mode**, the EAP exchange is skipped for bypassed MACs.
- In **MAC-based mode**, the RADIUS lookup is skipped.
- In **web-redirect mode**, redirection is prevented and access granted immediately.
- If Netlogin is disabled on a port, FA operates normally with no error.

### Fabric Attach (Server / Proxy / Client modes)
- Bypass logic operates on the ZTC (client) side. FA server-side processing is unaffected.
- ZTC VLAN/ISID provisioning proceeds independently of bypass state.

### ID Manager
- `lldpIdMgrDelNbrByPort()` now carries a `bool netlogin` parameter. All call sites were updated to pass the correct value so that bypass cleanup is triggered only where appropriate (`netlogin=true` for bypass-enabled cleanup, `false` otherwise).

### FDB (Forwarding Database)
- `nlHandleFabricAttachBypassNlFdb()` integrates bypass entries with FDB state, ensuring the bypassed MAC's forwarding is consistent with the granted access.

### VLAN Management
- FA ZTC continues to provision VLANs; bypass only affects authentication, never VLAN assignment.

### REST API / Instant Port
- YANG changes (`lldp.yang`, `netLogin.yang`) expose bypass state over NETCONF/RESTCONF.
- Commit `0f28f047` bumped the Instant Port REST component (v1.4.14.3) to fix VLAN action ordering in PUT operations, ensuring FA ZTC bypass clients receive correct VLAN assignments through REST-driven provisioning.

### MLAG / Stacking
- Bypass entries must be created on the correct switch/stack unit where the FA neighbor resides. Entries are local to the discovering unit.

### EAPS / EAPS Shared Port
- EAPS-induced port state changes affect LLDP neighbor lifecycle. When an EAPS topology change causes a port down/up, associated bypass entries are cleaned up via the neighbor departure path.

---

## 7. OPERATIONAL CHARACTERISTICS

### Performance and Scalability
- Bypass lookups (`nlIsInFaBypassNlList()`) are performed on authentication decisions; the list is sized to accommodate typical FA client density per port.
- Multiple FA neighbors on the same port each receive individual bypass entries.
- `nlRemoveFaBypassNlEntriesByMac()` handles roaming (same MAC on a new port) by cleaning the old entry before creating the new one.

### Resource Utilization
- Each bypass entry consumes a `nlBypassNlEntry_s` node in the Netlogin process.
- `_lldpFaPortStats` tracks bypass events per port for visibility.
- The global `bypassNlCount` provides an at-a-glance count of active bypass-enabled client types.

### High Availability / Process Restart
- On LLDP or Netlogin process restart, `lldpFaBypassNlReplayAllEntries()` re-establishes all bypass entries, minimizing the traffic-interruption window.
- If LLDP dies abnormally without replay firing, stale entries are avoided through Netlogin's own cleanup on IPC channel loss.

### Timing / Convergence
- Bypass activation occurs upon FA Element TLV reception and validation (LLDP receive processing).
- Removal is immediate upon neighbor departure, TTL aging, or config disable.

### Counter / State Synchronization
- `bypassNlCount` is incremented/decremented in lockstep with `bypassNl` flag changes and floor-guarded at 0 to prevent underflow.

### Logging
- Authentication skip events are recorded by `nlRecordFaBypassAuthSkip()`.
- Debug state is available via `nlDbgDumpFaBypassInfo()`.

---

## 8. SPECIAL BEHAVIORS AND EDGE CASES

- **Default disabled:** All client types default to `bypassNl = 0`; no bypass occurs unless explicitly configured.
- **Legacy config upgrade:** Pre-34.1.1 configs lack the `bypassNl` field; on load, `lldp_db.c` defaults it to disabled, preserving all other ZTC settings (vlanId, nsi, priority, enabled).
- **Invalid client type:** CLI rejects out-of-range client types. TLV-received client types are bounds-checked against `FA_ELEMENT_MIN_CLIENT_TYPE` and `FA_NUM_CLIENT_TYPES` to prevent out-of-bounds array indexing into `zeroTouchClients[]`.
- **Non-existent removal:** `nlRemoveFaBypassNlEntry()` is a safe no-op when the target MAC is not presentΓÇöno crash or assertion.
- **Count underflow protection:** `bypassNlCount` is guarded so it never goes negative even on error paths.
- **TTL aging vs link-down:** Both LLDP neighbor TTL expiry and physical link-down trigger the same cleanup path via `lldpIdMgrDelNbrByPort(port, netlogin=true)`.
- **Roaming MAC:** When the same MAC appears on a different port, `nlRemoveFaBypassNlEntriesByMac()` clears the old entry before a new one is created.
- **Global disable:** Disabling FA or LLDP globally cleans up all associated bypass entries.
- **Malformed FA TLV:** A truncated or invalid FA Element TLV (`TLV_TYPE_AVEX_FA_ELEMENT_NONE`) is handled gracefullyΓÇöno bypass entry is created.
- **IPC loss:** If a bypass ADD IPC is lost, the FA client falls back to normal Netlogin auth; if a REMOVE is lost, replay/cleanup mechanisms reconcile the state.

---

## 9. CONFIGURATION EXAMPLES

### Example 1: Basic ΓÇö Bypass for IP Phones on Access Ports
```
# Ensure LLDP is enabled
enable lldp ports 1:1-1:24

# Enable FA on the ports (ZTC client mode)
configure lldp ports 1:1-1:24 fabric-attach

# Enable Netlogin (MAC-based) on the access ports
enable netlogin mac
enable netlogin ports 1:1-1:24 mac

# Bypass Netlogin for IP-Phone FA client type
configure lldp ports 1:1-1:24 fabric-attach \
    zero-touch-client IP-Phone bypass-netlogin on

# Verify
show lldp fabric-attach zero-touch-client detail
show netlogin fabric-attach bypass
```

### Example 2: Selective Bypass ΓÇö Trust Phones and APs, Authenticate Cameras
```
# Bypass enabled for trusted infrastructure
configure lldp ports 2:1-2:48 fabric-attach \
    zero-touch-client IP-Phone bypass-netlogin on
configure lldp ports 2:1-2:48 fabric-attach \
    zero-touch-client AP bypass-netlogin on

# Cameras must still authenticate (leave bypass off - default)
configure lldp ports 2:1-2:48 fabric-attach \
    zero-touch-client Camera bypass-netlogin off

# 802.1X for non-bypassed devices
enable netlogin dot1x
enable netlogin ports 2:1-2:48 dot1x
enable radius netlogin

# Verify configured count and per-type state
show lldp fabric-attach zero-touch-client detail
```

### Example 3: Disable Bypass While Clients Are Active (Immediate Cleanup)
```
# Currently bypass is active with connected phones
show netlogin fabric-attach bypass

# Disable bypass; lldpFaBypassNlDelAllEntries() removes active entries,
# Netlogin auth resumes for those MACs on reconnect
configure lldp ports 1:1-1:24 fabric-attach \
    zero-touch-client IP-Phone bypass-netlogin off

# Confirm the bypass list is empty
show netlogin fabric-attach bypass
```

---

## 10. VERIFICATION AND MONITORING

### Verify Configuration
```
show lldp fabric-attach zero-touch-client detail
```
Confirm the `Bypass-Netlogin` column reflects `Enabled` for intended client types and that "Bypass-Netlogin Client Types Configured" matches expectations (`bypassNlCount`).

### Verify Active Bypass Entries
```
show netlogin fabric-attach bypass
```
Each connected FA client of a bypass-enabled type should appear with `Auth Skipped: Yes`. This validates `nlIsInFaBypassNlList()` and `nlRecordFaBypassAuthSkip()` operation.

### Verify Netlogin Session Behavior
```
show netlogin session
show netlogin port <port>
```
For bypassed MACs, no authentication session (802.1X/MAC/web) should be createdΓÇöaccess is granted directly.

### Debug / Deep Inspection
```
debug netlogin show fabric-attach bypass-info
```
Backed by `nlDbgDumpFaBypassInfo()` ΓÇö dumps the internal `nlBypassNlEntry_s` list for troubleshooting.

### What to Check
- **Bypass creation:** FA client of bypass-enabled type gains access without auth challenge; MAC appears in `show netlogin fabric-attach bypass`.
- **Bypass cleanup:** After neighbor departure/TTL aging, MAC is removed from the list; reconnection triggers normal auth.
- **Counter consistency:** `bypassNlCount` in `show lldp fabric-attach zero-touch-client detail` matches the number of enabled client types.
- **Replay after restart:** After LLDP/Netlogin process restart, `show netlogin fabric-attach bypass` still lists active entries (confirms `lldpFaBypassNlReplayAllEntries()`).
- **VLAN provisioning:** Bypassed clients still receive correct VLAN assignment (confirm via `show vlan` / FDB).

### Test Module Alignment
This feature is validated by the following recommended test modules:
- **LLDP** ΓÇö FA TLV processing, neighbor lifecycle, port events.
- **LLDP_MED** ΓÇö regression to ensure MED TLV processing is unaffected.
- **EAPS** and **EAPS_Shared_Port** ΓÇö port state change interaction with bypass cleanup.
- Additional critical coverage: **Fabric Attach (FA ZTC)**, **Netlogin** (all auth modes), and **REST API / Instant Port** (per commit `0f28f047`).

Test keywords: `lldp`, `neighbor`, `discovery`, `tlv`, `bypass`, `netlogin`, `fabric-attach`.
