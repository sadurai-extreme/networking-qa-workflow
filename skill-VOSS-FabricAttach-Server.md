# VOSS BEB Fabric Attach Server — Skill File

## 1. Overview and Concept

### What is Fabric Attach (FA)?
Fabric Attach (FA) enables network edge devices that do **not** support SPB (Shortest Path Bridging), MAC-in-MAC encapsulation (802.1ah), or I-SIDs to take advantage of an SPB fabric infrastructure. Edge devices signal an SPB-aware **FA Server** to automatically configure I-SID-to-VLAN bindings via LLDP (IEEE 802.1AB). FA uses a client-server model.

### FA Roles
| Role | Description | Device Examples |
|------|-------------|-----------------|
| **FA Server** | SPB-capable BEB at the fabric edge. Accepts I-SID-to-VLAN requests from Proxies/Clients, creates Switched UNI (ELAN) I-SIDs automatically | VSP 4000, VSP 7200, VSP 8000 (VOSS) |
| **FA Proxy** | Non-SPB access switch; aggregates FA Clients and relays I-SID assignments to the FA Server | ERS 4800, ERS 5900, EXOS switches |
| **FA Client** | End-point device that advertises I-SID-to-VLAN requests directly | WLAN 9100 APs, IP Phones, EXOS switches in client mode |

### FA Operation Summary
1. FA Server globally enabled → FA enabled on specific interface (port/MLT/SMLT).
2. FA Server transmits LLDP PDUs with **FA Element TLV** (element discovery).
3. FA Proxy/Client recognizes FA Server, responds with its FA capabilities.
4. FA Proxy/Client sends **FA I-SID-to-VLAN Assignment TLV** (mapping request).
5. FA Server accepts → creates **Switched UNI (ELAN) I-SID** with endpoint on that port/MLT.
6. I-SID advertised to SPB network via IS-IS.

### FA TLV Types
| TLV | Purpose |
|-----|---------|
| **FA Element TLV** | Handshake/discovery; advertises FA capability and management VLAN |
| **FA I-SID-to-VLAN Assignment TLV** | Carries I-SID/VLAN mapping requests from Proxy/Client; status returned by Server |

### Switched UNI (ELAN) I-SIDs
- FA-created I-SIDs are always **ELAN** type with **Switched UNI** endpoints.
- Default: Layer 2 only. For **Layer 3**, a platform VLAN must be manually created with the same I-SID value.
- I-SID limits: max 94 assignments per port/MLT.

---

## 2. Prerequisites for VOSS FA Server

Before configuring FA, the following must be in place on the VOSS switch:

1. **SPBM boot flag enabled** (default): `show boot config flags` → `spbm-config-mode = true`
2. **SPBM globally enabled**: `spbm`
3. **SPBM instance created** with B-VLANs and nickname.
4. **IS-IS configured** with manual area, IS-IS interfaces on NNI ports, IS-IS globally enabled.
5. **IS-IS operational** (adjacency up on NNI ports to the SPBM core/BCB).

---

## 3. Lab Platform: VSP 7520 Fabric Engine (ECLI)

The actual test lab uses a **VSP 7520-48XT-6C** running **Fabric Engine** (VOSS 9.0.2.0, ECLI mode). Key platform facts:

- CLI mode: **ECLI** (Fabric Engine CLI — same structure as classic VOSS CLI but with Fabric Engine features)
- **Auto-sense** (`auto-sense enable`) is available on access ports — automatically configures SPBM, ISIS, and VLAN when connected to another Fabric Engine/SPB switch
- SPBM/IS-IS parameters can be auto-configured via auto-sense; minimal manual IS-IS config is needed in auto-sense deployments
- The onboarding I-SID (`auto-sense onboarding i-sid`) is used for zero-touch fabric onboarding
- LACP member ports **must** have `no auto-sense enable` before configuring LACP

---

## 4. SPBM / IS-IS Minimum Configuration (FA Server Prerequisite)

### Full Manual Configuration (traditional VOSS CLI)
```
enable
configure terminal

! Enable SPBM globally
spbm
spbm ethertype 0x8100

! Enter IS-IS router mode — configure SPBM instance
router isis
  spbm 1
  spbm 1 b-vid 4086,4087 primary 4086
  spbm 1 nick-name 1.00.01
  manual-area c0.2000.000.00
  is-type l1
  sys-name VOSS-FA-Server
  system-id 0001.0001.0001
exit

! Create SPBM B-VLANs
vlan create 4086 type spbm-bvlan
vlan create 4087 type spbm-bvlan

! Configure NNI (uplink to SPBM core) interface
interface GigabitEthernet 1/1
  isis
  isis spbm 1
  isis enable
  no shutdown
exit

! Enable IS-IS globally
router isis enable
```

