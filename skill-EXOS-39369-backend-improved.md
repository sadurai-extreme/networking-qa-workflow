# Fabric Attach Zero Touch Commissioning — Bypass NetLogin Authentication

## SKILL FILE: FA ZTC Bypass NetLogin (EXOS-39369)

**Feature:** Fabric Attach Zero Touch Commissioning — Per-Client-Type NetLogin Authentication Bypass
**Implementation:** EXOS LLDP/FA Subsystem + NetLogin Module Integration
**Release:** Post-30.x EXOS (introduced via EXOS-39369)
**Status:** Production Feature Enhancement

---

## 1. FEATURE OVERVIEW

### 1.1 High-Level Description

Fabric Attach (FA) Zero Touch Commissioning (ZTC) Bypass NetLogin is a feature enhancement that allows network administrators to configure specific FA client device types to skip NetLogin (Network Login) authentication entirely when connecting to an EXOS switch. Rather than requiring every FA-discovered device to complete a MAC-based, 802.1X, or web-based authentication challenge, designated FA ZTC client types can be pre-authorized to receive immediate network access and VLAN assignment without undergoing a full authentication cycle.

The bypass decision is made at the **FA ZTC client type** level — meaning that a category of device (e.g., IP phones, wireless access points, IP cameras) can be whitelisted as trusted, and all devices of that client type discovered via FA LLDP TLV exchange will automatically bypass the NetLogin authentication gate.

### 1.2 Purpose and Business Value

In enterprise and campus environments using Fabric Attach for automatic device provisioning, requiring every FA-capable device to also complete NetLogin authentication introduces operational overhead and can delay device provisioning. This is particularly impactful in:

- **Zero-touch deployments**: Where managed devices (IP phones, APs, IP cameras) must come online automatically without IT intervention.
- **Trusted device classes**: Where device categories are inherently trusted by organizational policy (e.g., company-issued IP phones in a managed fleet).
- **Large-scale deployments**: Where hundreds of FA clients connect simultaneously and NetLogin RADIUS server load becomes a bottleneck.
- **Simplified onboarding**: Where FA-based VLAN assignment is the primary access control mechanism, and NetLogin is redundant for specific device types.

### 1.3 Use Cases and Target Scenarios

| Use Case | Description |
|---|---|
| IP Phone Auto-Provisioning | IP phones are discovered via FA LLDP, bypass NetLogin, receive voice VLAN automatically |
| Wireless AP Zero-Touch | Campus APs connect, bypass authentication, receive management VLAN and uplink assignment |
| IP Camera Deployment | Surveillance cameras bypass NetLogin, receive dedicated IoT VLAN |
| Mixed Environment | Some device types bypass NetLogin while others (unknown clients) still require authentication |
| RADIUS Offloading | Reduce RADIUS authentication load by exempting known, managed FA device classes |

### 1.4 Related Standards and Protocols

- **IEEE 802.1Qbp (Fabric Attach)**: Defines the FA TLV extensions to LLDP for automatic attachment provisioning
- **IEEE 802.1AB (LLDP)**: Link Layer Discovery Protocol — the carrier for FA TLVs
- **IEEE 802.1X**: Port-Based Network Access Control — the authentication framework that NetLogin can bypass
- **Extreme Networks Avaya FA**: Vendor-specific extension defining FA client types and element TLVs
- **RFC 2865 (RADIUS)**: Remote Authentication Dial-In User Service — bypassed for designated FA client types

### 1.5 Prerequisites and Dependencies

- **Fabric Attach** must be enabled on the switch in Server, Proxy, or appropriate operating mode
- **FA Zero Touch Commissioning** must be configured with at least one active ZTC client type entry
- **NetLogin** must be enabled on the relevant ports (MAC-based mode is the primary interaction mode)
- **LLDP** must be enabled on ports where FA clients connect
- FA-capable client devices must send valid FA Element TLVs in their LLDP PDUs
- EXOS version supporting the `bypassNl` field in `faZeroTouchClient_t` (EXOS-39369 or later)

---

## 2. FUNCTIONAL DESCRIPTION

### 2.1 Core Functionality Overview

The feature introduces a **per-FA-ZTC-client-type bypass flag** (`bypass-netlogin`) that instructs the NetLogin module to skip its authentication challenge for any device whose FA client type matches a configured bypass entry. The LLDP/FA subsystem acts as the authority for bypass decisions; it maintains bypass configuration per client type and communicates active bypass entries to the NetLogin module via IPC.

### 2.2 FA Client Type Concept

Fabric Attach defines a set of standardized client types encoded in the FA Element TLV. Each connected device reports its client type via LLDP advertisement. In EXOS FA ZTC, client types define the class of device and the associated provisioning parameters (VLAN, priority, NSI). Examples of FA client types include:

| Client Type ID | Device Category | Typical Use |
|---|---|---|
| 1 | Switch | Network infrastructure |
| 2 | Router | Layer 3 forwarding device |
| 3 | WLAN Controller | Wireless infrastructure controller |
| 4 | WAP (Wireless Access Point) | Wi-Fi access point |
| 5 | IP Phone | VoIP endpoint |
| 6 | IP Camera | Surveillance/IoT camera |
| 7 | Video Conferencing | VC endpoint |
| 8 | Server | Data center server |

The new `bypass-netlogin` option is configurable independently per client type, allowing granular control over which device categories bypass authentication.

### 2.3 Step-by-Step Operational Flow

#### 2.3.1 Configuration Phase

1. Administrator configures FA ZTC for a client type (e.g., IP Phone) with a VLAN assignment, priority, and NSI value.
2. Administrator additionally enables `bypass-netlogin` for that client type, setting the `bypassNl` flag in the `faZeroTouchClient_t` structure.
3. The `bypassNlCount` counter in `_lldpFaGlobalData` is incremented to track how many client types have bypass enabled.
4. Configuration is persisted to the LLDP/FA configuration database (`lldp_db.c`).

#### 2.3.2 Device Discovery Phase

5. An FA-capable client device connects to a switch port.
6. The device sends LLDP PDUs containing FA Element TLVs that declare the device's FA client type.
7. The LLDP subsystem (`lldp_main.c`) processes the incoming LLDP frame and passes FA TLV data to the FA handling module (`lldp_fa.c`).
8. `lldpHandleFabricAttachChange()` is called to process the new FA neighbor event.

#### 2.3.3 Bypass Activation Phase

9. The FA module checks whether the discovered device's client type has `bypassNl == 1` in the ZTC configuration.
10. If bypass is configured for that client type, `lldpFaPortNetloginBypass()` is called.
11. This function constructs an `lldpFaBypassNlMsg_s` IPC message and sends it to the NetLogin module using the `LLDP_CLNTSVR_FA_BYPASS_NL` message type.
12. The IPC is transmitted via the LLDP client-server inter-process communication channel (`lldp_clientlib.c`, `lldp_server.c`).

