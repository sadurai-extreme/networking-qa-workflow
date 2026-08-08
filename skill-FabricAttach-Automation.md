# Fabric Attach Automation Skill File

## Overview

This skill file documents the EXOS Fabric Attach (FA) TCL automation framework used across the following functional test modules:
- `EXOS_Fabric_Attach_Zero_Touch_Client` (ZTC)
- `Fabric_Attach_Over_MLAG`
- `Fabric_Attach_Radius_VSA`
- `Fabric_Attach_Static_NSI_Offset`

---

## 1. Automation Framework Fundamentals

### 1.1 DUT Role Mapping (Standard 5-Node Topology)

| DUT  | Default Role         | ZTC Topo-1 Role       | MLAG Topo Role        |
|------|----------------------|-----------------------|-----------------------|
| DUT1 | FA Server (VOSS/EXOS)| FA Server (VOSS)      | FA Server-1           |
| DUT2 | FA Proxy (standalone)| FA Proxy (standalone) | FA Server-2           |
| DUT3 | FA Proxy (MLAG peer1)| FA Proxy (MLAG peer1) | FA Proxy-1 (MLAG)     |
| DUT4 | FA Proxy (MLAG peer2)| FA Proxy (MLAG peer2) | FA Proxy-2 (MLAG)     |
| DUT5 | FA Client            | FA Client (WAP sim)   | FA Client             |

> **Note:** DUT1 starts as EXOS (VOSS FA Server mode is planned for future). When VOSS is DUT1, `create auto-peering ospf routerid` is replaced by VOSS FA Server CLI.

### 1.2 Global Variables Required

Every test script starts with these global declarations:

```tcl
global DUT1_CONNECT DUT2_CONNECT DUT3_CONNECT DUT4_CONNECT DUT5_CONNECT
global DUT1_IP DUT2_IP DUT3_IP DUT4_IP DUT5_IP
global DUTs_info
```

### 1.3 Port Naming Conventions (MANDATORY)

**NEVER use hardcoded port numbers. Always use these TCL procs:**

| Use Case                          | TCL Proc                            | Example                           |
|-----------------------------------|-------------------------------------|-----------------------------------|
| IXIA / front-panel access port    | `[MapDUTPortId <ixiaPortId> <DUT>]` | `[MapDUTPortId 1 1]` = IXIA port 1 on DUT1 |
| DUT-to-DUT trunk/uplink port      | `[GetATrunkPort <fromDUT> <toDUT> <index>]` | `[GetATrunkPort 2 1 1]` = 1st trunk from DUT2 to DUT1 |
| Multiple trunks (LAG members)     | `[GetATrunkPort 2 1 2]`             | 2nd trunk link from DUT2 to DUT1  |
| MLAG ISC link                     | `[GetATrunkPort 3 4 1]`             | ISC link between DUT3 and DUT4    |

**IXIA port mapping convention (ZTC Topo-1):**
- `[MapDUTPortId 1 1]` — IXIA port 1 connected to DUT1 (FA Server uplink side)
- `[MapDUTPortId 10 5]` — IXIA port 10 connected to DUT5 (FA Client side)
- `[MapDUTPortId 3 2]` — IXIA port 3 connected to DUT2 (standalone proxy)
- `[MapDUTPortId 5 3]` — IXIA port 5 connected to DUT3
- `[MapDUTPortId 7 4]` — IXIA port 7 connected to DUT4

---

## 2. Topology Definitions

### 2.1 Topology-1: VOSS FA Server + EXOS FA Proxy (ZTC Module)

```
   IXIA-1 ──── DUT1 (VOSS FA Server) ──┬── DUT2 (EXOS FA Proxy standalone)
                    │                    │
                DUT3 (EXOS MLAG Proxy) ─┤ (ISC: DUT3 ↔ DUT4)
                DUT4 (EXOS MLAG Proxy) ─┘
                    │
               DUT5 (FA Client WAP) ──── IXIA-10
```

**FA Server Init (VOSS DUT1):**
```tcl
Login $DUT1_CONNECT
SendACmd "create auto-peering ospf routerid 101.1.1.1"
exSleep 5
# Verify LTEP comes up
lappend ParameterList "{Local Endpoints.*101.1.1.1.*VR-Default.*} exist"
CheckKeyValue "show virtual-network" $ParameterList -time {s: 0 i: 2 d: 5 f: 10 r} \
    -comment "Checking LTEP configuration"
unset ParameterList
# After auto-peering, DUT1 transitions to FA Server
FA_Agent_type -DUT 1 -Type "Server"
# DUT2/3/4 automatically become FA Proxy
FA_Agent_type -DUT 2 -Type "Proxy"
FA_Agent_type -DUT 3 -Type "Proxy"
FA_Agent_type -DUT 4 -Type "Proxy"
```

**Standalone Proxy Init (when no FA Server VOSS/EXOS):**
```tcl
Login $DUT2_CONNECT
SendACmd "configure fabric attach uplink [GetATrunkPort 2 1 1]"
Login $DUT3_CONNECT
SendACmd "configure fabric attach uplink [GetATrunkPort 3 1 1]"
Login $DUT4_CONNECT
SendACmd "configure fabric attach uplink [GetATrunkPort 4 1 1]"
exSleep 5
FA_Agent_type -DUT 2 -Type "Standalone Proxy"
FA_Agent_type -DUT 3 -Type "Standalone Proxy"
FA_Agent_type -DUT 4 -Type "Standalone Proxy"
```

