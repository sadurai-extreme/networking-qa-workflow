# EXOS Fabric Attach Zero-Touch Client NetLogin Bypass — Skill File

## Feature: FA Device NetLogin Authentication Bypass (`bypass-netlogin`)
**Release:** EXOS 33.7 (introduced), 34.1 (enhanced)
**Platforms:** All EXOS platforms
**JIRA:** EXOS-39369
**Feature Spec:** F000199 / EXOS-211

---

## 1. FEATURE OVERVIEW

### 1.1 High-Level Description

The Fabric Attach (FA) Zero-Touch Client NetLogin Bypass feature is an enhancement to the existing `configure fabric attach zero-touch-client` command. It introduces a `bypass-netlogin [on | off]` option that allows FA devices of a specified client type to be attached directly as FA elements without requiring NetLogin MAC-based authentication, even when NetLogin is enabled on the ingress port.

Prior to this enhancement (EXOS 33.7), when NetLogin was enabled on a port, an FA device discovered via LLDP could only be attached as an FA element after its MAC address successfully authenticated through the NetLogin subsystem. This created a dependency between the FA Zero-Touch Client (ZTC) provisioning pipeline and the NetLogin authentication pipeline, which could block or delay FA element attachment in environments where RADIUS authentication was unavailable, misconfigured, or intentionally not desired for infrastructure devices.

### 1.2 Purpose and Business Value

- **Eliminates authentication friction for known FA infrastructure devices**: IP phones, cameras, switches, and other FA-capable devices that are pre-identified by client type can be attached without requiring RADIUS round-trips.
- **Supports zero-touch provisioning workflows**: In ZTC deployments, FA devices should be provisioned automatically. Requiring NetLogin authentication introduces a dependency on RADIUS availability that may not be appropriate for infrastructure devices.
- **Maintains security posture for non-FA devices**: Only devices of the explicitly configured FA client type bypass authentication; all other NetLogin clients on the same port continue to require authentication.
- **Provides operational visibility**: Both `show fabric attach elements` and `show netlogin` are enhanced to display bypass status, giving administrators a unified view of which devices are bypassing authentication.

### 1.3 Use Cases and Target Scenarios

1. **Enterprise IP Phone Deployment**: IP phones are FA-capable and communicate their VLAN/NSI requirements via LLDP. When NetLogin is enabled on access ports for endpoint security, IP phones should be provisioned immediately without waiting for RADIUS authentication.
2. **Surveillance Camera Networks**: FA-capable cameras can be attached directly as FA elements on ports where NetLogin is enforced for general endpoint security.
3. **Infrastructure Switch Cascading**: Downstream FA-capable switches in a ZTC environment should attach without authentication delays.
4. **Mixed-Mode Ports**: A single port may serve both FA devices (bypassing NetLogin) and regular endpoints (requiring NetLogin), with the bypass applying only to the FA client type.
5. **RADIUS-Unavailable Environments**: Deployments where RADIUS is temporarily unavailable should not prevent FA device provisioning.

### 1.4 Related Standards and Protocols

- **IEEE 802.1AB (LLDP)**: FA devices communicate client type and VLAN/NSI mappings via LLDP TLVs. The bypass mechanism is triggered by LLDP-discovered FA element information.
- **IEEE 802.1X / MAC-Based Authentication**: NetLogin MAC-based authentication is the primary authentication method affected by this bypass.
- **Avaya/Extreme Fabric Attach (FA) Protocol**: Proprietary LLDP TLV extensions for FA element discovery, VLAN-to-NSI mapping, and client type identification.
- **RADIUS (RFC 2865, RFC 2866)**: The authentication protocol bypassed for FA devices when bypass-netlogin is enabled.

### 1.5 Prerequisites and Dependencies

- Fabric Attach must be enabled on the switch (proxy, standalone proxy, or server mode).
- The `configure fabric attach zero-touch-client` command must be configured for the relevant client type.
- NetLogin must be configured on the port for the bypass to have operational significance (if NetLogin is not enabled, the bypass setting is stored but has no effect on authentication flow).
- LLDP must be enabled on the port for FA device discovery.
- The FA client type must be identifiable via LLDP TLVs transmitted by the connecting device.

---

## 2. FUNCTIONAL DESCRIPTION

### 2.1 Existing Feature Behavior (Pre-Enhancement)

#### 2.1.1 Fabric Attach Zero-Touch Client (ZTC) Operation

The FA Zero-Touch Client feature allows an EXOS switch operating in FA proxy or standalone proxy mode to automatically provision VLAN-to-NSI mappings for FA-capable devices discovered via LLDP. When an FA device connects to a port:

1. The FA device transmits LLDP packets containing FA TLVs that identify the device's client type (e.g., Switch, IP Phone, Camera, Server) and requested VLAN/NSI mappings.
2. The EXOS LLDP subsystem receives and parses these TLVs.
3. The FA daemon (`fad`) matches the discovered client type against configured ZTC client type entries.
4. If a match is found, the FA daemon creates a dynamic VLAN-to-NSI mapping for the device.
5. The FA proxy forwards this mapping to the FA server for NSI provisioning.