#### 2.3.4 NetLogin Bypass Enforcement Phase

13. The NetLogin server receives the `LLDP_CLNTSVR_FA_BYPASS_NL` IPC message via `lldpServerFaBypassNl()`.
14. NetLogin creates an `nlBypassNlEntry_s` record, keyed by MAC address and/or port identifier, and adds it to the bypass list.
15. When the FA client device generates traffic, NetLogin's authentication decision engine calls `nlIsInFaBypassNlList()`.
16. If the device is found in the bypass list, NetLogin skips the authentication challenge entirely.
17. The device proceeds directly to VLAN assignment via the FA ZTC provisioning path.
18. `nlHandleFabricAttachBypassNlFdb()` handles the FDB (Forwarding Database) integration for bypassed clients.

#### 2.3.5 Entry Cleanup Phase

19. When the FA client disconnects or the port goes down, `lldpIdMgrDelNbrByPort(portInstance, netlogin=true)` is called with the `netlogin` flag set to `true`.
20. This triggers `nlRemoveFaBypassNlEntryWithCleanup()` to remove the entry from the NetLogin bypass list.
21. `nlRemoveFaBypassNlEntriesByMac()` handles cleanup by MAC address when appropriate.
22. NetLogin reverts to normal authentication behavior for that port/device.

### 2.4 User Workflow

Administrators interact with the feature through two primary workflows:

**Enabling Bypass for a Client Type:**
```
1. Verify FA ZTC is configured for the client type
2. Enable bypass-netlogin for the client type via CLI
3. Verify bypass flag appears in show output
4. Connect FA device — device should bypass NetLogin
5. Verify show netlogin output reflects bypassed client
```

**Disabling Bypass:**
```
1. Remove bypass-netlogin from the client type configuration
2. Any active bypass entries for that client type are removed from NetLogin
3. FA devices of that type will now be subject to NetLogin authentication
4. Existing authenticated sessions remain until they expire or are cleared
```

### 2.5 State Transitions and Lifecycle

```
FA ZTC Client Type Bypass State Machine:
┌──────────────────────────────────────────────────────────┐
│                    BYPASS NOT CONFIGURED                  │
│              (bypassNl = 0, normal NetLogin)              │
└──────────────────────────────────────────────────────────┘
        │                                    ▲
        │ configure bypass-netlogin          │ unconfigure bypass-netlogin
        ▼                                    │
┌──────────────────────────────────────────────────────────┐
│                  BYPASS CONFIGURED                        │
│              (bypassNl = 1, bypassNlCount++)              │
└──────────────────────────────────────────────────────────┘
        │                                    ▲
        │ FA neighbor detected               │ port down / neighbor removed
        ▼                                    │
┌──────────────────────────────────────────────────────────┐
│                 BYPASS ENTRY ACTIVE                       │
│         (nlBypassNlEntry_s in NetLogin bypass list)       │
└──────────────────────────────────────────────────────────┘

Process Restart Recovery:
  lldpFaBypassNlReplayAllEntries() → IPC → NetLogin re-populates bypass list
```

### 2.6 Default Behaviors and Settings

- **Default state**: `bypass-netlogin` is **disabled (off)** for all FA ZTC client types. All FA clients default to requiring NetLogin authentication.
- **Granularity**: Bypass is configured per FA ZTC client type, not per-port. Any port where an FA device of the configured client type is detected will honor the bypass.
- **Existing Sessions**: Configuring or removing bypass-netlogin does not immediately terminate existing NetLogin sessions. Changes take effect for new authentication events.
- **FA Validation**: The bypass only applies to devices that present valid FA Element TLVs. Devices without valid FA TLVs are not considered for bypass, even if they share a MAC address with an FA-capable device.

---

## 3. EXOS IMPLEMENTATION DETAILS

### 3.1 Software Architecture Overview

The bypass-netlogin feature spans two major EXOS subsystems — the LLDP/FA process and the NetLogin process — connected via EXOS inter-process communication (IPC). The LLDP/FA subsystem is the **configuration and discovery authority**, while the NetLogin subsystem is the **enforcement authority**.