### 2.2 Topology-2: Dual EXOS FA Server (ZTC Module)

```
   IXIA-2 ──── DUT1 (EXOS FA Server-1) ═══ DUT2 (EXOS FA Server-2) ──── IXIA-4
                    │                              │
                DUT3 (MLAG Proxy-1) ═══ DUT4 (MLAG Proxy-2)
                    │
               DUT5 (FA Client) ──── IXIA-10
```

Both DUT1 and DUT2 run `create auto-peering ospf routerid <X>` to become FA Servers. DUT3/DUT4 are MLAG proxies connected to both servers.

### 2.3 Topology: EXOS FA Server (Future — EXOS as DUT1 FA Server)

When EXOS acts as FA Server (instead of VOSS):
- DUT1 = EXOS FA Server: `create auto-peering ospf routerid 101.1.1.1`
- All other config identical to VOSS topology
- Key difference: VOSS auto-peering uses `create auto-peering ospf` same as EXOS — the CLI is the **same** for EXOS FA Server
- Use `FA_Agent_type -DUT 1 -Type "Server"` to verify transition

### 2.4 Topology: Static NSI Offset (3-node)

```
   IXIA-1 ──── DUT3 (FA Client) ──── DUT1 (FA Proxy) ──── DUT2 (FA Server) ──── IXIA-2
```

### 2.5 Topology: FA Radius VSA / MLAG (5-node, MLAG centered)

```
            DUT5 (FA Proxy connected to two MLAG peers)
                 │               │
   DUT3 (MLAG Proxy-1) ═══ DUT4 (MLAG Proxy-2)
                 │               │
            DUT1 (FA Server-1)  DUT2 (FA Server-2 or Client)
```

---

## 3. Core Library Procedures

### 3.1 `FA_Agent_type` — Verify FA Mode

**File:** `EXOS_Fabric_Attach_Zero_Touch_Client/FabricAttach_Lib.tcl`

```tcl
# Verify a DUT's FA agent type (Server/Proxy/Client/Standalone Proxy)
FA_Agent_type -DUT <dut_number> -Type <"Server"|"Proxy"|"Client"|"Standalone Proxy">

# Examples:
FA_Agent_type -DUT 1 -Type "Server"       ;# DUT1 is FA Server
FA_Agent_type -DUT 2 -Type "Proxy"        ;# DUT2 auto-became FA Proxy
FA_Agent_type -DUT 3 -Type "Standalone Proxy" ;# DUT3 is standalone (no auto-peering)
FA_Agent_type -DUT 5 -Type "Client"       ;# DUT5 is FA Client
```

Internally calls: `CheckKeyValue "show fabric attach agent" ...`

---

### 3.2 `FA_Client_Simulation` — Simulate FA Client via LLDP

**File:** `EXOS_Fabric_Attach_Zero_Touch_Client/FA_Client_Simulation.tcl`

Generates a Python LLDP packet script, uploads it to a DUT via TFTP, and runs it using UPM to simulate an FA client sending LLDP TLVs.

```tcl
FA_Client_Simulation \
    -FA_ClientType <type_num> \
    -FileName <script_name> \
    -SourceMAC <"XX:XX:XX:XX:XX:XX"> \
    -VLAN_Interface <vlan_name> \
    -DUT <dut_number> \
    -ClientPort <"[GetATrunkPort X Y Z]"> \
    -Ixia <"[MapDUTPortId ixia_port dut]"> \
    -dummyTag <vlan_tag>
```

**FA Client Type Numbers:**

| Type Number | FA Client Type |
|-------------|---------------|
| 6           | Switch (type 18) |
| 7           | Router (type 19) |
| 8           | AP/WAP (type 20) |
| 9           | Camera (type 24) |
| 10          | Phone (type 28) |
| 11          | Type 29 |
| 12          | Type 30 |
| 14          | Type 38 |
| 15          | Type 40 |
| 16          | Type 42 |
| 17          | Type 44 |

**Example (ZTC Topo-1 — Phone client on standalone port):**
```tcl
FA_Client_Simulation \
    -FA_ClientType "10" \
    -FileName "FA_Phone" \
    -SourceMAC "00:00:00:11:11:01" \
    -VLAN_Interface "FA_Phone" \
    -DUT "5" \
    -ClientPort "[GetATrunkPort 5 2 1]" \
    -Ixia "[MapDUTPortId 10 5]" \
    -dummyTag 201
```

**What it does:**
1. Creates a tagged VLAN (`VLAN_Interface_ClientPort`) on the DUT
2. Adds the client port and IXIA port to the VLAN
3. Generates a Python script that crafts an LLDP packet with FA Element TLV
4. Uploads the script to the DUT via TFTP
5. `ConnectFAClient` then runs the script via UPM

---

### 3.3 `ConnectFAClient` — Trigger LLDP Packet Transmission

**File:** `EXOS_Fabric_Attach_Zero_Touch_Client/FabricAttach_Lib.tcl`