#### 2.1.2 NetLogin Interaction (Pre-Enhancement)

When NetLogin MAC-based authentication was enabled on the port where an FA device was discovered:

1. The FA daemon detected the FA device via LLDP.
2. Before creating the FA element entry and VLAN/NSI mapping, the FA daemon checked whether NetLogin was enabled on the ingress port.
3. If NetLogin was enabled, the FA device's MAC address was required to successfully authenticate through the NetLogin subsystem (typically via RADIUS).
4. Only after successful NetLogin authentication would the FA element be fully attached and the VLAN/NSI mapping created.
5. If authentication failed or RADIUS was unavailable, the FA device would not be attached as an FA element.

This behavior was appropriate for environments requiring strict access control but created operational challenges in ZTC deployments.

### 2.2 Enhanced Feature Behavior (EXOS 33.7+)

#### 2.2.1 bypass-netlogin Option

The `configure fabric attach zero-touch-client <client> bypass-netlogin [on | off]` command adds a per-client-type bypass flag to the ZTC configuration. This flag controls whether FA devices of the specified client type must pass NetLogin authentication before being attached as FA elements.

**Default value**: `off` — maintains existing behavior; NetLogin authentication is required when NetLogin is enabled on the port.

**When set to `on`**: FA devices of the specified client type bypass NetLogin authentication entirely and are attached directly as FA elements when discovered via LLDP.

#### 2.2.2 Operational Flow — bypass-netlogin OFF (Default)

```
FA Device connects to port
        │
        ▼
LLDP receives FA TLVs → FA daemon identifies client type
        │
        ▼
FA daemon checks ZTC configuration for client type match
        │
        ▼
Is NetLogin enabled on port?
    YES ──────────────────────────────────────────────────────────────┐
        │                                                             │
        ▼                                                             │
NetLogin MAC authentication required                                  │
        │                                                             │
    Auth SUCCESS?                                                     │
    YES ──► FA element attached, VLAN/NSI mapping created             │
    NO  ──► FA element NOT attached                                   │
                                                                      │
    NO ──────────────────────────────────────────────────────────────►│
        │                                                             │
        ▼                                                             │
FA element attached directly, VLAN/NSI mapping created ◄─────────────┘
```

#### 2.2.3 Operational Flow — bypass-netlogin ON

```
FA Device connects to port
        │
        ▼
LLDP receives FA TLVs → FA daemon identifies client type
        │
        ▼
FA daemon checks ZTC configuration for client type match
        │
        ▼
bypass-netlogin = ON for this client type?
    YES ──────────────────────────────────────────────────────────────┐
        │                                                             │
        ▼                                                             │
Is NetLogin enabled on port?                                          │
    YES ──► FA daemon signals NetLogin to bypass this MAC             │
            NetLogin records MAC in bypass client list                │
            FA element attached directly                              │
    NO  ──► FA element attached directly (no NetLogin interaction)    │
                                                                      │
    NO ──────────────────────────────────────────────────────────────►│
        │                                                             │
        ▼                                                             │
Standard NetLogin authentication required ◄──────────────────────────┘
```

#### 2.2.4 LLDP Communication of Bypass Information

When `bypass-netlogin on` is configured for a client type and an FA device of that type is discovered:

1. The FA daemon (`fad`) identifies the client type from the LLDP FA TLVs.
2. The FA daemon looks up the ZTC configuration for that client type and reads the `bypass-netlogin` flag.
3. If the flag is `on`, the FA daemon communicates the bypass instruction to the NetLogin subsystem via an internal IPC mechanism.
4. The NetLogin subsystem adds the FA device's MAC address to an internal bypass client list, keyed by MAC address, port, and VLAN.
5. The NetLogin subsystem suppresses MAC-based authentication challenges for that MAC address on that port.
6. The FA element is attached and the VLAN/NSI mapping is created without waiting for authentication.

#### 2.2.5 Bypass Client List Maintenance

- The bypass client list is maintained by the NetLogin subsystem in memory.
- Entries are added when the FA daemon signals a bypass for a discovered FA device.
- Entries are removed when:
  - The FA element ages out (LLDP neighbor timeout).
  - The port goes down (link-down event).
  - The `bypass-netlogin` setting is changed from `on` to `off` for the client type.
  - The ZTC configuration for the client type is removed.
  - The FA element is explicitly deleted.
- The bypass client list persists across NetLogin enable/disable operations — the list is maintained even when NetLogin is disabled, so that when NetLogin is re-enabled, the bypass state is immediately effective.

#### 2.2.6 Interaction with NetLogin Disabled

When NetLogin is disabled on the port:
- The `bypass-netlogin` setting is stored in the ZTC configuration and displayed in `show fabric attach elements` as `Yes` (if configured on).
- The `show netlogin` output still displays the bypass client list (if entries exist) under the "Netlogin Bypass Clients" section.
- The `show fabric attach elements` output shows `Yes` in the Netlogin Bypass column for the FA element.
- No actual authentication bypass occurs because NetLogin is not active — the FA device attaches normally.
- The `show netlogin port <port>` output on a NetLogin-disabled port shows only the bypass client list (no per-port NetLogin configuration sections).

