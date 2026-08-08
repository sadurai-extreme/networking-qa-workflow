# Fabric Attach Zero-Touch-Client (ZTC) Netlogin Bypass ΓÇö Skill File

**Feature ID:** EXOS-39369
**Release:** EXOS 34.1.1
**Feature Type:** Enhancement (Fabric Attach / Network Login integration)
**Primary Modules:** LLDP/FA (`lldp_fa.c`), Network Login (`nl_lldp.c`)
**Commit References:** `f3123132` (core implementation), `0f28f047` (companion REST/Instant Port fix)

---

## 1. FEATURE OVERVIEW

### Description

This feature introduces a **per-client-type configurable option** in the Fabric Attach (FA) Zero-Touch-Client (ZTC) framework that allows specific FA client types to **bypass Network Login (netlogin) authentication**. Fabric Attach already validates and provisions attached devices through the FA protocol (LLDP-based signaling); this enhancement removes the redundant requirement that such FA-provisioned clients additionally complete 802.1X, MAC-based, or Web-based netlogin authentication.

The feature was implemented primarily in commit `f3123132` (Amudhavalli Narayanan, Jul 7 2026) touching the LLDP/FA and Network Login modules, with a companion REST API/Instant Port fix in commit `0f28f047` (Glenn Swanbon).

### Purpose and Business Value

- **Resolves an operational conflict**: Prior to this feature, when netlogin was enabled on an FA-enabled port, FA ZTC clients were still challenged by netlogin even though FA already authorized them ΓÇö often blocking legitimate FA-provisioned devices.
- **Selective granularity**: Bypass is applied **per FA client type**, not globally, so administrators can exempt trusted FA client categories while still enforcing netlogin for others.
- **Coexistence**: Enables FA ZTC and Network Login to operate simultaneously on the same port without mutual interference.

### Use Cases and Target Scenarios

- Deployments where FA ZTC provisions IP phones, wireless APs, or cameras that should not be subjected to secondary netlogin authentication.
- Mixed-access edge ports carrying both FA-signaled ZTC clients (bypass) and unmanaged endpoints (still netlogin-authenticated).
- SPB/Fabric Connect edge attachment where FA already performs device validation.

### Related Standards and Protocols

- **IEEE 802.1ab** ΓÇö LLDP (transport for Fabric Attach TLVs)
- **IEEE 802.1aq** ΓÇö Shortest Path Bridging (SPB)
- **IEEE 802.1X**, **MAC-based**, and **Web-based** Network Login authentication
- **Fabric Attach** proprietary LLDP organizational TLV extensions (AVEX FA element TLVs)

### Prerequisites and Dependencies

- LLDP must be enabled on participating ports.
- Fabric Attach must be enabled and configured with Zero-Touch-Client entries.
- Network Login must be enabled on the port for the bypass logic to be meaningful.
- Default behavior: `bypassNl = 0` (bypass disabled), preserving pre-34.1.1 behavior for backward compatibility.

---

## 2. FUNCTIONAL DESCRIPTION

### Core Functionality

The feature allows each FA Zero-Touch-Client type entry to carry a **bypass-netlogin** flag. When enabled, FA ZTC clients matching that client type ΓÇö as discovered through Fabric Attach LLDP signaling ΓÇö are automatically added to a **Network Login bypass list**, exempting them from authentication challenges.

### Step-by-Step Operational Flow

1. **Configuration**: Administrator configures `bypass-netlogin` on a specific FA ZTC client type. This sets the `bypassNl` field in the corresponding `faZeroTouchClient_t` structure and increments the global `bypassNlCount` reference counter in `lldpFaGlobalData_t`.

2. **FA Client Detection**: When an FA ZTC client is discovered via LLDP FA element TLVs, `lldpHandleFabricAttachChange()` processes the neighbor change.

3. **Bypass Evaluation**: The handler checks whether `bypassNl` is enabled for the discovered client type. If yes, `lldpFaPortNetloginBypass()` prepares a bypass entry.

