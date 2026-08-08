# NOS API Feature - Skill File

## Overview

**Feature**: NOS API (Network Operating System API)  
**Component**: Management Interface / REST API Framework  
**Category**: Network Management & Automation  
**First Available**: EXOS 30.1+  

NOS API is a REST API framework for Extreme Networks Operating System (EXOS) that enables programmatic configuration, monitoring, and management of network switches through standard HTTP/HTTPS interfaces.

---

## Feature Description

### What is NOS API?

**NOS API** provides a modern REST API interface for EXOS switches, allowing network administrators and automation tools to interact with switches using standard HTTP methods (GET, POST, PUT, DELETE) instead of traditional CLI commands.

### Key Capabilities

1. **Programmatic Configuration**: Configure switches via REST API calls
2. **Real-Time Monitoring**: Retrieve operational data and statistics
3. **Automation Integration**: Integrate with orchestration platforms (Ansible, Python, etc.)
4. **OpenConfig Support**: Industry-standard data models
5. **JSON/XML Support**: Flexible data formats
6. **Multi-Vendor Compatibility**: Standards-based approach

### Purpose and Benefits

**Automation**: Replace manual CLI configuration with automated API calls

**Integration**: Seamlessly integrate with DevOps/NetOps tools and workflows

**Scalability**: Manage multiple switches programmatically from centralized systems

**Consistency**: Reduce configuration errors through programmatic validation

**Speed**: Faster configuration deployment compared to manual CLI entry

**Monitoring**: Real-time data collection for analytics and monitoring systems

---

## How It Enhances Existing Features

### 1. **Complements CLI Management**

NOS API doesn't replace CLI but provides an alternative interface:

**Before NOS API:**
- SSH to each switch
- Enter CLI commands manually
- Copy/paste configurations
- Manual verification

**With NOS API:**
- REST API calls from automation scripts
- Batch configuration across multiple switches
- Programmatic validation
- Automated verification

### 2. **Enables Modern Automation**

Integrates with modern automation frameworks:

- **Ansible**: Playbooks using REST API modules
- **Python**: Scripts using requests/httpx libraries
- **Terraform**: Infrastructure as Code for network
- **CI/CD Pipelines**: Network configuration in deployment pipelines

### 3. **Standards-Based Management**

Uses industry-standard models:

- **OpenConfig**: Vendor-neutral data models
- **RESTCONF**: RFC 8040 protocol
- **YANG**: Data modeling language
- **JSON/XML**: Standard data formats

### 4. **Enhances Network Observability**

Provides programmatic access to operational data:

- Port statistics in machine-readable format
- VLAN membership data
- Routing table information
- System health metrics
- Real-time alerts and events

---

## Detailed Feature Behavior

### Architecture

```
┌─────────────────────────────────────────────────┐
│         Management Applications                 │
│  (Ansible, Python, Terraform, Postman, etc.)   │
└────────────────────┬────────────────────────────┘
                     │ HTTPS/HTTP
                     │ REST API Calls
┌────────────────────▼────────────────────────────┐
│              NOS API Server                     │
│  ┌──────────────────────────────────────────┐  │
│  │  RESTCONF Handler (RFC 8040)             │  │
│  │  - /rest/restconf/data/                  │  │
│  │  - /rest/restconf/operations/            │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  OpenAPI Handler                         │  │
│  │  - /rest/openapi/v0/                     │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Authentication & Authorization          │  │
│  │  - Basic Auth, Token Auth                │  │
│  └──────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────┘
                     │ Internal API
┌────────────────────▼────────────────────────────┐
│              EXOS Core                          │
│  ┌──────────┬──────────┬──────────┬─────────┐  │
│  │  Policy  │  VLAN    │  Port    │  Route  │  │
│  │  Manager │  Manager │  Manager │  Manager│  │
│  └──────────┴──────────┴──────────┴─────────┘  │
└─────────────────────────────────────────────────┘
```

### NOS API Components

1. **HTTP Server**: Listens on port 80 (HTTP) or 443 (HTTPS)
2. **RESTCONF Handler**: Implements RFC 8040 RESTCONF protocol
3. **OpenAPI Handler**: Custom Extreme Networks API extensions
4. **Data Models**: OpenConfig YANG models + Extreme extensions
5. **Authentication Module**: User authentication and authorization
6. **Transaction Manager**: Ensures configuration consistency
7. **Event Notifier**: Sends notifications for state changes

