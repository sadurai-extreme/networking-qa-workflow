# EXOS-38882 Test Plan: NOS API OSPF Updates
## Version 1.0 - Automation-Ready Test Plan

**Feature**: NOS API: updates to OSPF (YAML PR 913)  
**Jira Ticket**: EXOS-38882  
**Type**: NOS API Endpoint Testing  
**Priority**: P2 - High  
**Test Plan Version**: 1.0  
**Date**: 2025-01-07  
**Author**: QA Automation Team  

---

## 1. Introduction

### 1.1 Purpose
This test plan validates the NOS API OSPF endpoints updated in YAML pull request 913. It covers REST API operations for OSPF configuration, state management, and operational data retrieval across VRFs, VLANs, areas, redistribution policies, and virtual circuits.

### 1.2 Scope
- **In Scope**:
  - All OSPF REST API endpoints (configuration and state)
  - HTTP methods: GET, POST, PATCH, PUT, DELETE
  - Data model validation (request/response schemas)
  - Error handling and edge cases
  - Platform-specific behavior (EXOS vs VOSS)
  - API-CLI consistency verification
  
- **Out of Scope**:
  - OSPF protocol convergence testing (covered by functional tests)
  - OSPF performance/scale testing
  - Multi-vendor OSPF interoperability
  - OSPF security/authentication protocol validation

### 1.3 Test Objectives
1. Verify all OSPF API endpoints return correct HTTP status codes
2. Validate request/response data models match OpenAPI specification
3. Ensure API operations correctly modify EXOS OSPF configuration
4. Confirm error handling for invalid inputs and edge cases
5. Verify API-CLI consistency (changes visible both ways)
6. Validate platform-specific field handling (EXOS vs VOSS)

---

## 2. Test Environment Setup

### 2.1 Hardware Requirements
- **DUT**: EXOS switch with OSPF support (X440-G2, X465, X690, X770, or 5720)
- **License**: Advanced Edge or Core license
- **Neighbor**: Optional second EXOS switch or router for adjacency testing
- **Traffic Generator**: Not required for API validation (optional for data plane verification)

### 2.2 Software Requirements
- **EXOS Version**: 33.7+ with YAML PR 913 changes
- **REST API**: Enabled (`enable web http` and/or `enable web https`)
- **Test Client**: Python 3.8+ with requests library, or Postman, or curl
- **Automation**: TCL framework with REST API support (http package)

### 2.3 Network Topology
```
┌─────────────────┐
│  Test Client    │
│  (API Caller)   │
└────────┬────────┘
         │ HTTPS/REST API
         │
┌────────▼────────────────────────┐
│      EXOS DUT                   │
│  ┌──────────────────────────┐   │
│  │ VR-Default               │   │
│  │  - OSPF Process          │   │
│  │  - Router ID: Auto/Manual│   │
│  └──────────────────────────┘   │
│                                 │
│  VLAN 10: 10.0.10.1/24  Area 0  │
│  VLAN 20: 10.0.20.1/24  Area 1  │
│  VLAN 30: 10.0.30.1/24  Area 2  │
└─────────────────────────────────┘
         │ Optional
         │ OSPF Adjacency
┌────────▼────────┐
│ OSPF Neighbor   │
│ (EXOS/Router)   │
└─────────────────┘
```

### 2.4 Base Configuration

```tcl
# VLAN Configuration
create vlan ospf_test_10
configure vlan ospf_test_10 tag 10
configure vlan ospf_test_10 ipaddress 10.0.10.1 255.255.255.0
enable ipforwarding vlan ospf_test_10

create vlan ospf_test_20
configure vlan ospf_test_20 tag 20
configure vlan ospf_test_20 ipaddress 10.0.20.1 255.255.255.0
enable ipforwarding vlan ospf_test_20

create vlan ospf_test_30
configure vlan ospf_test_30 tag 30
configure vlan ospf_test_30 ipaddress 10.0.30.1 255.255.255.0
enable ipforwarding vlan ospf_test_30

# Enable REST API (if not already enabled)
enable web http
# enable web https  # Recommended for production

# Verify REST API is accessible
# curl http://<switch-ip>/rest/restconf/data/openconfig-system:system/state
```

---

## 3. Global Test Variables

```tcl
# Test Configuration Constants
global API_BASE_URL
global API_AUTH_USER
global API_AUTH_PASS
global DUT_MGMT_IP
global VR_NAME
global TEST_VLAN_10
global TEST_VLAN_20
global TEST_VLAN_30
global TEST_AREA_0
global TEST_AREA_1
global TEST_AREA_2
global TEST_ROUTER_ID
global NEIGHBOR_ROUTER_ID

# Initialize variables
set API_BASE_URL "http://\[lindex \[split \$DUT1_CONNECT {:}] 0]/rest/restconf"
set API_AUTH_USER "admin"
set API_AUTH_PASS "admin"
set DUT_MGMT_IP [lindex [split $DUT1_CONNECT {:}] 0]
set VR_NAME "VR-Default"
set TEST_VLAN_10 "ospf_test_10"
set TEST_VLAN_20 "ospf_test_20"
set TEST_VLAN_30 "ospf_test_30"
set TEST_AREA_0 "0.0.0.0"
set TEST_AREA_1 "0.0.0.1"
set TEST_AREA_2 "0.0.0.2"
set TEST_ROUTER_ID "10.255.255.1"
set NEIGHBOR_ROUTER_ID "10.255.255.2"

# HTTP Status Codes
global HTTP_OK
global HTTP_CREATED
global HTTP_NO_CONTENT
global HTTP_BAD_REQUEST
global HTTP_NOT_FOUND
global HTTP_CONFLICT

set HTTP_OK 200
set HTTP_CREATED 201
set HTTP_NO_CONTENT 204
set HTTP_BAD_REQUEST 400
set HTTP_NOT_FOUND 404
set HTTP_CONFLICT 409

# Wait Times (milliseconds)
global OSPF_INIT_WAIT
global NEIGHBOR_ADJ_WAIT
global LSA_PROPAGATION_WAIT
global SPF_CALC_WAIT
global API_RESPONSE_WAIT

set OSPF_INIT_WAIT 10000           ;# 10 seconds for OSPF process start
set NEIGHBOR_ADJ_WAIT 120000       ;# 120 seconds for neighbor adjacency
set LSA_PROPAGATION_WAIT 15000     ;# 15 seconds for LSA propagation
set SPF_CALC_WAIT 10000            ;# 10 seconds for SPF recalculation
set API_RESPONSE_WAIT 5000         ;# 5 seconds for API response processing
```

---

## 4. Helper Functions

### 4.1 REST API Helper Functions

