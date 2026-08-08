# TCL Test Framework - SNMP Library (ExosSnmpLib.tcl)

## Overview
The EXOS TCL framework includes a full SNMP client library (`ExosSnmpLib.tcl`) that runs SNMP operations from the Linux test controller using `linuxSendACmd`. This means SNMP GET, SNMP walk, and TRAP/INFORM verification are ALL fully automatable — no external tool setup required.

## Core SNMP Procedures

### 1. snmpget_authNoPriv
**Purpose:** Send SNMPv3 GET with authentication but no privacy (authNoPriv)

**Syntax:**
```tcl
snmpget_authNoPriv 1 $snmpUserList $snmpAuthList $oidList $expectedList
```

**Parameters:**
- `dut` - DUT index (default: 1)
- `snmpuser_name` - List of SNMPv3 user names
- `snmpauth_name` - List of auth protocols (SHA, SHA-256, SHA-384, SHA-512, MD5)
- `snmpget_oid` - List of OIDs to query
- `snmpget_oid_check` - List of expected values in response

**Internally runs:**
```bash
snmpget -v3 -u <user> -l authNoPriv -a <authProto> -A password <DUT_IP> <OID>
```

**Use Cases:**
- Verify SNMPv3 GET succeeds with SHA-256/384/512 authentication
- Validate OID values after configuration
- End-to-end authNoPriv testing (TC 5.3.1)

**Example:**
```tcl
snmpget_authNoPriv 1 "sha256user sha384user sha512user" \
    "SHA-256 SHA-384 SHA-512" \
    "1.3.6.1.2.1.1.5.0 1.3.6.1.2.1.1.5.0 1.3.6.1.2.1.1.5.0" \
    "sysName sysName sysName"
```

---

### 2. snmpget_authPriv
**Purpose:** Send SNMPv3 GET/SET with both authentication and privacy (authPriv)

**Syntax:**
```tcl
snmpget_authPriv 1 $snmpUserList $snmpAuthList $snmpPrivList $oidList $expectedList
```

**Parameters:**
- `snmpauth_name` - Auth protocol (SHA-256, SHA-384, SHA-512)
- `snmppriv_name` - Privacy protocol (AES, AES-128, AES-256, DES)
- All other params same as snmpget_authNoPriv

**Internally runs:**
```bash
snmpget -v3 -u <user> -l authPriv -a <authProto> -A password -x <privProto> -X password <DUT_IP> <OID>
```

**Use Cases:**
- Verify SNMPv3 GET/SET with SHA-512 + AES-256 (TC 5.3.2)
- Testing authPriv security level
- Protocol mismatch validation (TC 5.4.4) — call with wrong credentials and verify error

**Example:**
```tcl
snmpget_authPriv 1 "sha512user" "SHA-512" "AES-256" \
    "1.3.6.1.2.1.1.5.0" "sysName"
```

---

### 3. snmpget_noAuthNoPriv
**Purpose:** Send SNMPv3 GET with no authentication and no privacy (noAuthNoPriv)

**Syntax:**
```tcl
snmpget_noAuthNoPriv 1 $snmpUserList $oidList $expectedList
```

**Internally runs:**
```bash
snmpget -v3 -u <user> -l noAuthNoPriv <DUT_IP> <OID>
```

---

### 4. SnmpCheckKeyValue_snmp
**Purpose:** Run any SNMP command (including snmpwalk) and verify key/value pairs in output

**Syntax:**
```tcl
SnmpCheckKeyValue_snmp "snmpwalk -v2c -c public -On <DUT_IP> <OID>" $parameterList
```

**Parameters:**
- `command` - Full snmp command string (snmpwalk, snmpget, snmpgetnext, etc.)
- `parameterList` - List of key/value pairs to verify in output

**Use Cases:**
- SNMP MIB walk to verify RFC 7860 auth-protocol OIDs (TC 5.3.8)
- Verify OID existence and values after configuration
- Check SNMPv3 authentication protocol OIDs (hmacSHA2-256, hmacSHA2-384, hmacSHA2-512)

**Example:**
```tcl
# Verify RFC 7860 SHA-256 auth OID (1.3.6.1.6.3.10.1.1.6)
lappend parameterList "{usmHMAC256SHA384AuthProtocol} exist"
lappend parameterList "{usmHMAC384SHA512AuthProtocol} exist"
lappend parameterList "{usmHMAC512SHA512AuthProtocol} exist"
SnmpCheckKeyValue_snmp "snmpwalk -v2c -c public -On $DUT1_IP 1.3.6.1.6.3.10.1.1" $parameterList
```