### Data Flow

**Configuration (Write) Operations:**
```
1. Client sends HTTP POST/PUT/PATCH with JSON payload
2. NOS API authenticates request
3. NOS API validates JSON against YANG model
4. NOS API translates to internal EXOS commands
5. EXOS applies configuration
6. NOS API returns success/error response
```

**Query (Read) Operations:**
```
1. Client sends HTTP GET request
2. NOS API authenticates request
3. NOS API queries EXOS operational/configuration data
4. NOS API formats data as JSON/XML
5. NOS API returns data to client
```

---

## Configuration & Setup

### Enabling NOS API

**Enable HTTP (Not Recommended for Production):**
```bash
enable web http
configure web http port 80
```

**Enable HTTPS (Recommended):**
```bash
enable web https
configure web https port 443
```

**Verify Service Status:**
```bash
show web
```

**Expected Output:**
```
Web Configuration
  HTTP:    Enabled
  HTTP Port: 80
  HTTPS:   Enabled
  HTTPS Port: 443
  SSL Certificate: Self-signed
  Authentication: Enabled
```

### SSL/TLS Configuration

**Generate Self-Signed Certificate:**
```bash
create ssl certificate self-signed subject "/CN=switch01.example.com" key-size 2048
configure web https certificate self-signed
```

**Install Custom Certificate:**
```bash
# Upload certificate files via TFTP/SCP
download ssl certificate <server> <filename>
configure web https certificate <cert-name>
```

**Verify Certificate:**
```bash
show ssl certificate
```

### Authentication Configuration

**Create API User:**
```bash
create account admin <username> <password>
configure account <username> readonly enable
# or for full access:
configure account <username> admin enable
```

**Configure Authentication Method:**
```bash
configure web authentication basic
# or
configure web authentication token
```

### Access Control

**Restrict Access by IP:**
```bash
configure web access-list add <ip-address> <netmask>
```

**Example - Allow only management network:**
```bash
configure web access-list add 10.1.1.0 255.255.255.0
configure web access-list deny all
```

---

## API Endpoints

### Base URLs

**RESTCONF (RFC 8040):**
- `https://<switch-ip>/rest/restconf/data/` - Configuration and state data
- `https://<switch-ip>/rest/restconf/operations/` - RPC operations

**OpenAPI v0 (Extreme-specific):**
- `https://<switch-ip>/rest/openapi/v0/` - Extreme-specific operations

### Common RESTCONF Endpoints

#### System Information
```http
GET /rest/restconf/data/openconfig-system:system/state
```

#### Port Configuration
```http
GET /rest/restconf/data/openconfig-interfaces:interfaces/interface={name}
POST /rest/restconf/data/openconfig-interfaces:interfaces/interface
PUT /rest/restconf/data/openconfig-interfaces:interfaces/interface={name}/config
DELETE /rest/restconf/data/openconfig-interfaces:interfaces/interface={name}
```

#### VLAN Management
```http
GET /rest/restconf/data/openconfig-vlan:vlans/vlan={vlan-id}
POST /rest/restconf/data/openconfig-vlan:vlans/vlan
DELETE /rest/restconf/data/openconfig-vlan:vlans/vlan={vlan-id}
```

#### Policy/IPP Configuration
```http
GET /rest/restconf/data/openconfig-policy-v3:policy/profiles
POST /rest/restconf/data/openconfig-policy-v3:policy/profiles/profile
PUT /rest/restconf/data/openconfig-policy-v3:policy/profiles/profile={name}
DELETE /rest/restconf/data/openconfig-policy-v3:policy/profiles/profile={name}
```

### OpenAPI v0 Endpoints

#### Instant Port Profiles
```http
GET /rest/openapi/v0/configuration/instant-port/profiles
PUT /rest/openapi/v0/configuration/instant-port/profiles/{profile-name}
DELETE /rest/openapi/v0/configuration/instant-port/profiles/{profile-name}
```

#### Port Assignment
```http
PUT /rest/openapi/v0/configuration/instant-port/ports/{port-list}/profile/{profile-name}
```

---

## Configuration Examples

### Example 1: Basic API Access Setup