```
┌─────────────────────────────────────────┐
│              LLDP Process               │
│  ┌────────────┐   ┌──────────────────┐  │
│  │  lldp_fa.c │   │  lldp_server.c   │  │
│  │  (FA ZTC   │──►│  (IPC server)    │  │
│  │   logic)   │   └────────┬─────────┘  │
│  └────────────┘            │            │
│  ┌────────────┐   ┌────────▼─────────┐  │
│  │  lldp_db.c │   │  lldp_clientlib.c│  │
│  │ (persist.) │   │  (IPC client)    │  │
│  └────────────┘   └──────────────────┘  │
└─────────────────────────────────────────┘
                         │
          LLDP_CLNTSVR_FA_BYPASS_NL IPC
                         │
┌────────────────────────▼────────────────┐
│             NetLogin Process            │
│  ┌─────────────────────────────────┐   │
│  │  nl_lldp.h / netLogin.h         │   │
│  │  nlHandleFabricAttachBypassNlCB  │   │
│  │  nlIsInFaBypassNlList()          │   │
│  │  nlBypassNlEntry_s list          │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 3.2 Key Modules and Files

| File | Module | Role |
|---|---|---|
| `lldp_fa.c` | LLDP/FA Core | FA ZTC bypass logic, `lldpFaPortNetloginBypass()`, `lldpHandleFabricAttachChange()`, `lldpFaBypassNlDelAllEntries()`, `lldpFaBypassNlReplayAllEntries()` |
| `lldp_fa.h` | LLDP/FA Headers | `faZeroTouchClient_t` struct with `bypassNl` field, `_lldpFaGlobalData` with `bypassNlCount` |
| `lldp_server.c` | LLDP IPC Server | `lldpServerFaBypassNl()` — receives bypass IPC from FA, dispatches to NetLogin |
| `lldp_clientlib.c` | LLDP IPC Client | Client-side IPC transmission of bypass entries |
| `lldp_ipc.h` | LLDP IPC Headers | `LLDP_CLNTSVR_FA_BYPASS_NL` enum, `lldpFaBypassNlMsg_s` message structure |
| `lldp_main.c` | LLDP Main Loop | LLDP PDU processing, event handling |
| `lldp_lib.c` | LLDP Utilities | Shared utility functions for FA/bypass |
| `lldp_cm.c` | LLDP Config Mgmt | Configuration management and validation |
| `lldp_db.c` | LLDP Database | Configuration persistence of `bypassNl` field |
| `lldp.cli` / `lldp_cli.py` | LLDP CLI | Command parsing and dispatch |
| `lldp.yang` | LLDP YANG Model | YANG schema for new `bypass-netlogin` node |
| `netLogin.h` / `nl_lldp.h` | NetLogin Headers | `nlBypassNlEntry_s` struct, `nlIsInFaBypassNlList()`, bypass list management |

### 3.3 Data Structures

#### 3.3.1 `faZeroTouchClient_t` — Enhanced ZTC Client Configuration

```c
typedef struct faZeroTouchClient_s {
    uint16_t vlanId;          /* VLAN ID assigned to this client type */
    uint32_t vlanIfInstance;  /* VLAN interface instance */
    uint32_t nsi;             /* Network Service Identifier */
    uint8_t  priority;        /* 802.1p priority for this client type */
    uint8_t  enabled;         /* ZTC entry enabled flag */
    uint8_t  bypassNl;        /* NEW: 1 = bypass netlogin for this type */
} faZeroTouchClient_t;
```

The `bypassNl` field is the per-client-type bypass flag. When set to `1`, all FA devices reporting this client type will be added to the NetLogin bypass list upon discovery.

#### 3.3.2 `_lldpFaGlobalData` — FA Global State (Enhanced)

```c
/* Relevant field added: */
uint8_t bypassNlCount;   /* Count of ZTC client types with bypassNl=1 */
```

The `bypassNlCount` counter enables fast-path optimization: if `bypassNlCount == 0`, the bypass processing code path is entirely skipped, preventing unnecessary overhead when the feature is not in use.

#### 3.3.3 `lldpFaBypassNlMsg_s` — NEW IPC Message Structure

New IPC message structure for communicating FA bypass entries between the LLDP process and the NetLogin process:

```c
typedef struct lldpFaBypassNlMsg_s {
    /* Message type: ADD or REMOVE */
    /* MAC address of the FA client device */
    /* Port/interface information */
    /* FA client type */
    /* Action: add to bypass list or remove from bypass list */
} lldpFaBypassNlMsg_t;
```

#### 3.3.4 `nlBypassNlEntry_s` — NEW NetLogin Bypass List Entry

Maintained inside the NetLogin process as a runtime list of active FA bypass clients:

```c
typedef struct nlBypassNlEntry_s {
    /* MAC address key */
    /* Port identifier */
    /* FA client type reference */
    /* Timestamp / validity tracking */
    /* Linked list / next pointer for iteration */
} nlBypassNlEntry_t;
```

#### 3.3.5 Modified: `idmCallbackData_s`

The ID Manager callback data structure is extended to carry NetLogin bypass context, enabling correct callback behavior when the ID Manager processes neighbor add/remove events for FA bypass clients.

#### 3.3.6 Modified: `_lldpFaPortStats`

Per-port FA statistics structure is updated to track bypass-specific counters (bypass entries added, removed, replayed).

#### 3.3.7 Modified: `_avex_element_tlv`

The Avaya/Extreme FA Element TLV parsing structure is updated to support the new client type range constants (`FA_ELEMENT_MIN_CLIENT_TYPE`, `FA_NUM_CLIENT_TYPES`).

### 3.4 IPC Message Flow

#### 3.4.1 New IPC Message Type

The enum governing LLDP client-server messages is extended with:

```c
LLDP_CLNTSVR_FA_BYPASS_NL  /* New: FA bypass netlogin notification */
```

This message type is used for both ADD (bypass a new FA client) and REMOVE (revoke bypass for a departing FA client) operations.

#### 3.4.2 IPC Channel Architecture

EXOS processes communicate via a socket-based IPC mechanism. The LLDP process acts as the source of bypass notifications, and the NetLogin process registers as a subscriber/handler via `nlHandleFabricAttachBypassNlCB()`. The `lldp_server.c` module routes incoming `LLDP_CLNTSVR_FA_BYPASS_NL` messages to the appropriate handler.

### 3.5 Key Algorithms

#### 3.5.1 Bypass Decision Algorithm (LLDP/FA Side)

```
FUNCTION lldpHandleFabricAttachChange(port, faNeighborData):
    clientType = faNeighborData.clientType
    ztcEntry = lookupZtcEntry(clientType)
    IF ztcEntry.enabled AND ztcEntry.bypassNl == 1:
        CALL lldpFaPortNetloginBypass(port, faNeighborData, ADD)
    ENDIF
END FUNCTION
```

#### 3.5.2 Bypass Entry Lifecycle — Add

```
FUNCTION lldpFaPortNetloginBypass(port, neighborData, action):
    msg = buildLldpFaBypassNlMsg(port, neighborData.macAddr, action)
    SEND msg via LLDP_CLNTSVR_FA_BYPASS_NL IPC to NetLogin
    UPDATE lldpFaPortStats[port].bypassNlCount
END FUNCTION
```

#### 3.5.3 NetLogin Bypass Check Algorithm

```
FUNCTION nlIsInFaBypassNlList(macAddr, port):
    FOR EACH entry IN bypassNlList:
        IF entry.macAddr == macAddr AND entry.port == port:
            RETURN TRUE  /* Skip authentication */
        ENDIF
    ENDFOR
    RETURN FALSE  /* Proceed with normal authentication */
END FUNCTION
```

#### 3.5.4 Replay Algorithm (HA/Restart Recovery)

```
FUNCTION lldpFaBypassNlReplayAllEntries():
    FOR EACH ztcClientType IN activeZtcClientTypes:
        IF ztcClientType.bypassNl == 1:
            FOR EACH activeNeighbor OF this clientType:
                CALL lldpFaPortNetloginBypass(port, neighbor, ADD)
            ENDFOR
        ENDIF
    ENDFOR
END FUNCTION
```

The replay function ensures that after an LLDP process restart (due to HA failover, process crash, or software upgrade), all active FA bypass entries are re-established in the NetLogin process without requiring FA client devices to reconnect.

#### 3.5.5 Delete All Entries

```
FUNCTION lldpFaBypassNlDelAllEntries():
    /* Sends REMOVE IPC for all active bypass entries */
    /* Called when: FA mode disabled, all ZTC entries removed */
    FOR EACH activeBypassEntry:
        SEND LLDP_CLNTSVR_FA_BYPASS_NL(REMOVE) to NetLogin
    ENDFOR
    RESET bypassNlCount = 0