4. **IPC Notification**: `lldpServerFaBypassNl()` sends an IPC message of type `LLDP_CLNTSVR_FA_BYPASS_NL` from the LLDP process to the Network Login process, carrying the port, MAC, and client-type identity.

5. **Bypass List Insertion**: On the netlogin side, `nlHandleFabricAttachBypassNlCB()` (and FDB companion `nlHandleFabricAttachBypassNlFdb()`) processes the message. `nlIsInFaBypassNlList()` guards against duplicates before adding a new `nlBypassNlEntry_t`.

6. **Authentication Skip**: When traffic from the exempted MAC is seen, netlogin recognizes it via the bypass list and skips authentication. `nlRecordFaBypassAuthSkip()` records the skip for accounting/visibility.

7. **Client Removal**: When the FA neighbor times out or the port goes down, `lldpIdMgrDelNbrByPort(portInstance, netlogin=TRUE)` triggers cleanup. `nlRemoveFaBypassNlEntry()` / `nlRemoveFaBypassNlEntriesByMac()` remove the exemption so the MAC is re-subjected to authentication on next appearance.

### User Workflow

- Administrator enables FA and configures ZTC client entries.
- Administrator selectively enables `bypass-netlogin` on specific client types.
- The switch automatically manages bypass entries as FA clients connect and disconnect ΓÇö **no per-client manual action required**.
- Administrator monitors bypass state via `show` commands.

### State Transitions and Lifecycle

```
[No Bypass Config] --configure bypass-netlogin--> [Bypass Enabled, bypassNlCount++]
[FA Client Detected + bypass enabled] --IPC--> [Bypass Entry Active in Netlogin]
[Neighbor Timeout / Port Down] --IPC REMOVE--> [Bypass Entry Removed]
[bypass-netlogin disabled] --DelAllEntries--> [All entries for type removed, bypassNlCount--]
```

### Default Behavior

- `bypassNl` defaults to `0` (disabled) for every client type.
- With no bypass configured, `bypassNlCount == 0` and **no bypass IPC messages are generated**, ensuring zero behavioral change from prior releases.

---

## 3. EXOS IMPLEMENTATION DETAILS

The feature is implemented across the **LLDP/FA module** (originating side) and the **Network Login module** (enforcement side), communicating over EXOS inter-process IPC. Core implementation was delivered in commit `f3123132`.

### Core Functions

#### LLDP/FA Side (`lldp_fa.c`, `lldp_server.c`, `lldp_main.c`)

- **`lldpFaPortNetloginBypass()`** ΓÇö Central function that evaluates a discovered FA ZTC client and determines whether it should be added to the netlogin bypass list based on the client type's `bypassNl` flag. Prepares the bypass entry data.
- **`lldpHandleFabricAttachChange()`** ΓÇö Processes FA neighbor state changes (client appear/disappear); invokes bypass logic when a bypass-enabled client type is detected or removed.
- **`lldpServerFaBypassNl()`** ΓÇö Server-side handler that constructs and transmits the `LLDP_CLNTSVR_FA_BYPASS_NL` IPC message to the Network Login process.
- **`lldpFaBypassNlReplayAllEntries()`** ΓÇö Replays all currently active bypass entries to netlogin. Used after process restart, HA switchover, or netlogin process restart to rebuild bypass state.
- **`lldpFaBypassNlDelAllEntries()`** ΓÇö Bulk-deletes all bypass entries; invoked when FA is disabled globally or bypass-netlogin is unconfigured.
- **`lldpIdMgrDelNbrByPort()`** ΓÇö **Signature changed** to accept a new `bool netlogin` parameter. When `TRUE`, neighbor removal also triggers netlogin bypass entry cleanup. All call sites were updated accordingly.
  ```c
  // OLD: void lldpIdMgrDelNbrByPort(portInstance_t portInstance);
  // NEW: void lldpIdMgrDelNbrByPort(portInstance_t portInstance, bool netlogin);
  ```