**Scenario**: Enable HTTPS API access with authentication

```bash
# 1. Enable HTTPS
enable web https
configure web https port 443

# 2. Create API user
create account admin api_user api_password123
configure account api_user admin enable

# 3. Restrict access to management network
configure web access-list add 10.100.0.0 255.255.0.0
configure web access-list deny all

# 4. Verify configuration
show web
show accounts
```

### Example 2: Python Script - Get System Info

```python
import requests
from requests.auth import HTTPBasicAuth
import json

# Configuration
SWITCH_IP = "10.1.1.100"
USERNAME = "api_user"
PASSWORD = "api_password123"
BASE_URL = f"https://{SWITCH_IP}/rest/restconf/data"

# Disable SSL warnings for self-signed cert (use proper cert in production)
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Get system information
response = requests.get(
    f"{BASE_URL}/openconfig-system:system/state",
    auth=HTTPBasicAuth(USERNAME, PASSWORD),
    headers={"Accept": "application/json"},
    verify=False
)

if response.status_code == 200:
    system_info = response.json()
    print(json.dumps(system_info, indent=2))
    print(f"Hostname: {system_info['state']['hostname']}")
    print(f"Version: {system_info['state']['software-version']}")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

### Example 3: Create VLAN via API

**Python Example:**
```python
import requests
from requests.auth import HTTPBasicAuth

SWITCH_IP = "10.1.1.100"
USERNAME = "api_user"
PASSWORD = "api_password123"

# VLAN configuration data
vlan_data = {
    "vlan": [
        {
            "vlan-id": 100,
            "config": {
                "vlan-id": 100,
                "name": "Engineering",
                "status": "ACTIVE"
            }
        }
    ]
}

# Create VLAN
response = requests.post(
    f"https://{SWITCH_IP}/rest/restconf/data/openconfig-vlan:vlans",
    auth=HTTPBasicAuth(USERNAME, PASSWORD),
    headers={"Content-Type": "application/json"},
    json=vlan_data,
    verify=False
)

if response.status_code in [200, 201, 204]:
    print("VLAN 100 created successfully")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

**cURL Example:**
```bash
curl -X POST \
  https://10.1.1.100/rest/restconf/data/openconfig-vlan:vlans \
  -u api_user:api_password123 \
  -H "Content-Type: application/json" \
  -d '{
    "vlan": [{
      "vlan-id": 100,
      "config": {
        "vlan-id": 100,
        "name": "Engineering",
        "status": "ACTIVE"
      }
    }]
  }' \
  -k
```

### Example 4: Configure IPP Profile

```python
import requests
from requests.auth import HTTPBasicAuth

SWITCH_IP = "10.1.1.100"
USERNAME = "api_user"
PASSWORD = "api_password123"

# IPP Profile configuration
ipp_profile = {
    "name": "VoicePhone",
    "devices": [
        {
            "name": "IPPhone",
            "matchList": [
                {
                    "category": "LLDP",
                    "devType": "GEN_TEL_PHONE"
                }
            ],
            "actionList": [
                {
                    "actionType": "SET_VLAN_TAGGED",
                    "vlanList": ["300"]
                },
                {
                    "actionType": "RATE_LIMIT_BROADCAST",
                    "rateLimit": 1000
                },
                {
                    "actionType": "SET_QOS_EXAM_REPLACE",
                    "qosExamination": "802_1P",
                    "qosReplacement": "DSCP"
                }
            ]
        }
    ]
}

# Create/Update IPP Profile
response = requests.put(
    f"https://{SWITCH_IP}/rest/openapi/v0/configuration/instant-port/profiles/VoicePhone",
    auth=HTTPBasicAuth(USERNAME, PASSWORD),
    headers={"Content-Type": "application/json"},
    json=ipp_profile,
    verify=False
)

if response.status_code in [200, 201, 204]:
    print("IPP Profile 'VoicePhone' configured successfully")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

### Example 5: Ansible Playbook

```yaml
---
- name: Configure EXOS Switch via NOA API
  hosts: switches
  gather_facts: no
  vars:
    switch_ip: "{{ inventory_hostname }}"
    api_user: "api_user"
    api_password: "api_password123"
  
  tasks:
    - name: Create VLAN 200
      uri:
        url: "https://{{ switch_ip }}/rest/restconf/data/openconfig-vlan:vlans"
        method: POST
        user: "{{ api_user }}"
        password: "{{ api_password }}"
        force_basic_auth: yes
        validate_certs: no
        body_format: json
        body:
          vlan:
            - vlan-id: 200
              config:
                vlan-id: 200
                name: "Production"
                status: "ACTIVE"
        status_code: [200, 201, 204]
      register: vlan_result
    
    - name: Display result
      debug:
        msg: "VLAN 200 created - Status: {{ vlan_result.status }}"