```tcl
##############################################################################
# Procedure: ApiGet
# Description: Perform HTTP GET request to NOS API
# Parameters:
#   - endpoint: API endpoint path (e.g., "/data/v0/configuration/ospf")
#   - expectedStatus: Expected HTTP status code (default: 200)
# Returns: Dictionary with keys: {status, headers, body}
##############################################################################
proc ApiGet {endpoint {expectedStatus 200}} {
    global API_BASE_URL API_AUTH_USER API_AUTH_PASS
    
    set url "${API_BASE_URL}${endpoint}"
    set auth [base64::encode "${API_AUTH_USER}:${API_AUTH_PASS}"]
    
    package require http
    package require json
    package require base64
    
    set token [::http::geturl $url \
        -headers [list Authorization "Basic $auth" Accept "application/json"] \
        -timeout 30000]
    
    set status [::http::ncode $token]
    set body [::http::data $token]
    set headers [::http::meta $token]
    ::http::cleanup $token
    
    if {$status != $expectedStatus} {
        result_error "ApiGet failed: Expected $expectedStatus, got $status. Response: $body"
        return [dict create status $status body $body headers $headers success 0]
    }
    
    result_ok "ApiGet $endpoint: HTTP $status"
    return [dict create status $status body $body headers $headers success 1]
}

##############################################################################
# Procedure: ApiPost
# Description: Perform HTTP POST request to NOS API
# Parameters:
#   - endpoint: API endpoint path
#   - jsonBody: JSON request body (as dict or string)
#   - expectedStatus: Expected HTTP status code (default: 204)
# Returns: Dictionary with keys: {status, headers, body}
##############################################################################
proc ApiPost {endpoint jsonBody {expectedStatus 204}} {
    global API_BASE_URL API_AUTH_USER API_AUTH_PASS
    
    set url "${API_BASE_URL}${endpoint}"
    set auth [base64::encode "${API_AUTH_USER}:${API_AUTH_PASS}"]
    
    package require http
    package require json
    package require base64
    
    # Convert dict to JSON string if needed
    if {[catch {set jsonString [::json::write object {*}$jsonBody]}]} {
        set jsonString $jsonBody
    }
    
    set token [::http::geturl $url \
        -headers [list Authorization "Basic $auth" \
                      Content-Type "application/json" \
                      Accept "application/json"] \
        -query $jsonString \
        -method POST \
        -timeout 30000]
    
    set status [::http::ncode $token]
    set body [::http::data $token]
    set headers [::http::meta $token]
    ::http::cleanup $token
    
    if {$status != $expectedStatus} {
        result_error "ApiPost failed: Expected $expectedStatus, got $status. Response: $body"
        return [dict create status $status body $body headers $headers success 0]
    }
    
    result_ok "ApiPost $endpoint: HTTP $status"
    return [dict create status $status body $body headers $headers success 1]
}

##############################################################################
# Procedure: ApiPatch
# Description: Perform HTTP PATCH request to NOS API
# Parameters:
#   - endpoint: API endpoint path
#   - jsonBody: JSON request body (as dict or string)
#   - expectedStatus: Expected HTTP status code (default: 204)
# Returns: Dictionary with keys: {status, headers, body}
##############################################################################
proc ApiPatch {endpoint jsonBody {expectedStatus 204}} {
    global API_BASE_URL API_AUTH_USER API_AUTH_PASS
    
    set url "${API_BASE_URL}${endpoint}"
    set auth [base64::encode "${API_AUTH_USER}:${API_AUTH_PASS}"]
    
    package require http
    package require json
    package require base64
    
    if {[catch {set jsonString [::json::write object {*}$jsonBody]}]} {
        set jsonString $jsonBody
    }
    
    set token [::http::geturl $url \
        -headers [list Authorization "Basic $auth" \
                      Content-Type "application/json" \
                      Accept "application/json"] \
        -query $jsonString \
        -method PATCH \
        -timeout 30000]
    
    set status [::http::ncode $token]
    set body [::http::data $token]
    set headers [::http::meta $token]
    ::http::cleanup $token
    
    if {$status != $expectedStatus} {
        result_error "ApiPatch failed: Expected $expectedStatus, got $status. Response: $body"
        return [dict create status $status body $body headers $headers success 0]
    }
    
    result_ok "ApiPatch $endpoint: HTTP $status"
    return [dict create status $status body $body headers $headers success 1]
}

##############################################################################
# Procedure: ApiPut
# Description: Perform HTTP PUT request to NOS API
# Parameters:
#   - endpoint: API endpoint path
#   - jsonBody: JSON request body (as dict or string)
#   - expectedStatus: Expected HTTP status code (default: 204)
# Returns: Dictionary with keys: {status, headers, body}
##############################################################################
proc ApiPut {endpoint jsonBody {expectedStatus 204}} {
    global API_BASE_URL API_AUTH_USER API_AUTH_PASS
    
    set url "${API_BASE_URL}${endpoint}"
    set auth [base64::encode "${API_AUTH_USER}:${API_AUTH_PASS}"]
    
    package require http
    package require json
    package require base64
    
    if {[catch {set jsonString [::json::write object {*}$jsonBody]}]} {
        set jsonString $jsonBody
    }
    
    set token [::http::geturl $url \
        -headers [list Authorization "Basic $auth" \
                      Content-Type "application/json" \
                      Accept "application/json"] \
        -query $jsonString \
        -method PUT \
        -timeout 30000]
    
    set status [::http::ncode $token]
    set body [::http::data $token]
    set headers [::http::meta $token]
    ::http::cleanup $token
    
    if {$status != $expectedStatus} {
        result_error "ApiPut failed: Expected $expectedStatus, got $status. Response: $body"
        return [dict create status $status body $body headers $headers success 0]
    }
    
    result_ok "ApiPut $endpoint: HTTP $status"
    return [dict create status $status body $body headers $headers success 1]
}

##############################################################################
# Procedure: ApiDelete
# Description: Perform HTTP DELETE request to NOS API
# Parameters:
#   - endpoint: API endpoint path
#   - expectedStatus: Expected HTTP status code (default: 204)
# Returns: Dictionary with keys: {status, headers, body}
##############################################################################
proc ApiDelete {endpoint {expectedStatus 204}} {
    global API_BASE_URL API_AUTH_USER API_AUTH_PASS
    
    set url "${API_BASE_URL}${endpoint}"
    set auth [base64::encode "${API_AUTH_USER}:${API_AUTH_PASS}"]
    
    package require http
    package require base64
    
    set token [::http::geturl $url \
        -headers [list Authorization "Basic $auth" Accept "application/json"] \
        -method DELETE \
        -timeout 30000]
    
    set status [::http::ncode $token]
    set body [::http::data $token]
    set headers [::http::meta $token]
    ::http::cleanup $token
    
    if {$status != $expectedStatus} {
        result_error "ApiDelete failed: Expected $expectedStatus, got $status. Response: $body"
        return [dict create status $status body $body headers $headers success 0]
    }
    
    result_ok "ApiDelete $endpoint: HTTP $status"
    return [dict create status $status body $body headers $headers success 1]
}

##############################################################################
# Procedure: ParseJsonResponse
# Description: Parse JSON response body and extract field value
# Parameters:
#   - jsonBody: JSON response body (string)
#   - fieldPath: Dot-notation path to field (e.g., "ospf.routerId")
# Returns: Field value or empty string if not found
##############################################################################
proc ParseJsonResponse {jsonBody fieldPath} {
    package require json
    
    if {[catch {set jsonDict [::json::json2dict $jsonBody]}]} {
        result_error "Failed to parse JSON response"
        return ""
    }
    
    set pathParts [split $fieldPath "."]
    set currentDict $jsonDict
    
    foreach part $pathParts {
        if {[dict exists $currentDict $part]} {
            set currentDict [dict get $currentDict $part]
        } else {
            result_error "Field path '$fieldPath' not found in JSON response"
            return ""
        }
    }
    
    return $currentDict
}

##############################################################################
# Procedure: VerifyOspfEnabled
# Description: Verify OSPF is enabled via CLI
# Parameters:
#   - vrName: VR name (default: VR-Default)
# Returns: 1 if enabled, 0 if disabled/error
##############################################################################
proc VerifyOspfEnabled {{vrName "VR-Default"}} {
    global DUT1_CONNECT
    
    set result [SendACmd "show ospf | include \"OSPF Process\""]
    if {[regexp {State:\s+ACTIVE} $result]} {
        result_ok "OSPF process is ACTIVE on $vrName"
        return 1
    } elseif {[regexp {State:\s+INACTIVE} $result]} {
        result_error "OSPF process is INACTIVE on $vrName"
        return 0
    } else {
        result_error "Unable to determine OSPF state on $vrName"
        return 0
    }
}

##############################################################################
# Procedure: CleanupOspfConfiguration
# Description: Remove all OSPF configuration (reset to clean state)
# Parameters: None
# Returns: 1 on success, 0 on failure
##############################################################################
proc CleanupOspfConfiguration {} {
    global TEST_VLAN_10 TEST_VLAN_20 TEST_VLAN_30 VR_NAME
    
    result_debug "Cleaning up OSPF configuration..."
    
    # Disable OSPF on all VLANs
    SendACmd "disable ospf vlan $TEST_VLAN_10"
    SendACmd "disable ospf vlan $TEST_VLAN_20"
    SendACmd "disable ospf vlan $TEST_VLAN_30"
    exSleep 2000
    
    # Disable OSPF export/redistribution
    SendACmd "disable ospf export direct"
    SendACmd "disable ospf export static"
    SendACmd "disable ospf export rip"
    exSleep 2000
    
    # Delete OSPF areas (non-backbone)
    SendACmd "delete ospf area 0.0.0.1 vr $VR_NAME"
    SendACmd "delete ospf area 0.0.0.2 vr $VR_NAME"
    exSleep 2000
    
    # Disable OSPF on VR (note: cannot delete from VR-Default)
    SendACmd "disable ospf vr $VR_NAME"
    exSleep 2000
    
    result_ok "OSPF configuration cleanup complete"
    return 1
}
```

---

## 5. Test Cases

### 5.1 Basic OSPF Configuration via API

#### Test Case 5.1.1: Enable OSPF on VR (POST)
**Sanity**: Yes  
**Test ID**: EXOS-38882-001  
**Priority**: P1  
**Objective**: Verify OSPF can be enabled on VR-Default via REST API  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_1_1_EnableOspfOnVr {} {
    global VR_NAME TEST_ROUTER_ID HTTP_NO_CONTENT
    global OSPF_INIT_WAIT
    
    # Test setup
    result_debug "=== Test Case 5.1.1: Enable OSPF on VR ==="
    CleanupOspfConfiguration
    
    # Step 1: POST request to add OSPF to VR-Default
    result_debug "Step 1: Send POST /v0/configuration/ospf to enable OSPF"
    set requestBody [dict create \
        vrName $VR_NAME \
        enable [::json::write boolean true] \
        routerId $TEST_ROUTER_ID \
        holdTime 5]
    
    set response [ApiPost "/data/v0/configuration/ospf" $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response success] == 0} {
        result_error "Failed to enable OSPF via API"
        return -1
    }
    
    # Step 2: Wait for OSPF process initialization
    result_debug "Step 2: Wait $OSPF_INIT_WAIT ms for OSPF process initialization"
    exSleep $OSPF_INIT_WAIT
    
    # Step 3: Verify OSPF is enabled via CLI
    result_debug "Step 3: Verify OSPF process state via CLI"
    if {[VerifyOspfEnabled $VR_NAME] == 0} {
        result_error "OSPF not enabled after API POST"
        return -1
    }
    
    # Step 4: Verify router ID via CLI
    result_debug "Step 4: Verify router ID configuration"
    set cliOutput [SendACmd "show ospf | include \"Router ID\""]
    if {![regexp "Router ID:\[\\s\]+${TEST_ROUTER_ID}" $cliOutput]} {
        result_error "Router ID not set correctly. Expected: $TEST_ROUTER_ID, CLI output: $cliOutput"
        return -1
    }
    result_ok "Router ID correctly set to $TEST_ROUTER_ID"
    
    # Step 5: Verify hold time via CLI
    result_debug "Step 5: Verify SPF hold time configuration"
    set cliOutput [SendACmd "show ospf | include \"SPF\""]
    if {![regexp {Hold\s+Time:\s+5} $cliOutput]} {
        result_error "SPF hold time not set correctly. Expected: 5, CLI output: $cliOutput"
        return -1
    }
    result_ok "SPF hold time correctly set to 5 seconds"
    
    # Test cleanup
    result_ok "=== Test Case 5.1.1: PASSED ==="
    return 0
}
```

**Expected Results**:
- API POST returns HTTP 204 (No Content)
- OSPF process transitions to ACTIVE state
- Router ID set to 10.255.255.1
- SPF hold time set to 5 seconds
- Configuration visible via `show ospf`

---

#### Test Case 5.1.2: Get OSPF Configuration (GET All VRs)
**Sanity**: Yes  
**Test ID**: EXOS-38882-002  
**Priority**: P1  
**Objective**: Verify retrieval of OSPF configuration across all VRs  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_1_2_GetOspfAllVrs {} {
    global VR_NAME TEST_ROUTER_ID HTTP_OK
    
    # Test setup: Ensure OSPF is enabled
    result_debug "=== Test Case 5.1.2: Get OSPF Configuration (All VRs) ==="
    TestCase_5_1_1_EnableOspfOnVr  ;# Prerequisite: OSPF must be enabled
    
    # Step 1: GET request to retrieve OSPF config for all VRs
    result_debug "Step 1: Send GET /v0/configuration/ospf"
    set response [ApiGet "/data/v0/configuration/ospf" $HTTP_OK]
    if {[dict get $response success] == 0} {
        result_error "Failed to retrieve OSPF configuration via API"
        return -1
    }
    
    # Step 2: Parse JSON response
    result_debug "Step 2: Parse JSON response body"
    set responseBody [dict get $response body]
    set routerId [ParseJsonResponse $responseBody "ospfComponentLevelSettings.ospf.0.routerId"]
    
    if {$routerId == ""} {
        result_error "Router ID not found in JSON response"
        return -1
    }
    
    # Step 3: Verify router ID matches configured value
    result_debug "Step 3: Verify router ID in response"
    if {$routerId != $TEST_ROUTER_ID} {
        result_error "Router ID mismatch. Expected: $TEST_ROUTER_ID, Got: $routerId"
        return -1
    }
    result_ok "Router ID in API response matches configured value: $routerId"
    
    # Step 4: Verify holdTime in response
    result_debug "Step 4: Verify SPF hold time in response"
    set holdTime [ParseJsonResponse $responseBody "ospfComponentLevelSettings.ospf.0.holdTime"]
    if {$holdTime != 5} {
        result_error "Hold time mismatch. Expected: 5, Got: $holdTime"
        return -1
    }
    result_ok "SPF hold time in API response: $holdTime seconds"
    
    # Test result
    result_ok "=== Test Case 5.1.2: PASSED ==="
    return 0
}
```

**Expected Results**:
- API GET returns HTTP 200 (OK)
- Response body contains valid JSON
- `routerId` field matches configured value (10.255.255.1)
- `holdTime` field equals 5
- `enable` field is true

---