```tcl
ConnectFAClient \
    -DUT <dut_number> \
    -Device <script_base_name> \
    -Port <"[GetATrunkPort X Y Z]"> \
    [-VLAN_NSI <"vlan:nsi">] \
    [-NSI_TLV <True|False>]

# Example: Connect phone client on standalone port (DUT5 → DUT2)
ConnectFAClient -DUT 5 -Device FA_Phone -Port [GetATrunkPort 5 2 1]
exSleep 10

# Example: Connect with NSI TLV
ConnectFAClient -DUT 5 -Device FA_Phone -Port [GetATrunkPort 5 3 1] \
    -VLAN_NSI "101:1011001" -NSI_TLV True
```

**What it does:**
- Logs into the DUT
- Creates/edits UPM profile for the given device+port
- Executes `run upm profile` to transmit the LLDP packet

---

### 3.4 `DisconnectFAClient` — Remove Client Simulation

```tcl
DisconnectFAClient \
    -DUT <dut_number> \
    -Device <script_base_name> \
    -Port <client_port> \
    -Duration <"Permanently"|"Temporarily"> \
    -Interfaces <"port1 [port2 ...]">

# Example:
DisconnectFAClient -DUT 5 -Device FA_Phone -Port [GetATrunkPort 5 2 1] \
    -Duration "Permanently" -Interfaces "[GetATrunkPort 5 2 1]"
```

---

### 3.5 `CheckFA_Assignment` — Verify FA Assignment Table

**File:** `EXOS_Fabric_Attach_Zero_Touch_Client/FabricAttach_Lib.tcl`

```tcl
CheckFA_Assignment \
    -DUT <dut_number> \
    -VLAN <vlan_tag> \
    -VLAN_Name <vlan_name> \
    -Port <"[GetATrunkPort X Y Z]"> \
    -NSI <nsi_value> \
    [-ClientType <"ZTC"|"Dynamic"|"Static">] \
    [-Status <"Active"|"Pending">] \
    [-Presence <"exist"|"notExist">]

# Verify ZTC assignment created on DUT2 for phone client
CheckFA_Assignment -DUT "2" -VLAN "101" -VLAN_Name FA_PhoneVLAN \
    -Port [GetATrunkPort 2 5 1] -NSI 1011001

# Verify assignment does NOT exist (cleanup check)
CheckFA_Assignment -DUT "2" -VLAN "101" -VLAN_Name FA_PhoneVLAN \
    -Port [GetATrunkPort 2 5 1] -NSI 1011001 -Presence "notExist"
```

Internally calls: `CheckKeyValue "show fabric attach assignment" ...`
Timing: `{s: 0 i: 5 d: 5 f: 30 r}`

---

### 3.6 `CheckPortVLANMembership` — Verify Port in VLAN

**File:** `EXOS_Fabric_Attach_Zero_Touch_Client/FabricAttach_Lib.tcl`

```tcl
CheckPortVLANMembership \
    -DUT <dut_number> \
    -VLAN <vlan_name> \
    -Port <"[GetATrunkPort X Y Z]"> \
    [-TagInfo <"Tag"|"Untag">] \
    [-LAG <0|1>] \
    [-MLAG <0|1>] \
    [-Dynamic <0|1>] \
    [-Netlogin_Enabled <0|1>] \
    [-Presence <"exist"|"notExist">] \
    [-comment <description>]

# Examples:
# Client port (untag, standalone)
CheckPortVLANMembership -DUT 2 -VLAN "FA_PhoneVLAN" \
    -Port [GetATrunkPort 2 5 1] -TagInfo Untag

# Uplink port (tagged, LAG)
CheckPortVLANMembership -DUT 2 -VLAN "FA_PhoneVLAN" \
    -Port [GetATrunkPort 2 1 1] -TagInfo Tag -LAG 1

# MLAG client port (untag, dynamic, MLAG)
CheckPortVLANMembership -DUT 3 -VLAN "FA_PhoneVLAN" \
    -Port [GetATrunkPort 3 5 1] -TagInfo Untag -MLAG 1 \
    -comment "Check Client port presence"

# ISC port (tagged, LAG on MLAG peer)
CheckPortVLANMembership -DUT 3 -VLAN "FA_PhoneVLAN" \
    -Port [GetATrunkPort 3 4 1] -TagInfo Tag -LAG 1 \
    -comment "Check ISC port presence"

# Uplink MLAG port (tagged, MLAG)
CheckPortVLANMembership -DUT 3 -VLAN "FA_PhoneVLAN" \
    -Port [GetATrunkPort 3 1 1] -TagInfo Tag -MLAG 1 \
    -comment "Check uplink port presence"

# With Netlogin enabled (bypass mode)
CheckPortVLANMembership -DUT 2 -VLAN "FA_PhoneVLAN" \
    -Port [GetATrunkPort 2 5 1] -TagInfo Untag -Netlogin_Enabled 1
```

Internally calls: `CheckKeyValue "show vlan $VLAN" ...`

---

### 3.7 `CheckFADb` — Verify FA Database (MLAG module)

**File:** `Fabric_Attach_Over_MLAG/FA-Lib.tcl`