```

---

## Verification and Monitoring

### Verify NOA Service Status

```bash
show web
```

**Expected Output:**
```
Web Configuration
  HTTP:    Enabled
  HTTP Port: 80
  HTTPS:   Enabled
  HTTPS Port: 443
  Active Sessions: 2
  Total Requests: 1523
  Failed Authentications: 5
```

### Monitor API Access

```bash
show web sessions
```

**Output:**
```
Web Active Sessions
Client IP        Username    Login Time           Idle Time
---------------  ----------  -------------------  ----------
10.100.1.50      api_user    Jul 01 15:23:45      00:02:15
10.100.1.51      admin       Jul 01 14:55:12      00:15:32
```

### View API Logs

```bash
show log messages | include web
```

**Example Logs:**
```
07/01/2026 15:23:45 <Info:WEB> User api_user logged in from 10.100.1.50
07/01/2026 15:24:12 <Info:WEB> POST /rest/restconf/data/openconfig-vlan:vlans - Success
07/01/2026 15:25:33 <Warn:WEB> Authentication failed from 10.100.1.99
```

### Test API Connectivity

**Using cURL:**
```bash
# Test basic connectivity
curl -X GET https://10.1.1.100/rest/restconf/data/openconfig-system:system/state \
  -u api_user:api_password123 \
  -k

# Test with verbose output
curl -v -X GET https://10.1.1.100/rest/restconf/data/openconfig-system:system/state \
  -u api_user:api_password123 \
  -k
```

**Using Python:**
```python
import requests
from requests.auth import HTTPBasicAuth

response = requests.get(
    "https://10.1.1.100/rest/restconf/data/openconfig-system:system/state",
    auth=HTTPBasicAuth("api_user", "api_password123"),
    verify=False
)

print(f"Status Code: {response.status_code}")
print(f"Response Time: {response.elapsed.total_seconds()}s")
print(f"Headers: {response.headers}")
```

---

## Common Issues and Solutions

### Issue 1: Connection Refused

**Symptom**: Cannot connect to API endpoint

**Diagnosis:**
```bash
show web
```

**Possible Causes:**
- NOA service not enabled
- Wrong port number
- Firewall blocking access

**Solutions:**
```bash
# Enable HTTPS
enable web https

# Verify port
show web | include Port

# Check access list
show web access-list
```

### Issue 2: Authentication Failed (401)

**Symptom**: HTTP 401 Unauthorized error

**Diagnosis:**
```bash
show accounts
show log messages | include web | include authentication
```

**Possible Causes:**
- Incorrect credentials
- Account doesn't have API access
- Account disabled

**Solutions:**
```bash
# Verify account exists
show accounts

# Enable admin access for account
configure account api_user admin enable

# Reset password if needed
configure account api_user password
```

### Issue 3: SSL Certificate Error

**Symptom**: SSL certificate validation fails

**Diagnosis:**
```bash
show ssl certificate
```

**Solutions:**

**Option 1: Disable certificate verification (Development only)**
```python
# Python
response = requests.get(url, verify=False)

# cURL
curl -k https://...
```

**Option 2: Install proper certificate**
```bash
# On EXOS switch
download ssl certificate <tftp-server> <cert-file>
configure web https certificate <cert-name>
```

**Option 3: Add certificate to trusted store (Client side)**
```python
# Python
response = requests.get(url, verify='/path/to/ca-bundle.crt')
```

### Issue 4: Configuration Not Applied

**Symptom**: API returns success but configuration not visible

**Diagnosis:**
```bash
# Check configuration
show configuration

# Check logs
show log messages | include web