END FUNCTION
```

### 3.6 `lldpIdMgrDelNbrByPort` — Signature Change

**Pre-enhancement:**
```c
void lldpIdMgrDelNbrByPort(portInstance_t portInstance);
```

**Post-enhancement:**
```c
void lldpIdMgrDelNbrByPort(portInstance_t portInstance, bool netlogin);
```

The `netlogin` boolean parameter controls whether the function triggers NetLogin bypass entry cleanup when deleting neighbor records. All existing call sites must pass the appropriate value:
- `netlogin = true`: Trigger NetLogin bypass entry removal (used when FA neighbor departs)
- `netlogin = false`: Skip NetLogin bypass cleanup (used for internal/non-FA neighbor removal)

### 3.7 Configuration Persistence

The `lldp_db.c` module handles persistence of the `bypassNl` field as part of the FA ZTC client type configuration record. The configuration is saved to the EXOS configuration file (`primary.cfg` / `secondary.cfg`) and restored on system reboot. The YANG schema (`lldp.yang`) defines the `bypass-netlogin` leaf node within the ZTC client type configuration subtree.

### 3.8 YANG Schema Extension

```yang
/* New leaf added to FA ZTC client type configuration: */
leaf bypass-netlogin {
    type boolean;
    default false;
    description "Enable bypass of NetLogin authentication for FA ZTC client type";
}
```

---

## 4. SUPPORTED ATTRIBUTES AND PARAMETERS

### 4.1 FA ZTC Client Type Configuration Parameters

| Parameter | Field Name | Type | Valid Range | Default | Description |
|---|---|---|---|---|---|
| Client Type ID | `clientType` | uint8 | `FA_ELEMENT_MIN_CLIENT_TYPE` to `FA_NUM_CLIENT_TYPES` | — | FA device category identifier |
| VLAN ID | `vlanId` | uint16 | 1–4094 | None | VLAN assigned to this client type |
| VLAN Interface Instance | `vlanIfInstance` | uint32 | System range | — | Internal VLAN reference |
| NSI | `nsi` | uint32 | Valid NSI range | 0 | Network Service Identifier |
| Priority | `priority` | uint8 | 0–7 | 0 | 802.1p priority for traffic |
| Enabled | `enabled` | uint8 | 0, 1 | 0 (disabled) | ZTC entry active state |
| **Bypass NetLogin** | **`bypassNl`** | **uint8** | **0 (off), 1 (on)** | **0 (off)** | **NEW: Skip NetLogin authentication** |

### 4.2 Global FA Bypass Parameters

| Parameter | Field Name | Type | Description |
|---|---|---|---|
| Bypass Count | `bypassNlCount` | uint8 | Count of ZTC client types with bypass enabled. Incremented on configure, decremented on unconfigure. Used for fast-path skip when no bypass is active. |

### 4.3 NetLogin Bypass List Entry Parameters

| Parameter | Description |
|---|---|
| MAC Address | Device MAC address — primary lookup key |
| Port Identifier | Physical port or LAG where FA client is connected |
| FA Client Type | Originating client type reference |
| Entry State | Active/pending removal |

### 4.4 Supported FA Client Types (for bypass configuration)

The `bypass-netlogin` option is supported for all FA ZTC client types defined in the range `[FA_ELEMENT_MIN_CLIENT_TYPE, FA_NUM_CLIENT_TYPES]`. This includes all standard FA client categories (switch, router, WAP, IP phone, IP camera, etc.) as well as any vendor-specific extensions supported by EXOS FA.

### 4.5 Platform Support

The feature is supported on all EXOS platforms that support Fabric Attach Zero Touch Commissioning. Platform-specific hardware table sizes may affect the maximum number of concurrent bypass entries:

| Platform Category | FA ZTC Support | Bypass NetLogin Support | Notes |
|---|---|---|---|
| ExtremeSwitching 5520 | Yes | Yes | Full support |
| ExtremeSwitching 5720 | Yes | Yes | Full support |
| ExtremeSwitching X465 | Yes | Yes | Full support |
| ExtremeSwitching X435 | Yes | Yes | Full support |
| ExtremeSwitching X620 | Yes | Yes | Full support |
| SummitStack | Yes | Yes | Active node manages bypass list |

### 4.6 License Requirements

- **Fabric Attach** features require the appropriate EXOS license tier (Edge or higher).
- **NetLogin** is available on Base license tier.
- The `bypass-netlogin` option itself does not require an additional license beyond what FA ZTC already requires.

---

## 5. CLI COMMANDS AND SYNTAX

### 5.1 Configure Bypass NetLogin for FA ZTC Client Type

```
configure lldp fabric-attach zero-touch-client <clientType> bypass-netlogin
```

**Description:** Enables the NetLogin authentication bypass for all FA devices matching the specified ZTC client type. Sets `bypassNl = 1` in `faZeroTouchClient_t` and increments `bypassNlCount`.

**Parameters:**
- `<clientType>` — FA client type identifier (numeric or keyword, within `[FA_ELEMENT_MIN_CLIENT_TYPE, FA_NUM_CLIENT_TYPES]`)

**Example:**
```bash
# Enable bypass for IP phones (client type 5)
configure lldp fabric-attach zero-touch-client 5 bypass-netlogin

# Enable bypass for wireless access points (client type 4)
configure lldp fabric-attach zero-touch-client 4 bypass-netlogin
```

### 5.2 Unconfigure/Disable Bypass NetLogin

```
unconfigure lldp fabric-attach zero-touch-client <clientType> bypass-netlogin
```

**Description:** Disables the NetLogin bypass for the specified ZTC client type. Sets `bypassNl = 0`, decrements `bypassNlCount`, and triggers removal of all active bypass entries for that client type from the NetLogin bypass list.

**Example:**
```bash
# Disable bypass for IP phones
unconfigure lldp fabric-attach zero-touch-client 5 bypass-netlogin
```

### 5.3 Show FA ZTC Configuration with Bypass Status

```
show lldp fabric-attach zero-touch-client
```

**Description:** Displays all FA ZTC client type configurations including the `bypass-netlogin` status for each configured client type.

**Example Output:**
```
# show lldp fabric-attach zero-touch-client

FA Zero Touch Commissioning Client Configuration
=================================================
Client Type  VLAN   NSI      Priority  Enabled  Bypass-NetLogin
-----------  ----   -------  --------  -------  ---------------
4 (WAP)      100    1000     0         Yes      Yes
5 (IPPhone)  200    2000     6         Yes      Yes
6 (IPCamera) 300    3000     0         Yes      No
```

### 5.4 Show NetLogin FA Bypass Entries

```
show netlogin fa-bypass
```

or

```
show netlogin
```

**Description:** Displays active FA bypass entries in the NetLogin bypass list, showing which FA clients are currently bypassing authentication.

**Example Output (enhanced `show netlogin`):**
```
# show netlogin