### Minimal IS-IS Config (Fabric Engine / Auto-sense deployment — actual lab)
```
enable
configure terminal

spbm
spbm ethertype 0x8100

router isis
  is-type l1
exit
router isis enable

! Auto-sense on access ports (Fabric Engine feature — auto-configures SPBM)
interface GigabitEthernet 1/1
  auto-sense enable
  no shutdown
exit

! Onboarding I-SID for zero-touch fabric attach
auto-sense onboarding i-sid 15999999
i-sid name 15999999 "Onboarding I-SID"
```

### Key IS-IS show commands
| Command | Purpose |
|---------|---------|
| `show isis spbm` | Verify SPBM instance, B-VIDs, nickname, SMLT params |
| `show isis` | Verify IS-IS global state (AdminState, System ID, area) |
| `show isis interface` | Verify IS-IS interfaces, operational state, adjacency count |
| `show isis adjacency` | Verify adjacency to SPB peers is UP |
| `show isis lsdb` | Verify LSDB is populated |

---

## 5. MLT / LACP Configuration

### 5.1 Static MLT (without LACP)
```
enable
configure terminal

mlt 10 enable
mlt 10 member 1/25-1/26
mlt 10 encapsulation dot1q

interface GigabitEthernet 1/25
  default-vlan-id 0
  no shutdown
  no spanning-tree mstp force-port-state enable   ! STP disabled on MLT member
exit
interface GigabitEthernet 1/26
  default-vlan-id 0
  no shutdown
  no spanning-tree mstp force-port-state enable
exit
```

### 5.2 LACP-based MLT (actual lab configuration from VSP 7520)

This is the exact LACP MLT configuration used in the lab (from `MLT_SMLT_Config.txt`):

**VOSS Switch 1 (BEB-A)**:
```
enable
configure terminal

lacp enable

interface gigabitethernet 1/18-1/19
  no auto-sense enable          ! MUST disable auto-sense on LACP ports
  no shutdown
  lacp key 100
  lacp aggregation enable
  lacp enable
exit

mlt 3
interface mlt 3
  lacp enable key 100
exit
```

**VOSS Switch 2 (BEB-B) — same config, same LACP key**:
```
enable
configure terminal

lacp enable

interface gigabitethernet 1/18-1/19
  no auto-sense enable
  no shutdown
  lacp key 100
  lacp aggregation enable
  lacp enable
exit

mlt 3
interface mlt 3
  lacp enable key 100
exit
```

### 5.3 LACP Verification Commands
```
show lacp interface
show lacp interface gigabitethernet 1/18
show lacp interface mlt id 3
show interfaces gigabitethernet statistics lacp
```

> **CRITICAL**: Always use `no auto-sense enable` on LACP member ports before configuring LACP. Auto-sense and LACP are mutually exclusive on a port.

---

## 6. SMLT Configuration (For Dual-Homed FA Server Topology)

When two VOSS BEB switches act as an FA Server pair in SMLT (dual-homed):

```
! === On BOTH BEB-A and BEB-B ===
enable
configure terminal

! Disable IS-IS first before SMLT config
no router isis enable

router isis
  ! Set SMLT peer system ID (nodal MAC of the peer)
  spbm 1 smlt-peer-system-id <peer-system-id-xxxx.xxxx.xxxx>

  ! Set shared virtual B-MAC (same on both peers)
  spbm 1 smlt-virtual-bmac <00:xx:xx:xx:xx:xx>
exit

router isis enable

! Configure the MLT that connects to FA Proxy as SMLT
interface mlt <mlt-id>
  smlt
exit

! Configure vIST (virtual IST) for SMLT peer communication
vlan create <vIST-vlan-id> type port-mstprstp 0
vlan i-sid <vIST-vlan-id> <vIST-isid>

interface vlan <vIST-vlan-id>
  ip address <local-ip> <mask> <gateway>
exit

virtual-ist peer-ip <peer-ip> vlan <vIST-vlan-id>

! Verify
show virtual-ist
show isis spbm
```