#### Test Case 5.1.3: Get OSPF Configuration by VR (GET Specific VR)
**Sanity**: Yes  
**Test ID**: EXOS-38882-003  
**Priority**: P1  
**Objective**: Verify retrieval of OSPF configuration for specific VR  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_1_3_GetOspfByVr {} {
    global VR_NAME TEST_ROUTER_ID HTTP_OK
    
    # Test setup
    result_debug "=== Test Case 5.1.3: Get OSPF Configuration by VR ==="
    TestCase_5_1_1_EnableOspfOnVr  ;# Prerequisite
    
    # Step 1: GET request for specific VR
    result_debug "Step 1: Send GET /v0/configuration/ospf/vr/$VR_NAME"
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME"
    set response [ApiGet $endpoint $HTTP_OK]
    if {[dict get $response success] == 0} {
        result_error "Failed to retrieve OSPF configuration for VR $VR_NAME"
        return -1
    }
    
    # Step 2: Parse and validate response
    result_debug "Step 2: Validate response fields"
    set responseBody [dict get $response body]
    set routerId [ParseJsonResponse $responseBody "ospfGetSettings.routerId"]
    set enable [ParseJsonResponse $responseBody "ospfGetSettings.enable"]
    set holdTime [ParseJsonResponse $responseBody "ospfGetSettings.holdTime"]
    
    # Step 3: Verify all fields
    set allFieldsValid 1
    
    if {$routerId != $TEST_ROUTER_ID} {
        result_error "Router ID mismatch: $routerId != $TEST_ROUTER_ID"
        set allFieldsValid 0
    }
    
    if {$enable != "true"} {
        result_error "OSPF enable state incorrect: $enable != true"
        set allFieldsValid 0
    }
    
    if {$holdTime != 5} {
        result_error "Hold time mismatch: $holdTime != 5"
        set allFieldsValid 0
    }
    
    if {$allFieldsValid == 0} {
        return -1
    }
    
    result_ok "All OSPF configuration fields validated successfully"
    result_ok "=== Test Case 5.1.3: PASSED ==="
    return 0
}
```

**Expected Results**:
- API GET returns HTTP 200
- Response contains `ospfGetSettings` object
- `routerId`, `enable`, `holdTime` fields present and correct
- Areas and redistribution lists returned (may be empty)

---

### 5.2 OSPF VR Configuration Updates (PATCH)

#### Test Case 5.2.1: Update OSPF Router ID via PATCH
**Sanity**: Yes  
**Test ID**: EXOS-38882-004  
**Priority**: P1  
**Objective**: Modify OSPF router ID using PATCH operation  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_2_1_UpdateRouterIdViaPatch {} {
    global VR_NAME TEST_ROUTER_ID HTTP_NO_CONTENT OSPF_INIT_WAIT
    
    # Test setup
    result_debug "=== Test Case 5.2.1: Update OSPF Router ID via PATCH ==="
    TestCase_5_1_1_EnableOspfOnVr  ;# Prerequisite
    
    # Step 1: Define new router ID
    set newRouterId "10.255.255.10"
    result_debug "Step 1: Prepare PATCH request to change router ID to $newRouterId"
    
    # Step 2: Send PATCH request
    set requestBody [dict create routerId $newRouterId]
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME"
    result_debug "Step 2: Send PATCH $endpoint"
    
    set response [ApiPatch $endpoint $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response success] == 0} {
        result_error "PATCH request failed"
        return -1
    }
    
    # Step 3: Wait for OSPF to apply changes
    result_debug "Step 3: Wait for OSPF to apply router ID change"
    exSleep $OSPF_INIT_WAIT
    
    # Step 4: Verify new router ID via CLI
    result_debug "Step 4: Verify new router ID via CLI"
    set cliOutput [SendACmd "show ospf | include \"Router ID\""]
    if {![regexp "Router ID:\[\\s\]+${newRouterId}" $cliOutput]} {
        result_error "Router ID not updated. Expected: $newRouterId, CLI: $cliOutput"
        return -1
    }
    result_ok "Router ID successfully updated to $newRouterId"
    
    # Step 5: Verify via GET API
    result_debug "Step 5: Verify via GET API"
    set getResp [ApiGet $endpoint $HTTP_OK]
    set apiRouterId [ParseJsonResponse [dict get $getResp body] "ospfGetSettings.routerId"]
    if {$apiRouterId != $newRouterId} {
        result_error "API GET shows incorrect router ID: $apiRouterId"
        return -1
    }
    result_ok "API GET confirms router ID: $apiRouterId"
    
    result_ok "=== Test Case 5.2.1: PASSED ==="
    return 0
}
```

**Expected Results**:
- PATCH returns HTTP 204
- Router ID updated to 10.255.255.10
- Change visible in CLI and subsequent GET requests
- OSPF process remains active (no restart required)

---

#### Test Case 5.2.2: Update OSPF Hold Time via PATCH
**Sanity**: No  
**Test ID**: EXOS-38882-005  
**Priority**: P2  
**Objective**: Modify SPF hold time using PATCH  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_2_2_UpdateHoldTimeViaPatch {} {
    global VR_NAME HTTP_NO_CONTENT SPF_CALC_WAIT
    
    # Test setup
    result_debug "=== Test Case 5.2.2: Update OSPF Hold Time via PATCH ==="
    TestCase_5_1_1_EnableOspfOnVr
    
    # Step 1: PATCH to change hold time to 10 seconds
    set newHoldTime 10
    result_debug "Step 1: Send PATCH to set hold time to $newHoldTime"
    set requestBody [dict create holdTime $newHoldTime]
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME"
    
    set response [ApiPatch $endpoint $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response success] == 0} {
        result_error "PATCH request failed"
        return -1
    }
    
    # Step 2: Wait for config application
    exSleep $SPF_CALC_WAIT
    
    # Step 3: Verify via CLI
    result_debug "Step 3: Verify hold time via CLI"
    set cliOutput [SendACmd "show ospf | include \"Hold Time\""]
    if {![regexp "Hold\\s+Time:\\s+${newHoldTime}" $cliOutput]} {
        result_error "Hold time not updated in CLI"
        return -1
    }
    result_ok "Hold time updated to $newHoldTime seconds"
    
    result_ok "=== Test Case 5.2.2: PASSED ==="
    return 0
}
```

**Expected Results**:
- PATCH returns HTTP 204
- SPF hold time updated to 10 seconds
- Visible in `show ospf` output

---

### 5.3 OSPF Area Management

#### Test Case 5.3.1: Create OSPF Area (PUT)
**Sanity**: Yes  
**Test ID**: EXOS-38882-006  
**Priority**: P1  
**Objective**: Create OSPF areas (backbone, normal, stub) via API  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_3_1_CreateOspfArea {} {
    global VR_NAME TEST_AREA_0 TEST_AREA_1 HTTP_NO_CONTENT
    
    # Test setup
    result_debug "=== Test Case 5.3.1: Create OSPF Area ==="
    TestCase_5_1_1_EnableOspfOnVr
    
    # Step 1: Create backbone area (0.0.0.0)
    result_debug "Step 1: Create backbone area $TEST_AREA_0"
    set requestBody [dict create \
        type "NORMAL" \
        sendAreaSummary [::json::write boolean true]]
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME/area/$TEST_AREA_0"
    
    set response [ApiPut $endpoint $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response success] == 0} {
        result_error "Failed to create backbone area"
        return -1
    }
    result_ok "Backbone area created"
    
    # Step 2: Create normal area (0.0.0.1)
    result_debug "Step 2: Create normal area $TEST_AREA_1"
    set endpoint2 "/data/v0/configuration/ospf/vr/$VR_NAME/area/$TEST_AREA_1"
    set response2 [ApiPut $endpoint2 $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response2 success] == 0} {
        result_error "Failed to create normal area"
        return -1
    }
    result_ok "Normal area created"
    
    # Step 3: Verify areas via CLI
    result_debug "Step 3: Verify areas exist via CLI"
    set cliOutput [SendACmd "show ospf area"]
    
    if {![regexp $TEST_AREA_0 $cliOutput]} {
        result_error "Backbone area not found in CLI output"
        return -1
    }
    
    if {![regexp $TEST_AREA_1 $cliOutput]} {
        result_error "Normal area not found in CLI output"
        return -1
    }
    
    result_ok "Both areas verified in CLI"
    result_ok "=== Test Case 5.3.1: PASSED ==="
    return 0
}
```

**Expected Results**:
- PUT returns HTTP 204 for both areas
- Areas appear in `show ospf area`
- Area type correctly set to NORMAL

---

#### Test Case 5.3.2: Create STUB Area
**Sanity**: No  
**Test ID**: EXOS-38882-007  
**Priority**: P2  
**Objective**: Create OSPF stub area with specific settings  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_3_2_CreateStubArea {} {
    global VR_NAME TEST_AREA_2 HTTP_NO_CONTENT
    
    # Test setup
    result_debug "=== Test Case 5.3.2: Create STUB Area ==="
    TestCase_5_1_1_EnableOspfOnVr
    
    # Step 1: Create stub area with sendAreaSummary = false
    result_debug "Step 1: Create STUB area $TEST_AREA_2"
    set requestBody [dict create \
        type "STUB" \
        sendAreaSummary [::json::write boolean false]]
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME/area/$TEST_AREA_2"
    
    set response [ApiPut $endpoint $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response success] == 0} {
        result_error "Failed to create stub area"
        return -1
    }
    
    # Step 2: Verify area type via CLI
    result_debug "Step 2: Verify area type is STUB"
    set cliOutput [SendACmd "show ospf area $TEST_AREA_2"]
    if {![regexp {Type:\s+Stub} $cliOutput]} {
        result_error "Area type is not STUB in CLI"
        return -1
    }
    result_ok "Area type confirmed as STUB"
    
    result_ok "=== Test Case 5.3.2: PASSED ==="
    return 0
}
```

**Expected Results**:
- PUT returns HTTP 204
- Area created with type STUB
- Summary LSAs not sent into area (sendAreaSummary: false)

---

### 5.4 OSPF VLAN Interface Configuration

#### Test Case 5.4.1: Enable OSPF on VLAN Interface (PATCH)
**Sanity**: Yes  
**Test ID**: EXOS-38882-008  
**Priority**: P1  
**Objective**: Enable OSPF on VLAN interface and assign to area  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_4_1_EnableOspfOnVlan {} {
    global TEST_VLAN_10 TEST_AREA_0 HTTP_NO_CONTENT NEIGHBOR_ADJ_WAIT
    
    # Test setup
    result_debug "=== Test Case 5.4.1: Enable OSPF on VLAN Interface ==="
    TestCase_5_1_1_EnableOspfOnVr
    TestCase_5_3_1_CreateOspfArea  ;# Create area first
    
    # Step 1: Enable OSPF on VLAN with area assignment
    result_debug "Step 1: Enable OSPF on $TEST_VLAN_10 in area $TEST_AREA_0"
    set requestBody [dict create \
        enable [::json::write boolean true] \
        area $TEST_AREA_0 \
        cost 10 \
        priority 100]
    set endpoint "/data/v0/configuration/ospf/vlan/$TEST_VLAN_10"
    
    set response [ApiPatch $endpoint $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response success] == 0} {
        result_error "Failed to enable OSPF on VLAN"
        return -1
    }
    
    # Step 2: Wait for OSPF interface initialization
    result_debug "Step 2: Wait for OSPF interface to initialize"
    exSleep $NEIGHBOR_ADJ_WAIT
    
    # Step 3: Verify OSPF enabled on VLAN via CLI
    result_debug "Step 3: Verify OSPF interface via CLI"
    set cliOutput [SendACmd "show ospf interface $TEST_VLAN_10"]
    
    if {![regexp {State:\s+Active} $cliOutput] && ![regexp {State:\s+DR} $cliOutput]} {
        result_error "OSPF interface not active on $TEST_VLAN_10"
        return -1
    }
    result_ok "OSPF interface active on $TEST_VLAN_10"
    
    # Step 4: Verify area assignment
    if {![regexp "Area:\[\\s\]+${TEST_AREA_0}" $cliOutput]} {
        result_error "VLAN not assigned to area $TEST_AREA_0"
        return -1
    }
    result_ok "VLAN correctly assigned to area $TEST_AREA_0"
    
    # Step 5: Verify cost and priority
    if {![regexp {Cost:\s+10} $cliOutput]} {
        result_error "OSPF cost not set to 10"
        return -1
    }
    
    if {![regexp {Priority:\s+100} $cliOutput]} {
        result_error "OSPF priority not set to 100"
        return -1
    }
    result_ok "Cost and priority configured correctly"
    
    result_ok "=== Test Case 5.4.1: PASSED ==="
    return 0
}
```