Network Login Global Configuration
===================================
...
FA Bypass Entries:
  MAC Address        Port   FA Client Type  Status
  -----------------  -----  --------------  ------
  00:11:22:33:44:55  1:5    5 (IPPhone)     Bypass Active
  AA:BB:CC:DD:EE:FF  1:6    4 (WAP)         Bypass Active
```

### 5.5 Show NetLogin Port (Enhanced)

```
show netlogin port <port>
```

**Description:** Displays per-port NetLogin configuration including bypass status information for FA clients discovered on the port.

**Example Output:**
```
# show netlogin port 1:5

Port                          : 1:5
Authentication                : mac-based
Port State                    : Enabled
Authentication Mode           : Required (Policy Enabled only)
Max Supported Users           : 1024
Current Users                 : 2
------------------------------------------------
        MAC Mode Port Configuration
FA Bypass NetLogin            : Active (client type: 5)
------------------------------------------------
```

### 5.6 Show LLDP FA Neighbor Information

```
show lldp fabric-attach neighbors
```

**Description:** Shows FA neighbors with their client types. Useful for correlating discovered FA devices with bypass-netlogin configuration.

**Example Output:**
```
# show lldp fabric-attach neighbors

FA Neighbor Table
=================
Port  Neighbor MAC        Client Type  ZTC VLAN  Bypass-NL  Status
----  -----------------  -----------  --------  ---------  ------
1:5   00:11:22:33:44:55  5 (IPPhone)  200       Yes        Active
1:6   AA:BB:CC:DD:EE:FF  4 (WAP)      100       Yes        Active
1:7   BB:CC:DD:EE:FF:00  6 (IPCamera) 300       No         Auth Required
```

### 5.7 Debug Commands

```bash
# Enable LLDP FA debug tracing (includes bypass-netlogin events)
debug lldp fa verbose

# Debug NetLogin FA bypass operations
debug netlogin fa-bypass

