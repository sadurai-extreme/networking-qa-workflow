**Network Login Bypass Feature Documentation**
=====================================================

**Table of Contents**
-----------------

1. [Feature Overview](#feature-overview)
2. [Configuration Options](#configuration-options)
3. [Show Command Integration](#show-command-integration)
4. [LLDP Integration](#lldp-integration)
5. [VLAN Assignment Coordination](#vlan-assignment-coordination)
6. [Client Type Support](#client-type-support)
7. [Feature Interactions](#feature-interactions)
8. [Configuration Examples](#configuration-examples)
9. [Operational Characteristics and Scalability](#operational-characteristics-and-scalability)
10. [Troubleshooting and Debugging](#troubleshooting-and-debugging)

**1. Feature Overview**
------------------------

The Network Login Bypass feature allows administrators to configure specific clients or ports to bypass the network login authentication process.

### Functional Behavior

* The feature can be enabled/disabled on a per-port basis
* When enabled, clients connected to the specified port(s) will not undergo network login authentication
* The feature interacts with other EXOS features, including LLDP and VLAN assignment

**2. Configuration Options**
---------------------------

The Network Login Bypass feature can be configured using the following CLI commands:

```markdown
# configure netlogin bypass-port 1:10-1:14
# enable netlogin bypass-port 1:10-1:14
```

### Configuration Options (continued)

* The `netlogin bypass-port` command specifies the port(s) to bypass network login authentication
* The `enable` keyword enables the feature for the specified port(s)
* Administrators can configure multiple ports using a single command

**3. Show Command Integration**
------------------------------

The following show commands display information related to the Network Login Bypass feature:

```markdown
# show netlogin bypass-port
```

### Show Command Output

| Port | Bypass Status |
| --- | --- |
| 1:10-1:14 | Enabled |

**4. LLDP Integration**
----------------------

The Network Login Bypass feature interacts with the LLDP (Link Layer Discovery Protocol) feature to communicate bypass clients to the NetLogin subsystem.

### LLDP Integration Details

* The LLDP feature communicates bypass client information to the NetLogin subsystem
* The NetLogin subsystem maintains a list of bypass clients even when the feature is disabled

**5. VLAN Assignment Coordination**
-----------------------------------

The Network Login Bypass feature interacts with the VLAN assignment process to ensure that bypass clients are assigned to the correct VLAN.

### VLAN Assignment Details

* The FA zero-touch-client configures VLAN/NSI assignment
* NetLogin authentication affects whether assignment occurs
* The bypass mechanism allows FA VLAN assignment without NetLogin

**6. Client Type Support**
-------------------------

The Network Login Bypass feature supports all client types, including switches, servers, IP phones, cameras, and more.

### Client Type Details

* Applies to all FA client types (Switch, Server, IP Phone, Camera, etc.)
* "No Auth" server types display "N/A" for bypass status

**7. Feature Interactions**
-------------------------

The Network Login Bypass feature interacts with other EXOS features, including:

* LLDP
* VLAN assignment
* NetLogin authentication

### Feature Interaction Details

* The feature interacts with the LLDP feature to communicate bypass clients
* The feature interacts with the VLAN assignment process to ensure correct VLAN assignment
* The feature interacts with the NetLogin authentication process to determine whether assignment occurs

**8. Configuration Examples**
---------------------------

The following configuration examples demonstrate how to configure the Network Login Bypass feature:

```markdown
# configure netlogin bypass-port 1:10-1:14
# enable netlogin bypass-port 1:10-1:14
```

### Additional Configuration Example

* Configure multiple ports using a single command:
```markdown
# configure netlogin bypass-port 1:10-1:14,4:1-4:4
# enable netlogin bypass-port 1:10-1:14,4:1-4:4
```

**9. Operational Characteristics and Scalability**
------------------------------------------------

The Network Login Bypass feature operates as follows:

* The feature can be enabled/disabled on a per-port basis
* When enabled, clients connected to the specified port(s) will not undergo network login authentication
* The feature interacts with other EXOS features, including LLDP and VLAN assignment

### Operational Characteristics Details

* The feature is designed for use in large-scale networks
* Administrators can configure multiple ports using a single command
* The feature ensures correct VLAN assignment for bypass clients

**10. Troubleshooting and Debugging**
-----------------------------------

The following troubleshooting steps can be used to resolve issues related to the Network Login Bypass feature:

### Troubleshooting Steps

1. Verify that the feature is enabled/disabled on the correct port(s)
2. Check LLDP communication between switches
3. Verify VLAN assignment for bypass clients