- **`lldpDMHandler()`** ΓÇö Dispatch/message handler updated to process the new bypass IPC opcode.

#### Network Login Side (`nl_lldp.c`, `nl_lib.c`, `nl_cm.c`, `nl_main.c`)

- **`nlIsInFaBypassNlList()`** ΓÇö Determines whether a given MAC/port is already present in the FA bypass list (prevents duplicate insertions).
- **`nlGetNextFaBypassEntry()`** ΓÇö Iterator for walking the bypass list (used by show commands and replay).
- **`nlRemoveFaBypassNlEntry()`** ΓÇö Removes a single bypass entry.
- **`nlRemoveFaBypassNlEntriesByMac()`** ΓÇö Removes all bypass entries matching a MAC address.
- **`nlRemoveFaBypassNlEntryWithCleanup()`** ΓÇö Removes an entry and performs associated state cleanup (FDB, session).
- **`nlRecordFaBypassAuthSkip()`** ΓÇö Records that authentication was skipped for a bypassed client (for statistics/visibility).
- **`nlHandleFabricAttachBypassNlCB()`** ΓÇö Control-block handler for incoming bypass IPC messages.
- **`nlHandleFabricAttachBypassNlFdb()`** ΓÇö Handles FDB (forwarding database) interaction for bypassed MACs.
- **`netLoginShowFaBypass_t_get()`** ΓÇö Populates show-command output for the bypass list.
- **`nlDbgDumpFaBypassInfo()`** ΓÇö Debug dump of internal bypass state.

### Data Structures

#### `faZeroTouchClient_s` (`lldp_fa.h`)
Extended with a new per-client-type bypass flag:
```c
typedef struct faZeroTouchClient_s {
    uint16_t vlanId;
    uint32_t vlanIfInstance;
    uint32_t nsi;
    uint8_t  priority;
    uint8_t  enabled;
    uint8_t  bypassNl;   /* NEW: 1 = bypass netlogin for this client type */
} faZeroTouchClient_t;
```

#### `_lldpFaGlobalData` (`lldp_fa.h`)
Extended with a reference counter:
```c
typedef struct _lldpFaGlobalData {
    /* ...existing FA global state... */
    faZeroTouchClient_t zeroTouchClients[FA_NUM_CLIENT_TYPES];
    uint8_t  bypassNlCount;   /* NEW: count of client types with bypass-nl */
} lldpFaGlobalData_t;
```
`bypassNlCount` provides an O(1) check for "is any bypass active" without iterating the full client-type array.

#### `lldpFaBypassNlMsg_s` (`lldp_ipc.h`)
New IPC message structure carrying port, MAC, client type, and action (add/`REMOVE`):
```c
typedef struct lldpFaBypassNlMsg_s {
    /* port, MAC, client type, add/remove action */
} lldpFaBypassNlMsg_t;
```

#### `nlBypassNlEntry_s` (`nl_lldp.h`)
New netlogin-side structure representing an active bypass exemption (keyed by port + MAC + client type).

#### `lldpFaNeighborMsg_s`, `idmCallbackData_s`, `_lldpFaPortStats`, `_avex_element_tlv`, `lldpLibAttr_s`, `ethhdr_vlan`
Additional structures updated to support FA neighbor messaging, statistics, and AVEX FA element TLV parsing.

### Key Enums / Constants

| Constant | Purpose |
|---|---|
| `LLDP_CLNTSVR_FA_BYPASS_NL` | New IPC opcode for LLDPΓåÆNetlogin bypass notification |
| `FANEIGHBOR_T_SET_VALID` | Validity flag for FA neighbor entries |
| `FAZTCCFG_T_SET_VALID` / `FAZTCCFG_T_IS_VALID` | ZTC configuration validation flags |
| `FA_NUM_CLIENT_TYPES` | Array bound for `zeroTouchClients[]` |
| `FA_ELEMENT_MIN_CLIENT_TYPE` | Minimum valid FA client type (range enforcement) |
| `GET_FA_ZTC` | IPC action to retrieve ZTC configuration |
| `REMOVE` | IPC action for bypass entry removal |
| `IS_FA_ZTC_ACTIVE`, `IS_FA_CLIENT`, `FA_MODE_CLIENT` | FA operational-mode macros |
| `TLV_TYPE_AVEX_FA_ELEMENT_NONE` | FA element TLV type sentinel |
| `LLDP_LIB_TRACE`, `FDB_CLIENT_ERROR` | Tracing / FDB error handling |