# Show internal FA bypass state information
debug lldp fa bypass-info
```

The `nlDbgDumpFaBypassInfo()` function provides internal bypass list dump for diagnostic purposes.

### 5.8 Command Interdependencies

1. `configure lldp fabric-attach zero-touch-client <type> bypass-netlogin` requires that a ZTC entry for `<type>` already exists (VLAN assignment must be configured).
2. If the ZTC entry is deleted while `bypass-netlogin` is active, bypass entries are automatically cleaned up.
3. Disabling FA entirely (`configure lldp fabric-attach mode off`) calls `lldpFaBypassNlDelAllEntries()` to clean up all bypass entries.

### 5.9 Configuration Persistence

All bypass-netlogin settings are saved to the EXOS configuration database via `lldp_db.c`. The configuration appears in `show configuration lldp` output and persists across reboots and software upgrades. The YANG-based configuration is also accessible via NETCONF/RESTCONF.

---

## 6. FEATURE INTERACTIONS

### 6.1 Interaction with NetLogin MAC Authentication

**Primary Integration Point.** FA ZTC Bypass NetLogin is tightly integrated with NetLogin MAC-based authentication:

- Under normal operation, when a MAC address generates traffic on a NetLogin-enabled port, the NetLogin module initiates a MAC authentication sequence (checking the local MAC list or sending a RADIUS Access-Request).
- With bypass-netlogin enabled for the FA client type, `nlIsInFaBypassNlList()` is evaluated **before** the MAC authentication sequence begins. If the MAC is in the bypass list, the entire NetLogin authentication process is skipped.
- The device is placed directly in its FA ZTC-assigned VLAN without a RADIUS round-trip.
- NetLogin session accounting may still be performed for the bypassed client, depending on configuration.
- Non-FA clients on the same port are unaffected and still undergo full NetLogin authentication.

**Configuration Scenario:**
```bash
# Typical co-configuration:
enable netlogin mac ports 1:1-1:48
configure netlogin vlan NetLoginVlan
configure lldp fabric-attach mode server
configure lldp fabric-attach zero-touch-client 5 vlan IPPhoneVLAN nsi 2000 priority 6
configure lldp fabric-attach zero-touch-client 5 bypass-netlogin
```

### 6.2 Interaction with Fabric Attach (FA) Subsystem

- FA operates the discovery and ZTC provisioning layer. The bypass feature is a **FA ZTC configuration attribute** — it only activates when FA has successfully identified a client's type from valid FA Element TLVs.
- FA mode changes (Server → Proxy → Off) directly affect bypass operation:
  - **FA mode disabled**: `lldpHandleFabricAttachChange()` triggers `lldpFaBypassNlDelAllEntries()` to flush all bypass entries.
  - **FA mode changed**: Bypass entries are re-evaluated based on new FA role and neighbor state.
- FA ZTC VLAN assignment and bypass-netlogin are **complementary**: bypass skips authentication, while FA ZTC handles VLAN provisioning. Both must be correctly configured for seamless device onboarding.

### 6.3 Interaction with LLDP (IEEE 802.1AB)

- LLDP is the transport mechanism for FA TLVs. Without a valid LLDP adjacency and FA Element TLV exchange, the bypass mechanism is never triggered.
- LLDP neighbor lifecycle events (neighbor add, neighbor update, neighbor remove, port down) drive the bypass entry lifecycle in NetLogin.
- The `lldpIdMgrDelNbrByPort()` function, modified with the new `netlogin` boolean parameter, ensures that LLDP neighbor removal events correctly clean up NetLogin bypass entries.
- LLDP hold time and transmission interval affect how quickly bypass entries are removed when an FA device disconnects (bounded by LLDP TTL expiry).

### 6.4 Interaction with VLAN Assignment

- FA ZTC bypass-netlogin and VLAN assignment work in conjunction:
  - The `bypassNl` flag exempts the device from NetLogin authentication.
  - The ZTC `vlanId` provides the VLAN assignment for the bypassed client.
- If no ZTC VLAN is configured for the client type, the bypass may grant access but without a deterministic VLAN assignment — the device may remain in the default or untagged VLAN.
- Dynamic VLAN assignment via RADIUS (which NetLogin normally facilitates) is bypassed for these clients; the FA ZTC VLAN assignment takes precedence.
- `nlHandleFabricAttachBypassNlFdb()` integrates the FDB entry for the bypassed client with the correct VLAN, ensuring proper forwarding.

### 6.5 Interaction with AAA (RADIUS/TACACS+)

- Bypass-netlogin completely exempts the FA client from AAA consultation for authentication decisions.
- No RADIUS Access-Request is sent for bypassed clients.
- RADIUS accounting (Start/Stop records) behavior for bypassed clients depends on the accounting configuration — if accounting is enabled and configured to track all network access, bypassed clients may still generate accounting records.
- AAA policies (CoS, ACL, QoS) that would normally be applied via RADIUS Access-Accept attributes are **not** applied to bypassed clients. Access policy is governed entirely by the ZTC configuration (VLAN, priority, NSI).

### 6.6 Interaction with Network Access Control (NAC)

- FA ZTC bypass-netlogin effectively creates a pre-authorized exception to NAC posture checking for designated FA device types.
- Organizations using NAC for endpoint compliance checking should evaluate which FA client types are appropriate for bypass, as bypassed devices will not undergo posture assessment.
- The bypass decision is made at the switch level; upstream NAC solutions (ExtremeControl, etc.) are not consulted for bypassed clients.

### 6.7 Interaction with 802.1X Authentication

- If NetLogin is configured for 802.1X (dot1x) authentication in addition to MAC authentication on a port, the bypass-netlogin feature's effect on 802.1X behavior should be verified.
- The bypass list (`nlBypassNlEntry_s`) is primarily designed for MAC-based authentication exemption. 802.1X interactions with FA bypass should be validated for the specific EXOS version.

### 6.8 Interaction with MLAG (Multi-Switch Link Aggregation Group)

- In MLAG environments where FA is operating across an ISC (Inter-Switch Connection), bypass entries generated on one MLAG peer may need to be consistent with the other peer.
- The LLDP FA module has existing MLAG interaction paths (`lldpReportMlagVirtualPortConfigToDot1br`). Bypass entry synchronization across MLAG peers should be verified.
- If an FA client fails over to the MLAG peer switch, the bypass entry on the new active node must be correctly established.

### 6.9 Interaction with STP (Spanning Tree Protocol) and EAPS

- FA discovery operates over LLDP PDUs, which traverse spanning tree topology changes normally.
- Topology changes (port going blocking → forwarding) may trigger LLDP neighbor re-discovery and subsequently bypass entry recreation.
- EAPS ring topology events that cause port state transitions will trigger `lldpIdMgrDelNbrByPort()` on affected ports, cleaning up bypass entries for FA clients on those ports.

### 6.10 Interaction with High Availability (HA) / Process Restart

- EXOS supports in-service process restart for daemons like LLDP.
- After an LLDP process restart, `lldpFaBypassNlReplayAllEntries()` is called to re-establish all active bypass entries in the NetLogin process.
- This ensures that FA clients do not lose their bypass status and are not incorrectly challenged by NetLogin after an LLDP process restart.
- The replay is based on the current FA ZTC configuration state and active FA neighbor table, ensuring only valid entries are replayed.

---

## 7. OPERATIONAL CHARACTERISTICS

### 7.1 Performance Characteristics

- **Fast-path optimization**: When `bypassNlCount == 0` (no bypass-netlogin configured for any client type), the bypass code path is entirely bypassed. This ensures zero overhead on deployments that do not use this feature.
- **IPC overhead**: Each FA client discovery event that triggers a bypass entry creation requires one IPC message between the LLDP process and the NetLogin process. This is a one-time cost per device connection event.
- **Lookup performance**: `nlIsInFaBypassNlList()` is called for every MAC-based authentication event. The efficiency of this lookup (linear scan vs. hash table implementation) directly affects NetLogin authentication performance under high device-connection load.
- **Replay performance**: `lldpFaBypassNlReplayAllEntries()` replays all active bypass entries sequentially. In deployments with many concurrent FA clients, this operation may take perceptible time during process restart recovery.

### 7.2 Scalability Limits

| Resource | Approximate Limit | Notes |
|---|---|---|
| FA ZTC client types with bypass | Up to `FA_NUM_CLIENT_TYPES` | Bounded by defined FA client type range |
| Concurrent bypass entries in NetLogin | Platform-dependent | Limited by NetLogin session table size and `nlBypassNlEntry_s` list capacity |
| FA neighbors per port | Platform LLDP neighbor limit | Typical: up to 32 neighbors per port |
| Bypass IPC messages/second | Limited by IPC channel bandwidth | Relevant during high port-churn events |

### 7.3 Memory and Resource Utilization

- Each `nlBypassNlEntry_s` record consumes a small, fixed amount of memory in the NetLogin process. For large-scale deployments with hundreds of bypassed FA clients, cumulative memory should be monitored.
- The `bypassNlCount` field in `_lldpFaGlobalData` is a `uint8_t`, supporting up to 255 client types with bypass enabled simultaneously.
- Per-port bypass statistics are maintained in `_lldpFaPortStats`, adding minimal per-port memory overhead.

### 7.4 Timing and Convergence Behavior

| Event | Timing Characteristic |
|---|---|
| Bypass entry creation (new FA client) | Near-instantaneous: single IPC message after LLDP PDU processing |
| Bypass entry removal (port down) | LLDP triggers on link-down event; cleanup is immediate on port failure |
| Bypass entry removal (LLDP TTL expiry) | Dependent on FA client's LLDP TTL value (typically 120 seconds) |
| Process restart replay | Seconds to minutes depending on number of active bypass entries |
| Configuration change propagation | Immediate: configure/unconfigure triggers immediate IPC to NetLogin |

### 7.5 High Availability Behavior

- **LLDP process restart**: `lldpFaBypassNlReplayAllEntries()` re-establishes all bypass entries. FA clients do not experience disruption if the replay completes before their next authentication event.
- **NetLogin process restart**: The LLDP process detects NetLogin process re-registration and replays bypass entries to the newly started NetLogin process.
- **Stack master failover (SummitStack)**: The new master node's LLDP process replays bypass entries based on the FA neighbor database that is maintained during stack operation.

### 7.6 Logging and Monitoring

- **Syslog events**: FA bypass entry add/remove events generate syslog messages under the LLDP facility.
- **LLDP FA stats**: Per-port FA statistics (via `_lldpFaPortStats`) track bypass-related event counts.
- **`nlDbgDumpFaBypassInfo()`**: Diagnostic function that dumps the current state of the NetLogin bypass list, accessible via debug commands.
- **SNMP**: FA ZTC configuration MIB objects should reflect the `bypassNl` attribute. Operators should verify MIB updates for this field.

### 7.7 Failure Modes and Graceful Degradation

- **IPC delivery failure**: If the `LLDP_CLNTSVR_FA_BYPASS_NL` IPC message fails to deliver to NetLogin, the FA client will not be added to the bypass list. The client will then be subject to normal NetLogin authentication. This is a fail-secure behavior (authentication is not bypassed due to IPC failure).
- **Memory allocation failure**: If `nlBypassNlEntry_s` allocation fails in NetLogin, the bypass entry is not created. NetLogin applies normal authentication. The failure is logged.
- **Process restart without replay**: If `lldpFaBypassNlReplayAllEntries()` is not called after process restart, existing FA bypass clients may be challenged by NetLogin on their next traffic event. They will re-establish bypass status upon the next LLDP PDU exchange.

---

## 8. SPECIAL BEHAVIORS AND EDGE CASES

### 8.1 Simultaneous NetLogin Authentication and FA Bypass

When a device is discovered via FA LLDP with a bypass-configured client type, but the device also sends traffic that triggers a NetLogin authentication event **before** the bypass IPC is processed, the authentication sequence may proceed. The IPC-based bypass entry creation has a small processing window. Deployments should be aware of this race condition in very high-speed connection scenarios.

### 8.2 bypassNl Configured Without VLAN Assignment

If `bypass-netlogin` is configured for an FA ZTC client type but no VLAN is assigned to that client type (`vlanId = 0` or ZTC entry incomplete), the FA client will bypass NetLogin but may not receive a VLAN assignment. The client may remain in the untagged or default VLAN, which may or may not be the intended behavior. Ensure ZTC VLAN assignments are complete before enabling bypass.

### 8.3 Non-FA Devices on Bypass-Configured Ports

The bypass is applied only to devices that present valid FA Element TLVs with a client type matching a bypass-configured ZTC entry. Non-FA devices on the same port or VLAN are entirely unaffected by the bypass configuration and continue to undergo standard NetLogin authentication. This is a critical security boundary.

### 8.4 bypassNlCount Accuracy

The `bypassNlCount` counter in `_lldpFaGlobalData` must accurately reflect the number of ZTC client types with bypass enabled. Inaccuracies (e.g., count non-zero but no actual bypass active) result in unnecessary processing overhead. Count going to zero when bypass entries exist (or vice versa) could result in incorrect fast-path decisions.

### 8.5 FA Mode Transition Edge Cases

| Transition | Expected Behavior |
|---|---|
| FA Server → FA Off | `lldpFaBypassNlDelAllEntries()` called; all bypass entries removed from NetLogin |
| FA Server → FA Proxy | Bypass entries re-evaluated based on new role; existing entries may be refreshed |
| FA Off → FA Server | No bypass entries until FA clients re-discover and re-send LLDP PDUs |
| FA ZTC client type disabled | Only bypass entries for that client type are removed; other types unaffected |

### 8.6 Backward Compatibility

- **Config file downgrade**: If a configuration with `bypass-netlogin` set is loaded on an older EXOS version that does not support the `bypassNl` field, the field will be silently ignored (standard EXOS behavior for unknown config attributes). FA ZTC will function without bypass, and clients will be subject to normal NetLogin authentication.
- **IPC message ID**: The new `LLDP_CLNTSVR_FA_BYPASS_NL` enum value must not conflict with existing LLDP IPC message IDs. This is enforced at compile time via the enum definition, but should be verified during version integration.
- **`lldpIdMgrDelNbrByPort` callers**: All existing callers of this function must be updated to pass the new `bool netlogin` parameter. Failure to update a caller results in stale bypass entries accumulating in NetLogin, potentially granting unintended access. This is a critical code review point.

### 8.7 LLDP Trunk Port Behavior

When FA is operating on trunk (LAG) member ports, bypass entries should be correctly associated with the logical trunk instance rather than individual physical ports. Verify that `lldpFaPortNetloginBypass()` and `lldpIdMgrDelNbrByPort()` correctly handle the LAG abstraction layer.

### 8.8 Duplicate Bypass Entry Prevention

`lldpFaBypassNlReplayAllEntries()` must not create duplicate entries in the NetLogin bypass list when replayed multiple times. The NetLogin add logic (`nlRecordFaBypassAuthSkip()`) should perform a pre-insertion check for existing entries.

### 8.9 Security Considerations

- The bypass feature should only be enabled for device types that are genuinely trusted and whose FA TLV authenticity can be reasonably assured in the deployment environment.
- FA TLVs are carried in LLDP frames which, by default, are not cryptographically authenticated. An attacker with physical access who can craft FA LLDP frames with a valid client type may spoof a bypass-eligible device type.
- Organizations with high security requirements should consider whether FA ZTC bypass-netlogin is appropriate without additional layer of port security (e.g., sticky MAC, 802.1X on the upstream aggregation switch).

---

## 9. CONFIGURATION EXAMPLES

### 9.1 Example 1: IP Phone Zero-Touch Deployment with Bypass

**Scenario:** An enterprise deploys IP phones across multiple access switches. All IP phones are FA-capable and should receive the voice VLAN without NetLogin authentication.

```bash
# Step 1: Configure VLANs
create vlan VoiceVLAN tag 200
create vlan DataVLAN tag 100
create vlan NetLoginVLAN tag 999