```tcl
CheckFADb \
    -dut <dut_number> \
    -fa_mode <"Proxy"|"Server"> \
    -FaDb_port <port> \
    -FaType <"Dynamic"|"Static"> \
    -FaDbCheck <"Exist"|"NotExist"> \
    -FADbStatus <"Active"|"Pending"> \
    -vlan_list <list> \
    -nsi_list <list>

# Example:
CheckFADb -dut 1 -fa_mode Proxy -FaDb_port [GetATrunkPort 1 3 1] \
    -FaType Dynamic -FaDbCheck Exist -FADbStatus Active \
    -vlan_list $VlanList -nsi_list $NsiList
```

---

### 3.8 `SimulateFAClient` — Radius VSA Client Simulation

**File:** `Fabric_Attach_Radius_VSA/FA_VSA_Lib.tcl`

Used in Radius VSA module. Sends LLDP FA packets via Python script from a DUT. Uses MySQL Radius server.

```tcl
SimulateFAClient \
    -dutNum <dut_number> \
    -clientTypeNum <type_num> \
    -destMAC "0180c200000e" \
    -srcMAC <switch_mac> \
    -InterfaceId <kernel_interface_id> \
    -PortId <port_id> \
    [-authkey <"None"|key>] \
    -vlanId <vlan> \
    -NsiID <nsi>
```

---

### 3.9 `MLAGPeerStatus` — Verify MLAG Peer State

```tcl
MLAGPeerStatus \
    -DUT <dut_number> \
    -LocalIP <ip> \
    -PeerIP <ip> \
    [-Status <"Up"|"Down">]

# Example:
MLAGPeerStatus -DUT 3 -LocalIP 10.1.2.1 -PeerIP 10.1.2.2 -Status Up
```

---

### 3.10 `CheckPortsInDynamicVlan` — Verify Port Counts in Dynamic VLAN

**File:** `Fabric_Attach_Over_MLAG/FA-Lib.tcl`

```tcl
CheckPortsInDynamicVlan \
    -dut <dut> \
    -fa_mode <mode> \
    -active_ports <count> \
    -total_ports <count> \
    -vlan_list <list>

# Example:
CheckPortsInDynamicVlan -dut 3 -fa_mode "" \
    -active_ports "2" -total_ports "3" -vlan_list $VlanList
```

---

### 3.11 `ValidateFAMode` — Return DUT FA Mode

```tcl
set mode [ValidateFAMode <dut_number>]
# Returns: "Client", "Proxy", "Server", "Standalone Proxy"
# Used in 1.init.tcl to validate testbed before execution
```

---

### 3.12 `FABuild_TB` / `FARemove_TB` — Testbed Port Enable/Disable

**File:** `Fabric_Attach_Radius_VSA/FA_VSA_Lib.tcl` and `Fabric_Attach_Static_NSI_Offset/FA_Offset_Lib.tcl`

```tcl
# Enable only relevant trunk ports for given topology
FABuild_TB 1    ;# Topology 1 (3-node or simpler)
FABuild_TB 2    ;# Topology 2 (5-node full mesh)

# Restore all ports after test
FARemove_TB
```

---

### 3.13 `CheckNResetFaMode` — Validate and Fix FA Mode After Cleanup

**File:** `Fabric_Attach_Over_MLAG/FA-Lib.tcl`

```tcl
# Called at end of cleanup to ensure all DUTs return to FA Client mode
# If not client, restarts process lldp to force transition
CheckNResetFaMode
```

---

### 3.14 `showLLDPNeighborInfo` — Verify LLDP Neighbor

```tcl
showLLDPNeighborInfo \
    -DUT <dut> \
    -NeighborMAC <mac> \
    -NeighborPort <port> \
    -LocalPort <local_port> \
    [-TTL <120>] \
    [-Presence <"exist"|"notExist">]
```

---

## 4. Test Case Structure Pattern

### 4.1 Standard Test Case Template