**Expected Results**:
- PATCH returns HTTP 204
- OSPF enabled on VLAN interface
- VLAN assigned to area 0.0.0.0
- Cost set to 10, priority set to 100
- Interface state transitions to Active or DR/BDR

---

#### Test Case 5.4.2: Get OSPF VLAN Configuration (GET)
**Sanity**: No  
**Test ID**: EXOS-38882-009  
**Priority**: P2  
**Objective**: Retrieve OSPF interface settings for specific VLAN  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_4_2_GetOspfVlanConfig {} {
    global TEST_VLAN_10 TEST_AREA_0 HTTP_OK
    
    # Test setup
    result_debug "=== Test Case 5.4.2: Get OSPF VLAN Configuration ==="
    TestCase_5_4_1_EnableOspfOnVlan  ;# Prerequisite
    
    # Step 1: GET OSPF configuration for VLAN
    result_debug "Step 1: Send GET /v0/configuration/ospf/vlan/$TEST_VLAN_10"
    set endpoint "/data/v0/configuration/ospf/vlan/$TEST_VLAN_10"
    set response [ApiGet $endpoint $HTTP_OK]
    
    if {[dict get $response success] == 0} {
        result_error "Failed to GET OSPF VLAN configuration"
        return -1
    }
    
    # Step 2: Parse and validate response fields
    result_debug "Step 2: Validate response fields"
    set responseBody [dict get $response body]
    set enable [ParseJsonResponse $responseBody "ospfInterfaceSettings.enable"]
    set area [ParseJsonResponse $responseBody "ospfInterfaceSettings.area"]
    set cost [ParseJsonResponse $responseBody "ospfInterfaceSettings.cost"]
    set priority [ParseJsonResponse $responseBody "ospfInterfaceSettings.priority"]
    
    # Step 3: Verify all fields match configured values
    set allValid 1
    
    if {$enable != "true"} {
        result_error "OSPF not enabled in API response"
        set allValid 0
    }
    
    if {$area != $TEST_AREA_0} {
        result_error "Area mismatch: $area != $TEST_AREA_0"
        set allValid 0
    }
    
    if {$cost != 10} {
        result_error "Cost mismatch: $cost != 10"
        set allValid 0
    }
    
    if {$priority != 100} {
        result_error "Priority mismatch: $priority != 100"
        set allValid 0
    }
    
    if {$allValid == 0} {
        return -1
    }
    
    result_ok "All VLAN OSPF configuration fields validated"
    result_ok "=== Test Case 5.4.2: PASSED ==="
    return 0
}
```

**Expected Results**:
- GET returns HTTP 200
- Response contains ospfInterfaceSettings object
- All fields (enable, area, cost, priority) match configured values
- Additional fields like helloInterval, deadInterval present with defaults

---

### 5.5 OSPF Redistribution Configuration

#### Test Case 5.5.1: Configure OSPF Static Route Redistribution (PUT)
**Sanity**: Yes  
**Test ID**: EXOS-38882-010  
**Priority**: P1  
**Objective**: Enable redistribution of static routes into OSPF  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_5_1_ConfigureStaticRedistribution {} {
    global VR_NAME HTTP_NO_CONTENT LSA_PROPAGATION_WAIT
    
    # Test setup
    result_debug "=== Test Case 5.5.1: Configure Static Route Redistribution ==="
    TestCase_5_1_1_EnableOspfOnVr
    
    # Step 1: Create test static route
    result_debug "Step 1: Create test static route"
    SendACmd "configure iproute add 192.168.100.0 255.255.255.0 192.168.1.1"
    exSleep 2000
    
    # Step 2: Configure redistribution via API
    result_debug "Step 2: Configure static route redistribution via PUT"
    set requestBody [dict create \
        enable [::json::write boolean true] \
        metricType 2 \
        metric 20]
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME/redistribute/static"
    
    set response [ApiPut $endpoint $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response success] == 0} {
        result_error "Failed to configure redistribution"
        return -1
    }
    
    # Step 3: Wait for LSA generation
    result_debug "Step 3: Wait for LSA propagation"
    exSleep $LSA_PROPAGATION_WAIT
    
    # Step 4: Verify redistribution enabled via CLI
    result_debug "Step 4: Verify redistribution via CLI"
    set cliOutput [SendACmd "show ospf export"]
    
    if {![regexp {static.*Enabled} $cliOutput] && ![regexp {static.*Enable} $cliOutput]} {
        result_error "Static route redistribution not enabled in CLI"
        return -1
    }
    result_ok "Static route redistribution enabled"
    
    # Step 5: Verify metric and metric type
    if {![regexp {Metric:\s+20} $cliOutput]} {
        result_error "Metric not set to 20"
        return -1
    }
    
    if {![regexp {Type:\s+(ase-type-2|ASE-Type-2|Type2)} $cliOutput]} {
        result_error "Metric type not set to Type 2"
        return -1
    }
    result_ok "Metric (20) and metric type (Type 2) configured correctly"
    
    # Step 6: Verify LSA in LSDB
    result_debug "Step 6: Verify AS-External LSA for redistributed route"
    set lsdbOutput [SendACmd "show ospf lsdb external"]
    if {![regexp {192\.168\.100\.0} $lsdbOutput]} {
        result_error "Redistributed route not found in LSDB"
        return -1
    }
    result_ok "Redistributed static route appears in LSDB"
    
    # Cleanup
    SendACmd "configure iproute delete 192.168.100.0 255.255.255.0 192.168.1.1"
    
    result_ok "=== Test Case 5.5.1: PASSED ==="
    return 0
}
```

**Expected Results**:
- PUT returns HTTP 204
- Static route redistribution enabled
- Metric set to 20, metric type 2
- AS-External LSA generated for 192.168.100.0/24
- Visible in `show ospf export` and `show ospf lsdb external`

---

#### Test Case 5.5.2: Configure Direct (Connected) Route Redistribution
**Sanity**: No  
**Test ID**: EXOS-38882-011  
**Priority**: P2  
**Objective**: Enable redistribution of directly connected routes  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_5_2_ConfigureDirectRedistribution {} {
    global VR_NAME HTTP_NO_CONTENT LSA_PROPAGATION_WAIT
    
    # Test setup
    result_debug "=== Test Case 5.5.2: Configure Direct Route Redistribution ==="
    TestCase_5_1_1_EnableOspfOnVr
    
    # Step 1: Configure direct route redistribution
    result_debug "Step 1: Configure direct route redistribution"
    set requestBody [dict create \
        enable [::json::write boolean true] \
        metricType 1 \
        metric 10]
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME/redistribute/direct"
    
    set response [ApiPut $endpoint $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response success] == 0} {
        result_error "Failed to configure direct redistribution"
        return -1
    }
    
    # Step 2: Wait for LSA generation
    exSleep $LSA_PROPAGATION_WAIT
    
    # Step 3: Verify via CLI
    result_debug "Step 3: Verify direct redistribution via CLI"
    set cliOutput [SendACmd "show ospf export"]
    
    if {![regexp {direct.*Enable} $cliOutput]} {
        result_error "Direct route redistribution not enabled"
        return -1
    }
    result_ok "Direct route redistribution enabled with metric type 1"
    
    result_ok "=== Test Case 5.5.2: PASSED ==="
    return 0
}
```

**Expected Results**:
- PUT returns HTTP 204
- Direct route redistribution enabled
- Metric type 1, metric 10
- Connected subnets appear as AS-External LSAs

---

#### Test Case 5.5.3: Delete OSPF Redistribution Entry (DELETE)
**Sanity**: No  
**Test ID**: EXOS-38882-012  
**Priority**: P2  
**Objective**: Remove redistribution configuration via DELETE  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_5_3_DeleteRedistribution {} {
    global VR_NAME HTTP_NO_CONTENT
    
    # Test setup
    result_debug "=== Test Case 5.5.3: Delete OSPF Redistribution Entry ==="
    TestCase_5_5_1_ConfigureStaticRedistribution  ;# Create redistribution first
    
    # Step 1: DELETE redistribution entry
    result_debug "Step 1: Send DELETE to remove static redistribution"
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME/redistribute/static"
    set response [ApiDelete $endpoint $HTTP_NO_CONTENT]
    
    if {[dict get $response success] == 0} {
        result_error "Failed to delete redistribution entry"
        return -1
    }
    
    # Step 2: Verify deletion via CLI
    result_debug "Step 2: Verify redistribution removed from CLI"
    set cliOutput [SendACmd "show ospf export"]
    
    if {[regexp {static.*Enable} $cliOutput]} {
        result_error "Static redistribution still enabled after DELETE"
        return -1
    }
    result_ok "Static redistribution successfully removed"
    
    result_ok "=== Test Case 5.5.3: PASSED ==="
    return 0
}
```

**Expected Results**:
- DELETE returns HTTP 204
- Redistribution entry removed
- No longer visible in `show ospf export`
- AS-External LSAs withdrawn from LSDB

---

### 5.6 OSPF State/Operational Data Retrieval