### IPC Architecture

```
CLI / YANG / REST
      Γöé
      Γû╝
LLDP Client Library (lldp_clientlib.c)
      Γöé  IPC
      Γû╝
LLDP Server (lldp_server.c / lldp_fa.c)
      Γöé  IPC: LLDP_CLNTSVR_FA_BYPASS_NL  (add / REMOVE)
      Γû╝
Network Login Process (nl_lldp.c)
      Γöé
      Γû╝
Netlogin Bypass List (nlBypassNlEntry_t) ΓåÆ auth skip for port+MAC
```

### Configuration Persistence

- The new `bypassNl` field is persisted via `lldp_db.c` (database schema extended).
- Configuration management routines in `lldp_cm.c` handle save/restore of the per-client-type bypass state.
- On firmware upgrade from a pre-39369 build, a missing `bypassNl` field defaults to `0`, preserving legacy behavior.

### YANG / NETCONF / RESTCONF

- `lldp.yang` and `netLogin.yang` extended to model the `bypass-netlogin` field for NETCONF/RESTCONF access.
- Companion commit `0f28f047` bumped the REST `artifactory_manifest` (fixing Instant Port PUT VLAN action reordering), relevant when FA ZTC provisions VLANs via the Instant Port / REST mechanism.

---

## 4. SUPPORTED ATTRIBUTES AND PARAMETERS

| Parameter | Description | Valid Range | Default | Persistence |
|---|---|---|---|---|
| `bypass-netlogin` (per client type) | Enables/disables netlogin bypass for an FA ZTC client type | on / off | off (`bypassNl=0`) | Saved in config DB |
| FA client type | The FA ZTC client type entry to which bypass applies | `FA_ELEMENT_MIN_CLIENT_TYPE` .. `FA_NUM_CLIENT_TYPES` | N/A | Saved |
| ZTC VLAN ID | VLAN provisioned for the client type | 1ΓÇô4094 | N/A | Saved |
| ZTC NSI/ISID | Network Service Identifier for FA mapping | Per FA range | N/A | Saved |
| `bypassNlCount` (internal) | Count of client types with bypass enabled | 0 .. `FA_NUM_CLIENT_TYPES` | 0 | Runtime state |

### Platform / License Notes

- Requires FA-capable EXOS platforms supporting Fabric Attach ZTC.
- No additional license beyond existing Fabric Attach and Network Login licensing.
- Bypass entry scale is bounded by `FA_NUM_CLIENT_TYPES` (client-type config) and the number of concurrently discovered FA ZTC clients.

---

## 5. CLI COMMANDS AND SYNTAX

> CLI surface derived from `lldp.cli`, `lldp_cli.py`, and `netLogin.cli` changes in commit `f3123132`.

### Configuration Commands

```
# Enable bypass-netlogin for a specific FA ZTC client type
configure lldp fabric-attach zero-touch-client <client-type> bypass-netlogin on

# Disable bypass-netlogin for a client type
configure lldp fabric-attach zero-touch-client <client-type> bypass-netlogin off

# Remove/unconfigure a ZTC client type (clears bypass state as well)
unconfigure lldp fabric-attach zero-touch-client <client-type>
```

### Show Commands

```
# Display FA ZTC configuration including bypass-netlogin state
show lldp fabric-attach zero-touch-client
show lldp fabric-attach zero-touch-client detail

# Display FA elements and provisioning
show fabric attach elements
show fabric attach assignments

# Display netlogin session/port status (bypassed clients reflected)
show netlogin session
show netlogin port <port>
```

### Example Output