```tcl
proc X.Y.Z {} {
    set testNo X.Y.Z
    set title "EXOS_Fabric_Attach_ZTC $testNo <description>"

    # Global variable declarations
    global DUT1_CONNECT DUT2_CONNECT DUT3_CONNECT DUT4_CONNECT DUT5_CONNECT
    global DUT1_IP DUT2_IP DUT3_IP DUT4_IP DUT5_IP
    global DUTs_info

    set fd_res [open_result_file "$testNo"]
    set time1 [clock seconds]
    result_h1 "$title"
    report_start_test "$title"

    ######################################################################
    # STEP 1: TOPOLOGY SETUP
    ######################################################################
    Topology_1_Setup $testNo          ;# or Topology_2_Setup

    ######################################################################
    # STEP 2: FEATURE CONFIGURATION
    ######################################################################
    # ZTC configuration on FA Proxy DUTs (DUT2/DUT3/DUT4)
    Login $DUT2_CONNECT
    SendACmd "create vlan FA_PhoneVLAN tag 101"
    SendACmd "configure fabric attach zero-touch-client phone vlan FA_PhoneVLAN nsi 1011001 enable priority dot1p"

    Login $DUT3_CONNECT
    SendACmd "create vlan FA_PhoneVLAN tag 101"
    SendACmd "configure fabric attach zero-touch-client phone vlan FA_PhoneVLAN nsi 1011001 enable priority dot1p"

    Login $DUT4_CONNECT
    SendACmd "create vlan FA_PhoneVLAN tag 101"
    SendACmd "configure fabric attach zero-touch-client phone vlan FA_PhoneVLAN nsi 1011001 enable priority dot1p"

    # Configure receiving VLAN on FA Server DUT1
    Login $DUT1_CONNECT
    SendACmd "create vlan FA_PhoneVLAN tag 101"
    SendACmd "configure vlan FA_PhoneVLAN add port [MapDUTPortId 1 1] tagged"

    ######################################################################
    # STEP 3: CLIENT CONNECTION
    ######################################################################
    ConnectFAClient -DUT 5 -Device FA_Phone -Port [GetATrunkPort 5 2 1]
    exSleep 10

    ######################################################################
    # STEP 4: VERIFICATION
    ######################################################################
    # Verify VLAN membership on client port
    CheckPortVLANMembership -DUT 2 -VLAN "FA_PhoneVLAN" \
        -Port [GetATrunkPort 2 5 1] -TagInfo Untag

    # Verify FA assignment entry
    CheckFA_Assignment -DUT "2" -VLAN "101" -VLAN_Name FA_PhoneVLAN \
        -Port [GetATrunkPort 2 5 1] -NSI 1011001

    # Verify tagged uplink presence
    CheckPortVLANMembership -DUT 2 -VLAN "FA_PhoneVLAN" \
        -Port [GetATrunkPort 2 1 1] -TagInfo Tag -LAG 1

    ######################################################################
    # STEP 5: TRAFFIC VERIFICATION (optional)
    ######################################################################
    SendFrame txPortId 10 sourceMac "00:00:00:11:11:01" \
        destMac "00:00:00:00:00:AA" -frameSize 512 \
        -frameRate 100000 -streamType contPacket -tag 201
    exSleep 5
    lappend checkRateList "1 100"
    CheckRates "10" $checkRateList "Checking L2 traffic from FA client" "1"
    unset checkRateList

    ######################################################################
    # STEP 6: CLEANUP
    ######################################################################
    Topology_1_Cleanup

    Login $DUT2_CONNECT
    SendACmd "configure fabric attach zero-touch-client phone disable"
    SendACmd "configure fabric attach zero-touch-client phone vlan none"
    SendACmd "delete vlan FA_PhoneVLAN"

    Login $DUT3_CONNECT
    SendACmd "configure fabric attach zero-touch-client phone disable"
    SendACmd "configure fabric attach zero-touch-client phone vlan none"
    SendACmd "delete vlan FA_PhoneVLAN"

    Login $DUT4_CONNECT
    SendACmd "configure fabric attach zero-touch-client phone disable"
    SendACmd "configure fabric attach zero-touch-client phone vlan none"
    SendACmd "delete vlan FA_PhoneVLAN"

    Login $DUT1_CONNECT
    SendACmd "delete vlan FA_PhoneVLAN"

    set time2 [clock seconds]
    result_p "*** Time for $testNo = [expr $time2-$time1] secs\n\n"
    close_result_file
    report_end_test
}
```

---

## 5. FA Zero Touch Client (ZTC) Module

### 5.1 ZTC CLI Commands

```tcl
# Configure ZTC on FA Proxy (DUT2/DUT3/DUT4 = EXOS)
SendACmd "configure fabric attach zero-touch-client phone vlan <vlan_name> nsi <nsi> enable priority dot1p"
SendACmd "configure fabric attach zero-touch-client phone vlan <vlan_name> nsi <nsi> enable priority <0-7>"
SendACmd "configure fabric attach zero-touch-client phone vlan <vlan_name> nsi <nsi> enable"
SendACmd "configure fabric attach zero-touch-client phone vlan <vlan_name> nsi <nsi> disable"

# Disable ZTC for a client type
SendACmd "configure fabric attach zero-touch-client phone disable"

# Remove ZTC VLAN mapping
SendACmd "configure fabric attach zero-touch-client phone vlan none"

# Enable/disable bypass-netlogin (EXOS-39369 feature)
SendACmd "configure lldp fabric-attach zero-touch-client phone bypass-netlogin on"
SendACmd "configure lldp fabric-attach zero-touch-client phone bypass-netlogin off"
```

### 5.2 ZTC Verification Commands

```tcl
# Show ZTC configuration
SendACmd "show fabric attach zero-touch-client"
SendACmd "show fabric attach assignment"
SendACmd "show fabric attach elements"
SendACmd "show fabric attach agent"

# LLDP neighbor check
SendACmd "show lldp port [GetATrunkPort 2 5 1] neighbors detailed"
SendACmd "show lldp neighbors"

# VLAN membership
SendACmd "show vlan FA_PhoneVLAN"
SendACmd "show vlan detail"

# Netlogin integration
SendACmd "show netlogin"
SendACmd "show netlogin port [GetATrunkPort 2 5 1]"
```

### 5.3 ZTC Topology-1 File Sourcing (in test cases)

```tcl
# Files sourced in test scripts:
source FabricAttach_Lib.tcl
source FA_Client_Simulation.tcl
source Topology_1_Setup.tcl
source Topology_2_Setup.tcl
```

### 5.4 ZTC with Netlogin Bypass (EXOS-39369 Feature)