#### Test Case 5.6.1: Get OSPF State for All Interfaces (GET)
**Sanity**: No  
**Test ID**: EXOS-38882-013  
**Priority**: P2  
**Objective**: Retrieve operational OSPF state across all interfaces  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_6_1_GetOspfState {} {
    global HTTP_OK
    
    # Test setup
    result_debug "=== Test Case 5.6.1: Get OSPF State for All Interfaces ==="
    TestCase_5_4_1_EnableOspfOnVlan  ;# Ensure OSPF is active on at least one VLAN
    
    # Step 1: GET OSPF state
    result_debug "Step 1: Send GET /v0/state/ospf"
    set endpoint "/data/v0/state/ospf"
    set response [ApiGet $endpoint $HTTP_OK]
    
    if {[dict get $response success] == 0} {
        result_error "Failed to retrieve OSPF state"
        return -1
    }
    
    # Step 2: Parse response
    result_debug "Step 2: Parse OSPF state response"
    set responseBody [dict get $response body]
    
    # Verify response contains state data
    if {$responseBody == "" || $responseBody == "\{\}"} {
        result_error "OSPF state response is empty"
        return -1
    }
    result_ok "OSPF state data retrieved successfully"
    
    # Step 3: Validate contains interface information
    result_debug "Step 3: Validate response contains interface data"
    if {![regexp {interface} $responseBody] && ![regexp {vlan} $responseBody]} {
        result_error "Response does not contain interface/VLAN information"
        return -1
    }
    result_ok "Response contains OSPF interface state data"
    
    result_ok "=== Test Case 5.6.1: PASSED ==="
    return 0
}
```

**Expected Results**:
- GET returns HTTP 200
- Response contains OSPF state for all VRFs
- Includes interface states, neighbor information, LSA counts
- Data reflects current operational status

---

### 5.7 OSPF Virtual Circuit Configuration

#### Test Case 5.7.1: Create OSPF Virtual Link (PUT)
**Sanity**: No  
**Test ID**: EXOS-38882-014  
**Priority**: P3  
**Objective**: Create virtual link through transit area  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_7_1_CreateVirtualLink {} {
    global VR_NAME TEST_AREA_1 NEIGHBOR_ROUTER_ID HTTP_NO_CONTENT
    
    # Test setup
    result_debug "=== Test Case 5.7.1: Create OSPF Virtual Link ==="
    TestCase_5_1_1_EnableOspfOnVr
    TestCase_5_3_1_CreateOspfArea  ;# Create transit area
    
    # Step 1: Create virtual link via PUT
    result_debug "Step 1: Create virtual link via PUT"
    set requestBody [dict create \
        enable [::json::write boolean true] \
        transitAreaId $TEST_AREA_1 \
        virtualNeighborId $NEIGHBOR_ROUTER_ID \
        helloInterval 10 \
        deadInterval 40]
    
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME/virtual-circuit/area/$TEST_AREA_1/virtual-neighbor/$NEIGHBOR_ROUTER_ID"
    
    set response [ApiPut $endpoint $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response success] == 0} {
        result_error "Failed to create virtual link"
        return -1
    }
    
    # Step 2: Verify virtual link via CLI
    result_debug "Step 2: Verify virtual link configuration via CLI"
    set cliOutput [SendACmd "show ospf virtual-links"]
    
    if {![regexp $NEIGHBOR_ROUTER_ID $cliOutput]} {
        result_error "Virtual link not found in CLI output"
        return -1
    }
    result_ok "Virtual link created successfully"
    
    result_ok "=== Test Case 5.7.1: PASSED ==="
    return 0
}
```

**Expected Results**:
- PUT returns HTTP 204
- Virtual link created with specified parameters
- Visible in `show ospf virtual-links`
- Virtual adjacency will form if neighbor exists

---

#### Test Case 5.7.2: Delete OSPF Virtual Link (DELETE)
**Sanity**: No  
**Test ID**: EXOS-38882-015  
**Priority**: P3  
**Objective**: Remove virtual link configuration  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_7_2_DeleteVirtualLink {} {
    global VR_NAME TEST_AREA_1 NEIGHBOR_ROUTER_ID HTTP_NO_CONTENT
    
    # Test setup
    result_debug "=== Test Case 5.7.2: Delete OSPF Virtual Link ==="
    TestCase_5_7_1_CreateVirtualLink  ;# Create virtual link first
    
    # Step 1: DELETE virtual link
    result_debug "Step 1: Send DELETE for virtual link"
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME/virtual-circuit/area/$TEST_AREA_1/virtual-neighbor/$NEIGHBOR_ROUTER_ID"
    set response [ApiDelete $endpoint $HTTP_NO_CONTENT]
    
    if {[dict get $response success] == 0} {
        result_error "Failed to delete virtual link"
        return -1
    }
    
    # Step 2: Verify deletion via CLI
    result_debug "Step 2: Verify virtual link removed from CLI"
    set cliOutput [SendACmd "show ospf virtual-links"]
    
    if {[regexp $NEIGHBOR_ROUTER_ID $cliOutput]} {
        result_error "Virtual link still present after DELETE"
        return -1
    }
    result_ok "Virtual link successfully deleted"
    
    result_ok "=== Test Case 5.7.2: PASSED ==="
    return 0
}
```

**Expected Results**:
- DELETE returns HTTP 204
- Virtual link removed from configuration
- No longer visible in `show ospf virtual-links`

---

### 5.8 Error Handling and Negative Tests

#### Test Case 5.8.1: POST OSPF with Invalid Router ID Format
**Sanity**: Yes  
**Test ID**: EXOS-38882-016  
**Priority**: P1  
**Objective**: Verify API rejects invalid router ID format  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_8_1_InvalidRouterIdFormat {} {
    global VR_NAME HTTP_BAD_REQUEST
    
    # Test setup
    result_debug "=== Test Case 5.8.1: Invalid Router ID Format ==="
    CleanupOspfConfiguration
    
    # Step 1: Send POST with invalid router ID (not IPv4 format)
    result_debug "Step 1: Send POST with invalid router ID"
    set requestBody [dict create \
        vrName $VR_NAME \
        enable [::json::write boolean true] \
        routerId "999.999.999.999"]  ;# Invalid IPv4 address
    
    set response [ApiPost "/data/v0/configuration/ospf" $requestBody $HTTP_BAD_REQUEST]
    
    # Step 2: Verify API returns 400 Bad Request
    if {[dict get $response status] != $HTTP_BAD_REQUEST} {
        result_error "Expected HTTP 400, got [dict get $response status]"
        return -1
    }
    result_ok "API correctly rejected invalid router ID with HTTP 400"
    
    # Step 3: Verify OSPF not enabled (no partial configuration)
    result_debug "Step 3: Verify OSPF not enabled after failed POST"
    if {[VerifyOspfEnabled $VR_NAME] == 1} {
        result_error "OSPF was enabled despite invalid router ID"
        return -1
    }
    result_ok "OSPF not enabled (as expected)"
    
    result_ok "=== Test Case 5.8.1: PASSED ==="
    return 0
}
```

**Expected Results**:
- POST returns HTTP 400 (Bad Request)
- Error message indicates invalid router ID format
- OSPF process not enabled
- No partial configuration applied

---

#### Test Case 5.8.2: PATCH OSPF on Non-Existent VR
**Sanity**: No  
**Test ID**: EXOS-38882-017  
**Priority**: P2  
**Objective**: Verify API returns 404 for non-existent VR  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_8_2_PatchNonExistentVr {} {
    global HTTP_NOT_FOUND
    
    # Test setup
    result_debug "=== Test Case 5.8.2: PATCH on Non-Existent VR ==="
    
    # Step 1: PATCH request for non-existent VR
    result_debug "Step 1: Send PATCH for VR that doesn't exist"
    set nonExistentVr "VR-NonExistent-12345"
    set requestBody [dict create holdTime 15]
    set endpoint "/data/v0/configuration/ospf/vr/$nonExistentVr"
    
    set response [ApiPatch $endpoint $requestBody $HTTP_NOT_FOUND]
    
    # Step 2: Verify HTTP 404 returned
    if {[dict get $response status] != $HTTP_NOT_FOUND} {
        result_error "Expected HTTP 404, got [dict get $response status]"
        return -1
    }
    result_ok "API correctly returned HTTP 404 for non-existent VR"
    
    result_ok "=== Test Case 5.8.2: PASSED ==="
    return 0
}
```

**Expected Results**:
- PATCH returns HTTP 404 (Not Found)
- Error message indicates VR does not exist
- No configuration changes applied

---

#### Test Case 5.8.3: PUT Area with Invalid Area ID Format
**Sanity**: No  
**Test ID**: EXOS-38882-018  
**Priority**: P2  
**Objective**: Verify API rejects invalid area ID format  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_8_3_InvalidAreaIdFormat {} {
    global VR_NAME HTTP_BAD_REQUEST
    
    # Test setup
    result_debug "=== Test Case 5.8.3: Invalid Area ID Format ==="
    TestCase_5_1_1_EnableOspfOnVr
    
    # Step 1: PUT area with invalid area ID
    result_debug "Step 1: Send PUT with invalid area ID format"
    set invalidAreaId "INVALID_AREA"
    set requestBody [dict create type "NORMAL"]
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME/area/$invalidAreaId"
    
    set response [ApiPut $endpoint $requestBody $HTTP_BAD_REQUEST]
    
    # Step 2: Verify HTTP 400
    if {[dict get $response status] != $HTTP_BAD_REQUEST} {
        result_error "Expected HTTP 400, got [dict get $response status]"
        return -1
    }
    result_ok "API rejected invalid area ID with HTTP 400"
    
    result_ok "=== Test Case 5.8.3: PASSED ==="
    return 0
}
```

**Expected Results**:
- PUT returns HTTP 400
- Error message indicates invalid area ID format (must be IPv4 format)
- Area not created

---