### SMLT Key Points
- FA System ID is based on **virtual MAC** (SMLT virtual B-MAC) — must be the same on both peers.
- FA authentication key must be the same on both peers.
- vIST creates a virtualized IST channel through the SPBM cloud (no physical IST link required).
- Both peers can receive and create I-SIDs: DISC_LOCAL (learned first locally), DISC_REMOTE (synchronized from peer), or DISC_BOTH.

---

## 7. FA Server Configuration (Global + Interface)

### 7.1 Enable FA Globally

```
enable
configure terminal

fa enable

! Verify
show fa
show fa agent
```

**Expected output:**
```
FA Service            : enabled
FA Element Type       : server
FA Assignment Timeout : 240
FA Discovery Timeout  : 240
FA Provision Mode     : spbm
```

> FA is globally enabled by default on VOSS. The provision mode is always `spbm` (only SPB provisioning mode is supported on FA Server).

### 7.2 Configure FA Timeouts (Optional)

```
! Discovery timeout (45-480 sec, default 240): must be >= assignment timeout
fa discovery-timeout 240

! Assignment timeout (45-480 sec, default 240): must be <= discovery timeout
fa assignment-timeout 240

! Restore defaults
default fa discovery-timeout
default fa assignment-timeout
```

### 7.3 Enable FA on Interface (Port or MLT)

FA must be explicitly enabled on each port/MLT that connects to FA Proxies or Clients.

```
! On a port:
interface GigabitEthernet 1/3
  fa
  fa enable
exit

! On an MLT (actual lab config from VSP 7520 — FA VOSS config.txt):
interface mlt 10
  fa
  fa enable
  no fa message-authentication    ! Disabled for EXOS interop (EXOS proxy may not use FA auth)
exit
```

> **Important**: In Fabric Engine / ECLI, the `fa` command enters the FA sub-context under the interface before `fa enable`. In classic VOSS CLI the two commands may appear as one block; always confirm with `show fa interface` after configuration.

**Effect of enabling FA on an interface:**
- LLDP is automatically enabled (both TX and RX).
- Traffic **tagging is enabled** (port becomes tagged).
- **Spanning tree is disabled** on the port.
- Message authentication is enabled by default (default key).

> **`no fa message-authentication`**: Disable authentication when connecting to EXOS FA Proxy devices that are not configured with FA authentication key — prevents auth mismatch rejections.

### 7.4 FA Message Authentication (Per Interface)

```
! Enable/disable message authentication (enabled by default when FA is enabled):
interface GigabitEthernet 1/3
  fa message-authentication       ! enable
  no fa message-authentication    ! disable
exit

! Configure a custom authentication key (0-32 chars):
interface GigabitEthernet 1/3
  fa enable
  fa message-authentication
  fa authentication-key <key-string>   ! e.g., fa authentication-key mykey123
exit

! Restore default key:
interface GigabitEthernet 1/3
  default fa authentication-key
exit
```

> **IMPORTANT:** FA authentication key must match between FA Server interface and the connected FA Proxy/Client. In SMLT, same key must be configured on both BEB peers.

### 7.5 Configure FA Management I-SID (Optional)

The management I-SID tells downstream Proxy/Client devices which VLAN to use for management traffic.

```
! With C-VID (management VLAN ID transmitted to Proxy/Client):
interface GigabitEthernet 1/3
  fa management i-sid 101 c-vid 101
exit

! Without C-VID (management via untagged traffic):
interface mlt 1
  fa management i-sid 100
exit

! Remove:
interface GigabitEthernet 1/3
  no fa management i-sid
exit

! Verify:
show i-sid 101
show interfaces gigabitEthernet i-sid
```

---

## 8. Verification Commands

### FA Global Status
```
show fa                   ! Global FA config (service, type, timeouts, provision mode)
show fa agent             ! Same as show fa
```

### FA Interface Status
```
show fa interface                     ! All FA interfaces
show fa interface port 1/3            ! Specific port
show fa interface mlt 1               ! Specific MLT
show fa interface enabled-auth        ! Interfaces with auth enabled
show fa interface disabled-auth       ! Interfaces with auth disabled
```

**Output fields:** INTERFACE, SERVER STATUS (enabled/disabled), MGMT ISID, MGMT CVID, MSG AUTH STATUS, MSG AUTH KEY

### FA Element Discovery
```
show fa elements                      ! All discovered FA Proxies/Clients
show fa elements 1/3                  ! On specific port
```

**Output fields:** PORT, TYPE (proxy/client/server), MGMT VLAN, STATE (Tagging/AutoConfig), SYSTEM ID, ELEM AUTH, ASGN AUTH