```
# show lldp fabric-attach zero-touch-client detail
FA Zero-Touch-Client Configuration
Client Type   VLAN   NSI/ISID   Priority   Bypass-Netlogin
-----------   ----   --------   --------   ---------------
camera        100    2800100    3          On
ap            200    2800200    5          Off
phone         300    2800300    6          On

Bypass-Netlogin Active Client Types: 2
```

### Debug Commands

```
# Internal bypass list dump (backed by nlDbgDumpFaBypassInfo())
debug netlogin show fa-bypass-info

# LLDP FA tracing (LLDP_LIB_TRACE)
debug lldp show fabric-attach bypass
```

### Persistence Behavior

- Bypass configuration is stored in the configuration database (`lldp_cm.c` / `lldp_db.c`) and survives `save configuration` and reboot.
- Runtime bypass entries (per-client exemptions) are **not** saved ΓÇö they are dynamically rebuilt via `lldpFaBypassNlReplayAllEntries()` after restart/switchover.

---

## 6. FEATURE INTERACTIONS

### Network Login (802.1X / MAC / Web-based)

- The bypass list operates alongside all three netlogin authentication modes. When a client's port+MAC matches a bypass entry, `nlRecordFaBypassAuthSkip()` records the skip and netlogin does not challenge the client.
- **Selective enforcement**: Non-FA clients and FA clients of non-bypass types on the same port continue to be authenticated normally.

### Fabric Attach

- Bypass is tightly coupled to the FA neighbor lifecycle. FA client detection (via AVEX FA element TLVs) drives bypass creation; FA neighbor timeout drives removal.
- Only FA ZTC clients of a configured client type (`IS_FA_ZTC_ACTIVE`, `IS_FA_CLIENT`) are eligible for bypass.

### LLDP

- Bypass signaling rides on the LLDP FA processing path. FA element TLV parsing (`_avex_element_tlv`, `TLV_TYPE_AVEX_FA_ELEMENT_NONE`) identifies client type.
- LLDP neighbor removal (`lldpIdMgrDelNbrByPort` with `netlogin=TRUE`) cascades to bypass cleanup.

### Identity Manager (IdMgr)

- The changed signature of `lldpIdMgrDelNbrByPort()` ties neighbor identity removal to bypass cleanup. FA bypass clients must not be misreported to policy ΓÇö the `lldpReportToPolicy()` path was reviewed so bypassed clients are not flagged as unauthenticated.

### FDB (Forwarding Database)

- `nlHandleFabricAttachBypassNlFdb()` coordinates FDB state for bypassed MACs, ensuring forwarding entries align with the bypass exemption (`FDB_CLIENT_ERROR` handling for failure cases).

### MLAG / High Availability

- On HA switchover, `lldpFaBypassNlReplayAllEntries()` rebuilds bypass state on the new primary. MLAG ISC-triggered LLDP replays coordinate bypass entry re-establishment.

### Instant Port / REST API

- Companion commit `0f28f047` fixes VLAN action reordering in Instant Port PUT operations, ensuring FA ZTC VLAN provisioning via REST is not disrupted (REST manifest version bump).

---

## 7. OPERATIONAL CHARACTERISTICS

### Performance

- The `bypassNlCount` counter provides O(1) determination of whether any bypass is active, preventing unnecessary IPC generation when no bypass is configured (zero overhead in default deployments).
- Bypass list lookups (`nlIsInFaBypassNlList()`) guard against duplicate insertion, keeping list operations efficient.

### Scalability

- Configuration scale is bounded by `FA_NUM_CLIENT_TYPES`.
- Runtime bypass entries scale with the number of concurrently discovered FA ZTC clients across bypass-enabled types.
- Rapid connect/disconnect (bypass entry churn) is handled through the add/`REMOVE` IPC lifecycle.

### Resource Utilization

- Minimal additional memory: one `uint8_t bypassNl` per client type and one `uint8_t bypassNlCount` global on the LLDP side; one `nlBypassNlEntry_t` per active exemption on the netlogin side.