#### Test Case 5.8.4: PATCH VLAN with OSPF Not Enabled on VR
**Sanity**: No  
**Test ID**: EXOS-38882-019  
**Priority**: P2  
**Objective**: Verify error when enabling OSPF on VLAN without OSPF on VR  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_8_4_VlanOspfWithoutVrOspf {} {
    global TEST_VLAN_10 TEST_AREA_0 HTTP_BAD_REQUEST
    
    # Test setup
    result_debug "=== Test Case 5.8.4: Enable OSPF on VLAN without VR OSPF ==="
    CleanupOspfConfiguration  ;# Ensure OSPF is disabled on VR
    
    # Step 1: Attempt to enable OSPF on VLAN
    result_debug "Step 1: Try to enable OSPF on VLAN (OSPF not enabled on VR)"
    set requestBody [dict create \
        enable [::json::write boolean true] \
        area $TEST_AREA_0]
    set endpoint "/data/v0/configuration/ospf/vlan/$TEST_VLAN_10"
    
    set response [ApiPatch $endpoint $requestBody $HTTP_BAD_REQUEST]
    
    # Step 2: Verify API returns error
    if {[dict get $response status] != $HTTP_BAD_REQUEST} {
        result_error "Expected HTTP 400, got [dict get $response status]"
        return -1
    }
    result_ok "API rejected VLAN OSPF enable with HTTP 400 (OSPF not enabled on VR)"
    
    result_ok "=== Test Case 5.8.4: PASSED ==="
    return 0
}
```

**Expected Results**:
- PATCH returns HTTP 400 or 409
- Error message indicates OSPF must be enabled on VR first
- VLAN OSPF not enabled

---

#### Test Case 5.8.5: DELETE OSPF from VR-Default (Should Fail on EXOS)
**Sanity**: No  
**Test ID**: EXOS-38882-020  
**Priority**: P2  
**Objective**: Verify DELETE OSPF from VR-Default returns error on EXOS  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_8_5_DeleteOspfFromVrDefault {} {
    global VR_NAME HTTP_BAD_REQUEST HTTP_CONFLICT
    
    # Test setup
    result_debug "=== Test Case 5.8.5: DELETE OSPF from VR-Default ==="
    TestCase_5_1_1_EnableOspfOnVr
    
    # Step 1: Attempt to DELETE OSPF from VR-Default
    result_debug "Step 1: Try to DELETE OSPF from VR-Default (should fail on EXOS)"
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME"
    set response [ApiDelete $endpoint $HTTP_BAD_REQUEST]
    
    # Step 2: Verify error returned (400 or 409)
    set status [dict get $response status]
    if {$status != $HTTP_BAD_REQUEST && $status != $HTTP_CONFLICT} {
        result_error "Expected HTTP 400 or 409, got $status"
        return -1
    }
    result_ok "API rejected DELETE of OSPF from VR-Default (HTTP $status)"
    
    # Step 3: Verify OSPF still enabled
    result_debug "Step 3: Verify OSPF still enabled after failed DELETE"
    if {[VerifyOspfEnabled $VR_NAME] == 0} {
        result_error "OSPF was deleted despite error response"
        return -1
    }
    result_ok "OSPF still enabled (as expected)"
    
    result_ok "=== Test Case 5.8.5: PASSED ==="
    return 0
}
```

**Expected Results**:
- DELETE returns HTTP 400 or 409
- Error message: "OSPF process always exists on VR-Default and cannot be deleted"
- OSPF remains enabled and operational

---

#### Test Case 5.8.6: PUT Redistribution with Out-of-Range Metric
**Sanity**: No  
**Test ID**: EXOS-38882-021  
**Priority**: P2  
**Objective**: Verify API validates metric value range  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_8_6_InvalidRedistributionMetric {} {
    global VR_NAME HTTP_BAD_REQUEST
    
    # Test setup
    result_debug "=== Test Case 5.8.6: Invalid Redistribution Metric ==="
    TestCase_5_1_1_EnableOspfOnVr
    
    # Step 1: PUT redistribution with invalid metric (out of range)
    result_debug "Step 1: Send PUT with metric value > 16777214"
    set requestBody [dict create \
        enable [::json::write boolean true] \
        metricType 2 \
        metric 99999999]  ;# OSPF metric max is usually 16777214
    
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME/redistribute/static"
    set response [ApiPut $endpoint $requestBody $HTTP_BAD_REQUEST]
    
    # Step 2: Verify HTTP 400
    if {[dict get $response status] != $HTTP_BAD_REQUEST} {
        result_error "Expected HTTP 400, got [dict get $response status]"
        return -1
    }
    result_ok "API rejected invalid metric with HTTP 400"
    
    result_ok "=== Test Case 5.8.6: PASSED ==="
    return 0
}
```

**Expected Results**:
- PUT returns HTTP 400
- Error message indicates metric value out of range
- Redistribution not configured

---

#### Test Case 5.8.7: POST OSPF with Missing Required Field (vrName)
**Sanity**: No  
**Test ID**: EXOS-38882-022  
**Priority**: P2  
**Objective**: Verify API validates required fields are present  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_8_7_MissingRequiredField {} {
    global HTTP_BAD_REQUEST
    
    # Test setup
    result_debug "=== Test Case 5.8.7: POST with Missing vrName ==="
    CleanupOspfConfiguration
    
    # Step 1: POST without required vrName field
    result_debug "Step 1: Send POST without vrName field"
    set requestBody [dict create \
        enable [::json::write boolean true] \
        routerId "10.1.1.1"]  ;# Missing vrName!
    
    set response [ApiPost "/data/v0/configuration/ospf" $requestBody $HTTP_BAD_REQUEST]
    
    # Step 2: Verify HTTP 400
    if {[dict get $response status] != $HTTP_BAD_REQUEST} {
        result_error "Expected HTTP 400, got [dict get $response status]"
        return -1
    }
    result_ok "API rejected request with missing required field (HTTP 400)"
    
    result_ok "=== Test Case 5.8.7: PASSED ==="
    return 0
}
```

**Expected Results**:
- POST returns HTTP 400
- Error message indicates missing required field (vrName)
- OSPF not enabled

---

### 5.9 Platform-Specific Field Testing (EXOS vs VOSS)

#### Test Case 5.9.1: EXOS Graceful Restart Type Configuration
**Sanity**: No  
**Test ID**: EXOS-38882-023  
**Priority**: P3  
**Objective**: Verify EXOS-specific gracefulRestartType field  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_9_1_ExosGracefulRestartType {} {
    global VR_NAME HTTP_NO_CONTENT
    
    # Test setup
    result_debug "=== Test Case 5.9.1: EXOS Graceful Restart Type ==="
    TestCase_5_1_1_EnableOspfOnVr
    
    # Step 1: PATCH to set gracefulRestartType (EXOS only)
    result_debug "Step 1: Set gracefulRestartType to PLANNED_AND_UNPLANNED"
    set requestBody [dict create \
        gracefulRestartType "PLANNED_AND_UNPLANNED" \
        gracefulRestartPeriod 180]
    
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME"
    set response [ApiPatch $endpoint $requestBody $HTTP_NO_CONTENT]
    
    if {[dict get $response success] == 0} {
        result_error "Failed to configure graceful restart"
        return -1
    }
    
    # Step 2: Verify via CLI
    result_debug "Step 2: Verify graceful restart configuration"
    set cliOutput [SendACmd "show ospf"]
    if {![regexp {Graceful.*Restart.*Enable} $cliOutput] && ![regexp {GR.*Enable} $cliOutput]} {
        result_error "Graceful restart not enabled in CLI"
        return -1
    }
    result_ok "Graceful restart configured successfully"
    
    result_ok "=== Test Case 5.9.1: PASSED ==="
    return 0
}
```

**Expected Results**:
- PATCH returns HTTP 204
- Graceful restart enabled with type PLANNED_AND_UNPLANNED
- Grace period set to 180 seconds
- Feature specific to EXOS (VOSS should ignore or error)

---

#### Test Case 5.9.2: EXOS-Specific Originate Configuration
**Sanity**: No  
**Test ID**: EXOS-38882-024  
**Priority**: P3  
**Objective**: Verify EXOS originate settings (default route advertisement)  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_9_2_ExosOriginateConfig {} {
    global VR_NAME HTTP_NO_CONTENT
    
    # Test setup
    result_debug "=== Test Case 5.9.2: EXOS Originate Configuration ==="
    TestCase_5_1_1_EnableOspfOnVr
    
    # Step 1: Configure originate (default route advertisement)
    result_debug "Step 1: Configure originate with metric and type"
    set requestBody [dict create \
        originate [dict create \
            enable [::json::write boolean true] \
            metric 100 \
            metricType 1 \
            alwaysAdvertise [::json::write boolean true]]]
    
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME"
    set response [ApiPatch $endpoint $requestBody $HTTP_NO_CONTENT]
    
    if {[dict get $response success] == 0} {
        result_error "Failed to configure originate"
        return -1
    }
    
    # Step 2: Verify default route advertisement via CLI
    result_debug "Step 2: Verify default route origination"
    set cliOutput [SendACmd "show ospf | include \"originate\""]
    if {![regexp {originate.*enable} $cliOutput]} {
        result_error "Originate not enabled in CLI"
        return -1
    }
    result_ok "Default route originate configured"
    
    result_ok "=== Test Case 5.9.2: PASSED ==="
    return 0
}
```

**Expected Results**:
- PATCH returns HTTP 204
- Default route (0.0.0.0/0) advertised as AS-External LSA
- Metric 100, Type 1
- Always advertised even without default route in routing table

---

### 5.10 Idempotency Testing

#### Test Case 5.10.1: Multiple Identical PUT Requests (Idempotency)
**Sanity**: No  
**Test ID**: EXOS-38882-025  
**Priority**: P2  
**Objective**: Verify PUT operations are idempotent  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_10_1_PutIdempotency {} {
    global VR_NAME TEST_AREA_1 HTTP_NO_CONTENT
    
    # Test setup
    result_debug "=== Test Case 5.10.1: PUT Idempotency Test ==="
    TestCase_5_1_1_EnableOspfOnVr
    
    # Step 1: PUT area creation (first time)
    result_debug "Step 1: First PUT to create area"
    set requestBody [dict create type "NORMAL"]
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME/area/$TEST_AREA_1"
    
    set response1 [ApiPut $endpoint $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response1 success] == 0} {
        result_error "First PUT failed"
        return -1
    }
    result_ok "First PUT successful (created area)"
    
    # Step 2: Identical PUT (second time - should also succeed)
    result_debug "Step 2: Second identical PUT (idempotency test)"
    set response2 [ApiPut $endpoint $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response2 success] == 0} {
        result_error "Second PUT failed (not idempotent)"
        return -1
    }
    result_ok "Second PUT successful (idempotent)"
    
    # Step 3: Third identical PUT
    result_debug "Step 3: Third identical PUT"
    set response3 [ApiPut $endpoint $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response3 success] == 0} {
        result_error "Third PUT failed"
        return -1
    }
    result_ok "Third PUT successful (idempotent)"
    
    # Step 4: Verify only one area exists (no duplicates)
    result_debug "Step 4: Verify area not duplicated"
    set cliOutput [SendACmd "show ospf area"]
    set areaCount [regexp -all $TEST_AREA_1 $cliOutput]
    if {$areaCount > 1} {
        result_error "Area appears $areaCount times (duplicated)"
        return -1
    }
    result_ok "Area exists exactly once (no duplication)"
    
    result_ok "=== Test Case 5.10.1: PASSED ==="
    return 0
}
```

**Expected Results**:
- All three PUT requests return HTTP 204
- No error on second and third PUT (idempotent behavior)
- Only one area exists (not duplicated)
- Configuration remains consistent

---

#### Test Case 5.10.2: Multiple Identical POST Requests (Non-Idempotent)
**Sanity**: No  
**Test ID**: EXOS-38882-026  
**Priority**: P2  
**Objective**: Verify POST operations are NOT idempotent  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_10_2_PostNonIdempotency {} {
    global VR_NAME TEST_ROUTER_ID HTTP_NO_CONTENT HTTP_CONFLICT
    
    # Test setup
    result_debug "=== Test Case 5.10.2: POST Non-Idempotency Test ==="
    CleanupOspfConfiguration
    
    # Step 1: First POST (should succeed)
    result_debug "Step 1: First POST to enable OSPF"
    set requestBody [dict create \
        vrName $VR_NAME \
        enable [::json::write boolean true] \
        routerId $TEST_ROUTER_ID]
    
    set response1 [ApiPost "/data/v0/configuration/ospf" $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response1 success] == 0} {
        result_error "First POST failed"
        return -1
    }
    result_ok "First POST successful"
    
    # Step 2: Second identical POST (should fail with 409 Conflict)
    result_debug "Step 2: Second identical POST (should fail)"
    set response2 [ApiPost "/data/v0/configuration/ospf" $requestBody $HTTP_CONFLICT]
    
    set status [dict get $response2 status]
    if {$status != $HTTP_CONFLICT && $status != $HTTP_BAD_REQUEST} {
        result_error "Second POST should fail with 409 or 400, got $status"
        return -1
    }
    result_ok "Second POST correctly failed with HTTP $status (non-idempotent)"
    
    result_ok "=== Test Case 5.10.2: PASSED ==="
    return 0
}
```