# Step 2: Enable LLDP on access ports
enable lldp port 1:1-1:48

# Step 3: Configure Fabric Attach in Server mode
configure lldp fabric-attach mode server

# Step 4: Configure FA ZTC for IP phones (client type 5)
configure lldp fabric-attach zero-touch-client 5 vlan VoiceVLAN nsi 2000 priority 6
enable lldp fabric-attach zero-touch-client 5

# Step 5: Enable bypass-netlogin for IP phones
configure lldp fabric-attach zero-touch-client 5 bypass-netlogin

# Step 6: Configure NetLogin MAC for non-FA devices (still required for data clients)
configure netlogin vlan NetLoginVLAN
enable netlogin mac
enable netlogin ports 1:1-1:48 mac-based
configure netlogin add mac-list default vlan DataVLAN

# Verification:
show lldp fabric-attach zero-touch-client
show netlogin fa-bypass
show lldp fabric-attach neighbors
```

**Result:** IP phones are automatically provisioned on VoiceVLAN (priority 6, NSI 2000) via FA without NetLogin challenge. PC/data devices connected to the same ports proceed through normal NetLogin MAC authentication.

---

### 9.2 Example 2: Mixed Device Deployment — Selective Bypass

**Scenario:** A campus network has wireless APs and IP cameras. APs should bypass NetLogin (trusted, managed devices), but IP cameras should still authenticate (less trusted, IoT devices).

```bash
# VLAN Setup
create vlan APVLAN tag 100
create vlan CameraVLAN tag 300
create vlan IoTAuthVLAN tag 998

# Enable LLDP
enable lldp port 1:1-1:24

# Configure FA Server mode
configure lldp fabric-attach mode server

# Configure ZTC for WAPs (client type 4) — with bypass
configure lldp fabric-attach zero-touch-client 4 vlan APVLAN nsi 4000 priority 0
enable lldp fabric-attach zero-touch-client 4
configure lldp fabric-attach zero-touch-client 4 bypass-netlogin