This feature (`configure lldp fabric-attach zero-touch-client <type> bypass-netlogin <on|off>`) is configured on **FA Proxy** (DUT2/DUT3/DUT4), NOT on the FA Server:

```tcl
# ZTC bypass-netlogin configuration on FA Proxy
Login $DUT2_CONNECT
SendACmd "enable netlogin mac"
SendACmd "configure netlogin add mac-list default"
SendACmd "enable netlogin ports [MapDUTPortId 3 2] mac"
SendACmd "configure lldp fabric-attach zero-touch-client phone bypass-netlogin on"

# Verify bypass takes effect (FA client admitted without netlogin auth)
ConnectFAClient -DUT 5 -Device FA_Phone -Port [GetATrunkPort 5 2 1]
exSleep 10
CheckPortVLANMembership -DUT 2 -VLAN "FA_PhoneVLAN" \
    -Port [GetATrunkPort 2 5 1] -TagInfo Untag -Netlogin_Enabled 1

# Verify non-FA device still goes through netlogin
# (Send non-FA MAC from IXIA, verify it does NOT get admitted)
```

---

## 6. FA Over MLAG Module

### 6.1 MLAG Setup Pattern

```tcl
# DUT3 (MLAG Peer-1) setup
Login $DUT3_CONNECT
SendACmd "enable sharing [GetATrunkPort 3 4 1] grouping [GetATrunkPort 3 4 1] [GetATrunkPort 3 4 2] lacp"  ;# ISC LAG
SendACmd "enable sharing [GetATrunkPort 3 5 1] grouping [GetATrunkPort 3 5 1] lacp"                          ;# MLAG client port
SendACmd "enable sharing [GetATrunkPort 3 1 1] grouping [GetATrunkPort 3 1 1] lacp"                          ;# Uplink MLAG

SendACmd "create vlan ISC-1 tag 10"
SendACmd "configure vlan ISC-1 add ports [GetATrunkPort 3 4 1] tagged"
SendACmd "configure vlan ISC-1 ipaddress 10.1.2.1/24"

SendACmd "create mlag peer DUT-4"
SendACmd "configure mlag peer DUT-4 ipaddress 10.1.2.2"
SendACmd "configure mlag peer DUT-4 lacp-mac 00:00:00:a1:a2:a3"
SendACmd "enable mlag port [GetATrunkPort 3 5 1] peer DUT-4 id 1001"
SendACmd "enable mlag port [GetATrunkPort 3 1 1] peer DUT-4 id 2001"
```

### 6.2 MLAG FA Assignment Verification Pattern

After a client connects via MLAG, both MLAG peers (DUT3 and DUT4) should show the FA assignment:

```tcl
# Verify both MLAG peers have the FA assignment
CheckFA_Assignment -DUT "3" -VLAN "101" -VLAN_Name FA_PhoneVLAN \
    -Port [GetATrunkPort 3 5 1] -NSI 1011001
CheckFA_Assignment -DUT "4" -VLAN "101" -VLAN_Name FA_PhoneVLAN \
    -Port [GetATrunkPort 4 5 1] -NSI 1011001

# Verify VLAN propagation across MLAG
CheckPortVLANMembership -DUT 3 -VLAN "FA_PhoneVLAN" \
    -Port [GetATrunkPort 3 5 1] -TagInfo Untag -MLAG 1 -comment "Client port"
CheckPortVLANMembership -DUT 4 -VLAN "FA_PhoneVLAN" \
    -Port [GetATrunkPort 4 5 1] -TagInfo Untag -MLAG 1 -comment "Client port peer"
CheckPortVLANMembership -DUT 3 -VLAN "FA_PhoneVLAN" \
    -Port [GetATrunkPort 3 4 1] -TagInfo Tag -LAG 1  -comment "ISC port"
CheckPortVLANMembership -DUT 3 -VLAN "FA_PhoneVLAN" \
    -Port [GetATrunkPort 3 1 1] -TagInfo Tag -MLAG 1 -comment "Uplink FA port"
```

### 6.3 MLAG FA Cleanup

```tcl
# Disable MLAG
Login $DUT3_CONNECT
SendACmd "disable mlag port [GetATrunkPort 3 5 1]"
SendACmd "disable mlag port [GetATrunkPort 3 1 1]"
SendACmd "delete mlag peer DUT-4"
SendACmd "delete vlan ISC-1"
SendACmd "disable sharing [GetATrunkPort 3 4 1]"
SendACmd "disable sharing [GetATrunkPort 3 5 1]"
SendACmd "disable sharing [GetATrunkPort 3 1 1]"
```

---

## 7. FA Radius VSA Module

### 7.1 Radius Server Setup

```tcl
global RADIUSMYSQL
# Connect to MySQL Radius server
set radius_handler [ConnectRadiusMysql $RADIUSMYSQL]

# Or using wrapper
Changedb_dot1x_ConnectRadiusDatabase
```

### 7.2 Radius VSA Client Simulation

```tcl
# Get kernel interface name for the VLAN
# "debug vlan show vlan <name> | grep vlanNameInkernel"
# Returns value like "Defau_F4244"

SimulateFAClient \
    -dutNum 1 \
    -clientTypeNum 6 \
    -destMAC "0180c200000e" \
    -srcMAC "001100220033" \
    -InterfaceId "Defau_F4244" \
    -authkey "None" \
    -vlanId 10 \
    -NsiID 100
```