**Expected Results**:
- First POST returns HTTP 204 (success)
- Second identical POST returns HTTP 409 Conflict or 400 Bad Request
- Error message indicates OSPF already exists
- Demonstrates POST is not idempotent (expected behavior)

---

### 5.11 API-CLI Consistency Validation

#### Test Case 5.11.1: Verify API Configuration Visible in CLI
**Sanity**: Yes  
**Test ID**: EXOS-38882-027  
**Priority**: P1  
**Objective**: Ensure API changes immediately visible via CLI  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_11_1_ApiToCliConsistency {} {
    global VR_NAME TEST_ROUTER_ID TEST_AREA_0 TEST_VLAN_10 HTTP_NO_CONTENT
    
    # Test setup
    result_debug "=== Test Case 5.11.1: API to CLI Consistency ==="
    CleanupOspfConfiguration
    
    # Step 1: Configure OSPF entirely via API
    result_debug "Step 1: Configure OSPF via API"
    
    # Enable OSPF on VR
    set vrBody [dict create \
        vrName $VR_NAME \
        enable [::json::write boolean true] \
        routerId $TEST_ROUTER_ID \
        holdTime 8]
    ApiPost "/data/v0/configuration/ospf" $vrBody $HTTP_NO_CONTENT
    exSleep 5000
    
    # Create area
    set areaBody [dict create type "NORMAL"]
    ApiPut "/data/v0/configuration/ospf/vr/$VR_NAME/area/$TEST_AREA_0" $areaBody $HTTP_NO_CONTENT
    exSleep 2000
    
    # Enable OSPF on VLAN
    set vlanBody [dict create \
        enable [::json::write boolean true] \
        area $TEST_AREA_0 \
        cost 15]
    ApiPatch "/data/v0/configuration/ospf/vlan/$TEST_VLAN_10" $vlanBody $HTTP_NO_CONTENT
    exSleep 5000
    
    # Step 2: Verify all configurations via CLI
    result_debug "Step 2: Verify all API configurations via CLI"
    
    # Check OSPF enabled
    if {[VerifyOspfEnabled $VR_NAME] == 0} {
        result_error "OSPF not enabled (CLI)"
        return -1
    }
    
    # Check router ID
    set cliOspf [SendACmd "show ospf"]
    if {![regexp "Router ID:\[\\s\]+${TEST_ROUTER_ID}" $cliOspf]} {
        result_error "Router ID not visible in CLI"
        return -1
    }
    
    # Check hold time
    if {![regexp {Hold\s+Time:\s+8} $cliOspf]} {
        result_error "Hold time not visible in CLI"
        return -1
    }
    
    # Check area
    set cliArea [SendACmd "show ospf area"]
    if {![regexp $TEST_AREA_0 $cliArea]} {
        result_error "Area not visible in CLI"
        return -1
    }
    
    # Check VLAN
    set cliVlan [SendACmd "show ospf interface $TEST_VLAN_10"]
    if {![regexp {Cost:\s+15} $cliVlan]} {
        result_error "VLAN cost not visible in CLI"
        return -1
    }
    
    result_ok "All API configurations visible in CLI"
    result_ok "=== Test Case 5.11.1: PASSED ==="
    return 0
}
```

**Expected Results**:
- All API operations succeed
- Every configuration immediately visible via CLI
- No delay or inconsistency between API and CLI views
- `show` commands reflect exact API-configured values

---

#### Test Case 5.11.2: Verify CLI Configuration Visible in API
**Sanity**: No  
**Test ID**: EXOS-38882-028  
**Priority**: P2  
**Objective**: Ensure CLI changes immediately visible via API GET  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_11_2_CliToApiConsistency {} {
    global VR_NAME TEST_ROUTER_ID TEST_AREA_0 HTTP_OK
    
    # Test setup
    result_debug "=== Test Case 5.11.2: CLI to API Consistency ==="
    CleanupOspfConfiguration
    
    # Step 1: Configure OSPF entirely via CLI
    result_debug "Step 1: Configure OSPF via CLI commands"
    SendACmd "enable ospf vr $VR_NAME"
    SendACmd "configure ospf routerid $TEST_ROUTER_ID vr $VR_NAME"
    SendACmd "configure ospf spf-hold-time 12 vr $VR_NAME"
    SendACmd "create ospf area $TEST_AREA_0 vr $VR_NAME"
    exSleep 5000
    
    # Step 2: Retrieve configuration via API
    result_debug "Step 2: Retrieve configuration via GET API"
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME"
    set response [ApiGet $endpoint $HTTP_OK]
    
    if {[dict get $response success] == 0} {
        result_error "Failed to GET OSPF configuration"
        return -1
    }
    
    # Step 3: Verify CLI configurations visible in API response
    result_debug "Step 3: Verify CLI config in API response"
    set responseBody [dict get $response body]
    
    set apiRouterId [ParseJsonResponse $responseBody "ospfGetSettings.routerId"]
    if {$apiRouterId != $TEST_ROUTER_ID} {
        result_error "Router ID not matching: CLI=$TEST_ROUTER_ID, API=$apiRouterId"
        return -1
    }
    
    set apiHoldTime [ParseJsonResponse $responseBody "ospfGetSettings.holdTime"]
    if {$apiHoldTime != 12} {
        result_error "Hold time not matching: CLI=12, API=$apiHoldTime"
        return -1
    }
    
    result_ok "All CLI configurations visible in API GET response"
    result_ok "=== Test Case 5.11.2: PASSED ==="
    return 0
}
```

**Expected Results**:
- All CLI commands succeed
- API GET returns HTTP 200
- API response contains all CLI-configured values
- Router ID, hold time match exactly
- Areas list includes CLI-created area

---

### 5.12 DELETE Operations and Cleanup