**State Legend:** T=Tagged, U=Untagged, D=Disabled, S=Spbm, V=Vlan, I=Invalid  
**Auth Legend:** AP=Auth Pass, AF=Auth Fail, NA=Not Authenticated, N=None

### FA I-SID-to-VLAN Assignments
```
show fa assignment                    ! All assignments
show fa assignment 1/3                ! On specific port
```

**Output fields:** Interface, I-SID, Vlan (C-VID), State (active/reject/pending), Origin (proxy/client)

### FA-Created I-SIDs (Switched UNI/ELAN)
```
show i-sid elan                       ! All ELAN I-SIDs
show mlt i-sid 1                      ! ELAN I-SIDs on MLT 1
show interfaces gigabitEthernet i-sid ! Port-level I-SID info
```

**ORIGIN values:** DISC_LOCAL (learned from local TLV), DISC_REMOTE (synchronized from IST peer), DISC_BOTH (both), MANAGEMENT (FA management I-SID), CONFIG (manually configured endpoint added)

### FA Statistics
```
show fa statistics                    ! All ports — discovery + assignment stats
show fa statistics summary            ! Summary
show fa statistics 1/3                ! Specific port
clear fa statistics                   ! Clear all
```

**Columns:** DiscElem Received/Expired/Deleted/AuthFailed, Asgn Received/Accepted/Rejected/Expired/Deleted/AuthFailed

### FA Zero Touch
```
show fa zero-touch-client             ! Configured ZTC entries (type, I-SID, VLAN)
```

### LLDP Verification
```
show lldp neighbor                    ! All LLDP neighbors
show lldp neighbor port 1/3           ! Specific port neighbor
show lldp tx-stats                    ! TX statistics
show lldp rx-stats                    ! RX statistics
show lldp tx-stats port 1/3          ! Port-level TX stats
show lldp rx-stats port 1/3          ! Port-level RX stats
```

---

## 9. FA Zero Touch Client Attachment (Optional)

Enables automatic configuration of downstream FA Proxy/Client devices based on FA Server settings.

```
! Enable ZTC for a specific client type (e.g., IP phone → I-SID 1001):
fa zero-touch-client standard phone i-sid 1001
fa zero-touch-client standard camera i-sid 1003
fa zero-touch-client standard wap-type1 i-sid 1005
fa zero-touch-client standard switch i-sid 1010

! Disable ZTC for a type:
no fa zero-touch-client standard phone

! Verify:
show fa zero-touch-client
```

**Supported client types:** `camera | ona-sdn | ona-spb-over-ip | phone | router | security-device | srvr-endpt | switch | video | virtual-switch | wap-type1 | wap-type2`

---

## 10. FA Assignment Rejection Reasons

The FA Server rejects I-SID-to-VLAN assignments when:
- FA not properly configured on the port/MLT
- IS-IS is disabled (fatal — assignments rejected globally)
- C-VID not in range 1–4094 (4095 unsupported; 4096 = untagged)
- I-SID value is 0 or in reserved range 16777213–16777215
- I-SID already used for IP VPN, MVPN, SPB multicast, or Transparent Port UNI
- I-SID already in use in a private VLAN platform VLAN
- Port is in MLT but FA not enabled on that MLT
- Maximum 94 I-SID-to-VLAN assignments per port exceeded
- Maximum I-SIDs on switch exceeded
- Same endpoint on more than one I-SID
- Port/MLT associated with more than one C-VID in the same I-SID
- Resource error (memory)
- Authentication key mismatch

---

## 11. FA Configuration Constraints and Considerations

| Constraint | Detail |
|-----------|--------|
| FA + IS-IS | IS-IS must be globally enabled for FA assignments to be accepted |
| Spanning tree | Disabled automatically on FA-enabled ports |
| LACP | Disable LACP before changing LACP key on FA-enabled MLT |
| BROUTER | FA cannot be enabled on BROUTER ports |
| Flex UNI / T-UNI / C-VLAN UNI | Cannot enable FA on these port types |
| Static MAC/ARP/IGMP | Not supported on FA-enabled ports |
| SMLT | If SPBM instance deleted, delete FA on SMLT first |
| VLACP | FA/LLDP signaling runs independent of VLACP state; data forwarding depends on VLACP |
| Layer 3 support | Requires manual platform VLAN with same I-SID value as the FA assignment |
| Max assignments per port | 94 I-SID-to-VLAN mappings |

---

## 12. Complete FA Server Configuration Example

### 12.1 Actual Lab Configuration (VSP 7520 — Fabric Engine / ECLI)