# Verify via CLI
show vlan
show policy profile
```

**Possible Causes:**
- Transaction rollback due to error
- Invalid parameters accepted but not applied
- Configuration conflict

**Solutions:**
1. Verify API response includes success confirmation
2. Check for error messages in response body
3. Use GET to retrieve configuration after POST/PUT
4. Verify dependencies (e.g., VLAN exists before adding to IPP profile)

### Issue 5: Timeout Errors

**Symptom**: API requests time out

**Possible Causes:**
- Large response payload
- Switch under heavy load
- Network latency

**Solutions:**
```python
# Increase timeout in client
response = requests.get(url, timeout=30)

# Use pagination for large datasets
# Use filters to reduce response size
response = requests.get(
    f"{url}?vlan-id=100",  # Filter specific VLAN
    timeout=30
)
```

### Issue 6: Forbidden (403)

**Symptom**: HTTP 403 Forbidden error

**Diagnosis:**
```bash
show accounts
show web access-list
```

**Possible Causes:**
- IP address not in access list
- Account doesn't have required permissions
- Read-only account attempting write operation

**Solutions:**
```bash
# Add IP to access list
configure web access-list add 10.100.1.50 255.255.255.255

# Grant admin access
configure account api_user admin enable

# Verify permissions
show accounts detail api_user
```

---

## Platform Considerations

### Supported Platforms

NOA is available on:
- **Summit X-series**: X440, X450, X460, X465, X590, X620, X670, X690, X695, X870
- **ExtremeSwitching 5000 series**: 5320, 5420, 5520, 5720
- **VSP series**: Select models with EXOS

### Software Requirements

- **Minimum EXOS Version**: 30.1
- **Recommended Version**: 30.7+ (enhanced OpenConfig support)
- **Latest Features**: 33.x+ (IPP API, advanced filtering)

### Resource Considerations

- **Memory**: NOS API requires ~50-100MB RAM
- **CPU**: Minimal impact (<5% during normal operations)
- **Disk**: ~20MB for web server and certificates

### Performance Characteristics

- **Throughput**: 100-500 requests/second (depends on operation type)
- **Latency**: 10-200ms per request (varies by complexity)
- **Concurrent Sessions**: Up to 32 simultaneous API sessions
- **Max Payload Size**: 10MB per request

### High Availability

- **Cluster Mode**: API requests handled by master switch
- **Failover**: API sessions must reconnect after failover
- **State Sync**: Configuration changes sync across cluster members

---

## Security Best Practices

### 1. Use HTTPS Only

```bash
disable web http
enable web https
configure web https port 443
```

### 2. Strong Authentication

```bash
# Use strong passwords
create account admin api_user <strong-password>

# Consider token-based authentication for production
configure web authentication token
```

### 3. IP Whitelisting

```bash
# Allow only management network
configure web access-list add 10.100.0.0 255.255.0.0
configure web access-list deny all
```

### 4. Proper SSL Certificates

```bash
# Use CA-signed certificates in production
download ssl certificate <server> <ca-signed-cert.pem>
configure web https certificate production-cert
```

### 5. Least Privilege

```bash
# Create read-only account for monitoring
create account admin monitor_user <password>
configure account monitor_user readonly enable

# Use admin accounts only for configuration
```

### 6. Audit Logging

```bash
# Enable comprehensive logging
enable log target syslog <syslog-server> vr VR-Default severity Info
configure log target syslog <syslog-server> filter DefaultFilter
configure log target syslog <syslog-server> match Any
```

### 7. Rate Limiting

Configure rate limiting to prevent API abuse:
```bash
configure web rate-limit requests 100 per-minute
configure web rate-limit max-connections 10 per-ip
```

---

## Integration Examples

### Terraform Provider

```hcl
terraform {
  required_providers {
    exos = {
      source = "extreme/exos"
      version = "1.0.0"
    }
  }
}

provider "exos" {
  host     = "10.1.1.100"
  username = "api_user"
  password = "api_password123"
  insecure = true
}

resource "exos_vlan" "engineering" {
  vlan_id = 100
  name    = "Engineering"
  description = "Engineering Department"
}