### 7.3 Radius VSA VLAN/NSI Mappings

```tcl
# Create VLAN/NSI mappings via CLI (static)
CreateVlanNsiMappings \
    -dut 2 \
    -edge_port [MapDUTPortId 3 2] \
    -vlan_list $VlanList \
    -nsi_list $NsiList

# Verify static and dynamic entries in FA Db
set parameterList ""
lappend parameterList "{VLAN_1699.*} {Static.*10699.*Active} inLine exist"
lappend parameterList "{VLAN_1699.*} {Dynamic.*10699.*Active} inLine exist"
CheckKeyValue "show fabric attach assignments" $parameterList \
    -comment "Check FA Database" -time {s: 1 i: 5 d: 60 f: 60 r}
unset parameterList
```

---

## 8. FA Static NSI Offset Module

### 8.1 NSI Offset CLI

```tcl
# Configure static NSI offset on FA Proxy (DUT1 in 3-node topo)
SendACmd "configure fabric attach nsi-offset <value>"

# Verify NSI offset applied to assignment
SendACmd "show fabric attach assignment"
```

### 8.2 NSI Offset Topology Init (3-node)

```tcl
FABuild_TB 1    ;# Enable ports for 3-node topology: DUT3-DUT1-DUT2
                ;# DUT3=Client, DUT1=Proxy, DUT2=Server

# FA Server setup on DUT2
Login $DUT2_CONNECT
SendACmd "create auto-peering ospf routerid 102.1.1.1"
FA_Agent_type -DUT 2 -Type "Server"
FA_Agent_type -DUT 1 -Type "Proxy"
```

---

## 9. Testbed Initialization (1.init.tcl Pattern)

### 9.1 Pre-Test Validation

```tcl
# Verify all DUTs start in FA Client mode (clean state)
set dut1FaMode [ValidateFAMode 1]
set dut2FaMode [ValidateFAMode 2]
# ... etc.

if {($dut1FaMode == "Client") && ($dut2FaMode == "Client") && ...} {
    result_ok "Proceeding — all DUTs in Client mode"
} else {
    result_error "Not all DUTs in Client mode — aborting"
    return 0
}
```

### 9.2 Platform / Version Checks

```tcl
# VxLAN capability check (needed for MLAG FA Server topology)
if { [regexp -nocase $sw1_type $vxLanDevices] } {
    result_debug "DUT1: VxLAN capable"
} else {
    result_skip "VxLAN not supported — skipping test"
    return "testSkipped"
}

# EXOS version check
if {$sw1_ver < "30.3"} {
    result_skip "Dynamic VxLAN requires EXOS 30.3+"
    return "testSkipped"
}
```

### 9.3 Link Speed Validation for LAG

```tcl
# Validate ports can form a LAG (must be same speed)
if { ![ValidatePortForLoadshare 5 "[GetATrunkPort 5 3 1] [GetATrunkPort 5 3 2] \
    [GetATrunkPort 5 4 1] [GetATrunkPort 5 4 2]"] } {
    result_skip "Ports not same speed — cannot form LAG"
    return "testSkipped"
}
```

---

## 10. Show Commands and Debug Commands

### 10.1 FA Show Commands

```tcl
# Core FA state
SendACmd "show fabric attach agent"
SendACmd "show fabric attach elements"
SendACmd "show fabric attach assignment"
SendACmd "show fabric attach statistics"
SendACmd "show fabric attach zero-touch-client"

# LLDP related
SendACmd "show lldp neighbors"
SendACmd "show lldp port <port> neighbors detailed"

# VLAN state
SendACmd "show vlan <name>"
SendACmd "show vlan detail"

# MLAG state  
SendACmd "show mlag peer"
SendACmd "show mlag port"
SendACmd "show port sharing"

# Virtual network (for VOSS auto-peering based FA Server check)
SendACmd "show virtual-network"
```

### 10.2 Debug Commands

```tcl
# FA database internal state
SendACmd "debug lldp show fabric attach database"
SendACmd "debug vlan show lib lldp vlans"
SendACmd "debug vlan show vlan"
SendACmd "debug vsm show ports"
SendACmd "debug ems show trace lldp fabricattach"

# BGP SYS_VLAN cleanup check
SendACmd "show vlan | include SYS_BGP"
```

---

## 11. Common CheckKeyValue Timing Patterns

| Scenario                          | Timing Pattern                         |
|-----------------------------------|----------------------------------------|
| Normal FA assignment check        | `{s: 0 i: 5 d: 5 f: 30 r}`           |
| LTEP/auto-peering check           | `{s: 0 i: 2 d: 5 f: 10 r}`           |
| VLAN cleanup/ageout check         | `{s: 1 i: 30 d: 300 f: 300 r}`       |
| MLAG peer status                  | `{s: 1 i: 2 d: 5 f: 15 r}`           |
| Dynamic VLAN clear after timeout  | `{s: 1 i: 10 d: 30 f: 30 r}`         |
| FA Database (conflict scenario)   | `{s: 1 i: 5 d: 60 f: 60 r}`          |
| FA Mode validation                | `{s: 1 i: 10 d: 40 f: 40 r}`         |