Based on `FA VOSS config.txt` from the lab (VSP 7520-48XT-6C, VOSS 9.0.2.0):

```
7520-48XT-6C-FabricEngine:1# configure terminal

! SPBM global
spbm
spbm ethertype 0x8100

! IS-IS minimal config (auto-sense handles SPBM nick-name/b-vid automatically)
router isis
  is-type l1
exit
router isis enable

! MLT 10 = uplink/NNI toward SPB core (using LACP, ports 1/25-1/26)
lacp enable
mlt 10 enable
mlt 10 member 1/25-1/26
mlt 10 encapsulation dot1q

interface GigabitEthernet 1/25
  default-vlan-id 0
  no shutdown
  lacp key 100 aggregation enable
  no spanning-tree mstp force-port-state enable
exit
interface GigabitEthernet 1/26
  default-vlan-id 0
  no shutdown
  lacp key 100 aggregation enable
  no spanning-tree mstp force-port-state enable
exit

! Management/Onboarding VLAN with I-SID
vlan members remove 1 1/1-1/48,1/49-1/54
vlan create 4048 name "onboarding-vlan" type pvlan-mstprstp 0 secondary 4049
vlan i-sid 4048 15999999
auto-sense onboarding i-sid 15999999
i-sid name 15999999 "Onboarding I-SID"

! Access ports — auto-sense enabled (Fabric Engine feature)
interface GigabitEthernet 1/1
  auto-sense enable
  no shutdown
exit

! FA on MLT 10 (toward EXOS FA Proxy, auth disabled for EXOS interop)
interface mlt 10
  fa
  fa enable
  no fa message-authentication
exit
```

### 12.2 Non-SMLT (Single BEB FA Server — Traditional VOSS CLI)

```
! Step 1: SPBM/IS-IS prerequisite (NNI port toward SPB core is 1/1)
enable
configure terminal
spbm
router isis
  spbm 1
  spbm 1 b-vid 4086,4087 primary 4086
  spbm 1 nick-name 1.00.01
  manual-area c0.2000.0000.00
  is-type l1
  sys-name BEB-FAServer
  system-id 0001.0001.0001
exit
vlan create 4086 type spbm-bvlan
vlan create 4087 type spbm-bvlan
interface GigabitEthernet 1/1
  isis
  isis spbm 1
  isis enable
  no shutdown
exit
router isis enable

! Step 2: Enable FA globally
fa enable

! Step 3: Enable FA on access port (toward FA Proxy/Client)
interface GigabitEthernet 1/3
  fa
  fa enable
  fa message-authentication
  fa authentication-key myauthkey
exit

! Optional: Configure management I-SID (tells Proxy/Client which VLAN for mgmt)
interface GigabitEthernet 1/3
  fa management i-sid 101 c-vid 101
exit

! Step 4: Verify
show fa
show fa interface
show fa elements
show fa assignment
show i-sid elan
```

### 12.3 Dual-Homed SMLT FA Server (BEB-A and BEB-B as FA Server Pair)

```
! === On BEB-A ===
enable
configure terminal
! [SPBM/IS-IS already configured on NNI ports]

! SMLT IST peer config
no router isis enable
router isis
  spbm 1 smlt-peer-system-id 0001.0001.0002    ! BEB-B's system-id
  spbm 1 smlt-virtual-bmac 00:00:00:01:00:01   ! Shared virtual B-MAC
exit
router isis enable

! vIST channel
vlan create 2261 type port-mstprstp 0
vlan i-sid 2261 1502261
interface vlan 2261
  ip address 10.22.61.1 255.255.255.0 2
exit
virtual-ist peer-ip 10.22.61.2 vlan 2261

! SMLT MLT toward FA Proxy
interface mlt 1
  smlt
exit

! FA Server config on SMLT MLT
fa enable
interface mlt 1
  fa
  fa enable
  fa message-authentication
  fa authentication-key dual-smlt-key    ! MUST match on both BEB-A and BEB-B
exit

! === On BEB-B (mirror config) ===
! smlt-peer-system-id = BEB-A's system-id
! smlt-virtual-bmac   = same shared virtual B-MAC
! vIST peer-ip        = BEB-A's IP
! fa authentication-key = same key

! Verify on both BEBs
show virtual-ist
show fa
show fa interface
show fa elements
show fa assignment
show i-sid elan
show mlt i-sid 1
```

---

## 13. Layer 3 FA Support (Optional — Create Platform VLAN)