### High Availability / Recovery

- **LLDP process restart**: `lldpFaBypassNlReplayAllEntries()` restores bypass entries.
- **Netlogin process restart**: LLDP replays bypass state so the netlogin bypass list is rebuilt.
- **HA switchover**: Replay mechanism re-establishes bypass entries on the new active MSM/node.
- **Config restore**: Bypass configuration persists; runtime entries are reconstructed dynamically.

### Logging / Visibility

- `nlRecordFaBypassAuthSkip()` records authentication skips for bypassed clients (visible in netlogin statistics).
- `nlDbgDumpFaBypassInfo()` and LLDP tracing (`LLDP_LIB_TRACE`) provide diagnostic output.

---

## 8. SPECIAL BEHAVIORS AND EDGE CASES

- **Retroactive application**: Configuring `bypass-netlogin` after an FA client is already connected applies the bypass to the already-present client.
- **Live disable**: Disabling `bypass-netlogin` while a client is connected removes the exemption and re-subjects the client to netlogin authentication.
- **No FA neighbor present**: Configuring bypass when no matching FA neighbor exists is handled gracefully ΓÇö the flag is stored and applied when a matching client appears.
- **Empty-list cleanup**: `lldpFaBypassNlDelAllEntries()` on an empty list is a safe no-op.
- **Netlogin process down**: Bypass IPC messages are handled gracefully when the netlogin process is unavailable; state is replayed once it returns.
- **Backward compatibility**: Default `bypassNl=0` ensures identical behavior to pre-34.1.1 for existing configurations.
- **Upgrade path**: Databases from pre-39369 firmware without the `bypassNl` field default the value to `0`.
- **Signature change risk**: The `lldpIdMgrDelNbrByPort()` `netlogin` parameter must be correct at every call site ΓÇö `TRUE` on port-down/neighbor-timeout paths (to clean bypass), `FALSE` where bypass cleanup should not occur.
- **Security scoping**: Bypass entries are keyed by port + MAC (+ client type), applied only where the FA client was detected ΓÇö a non-FA device cannot spoof FA TLVs to obtain global bypass, and exemptions are removed on FA TLV cessation.
- **Race window**: Enabling/disabling bypass while clients are actively connecting is managed through the ordered add/`REMOVE` IPC sequence.

---

## 9. CONFIGURATION EXAMPLES

### Example 1: Basic Bypass for a Single Client Type

```
# Enable LLDP and Fabric Attach
enable lldp ports 1:1-1:24
configure lldp fabric-attach mode client ports 1:1-1:24

# Configure a ZTC client type with VLAN/NSI provisioning
configure lldp fabric-attach zero-touch-client camera vlan 100 nsi 2800100

# Enable netlogin bypass for the camera client type
configure lldp fabric-attach zero-touch-client camera bypass-netlogin on

# Enable MAC-based netlogin on the same ports
enable netlogin mac
enable netlogin ports 1:1-1:24 mac

# Verify
show lldp fabric-attach zero-touch-client detail
```

### Example 2: Mixed Enforcement (Bypass Some, Authenticate Others)

```
# ZTC client types
configure lldp fabric-attach zero-touch-client phone  vlan 300 nsi 2800300
configure lldp fabric-attach zero-touch-client ap     vlan 200 nsi 2800200

# Bypass netlogin only for phones; APs must still authenticate
configure lldp fabric-attach zero-touch-client phone bypass-netlogin on
configure lldp fabric-attach zero-touch-client ap    bypass-netlogin off

# 802.1X netlogin remains active on the port
enable netlogin dot1x
enable netlogin ports 2:1-2:48 dot1x

# Result:
#  - Phones (FA ZTC, bypass on)  -> skip authentication
#  - APs    (FA ZTC, bypass off) -> 802.1X authenticated
#  - Any non-FA endpoint         -> 802.1X authenticated
```

### Example 3: Bypass with HA / Persistence