---

## 12. Cleanup Patterns

### 12.1 FA Server Cleanup

```tcl
# Remove VOSS/EXOS auto-peering (FA Server teardown)
Login $DUT1_CONNECT
SendACmd "delete auto-peering"
exSleep 5
lappend ParameterList "{Local Endpoints.*101.1.1.1.*VR-Default.*} notExist"
CheckKeyValue "show virtual-network" $ParameterList \
    -time {s: 0 i: 2 d: 5 f: 10 r} -comment "LTEP removed"
unset ParameterList
```

### 12.2 Standalone Proxy Cleanup

```tcl
Login $DUT2_CONNECT
SendACmd "configure fabric attach uplink none"
Login $DUT3_CONNECT
SendACmd "configure fabric attach uplink none"
Login $DUT4_CONNECT
SendACmd "configure fabric attach uplink none"
```

### 12.3 Static VLAN Cleanup

```tcl
# Remove any stale static VLANs (workaround for known issues)
StaticVlanCleanup 1
StaticVlanCleanup 2
StaticVlanCleanup 3
StaticVlanCleanup 4
StaticVlanCleanup 5
```

### 12.4 Post-Cleanup FA Mode Verification

```tcl
# Ensure all DUTs return to FA Client mode
CheckNResetFaMode

# Or manual per-DUT check:
FA_Agent_type -DUT 1 -Type "Client"
FA_Agent_type -DUT 2 -Type "Client"
FA_Agent_type -DUT 3 -Type "Client"
FA_Agent_type -DUT 4 -Type "Client"
FA_Agent_type -DUT 5 -Type "Client"
```

---

## 13. Known Issues and Workarounds

| JIRA ID     | Description                                                        | Workaround                                    |
|-------------|--------------------------------------------------------------------|-----------------------------------------------|
| EXOS-18199  | Dynamic VLANs not cleared after FA mode change to Client           | `StaticVlanCleanup` + restart lldp process    |
| EXOS-27275  | FA Proxy fails to transition to client after cleanup               | `CheckNResetFaMode` → restart lldp process    |
| EXOS-27733  | FA server port info on member port not cleared after LAG creation  | Restart lldp: `restartProcess -processName lldp` |
| EXOS-27630  | ISC port removed from static VLAN when MLAG port disabled          | Re-enable port, re-check after ageout         |
| EXOS-28559  | `delete auto-peering` fails to clear SYS_BGP vlan on stack        | Restart bgp process                           |
| xos0077879  | Static NSI bindings go Pending when dynamic binding removed        | Wait ~310s, verify Active state returns       |

---

## 14. VOSS FA Server Notes (Future Use)

When VOSS is DUT1 (FA Server), the following VOSS-specific differences apply:

| Aspect                       | EXOS FA Server                                  | VOSS FA Server                                 |
|------------------------------|------------------------------------------------|------------------------------------------------|
| FA Server enable             | `create auto-peering ospf routerid X.X.X.X`   | VOSS SPB/FA Server CLI (IS-IS based)           |
| FA Server verify             | `show virtual-network` (LTEP check)            | VOSS: `show isis` / `show fa`                  |
| VLAN/NSI mapping             | `configure vlan <name> add nsi <nsi>`          | VOSS: `i-sid <isid>` mapping                   |
| Auto-peering teardown        | `delete auto-peering`                          | VOSS: unconfigure FA Server role               |
| `FA_Agent_type` check        | Works on EXOS only                             | Must use VOSS equivalent show command          |
| LLDP config                  | `disable/enable lldp port <port>`              | Same IEEE 802.1ab LLDP commands                |

**Current Automation State:**
- All existing automation scripts use EXOS DUT1 as FA Server via `create auto-peering ospf`
- VOSS DUT1 FA Server topology is planned but **not yet scripted**
- When scripting VOSS FA Server: replace `Topology_1_Setup` FA Server section with VOSS CLI, keep all proxy/client procs unchanged

---

## 15. Skill File Usage in Test Plan Generation

When generating test plans for FA features, include these automation facts:

1. **Port references** must use `[GetATrunkPort fromDUT toDUT index]` and `[MapDUTPortId ixiaPort DUT]`
2. **FA mode checks** use `FA_Agent_type` proc — not raw `show fabric attach agent`
3. **Client simulation** uses `FA_Client_Simulation` + `ConnectFAClient` — not physical client connections
4. **Verification** uses `CheckFA_Assignment` and `CheckPortVLANMembership` procs
5. **Cleanup** must call `Topology_X_Cleanup` and verify `FA_Agent_type -Type "Client"` for all DUTs
6. **MLAG scenarios** must verify both MLAG peers (DUT3 AND DUT4) independently
7. **Timing**: Always use `exSleep 10` after `ConnectFAClient` before verification

---

*Source: Analyzed from `/root/exos-tcl-automation/automation/Functionaltest/` — August 2026*
*Modules: EXOS_Fabric_Attach_Zero_Touch_Client, Fabric_Attach_Over_MLAG, Fabric_Attach_Radius_VSA, Fabric_Attach_Static_NSI_Offset*