To support Layer 3 routing on FA-learned I-SIDs, manually create a platform VLAN with the same I-SID:

```
! FA assignment learned: I-SID 44, C-VID 2 on port 1/3
! For Layer 3 support:
vlan create 2 type port-mstprstp 0
vlan i-sid 2 44

! Verify — VLANID column will now show the platform VLAN
show i-sid elan
show vlan i-sid
```

---

## 14. Troubleshooting FA

| Issue | Check |
|-------|-------|
| FA assignments rejected | `show fa assignment` (state = reject), check IS-IS is enabled |
| No FA elements discovered | `show fa elements`, check LLDP: `show lldp neighbor`, check `show fa interface` (status = enabled) |
| Auth failures | `show fa elements` (ELEM AUTH = AF), verify matching auth key on both sides |
| LLDP not transmitting | `show lldp tx-stats port <port>`, verify FA is enabled on port |
| I-SID not created | Verify IS-IS adjacency: `show isis adjacency`, check assignment state is "active" |
| SMLT sync issues | `show virtual-ist`, verify vIST peer-ip is reachable, verify same smlt-virtual-bmac |

```
! Quick health check sequence:
show isis adjacency           ! IS-IS peers up?
show fa                       ! FA globally enabled?
show fa interface             ! FA enabled on port/MLT?
show fa elements              ! Proxy/Client discovered?
show fa assignment            ! Assignments active?
show i-sid elan               ! ELAN I-SIDs created?
show fa statistics            ! Any auth failures or rejections?
```

---

## 15. Topology Reference for Test Lab

### Lab Hardware
- **DUT1** = **VSP 7520-48XT-6C** (Fabric Engine, VOSS 9.0.2.0, ECLI mode) — FA Server role
  - Ports 1/25-1/26 → MLT 10 (LACP, key 100) → NNI / uplink
  - Access ports 1/1–1/24, 1/27+ → `auto-sense enable` (or FA enable when connecting to EXOS proxy)
- **DUT2** / **DUT3** = EXOS switches — FA Proxy role
- Management: OOB via DHCP on VLAN 4048 / I-SID 15999999

### Typical Test Topology (VOSS as FA Server)

```
[EXOS FA Proxy / EXOS FA Client]
         |
  LLDP FA TLVs (port/MLT)
         |
[VSP 7520 \u2014 FA Server (Fabric Engine)]   \u2190 DUT1
         |
   LACP MLT 10 (ports 1/25-1/26)
   IS-IS / SPBM NNI
         |
   [SPBM Core / BCB]
         |
   [Remote BEB / FA Server]
         |
[EXOS FA Proxy / other client]
```

### Port Role Naming Convention (for TCL test scripts)
- `DUT1` = VOSS FA Server (VSP 7520, BEB)
- `DUT2` / `DUT3` = EXOS FA Proxy switches (access layer, connected to DUT1)
- `DUT4` = EXOS FA Client or additional proxy
- `GetATrunkPort DUT2 DUT1` → port on DUT2 toward DUT1 (FA Server uplink)
- `MapDUTPortId DUT1 1` → FA-enabled port on DUT1 toward DUT2
- On VSP 7520: interface names use format `GigabitEthernet 1/<port>` (e.g., `GigabitEthernet 1/3`)

---

## 16. FA Server Configuration vs FA Proxy Configuration Differences

| Aspect | VOSS FA Server | EXOS FA Proxy |
|--------|---------------|---------------|
| Role | SPB fabric edge, creates I-SIDs | Non-SPB, relays client requests |
| FA enable command | `fa enable` (global + interface) | `configure lldp fabric-attach ports <port>` |
| Provision mode | `spbm` only | Proxy (non-SPBM) |
| I-SID creation | Automatic (Switched UNI ELAN) | N/A — requests to Server |
| Auth key | `fa authentication-key <key>` | FA key configured on ERS/EXOS |
| LLDP | Auto-enabled when FA enabled | LLDP must be pre-configured |
| IS-IS requirement | IS-IS must be running | Not required |
| Zero Touch | Configures ZTC client types | Receives ZTC info from Server |

---

---

*Source: Configuring Fabric Connect on VOSS (VSP BEB) — FA Server sections (p62–79, p134–175, p238–252)*
*Document: FAproxy-FAServer-VOSS_BEB.pdf*
*Lab Config References: FA VOSS config.txt (VSP 7520-48XT-6C, VOSS 9.0.2.0 Fabric Engine), MLT_SMLT_Config.txt*