# Configure ZTC for IP Cameras (client type 6) — WITHOUT bypass
configure lldp fabric-attach zero-touch-client 6 vlan CameraVLAN nsi 6000 priority 0
enable lldp fabric-attach zero-touch-client 6
# Note: bypass-netlogin NOT configured for client type 6

# Configure NetLogin for camera authentication
configure netlogin vlan IoTAuthVLAN
enable netlogin mac
enable netlogin ports 1:1-1:24 mac-based
configure radius netlogin primary server 192.168.1.10 client-ip 192.168.1.1

# Verification commands:
show lldp fabric-attach zero-touch-client
# Expected: WAP row shows Bypass-NetLogin = Yes, Camera row shows No

show netlogin fa-bypass
# Expected: Only WAP entries appear in bypass list

show lldp fabric-attach neighbors
# Expected: WAP neighbors show "Yes" for Bypass-NL column
#           Camera neighbors show "No" — they require auth
```

**Result:** WAPs automatically join APVLAN without authentication. IP cameras are placed in IoTAuthVLAN and must authenticate via RADIUS before receiving network access.

---

### 9.3 Example 3: Process Restart Recovery Verification

**Scenario:** Verifying that FA bypass entries survive an LLDP process restart (relevant for HA/upgrade scenarios).

```bash
# Pre-restart state: verify bypass entries are active
show lldp fabric-attach zero-touch-client
show netlogin fa-bypass
# Note current bypass entries (MAC addresses, ports, client types)

# Simulate LLDP process restart (or observe during software upgrade)
# The replay mechanism should restore all entries automatically.

# Post-restart verification:
show lldp fabric-attach neighbors
# Expected: Same FA neighbors should reappear (LLDP re-discovery + replay)

show netlogin fa-bypass
# Expected: Same bypass entries should be present
# (Either via replay or re-establishment after LLDP re-discovery)

# Verify FA clients on the network remain connected without disruption
show netlogin session
# Expected: Bypassed clients show active sessions, no re-authentication event
```

---

### 9.4 Example 4: Complete Cleanup — Disabling Bypass

**Scenario:** A security policy change requires that IP phones must now authenticate via NetLogin. Disabling bypass-netlogin.

```bash
# Current state: IP phones (client type 5) are bypassing NetLogin
show lldp fabric-attach zero-touch-client
# Shows: client type 5 — Bypass-NetLogin = Yes

show netlogin fa-bypass
# Shows: Multiple IP phone MAC addresses in bypass list

# Disable bypass for IP phones
unconfigure lldp fabric-attach zero-touch-client 5 bypass-netlogin

# Verify cleanup:
show lldp fabric-attach zero-touch-client
# Expected: client type 5 — Bypass-NetLogin = No

show netlogin fa-bypass
# Expected: No entries for IP phone MAC addresses

# IP phones will now be challenged by NetLogin on next connection
# (Existing sessions may persist until TTL expiry or manual clear)
clear netlogin state mac-address <phone-mac>
# Force re-authentication for specific devices if needed
```

---

## 10. VERIFICATION AND MONITORING

### 10.1 Primary Verification Commands

```bash
# 1. Verify bypass-netlogin configuration per client type
show lldp fabric-attach zero-touch-client

# 2. Verify active bypass entries in NetLogin
show netlogin fa-bypass

# 3. Verify FA neighbor discovery with bypass status
show lldp fabric-attach neighbors

# 4. Verify per-port NetLogin status
show netlogin port 1:5

# 5. Verify NetLogin sessions (bypassed clients should appear without auth challenge)
show netlogin session

# 6. Verify LLDP neighbor state
show lldp neighbors detail port 1:5
```

### 10.2 Confirming Proper Bypass Operation

The following indicators confirm that bypass-netlogin is operating correctly:

| Check | Expected Indicator |
|---|---|
| `show lldp fabric-attach zero-touch-client` | `Bypass-NetLogin: Yes` for configured client types |
| `show netlogin fa-bypass` | Active entries listing FA client MAC addresses |
| `show netlogin session` | Bypassed clients show `Agent type: fa-bypass` or similar marker |
| `show lldp fabric-attach neighbors` | `Bypass-NL: Yes` column populated for matching client types |
| System log | Log entries: "FA bypass entry added for MAC [xx:xx:xx] port [1:x] type [n]" |

### 10.3 Key Log Messages

```
<Info> LLDP: FA bypass-netlogin entry added: MAC 00:11:22:33:44:55 port 1:5 client-type 5
<Info> LLDP: FA bypass-netlogin entry removed: MAC 00:11:22:33:44:55 port 1:5 (port-down)
<Info> LLDP: FA bypass-netlogin replay: 12 entries restored to NetLogin
<Warning> LLDP: FA bypass IPC failed for MAC 00:11:22:33:44:55 — device will require NetLogin auth
<Info> NetLogin: FA bypass authorized: MAC 00:11:22:33:44:55 port 1:5 (no auth challenge)
```

### 10.4 Debug Diagnostics

```bash
# Enable detailed FA bypass tracing
debug lldp fa verbose

# Dump NetLogin FA bypass list state
debug netlogin fa-bypass dump
# This invokes nlDbgDumpFaBypassInfo() to print the full bypass list

# Check IPC communication between LLDP and NetLogin
debug lldp ipc

# Trace FA TLV processing
debug lldp fa tlv
```

### 10.5 SNMP Monitoring

- FA ZTC configuration MIB objects under the LLDP/FA MIB tree should include the `bypassNl` attribute.
- Monitor FA neighbor table changes via existing FA SNMP notifications.
- NetLogin session MIB entries for bypassed clients may carry a special session type indicator.

### 10.6 Statistics and Counters

Per-port FA bypass statistics are maintained in `_lldpFaPortStats`:

```bash
# View FA port statistics
show lldp fabric-attach port <port> statistics

# Expected counters:
#   Bypass entries added:    N
#   Bypass entries removed:  N
#   Bypass replay events:    N
#   IPC failures:            N (should be 0 in normal operation)
```

### 10.7 Common Operational States and Troubleshooting

| Symptom | Likely Cause | Resolution |
|---|---|---|
| FA device not bypassing NetLogin | `bypass-netlogin` not configured for client type | Verify `show lldp fabric-attach zero-touch-client` shows `Yes` for the client type |
| FA device type not recognized | Invalid FA Element TLV from client | Check `show lldp neighbors detail` for FA TLV content; verify client FA support |
| Bypass entry not appearing in NetLogin | IPC delivery failure between LLDP and NetLogin | Check `debug lldp ipc`;