```
# Configure bypass across multiple client types
configure lldp fabric-attach zero-touch-client camera bypass-netlogin on
configure lldp fabric-attach zero-touch-client phone  bypass-netlogin on

# Save configuration (bypassNl persisted via lldp_cm.c / lldp_db.c)
save configuration

# After reboot or HA switchover, runtime bypass entries are automatically
# replayed by lldpFaBypassNlReplayAllEntries(); configuration is restored.

show lldp fabric-attach zero-touch-client detail
show netlogin session
```

---

## 10. VERIFICATION AND MONITORING

### Show Commands to Verify

```
# Confirm bypass-netlogin state per client type
show lldp fabric-attach zero-touch-client detail

# Confirm FA client detection and provisioning
show fabric attach elements
show fabric attach assignments

# Confirm bypassed clients are not being challenged
show netlogin session
show netlogin port <port>
```

### Expected Indicators

- `show lldp fabric-attach zero-touch-client detail` shows `Bypass-Netlogin: On` for configured types and an active bypass client-type count matching `bypassNlCount`.
- `show netlogin session` shows FA-bypassed MACs **without** an authentication challenge/session, while non-bypass clients show normal auth status.
- FA elements show the client as provisioned/active.

### Statistics and Counters

- Authentication skip events recorded via `nlRecordFaBypassAuthSkip()` ΓÇö visible in netlogin statistics for bypassed clients.
- FA port statistics (`_lldpFaPortStats`) reflect FA client discovery activity.

### Debug / Troubleshooting

```
# Dump internal netlogin bypass list state
debug netlogin show fa-bypass-info        # backed by nlDbgDumpFaBypassInfo()

# LLDP FA bypass tracing
debug lldp show fabric-attach bypass      # LLDP_LIB_TRACE

# Iterate bypass entries programmatically (internal)
#   nlGetNextFaBypassEntry() walks the list
#   nlIsInFaBypassNlList() confirms membership
```

### Common Operational States

| State | Meaning |
|---|---|
| Bypass configured, no FA client | Config stored; no runtime bypass entries yet |
| Bypass active | FA client detected; exemption present; netlogin skipped |
| Bypass removed (timeout/port-down) | `nlRemoveFaBypassNlEntry()` executed; MAC re-authenticated on return |
| Bypass replayed | Entries rebuilt after restart/switchover via `lldpFaBypassNlReplayAllEntries()` |

### Verification Checklist

- [ ] `show lldp fabric-attach zero-touch-client detail` reflects configured bypass state
- [ ] Bypassed FA clients absent from netlogin authentication challenges
- [ ] Non-bypass FA clients and non-FA clients still authenticated
- [ ] Bypass entries removed on neighbor timeout / port down / FA disable
- [ ] Configuration persists across `save configuration` + reboot
- [ ] Bypass entries replayed after LLDP/netlogin restart and HA switchover

---

### Implementation Reference Summary

| Item | Detail |
|---|---|
| Core commit | `f3123132` ΓÇö EXOS-39369, Amudhavalli Narayanan, Jul 7 2026 |
| Companion commit | `0f28f047` ΓÇö EXOS-39627 Instant Port VLAN action fix, Glenn Swanbon |
| Key LLDP files | `lldp_fa.c`, `lldp_server.c`, `lldp_main.c`, `lldp_cm.c`, `lldp_db.c`, `lldp_clientlib.c`, `lldp_lib.c`, `lldp.cli`, `lldp_cli.py`, `lldp.yang`, `lldp_fa.h`, `lldp_ipc.h`, `lldp.h` |
| Key Netlogin files | `nl_lldp.c`, `nl_lib.c`, `nl_cm.c`, `nl_main.c`, `netLogin.h`, `nl_lldp.h`, `netLogin.cli`, `netLogin.yang` |
| Recommended test modules | **LLDP** (primary), **Netlogin**, **FA (Fabric Attach)**, **Identity Manager**, LLDP_MED (coexistence) |
| Test keywords | lldp, neighbor, discovery, tlv, netlogin, fabric-attach, bypass |