#### Test Case 5.12.1: Delete OSPF Area via DELETE
**Sanity**: No  
**Test ID**: EXOS-38882-029  
**Priority**: P2  
**Objective**: Verify area deletion via API  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_12_1_DeleteOspfArea {} {
    global VR_NAME TEST_AREA_1 HTTP_NO_CONTENT
    
    # Test setup
    result_debug "=== Test Case 5.12.1: Delete OSPF Area ==="
    TestCase_5_1_1_EnableOspfOnVr
    TestCase_5_3_1_CreateOspfArea  ;# Create area first
    
    # Step 1: DELETE area via API
    result_debug "Step 1: Send DELETE for area $TEST_AREA_1"
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME/area/$TEST_AREA_1"
    set response [ApiDelete $endpoint $HTTP_NO_CONTENT]
    
    if {[dict get $response success] == 0} {
        result_error "Failed to delete area"
        return -1
    }
    
    # Step 2: Verify area deleted via CLI
    result_debug "Step 2: Verify area no longer exists"
    set cliOutput [SendACmd "show ospf area"]
    
    if {[regexp $TEST_AREA_1 $cliOutput]} {
        result_error "Area still exists after DELETE"
        return -1
    }
    result_ok "Area successfully deleted"
    
    result_ok "=== Test Case 5.12.1: PASSED ==="
    return 0
}
```

**Expected Results**:
- DELETE returns HTTP 204
- Area removed from configuration
- Not visible in `show ospf area`
- Subsequent GET for area returns 404

---

#### Test Case 5.12.2: Disable OSPF on VR via PATCH
**Sanity**: No  
**Test ID**: EXOS-38882-030  
**Priority**: P2  
**Objective**: Disable OSPF process via API (set enable: false)  
**Automation Status**: 100% Automatable  

**Detailed Test Procedure**:

```tcl
proc TestCase_5_12_2_DisableOspfViaApi {} {
    global VR_NAME HTTP_NO_CONTENT OSPF_INIT_WAIT
    
    # Test setup
    result_debug "=== Test Case 5.12.2: Disable OSPF via PATCH ==="
    TestCase_5_1_1_EnableOspfOnVr
    
    # Step 1: PATCH to disable OSPF
    result_debug "Step 1: Send PATCH to disable OSPF"
    set requestBody [dict create enable [::json::write boolean false]]
    set endpoint "/data/v0/configuration/ospf/vr/$VR_NAME"
    
    set response [ApiPatch $endpoint $requestBody $HTTP_NO_CONTENT]
    if {[dict get $response success] == 0} {
        result_error "Failed to disable OSPF"
        return -1
    }
    
    # Step 2: Wait for OSPF shutdown
    result_debug "Step 2: Wait for OSPF process shutdown"
    exSleep $OSPF_INIT_WAIT
    
    # Step 3: Verify OSPF disabled via CLI
    result_debug "Step 3: Verify OSPF state is INACTIVE"
    set cliOutput [SendACmd "show ospf"]
    
    if {![regexp {State:\s+INACTIVE} $cliOutput]} {
        result_error "OSPF not in INACTIVE state"
        return -1
    }
    result_ok "OSPF successfully disabled (INACTIVE state)"
    
    result_ok "=== Test Case 5.12.2: PASSED ==="
    return 0
}
```

**Expected Results**:
- PATCH returns HTTP 204
- OSPF process transitions to INACTIVE state
- All neighbor adjacencies torn down
- Configuration preserved but not active

---

## 6. Test Execution Summary

### 6.1 Test Case Matrix

| Test ID | Test Case Name | Sanity | Priority | Automation | Category |
|---------|---------------|--------|----------|------------|----------|
| EXOS-38882-001 | Enable OSPF on VR (POST) | ✅ | P1 | 100% | Basic Config |
| EXOS-38882-002 | Get OSPF Config (All VRs) | ✅ | P1 | 100% | Basic Config |
| EXOS-38882-003 | Get OSPF Config by VR | ✅ | P1 | 100% | Basic Config |
| EXOS-38882-004 | Update Router ID (PATCH) | ✅ | P1 | 100% | VR Config |
| EXOS-38882-005 | Update Hold Time (PATCH) | ❌ | P2 | 100% | VR Config |
| EXOS-38882-006 | Create OSPF Area (PUT) | ✅ | P1 | 100% | Area Mgmt |
| EXOS-38882-007 | Create STUB Area | ❌ | P2 | 100% | Area Mgmt |
| EXOS-38882-008 | Enable OSPF on VLAN (PATCH) | ✅ | P1 | 100% | VLAN Interface |
| EXOS-38882-009 | Get OSPF VLAN Config | ❌ | P2 | 100% | VLAN Interface |
| EXOS-38882-010 | Configure Static Redistribution | ✅ | P1 | 100% | Redistribution |
| EXOS-38882-011 | Configure Direct Redistribution | ❌ | P2 | 100% | Redistribution |
| EXOS-38882-012 | Delete Redistribution Entry | ❌ | P2 | 100% | Redistribution |
| EXOS-38882-013 | Get OSPF State (All Interfaces) | ❌ | P2 | 100% | State Data |
| EXOS-38882-014 | Create Virtual Link (PUT) | ❌ | P3 | 100% | Virtual Circuit |
| EXOS-38882-015 | Delete Virtual Link | ❌ | P3 | 100% | Virtual Circuit |
| EXOS-38882-016 | Invalid Router ID Format | ✅ | P1 | 100% | Error Handling |
| EXOS-38882-017 | PATCH Non-Existent VR | ❌ | P2 | 100% | Error Handling |
| EXOS-38882-018 | Invalid Area ID Format | ❌ | P2 | 100% | Error Handling |
| EXOS-38882-019 | VLAN OSPF without VR OSPF | ❌ | P2 | 100% | Error Handling |
| EXOS-38882-020 | DELETE from VR-Default | ❌ | P2 | 100% | Error Handling |
| EXOS-38882-021 | Invalid Redistribution Metric | ❌ | P2 | 100% | Error Handling |
| EXOS-38882-022 | Missing Required Field | ❌ | P2 | 100% | Error Handling |
| EXOS-38882-023 | EXOS Graceful Restart Type | ❌ | P3 | 100% | Platform-Specific |
| EXOS-38882-024 | EXOS Originate Config | ❌ | P3 | 100% | Platform-Specific |
| EXOS-38882-025 | PUT Idempotency Test | ❌ | P2 | 100% | Idempotency |
| EXOS-38882-026 | POST Non-Idempotency Test | ❌ | P2 | 100% | Idempotency |
| EXOS-38882-027 | API to CLI Consistency | ✅ | P1 | 100% | Consistency |
| EXOS-38882-028 | CLI to API Consistency | ❌ | P2 | 100% | Consistency |
| EXOS-38882-029 | Delete OSPF Area | ❌ | P2 | 100% | DELETE Ops |
| EXOS-38882-030 | Disable OSPF via PATCH | ❌ | P2 | 100% | DELETE Ops |

**Total Test Cases**: 30  
**Sanity Test Cases**: 8 (27% coverage)  
**Automation Coverage**: 100%  

### 6.2 Test Coverage Analysis

#### HTTP Methods Coverage
- **GET**: 4 test cases (configuration and state retrieval)
- **POST**: 3 test cases (OSPF enable, error handling)
- **PATCH**: 7 test cases (VR config updates, VLAN config, disable)
- **PUT**: 7 test cases (areas, redistribution, virtual links, idempotency)
- **DELETE**: 5 test cases (areas, redistribution, virtual links, error handling)

#### Endpoint Coverage
- ✅ `/v0/configuration/ospf` (GET, POST)
- ✅ `/v0/configuration/ospf/vr/{vr_name}` (GET, PATCH, DELETE)
- ✅ `/v0/configuration/ospf/vr/{vr_name}/area/{area_id}` (PUT, DELETE)
- ✅ `/v0/configuration/ospf/vr/{vr_name}/redistribute/{protocol}` (PUT, DELETE)
- ✅ `/v0/configuration/ospf/vlan/{vlan_id}` (GET, PATCH)
- ✅ `/v0/configuration/ospf/vr/{vr_name}/virtual-circuit/...` (PUT, DELETE)
- ✅ `/v0/state/ospf` (GET)

#### Data Model Field Coverage
- ✅ `enable`, `routerId`, `holdTime` (OspfUpdateSettings)
- ✅ `gracefulRestartType`, `gracefulRestartPeriod` (EXOS-specific)
- ✅ `originate` (EXOS-specific)
- ✅ `type`, `sendAreaSummary` (OspfAreaUpdateSettings)
- ✅ `enable`, `area`, `cost`, `priority` (OspfInterfaceSettings)
- ✅ `enable`, `metricType`, `metric` (OspfRedistributeSettings)
- ✅ `transitAreaId`, `virtualNeighborId` (OspfVirtualCircuitSettings)

#### Error Scenarios Coverage
- ✅ Invalid data types (router ID, area ID format)
- ✅ Out-of-range values (metric, hold time)
- ✅ Missing required fields (vrName)
- ✅ Non-existent resources (VR, VLAN, area)
- ✅ Invalid operations (DELETE from VR-Default, enable VLAN OSPF without VR OSPF)

---

## 7. Appendix

### 7.1 Test Execution Prerequisites

**Before Running Test Suite**:
1. ✅ REST API enabled on DUT (`enable web http` or `enable web https`)
2. ✅ Advanced Edge or Core license installed
3. ✅ At least 3 VLANs configured with IP addresses
4. ✅ VLANs in IP routing mode (`enable ipforwarding vlan <vlan_name>`)
5. ✅ Test client has network connectivity to DUT management IP
6. ✅ TCL automation framework with http package installed
7. ✅ TCL json package available for parsing responses

### 7.2 Common HTTP Response Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET request with response body |
| 201 | Created | Successful POST creating new resource (rare in NOS API) |
| 204 | No Content | Successful POST/PATCH/PUT/DELETE with no response body |
| 400 | Bad Request | Invalid request body, missing fields, out-of-range values |
| 404 | Not Found | Resource doesn't exist (VR, VLAN, area) |
| 409 | Conflict | Resource already exists (POST duplicate), operation not allowed |
| 500 | Internal Server Error | Server-side error processing request |

### 7.3 JSON Response Parsing Examples

**Example 1: Parse Router ID from GET Response**
```tcl
set response [ApiGet "/data/v0/configuration/ospf/vr/VR-Default" 200]
set jsonBody [dict get $response body]
set routerId [ParseJsonResponse $jsonBody "ospfGetSettings.routerId"]
puts "Router ID: $routerId"
```

**Example 2: Parse Area List**
```tcl
set response [ApiGet "/data/v0/configuration/ospf/vr/VR-Default" 200]
set jsonBody [dict get $response body]
set areas [ParseJsonResponse $jsonBody "ospfGetSettings.areas"]
foreach area $areas {
    puts "Area ID: [dict get $area areaId], Type: [dict get $area type]"
}
```

### 7.4 CLI Commands for Manual Verification

**Check OSPF Process Status**:
```bash
show ospf                     # Overall OSPF status
show ospf | include "State"   # Check ACTIVE/INACTIVE state
show ospf | include "Router ID"  # Verify router ID
```

**Check Areas**:
```bash
show ospf area                # List all areas
show ospf area 0.0.0.0        # Specific area details
```

**Check OSPF Interfaces**:
```bash
show ospf interface           # All OSPF-enabled interfaces
show ospf interface <vlan>    # Specific VLAN details
```

**Check Neighbors**:
```bash
show ospf neighbor            # All neighbors
show ospf neighbor detail     # Detailed neighbor info
```

**Check Redistribution**:
```bash
show ospf export              # All redistribution entries
```

**Check LSDB**:
```bash
show ospf lsdb                # All LSAs
show ospf lsdb external       # AS-External LSAs (redistributed routes)
show ospf lsdb router         # Router LSAs
```

**Check Routes**:
```bash
show iproute ospf             # OSPF routes in routing table
```

### 7.5 Troubleshooting Guide

| Issue | Possible Cause | Resolution |
|-------|---------------|------------|
| HTTP 404 on all requests | REST API not enabled | `enable web http` |
| HTTP 401 Unauthorized | Wrong credentials | Check API_AUTH_USER and API_AUTH_PASS |
| Timeout on API requests | Network connectivity | Ping DUT management IP, check firewall |
| OSPF not starting after POST | No interface IPs configured | Configure at least one VLAN with IP address |
| Virtual link not forming | Transit area not reachable | Verify transit area has active interfaces on both routers |
| Redistribution not working | AS boundary router not set (VOSS) | Set `isASBoundaryRouter: true` on VOSS |
| API returns 500 error | Server-side bug | Check EXOS logs, contact support |

### 7.6 Known Limitations

1. **VR-Default Cannot Be Deleted**: On EXOS, OSPF process always exists on VR-Default and cannot be deleted via DELETE operation (returns 400/409)

2. **Platform-Specific Fields**: Some fields only apply to EXOS or VOSS:
   - EXOS only: `gracefulRestartType`, `gracefulRestartPeriod`, `originate`
   - VOSS only: `isASBoundaryRouter`, `rfc1583CompatibilityEnable`, `helperModeEnable`, `autoVirtLinkEnable`

3. **Hold Time Range**: Different ranges for EXOS vs VOSS:
   - EXOS: 0-300 seconds (default 3)
   - VOSS: 0, 3-60 seconds (default 10)

4. **Router ID Auto-Derivation**: Requires at least one interface IP on EXOS, based on chassis MAC on VOSS

5. **API Response Format**: Some responses may include empty arrays/objects if no data exists (e.g., empty areas list, empty redistribution list)

### 7.7 Test Data Reference

**Test Router IDs**:
- Primary: 10.255.255.1
- Secondary: 10.255.255.10
- Neighbor: 10.255.255.2

**Test Area IDs**:
- Backbone: 0.0.0.0
- Area 1: 0.0.0.1
- Area 2: 0.0.0.2

**Test VLANs**:
- ospf_test_10 (VLAN 10, 10.0.10.1/24)
- ospf_test_20 (VLAN 20, 10.0.20.1/24)
- ospf_test_30 (VLAN 30, 10.0.30.1/24)

**Test Static Route**:
- 192.168.100.0/24 via 192.168.1.1

### 7.8 Automation Execution Command

**Run Full Test Suite**:
```bash
cd /extreme/Regression/33.7_latest/exos-tcl-automation/automation/Functionaltest/OSPF_API
./run_ospf_api_tests.tcl -dut1 <switch-ip>:22 -user admin -password admin
```

**Run Sanity Tests Only**:
```bash
./run_ospf_api_tests.tcl -dut1 <switch-ip>:22 -sanity
```

**Run Specific Test Case**:
```bash
./run_ospf_api_tests.tcl -dut1 <switch-ip>:22 -testcase TestCase_5_1_1_EnableOspfOnVr
```

---

## 8. Sign-Off and Approvals

**Test Plan Prepared By**: QA Automation Team  
**Date**: 2025-01-07  

**Review Status**: Ready for Review  

**Approvals**:
- [ ] QA Lead
- [ ] Development Lead
- [ ] Product Manager

**Execution Status**: Pending  
**Estimated Execution Time**: 3-4 hours (full suite)  
**Estimated Execution Time (Sanity)**: 30-45 minutes  

---

**End of Test Plan**