resource "exos_ipp_profile" "voice_phone" {
  name = "VoicePhone"
  devices = [{
    name = "IPPhone"
    match_category = "LLDP"
    match_devtype = "GEN_TEL_PHONE"
    actions = [
      {
        type = "SET_VLAN_TAGGED"
        vlans = ["300"]
      },
      {
        type = "RATE_LIMIT_BROADCAST"
        rate = 1000
      }
    ]
  }]
}
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    environment {
        SWITCH_IP = '10.1.1.100'
        API_CREDS = credentials('exos-api-credentials')
    }
    
    stages {
        stage('Deploy Configuration') {
            steps {
                script {
                    sh '''
                        curl -X POST \
                          https://${SWITCH_IP}/rest/restconf/data/openconfig-vlan:vlans \
                          -u ${API_CREDS} \
                          -H "Content-Type: application/json" \
                          -d @vlan-config.json \
                          -k
                    '''
                }
            }
        }
        
        stage('Verify') {
            steps {
                script {
                    sh '''
                        curl -X GET \
                          https://${SWITCH_IP}/rest/restconf/data/openconfig-vlan:vlans/vlan=100 \
                          -u ${API_CREDS} \
                          -k
                    '''
                }
            }
        }
    }
}
```

---

## Feature Interactions

### Works With

- **NetSight/XIQ**: Can coexist with GUI management
- **CLI**: API and CLI changes are synchronized
- **SNMP**: Both protocols can be used simultaneously
- **Syslog**: API events logged to syslog servers

### Dependencies

- **User Accounts**: Requires user account for authentication
- **Web Server**: Requires web service enabled
- **Network Connectivity**: Requires IP connectivity to switch

### Conflicts

- **Port Conflicts**: HTTP/HTTPS ports cannot be used by other services
- **Resource Limits**: Heavy API usage may impact other management protocols

---

## Migration from CLI to API

### CLI to API Mapping

| CLI Command | API Endpoint | Method |
|-------------|--------------|--------|
| `create vlan <id> tag <tag>` | `/rest/restconf/data/openconfig-vlan:vlans` | POST |
| `show vlan` | `/rest/restconf/data/openconfig-vlan:vlans` | GET |
| `configure vlan <id> add ports <ports> tagged` | `/rest/restconf/data/openconfig-vlan:vlans/vlan={id}` | PUT |
| `show ports <port> information` | `/rest/restconf/data/openconfig-interfaces:interfaces/interface={port}` | GET |
| `enable ports <port>` | `/rest/restconf/data/openconfig-interfaces:interfaces/interface={port}/config` | PUT |

### Migration Strategy

1. **Identify** CLI workflows to automate
2. **Map** CLI commands to API endpoints
3. **Test** API calls in development environment
4. **Validate** results match CLI behavior
5. **Deploy** automation to production
6. **Monitor** API performance and errors

---

## References

### Documentation

- **EXOS User Guide**: REST API chapter
- **OpenConfig Models**: https://openconfig.net/
- **RESTCONF Specification**: RFC 8040
- **YANG Specification**: RFC 7950

### Related Features

- **Instant Port Profile (IPP)**: Automated port configuration
- **NetLogin**: Network access control
- **Policy**: QoS and ACL management
- **SNMP**: Alternative management protocol

### Tools and Libraries

**Python:**
- `requests` - HTTP library
- `pyexos` - EXOS-specific library

**JavaScript/Node.js:**
- `axios` - Promise-based HTTP client
- `node-fetch` - Fetch API for Node.js

**cURL:**
- Command-line HTTP client

---

## Summary

The **NOS API feature** provides modern REST API access to EXOS switches, enabling:

✅ **Programmatic Configuration** - Automate switch configuration via REST API  
✅ **Real-Time Monitoring** - Retrieve operational data programmatically  
✅ **Standards-Based** - OpenConfig models, RESTCONF protocol  
✅ **Integration Ready** - Works with Ansible, Python, Terraform, Jenkins  
✅ **Secure** - HTTPS, authentication, access control  
✅ **Comprehensive** - Covers VLANs, ports, IPP, routing, QoS, and more  

**Key Takeaways:**

- Enable HTTPS for production deployments
- Use strong authentication and access control
- Leverage OpenConfig models for vendor-neutral automation
- Test API calls thoroughly before production use
- Monitor API logs for errors and authentication failures
- Combine with CLI for complete management coverage

**Recommendation**: NOS API is the foundation for modern network automation. Start with simple GET operations for monitoring, then progress to configuration automation for common tasks like VLAN management and port configuration.