---

### 5. snmpHandleTraps_NoErr / ::snmpHandleTraps_NoErr
**Purpose:** Verify SNMP TRAP and INFORM messages received from the DUT

**Syntax:**
```tcl
snmpHandleTraps_NoErr $paramList -dut $DUT1_IP -time {s: 10 i: 5 e: 30}
```

**Parameters:**
- `paramList` - List of expected/unexpected trap OID patterns
- `-dut` - DUT IP address to monitor traps from
- `-time` - Timing: `s:` start wait, `i:` interval, `e:` end time (seconds)

**Mechanism:**
- Reads trap file from `/tmp/snmp_trap_<DUT_IP>` written by snmptrapd daemon
- Verifies trap PDUs contain expected OIDs/values

**Use Cases:**
- Verify SHA-2 user as security principal sends valid TRAP/INFORM (TC 5.3.9)
- Validate trap authentication with SNMPv3 SHA-2 credentials
- Check trap OID matches expected RFC OIDs

**Example:**
```tcl
# Configure trap receiver on DUT, then verify trap received
SendACmd "configure snmpv3 add target-addr sha256target param sha256params ipaddress $trapReceiverIP"
lappend paramList "{.*SNMPv2-MIB::snmpTrapOID.*} exist"
lappend paramList "{.*usmHMAC256SHA384AuthProtocol.*} exist"
snmpHandleTraps_NoErr $paramList -dut $DUT1_IP -time {s: 10 i: 5 e: 60}
```

---

### 6. UploadAndVerifyCapturedPacket_snmp
**Purpose:** Upload captured packet/config file via TFTP and verify its contents

**Syntax:**
```tcl
UploadAndVerifyCapturedPacket_snmp $testNo $parameterList
```

**Use Cases:**
- Verify saved SHA-2 user configuration file contents after upload (TC 5.3.7)
- Confirm encrypted passwords are preserved in saved config

---

### 7. linuxSendACmd
**Purpose:** Run any Linux shell command from the test controller (SSH server)

**Syntax:**
```tcl
set output [linuxSendACmd "snmpget -v3 -u sha256user -l authNoPriv -a SHA-256 -A mypassword $DUT1_IP sysName.0"]
```

**Use Cases:**
- Run snmpget/snmpwalk/snmpgetnext/snmptrap from test controller
- NETCONF client commands (if ncclient installed on test controller)
- Any shell-level automation needed alongside CLI

---

## Config Save / Upload / Restore

### Via CLI (fully automatable with SendACmd)

```tcl
# Save configuration
SendACmd "save configuration"

# Upload configuration to TFTP server
SendACmd "upload configuration $tftpServerList $filename"

# Download (restore) configuration from TFTP
SendACmd "tftp get $tftpServerList vr vr-Mgmt $filename"
SendACmd "download configuration $tftpServerList $filename"
```

**Use Cases:**
- Save/upload/download/restore of encrypted SHA-2 users (TC 5.3.7)
- Config persistence verification with CLI-2 syntax

---

## Classification Decision Guide (SNMP-related)

| Test Scenario | Classification | Procedure to Use |
|---|---|---|
| SNMP GET authNoPriv with SHA-2 | **Automatable** | `snmpget_authNoPriv` |
| SNMP GET/SET authPriv with SHA-2 + AES | **Automatable** | `snmpget_authPriv` |
| SNMP MIB walk for RFC 7860 OIDs | **Automatable** | `SnmpCheckKeyValue_snmp` with snmpwalk |
| SNMP TRAP / INFORM verification | **Automatable** | `snmpHandleTraps_NoErr` |
| Config save/upload/restore | **Automatable** | `SendACmd "upload configuration"` |
| Reboot + SNMP verification | **Automatable** | `CheckReboot` + `snmpget_authNoPriv` |
| Protocol/password mismatch error | **Automatable** | `snmpget_authPriv` with wrong credentials, verify error in output |
| NETCONF/YANG provisioning | **Semi-Automatable** | No NETCONF client proc in framework — requires manual ncclient setup |
| EWX/XML provisioning | **Semi-Automatable** | XML API has separate test suite but no built-in TCL proc |