#### 2.2.7 FA Server and "No Auth" Elements

FA elements discovered as FA Servers with "No Auth" (i.e., FA server elements that do not use FA message authentication) display `N/A` in the Netlogin Bypass column of `show fabric attach elements`. This is because:
- FA server elements are not subject to ZTC client type matching.
- The bypass-netlogin concept applies only to FA client elements discovered via ZTC.
- Server-type elements have their own authentication model (FA message authentication key).

#### 2.2.8 State Transitions

| Event | bypass-netlogin State | Result |
|---|---|---|
| FA device discovered via LLDP | ON | FA element attached, MAC added to bypass list |
| FA device discovered via LLDP | OFF | NetLogin authentication required |
| LLDP neighbor timeout | ON | FA element removed, MAC removed from bypass list |
| Port link-down | ON | FA element removed, MAC removed from bypass list |
| `bypass-netlogin` changed ON→OFF | — | Existing bypass entries removed; FA element re-evaluated |
| `bypass-netlogin` changed OFF→ON | — | Existing FA elements re-evaluated; bypass applied |
| NetLogin disabled on port | ON | Bypass list maintained; FA element attached normally |
| NetLogin re-enabled on port | ON | Bypass list immediately effective; no re-authentication |

---

## 3. EXOS IMPLEMENTATION DETAILS

### 3.1 Software Architecture

The FA NetLogin bypass feature involves coordination between three primary EXOS subsystems:

1. **FA Daemon (`fad`)**: Manages FA element discovery, ZTC configuration, and VLAN/NSI mapping. Extended to read the `bypass-netlogin` flag from ZTC configuration and signal the NetLogin subsystem.
2. **LLDP Subsystem**: Receives and parses FA TLVs from connected FA devices. Passes FA element information (including client type) to the FA daemon.
3. **NetLogin Subsystem (`netloginMgr` / `netloginAgent`)**: Manages MAC-based authentication. Extended to maintain a bypass client list and suppress authentication for listed MAC addresses.

### 3.2 Key Modules and Processes

| Module | Role |
|---|---|
| `fad` (Fabric Attach Daemon) | ZTC configuration management, FA element lifecycle, bypass signaling |
| `lldpd` (LLDP Daemon) | FA TLV reception and parsing, neighbor table management |
| `netloginMgr` | NetLogin configuration and bypass client list management |
| `netloginAgent` | Per-port authentication enforcement, bypass list lookup |
| `hal` (Hardware Abstraction Layer) | FDB entry management for bypassed MAC addresses |
| `vlanMgr` | VLAN assignment coordination for FA elements |

### 3.3 Internal Data Structures

#### 3.3.1 ZTC Client Configuration Entry (Extended)

```c
typedef struct fa_ztc_client_config {
    fa_client_type_t    client_type;       /* FA client type enum */
    uint16_t            vlan_id;           /* Configured VLAN ID */
    uint32_t            nsi;               /* Configured NSI */
    bool                bypass_netlogin;   /* NEW: bypass-netlogin flag */
    /* ... other ZTC fields ... */
} fa_ztc_client_config_t;
```

#### 3.3.2 NetLogin Bypass Client Entry

```c
typedef struct netlogin_bypass_client {
    uint8_t     mac[6];        /* FA device MAC address */
    uint32_t    port;          /* Ingress port */
    uint16_t    vlan_id;       /* Associated VLAN */
    bool        active;        /* Entry is active */
    /* ... timestamp, aging fields ... */
} netlogin_bypass_client_t;
```

### 3.4 IPC Communication Between FA Daemon and NetLogin

The FA daemon communicates bypass instructions to the NetLogin subsystem using EXOS internal IPC (Inter-Process Communication) message passing. The message types include:

- **`FA_NETLOGIN_BYPASS_ADD`**: Sent when an FA device with `bypass-netlogin on` is discovered. Carries MAC address, port, and VLAN.
- **`FA_NETLOGIN_BYPASS_REMOVE`**: Sent when an FA element is removed (timeout, link-down, configuration change). Carries MAC address and port.
- **`FA_NETLOGIN_BYPASS_FLUSH_PORT`**: Sent on port link-down to remove all bypass entries for a port.
- **`FA_NETLOGIN_BYPASS_FLUSH_ALL`**: Sent when ZTC configuration is cleared.

### 3.5 Authentication Bypass Mechanism in NetLogin

When the NetLogin subsystem receives an `FA_NETLOGIN_BYPASS_ADD` message:

1. The MAC address is added to the bypass client table (in-memory hash table keyed by MAC+port).
2. When a new MAC address is seen on a NetLogin-enabled port, the NetLogin agent checks the bypass table before initiating authentication.
3. If the MAC is found in the bypass table, the authentication challenge is suppressed.
4. The MAC is allowed to pass traffic on the configured VLAN without authentication.
5. No RADIUS request is generated for bypassed MAC addresses.
6. The bypassed MAC is not added to the authenticated client list in NetLogin — it appears only in the bypass client list.

### 3.6 LLDP TLV Processing for FA Client Type

The