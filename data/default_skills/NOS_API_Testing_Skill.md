# NOS OpenAPI Testing - Skill File

## Overview

**Feature**: EXOS REST API Testing Integration  
**Component**: Test Automation / API Validation  
**Purpose**: Automated testing of EXOS network switch APIs  

This skill file documents the NOS OpenAPI endpoints, testing methodology, and integration with the QA workflow system for comprehensive API test coverage.

---

## EXOS REST API Architecture

### API Base Structure

**Base URL Format**: `https://<switch-ip>:<port>/rest`

**Common Endpoints**:
- `/rest/restconf/data/` - RESTCONF data plane
- `/rest/openapi/v0/` - OpenAPI v0 endpoints
- `/rest/restconf/operations/` - RPC operations

**Authentication**: Basic Auth (username/password)

**Content-Type**: `application/json`

### OpenConfig Models

EXOS supports OpenConfig-based APIs for:
- **Policy**: `openconfig-policy-v3:policy`
- **Ports**: `openconfig-port:ports`
- **VLANs**: `openconfig-vlan:vlans`
- **Interfaces**: `openconfig-interfaces:interfaces`
- **Routing**: `openconfig-routing-policy:routing-policy`

---

## Common API Endpoints

### 1. IPP (Instant Port Profile) APIs

#### Create Profile
```http
POST /rest/restconf/data/openconfig-policy-v3:policy/profiles/profile
Content-Type: application/json

{
  "profile-name": "MyProfile",
  "pvid": 100,
  "cos": 0,
  "egress-vlans": "100,200",
  "forbidden-vlans": "1",
  "rate-limit-broadcast": 1000,
  "rate-limit-multicast": 500,
  "rate-limit-unknown-destmac": 2000
}
```

**Response**: `201 Created` or `200 OK`

#### Get Profile
```http
GET /rest/restconf/data/openconfig-policy-v3:policy/profiles/profile={profile-name}
```

#### Update Profile
```http
PUT /rest/restconf/data/openconfig-policy-v3:policy/profiles/profile={profile-name}
Content-Type: application/json

{
  "profile-name": "MyProfile",
  "pvid": 200,
  "rate-limit-broadcast": 2000
}
```

#### Delete Profile
```http
DELETE /rest/restconf/data/openconfig-policy-v3:policy/profiles/profile={profile-name}
```

#### List All Profiles
```http
GET /rest/restconf/data/openconfig-policy-v3:policy/profiles
```

---

### 2. Policy Rule APIs

#### Create Rule
```http
POST /rest/restconf/data/openconfig-policy-v3:policy/rules/rule
Content-Type: application/json

{
  "rule-name": "MyRule",
  "profile-name": "MyProfile",
  "match-type": "mac-source",
  "mac-address": "00:11:22:33:44:55",
  "mac-mask": 48,
  "ports": ["1:1", "1:2"]
}
```

#### Get Rule
```http
GET /rest/restconf/data/openconfig-policy-v3:policy/rules/rule={rule-name}
```

#### Delete Rule
```http
DELETE /rest/restconf/data/openconfig-policy-v3:policy/rules/rule={rule-name}
```

---

### 3. Port Configuration APIs

#### Get Port State
```http
GET /rest/restconf/data/openconfig-port:ports/port={port-id}/state
```

**Example**: `/rest/restconf/data/openconfig-port:ports/port=1:1/state`

**Response**:
```json
{
  "state": {
    "port-id": "1:1",
    "admin-status": "UP",
    "oper-status": "UP",
    "speed": "1000",
    "rate-limit": {
      "broadcast": {
        "rate": 1000,
        "enabled": true
      }
    }
  }
}
```

#### Get Port Configuration
```http
GET /rest/restconf/data/openconfig-port:ports/port={port-id}/config
```

#### Configure Port
```http
PUT /rest/restconf/data/openconfig-port:ports/port={port-id}/config
Content-Type: application/json

{
  "admin-status": "UP",
  "description": "Uplink Port"
}
```

---

### 4. VLAN APIs

#### Create VLAN
```http
POST /rest/restconf/data/openconfig-vlan:vlans/vlan
Content-Type: application/json

{
  "vlan-id": 100,
  "name": "TestVLAN",
  "description": "Test VLAN for API testing"
}
```

#### Get VLAN
```http
GET /rest/restconf/data/openconfig-vlan:vlans/vlan={vlan-id}
```

#### Add Ports to VLAN
```http
POST /rest/restconf/data/openconfig-vlan:vlans/vlan={vlan-id}/ports
Content-Type: application/json

{
  "ports": ["1:1", "1:2"],
  "tagging": "tagged"
}
```

#### Delete VLAN
```http
DELETE /rest/restconf/data/openconfig-vlan:vlans/vlan={vlan-id}
```

---

### 5. System Information APIs

#### Get System Info
```http
GET /rest/restconf/data/openconfig-system:system/state
```

**Response**:
```json
{
  "state": {
    "hostname": "Switch01",
    "version": "33.7.0.96",
    "model": "X465-24W",
    "serial-number": "ABC123456"
  }
}
```

#### Get Software Version
```http
GET /rest/restconf/data/openconfig-system:system/state/software-version
```

---

### 6. Statistics APIs

#### Get Port Statistics
```http
GET /rest/restconf/data/openconfig-port:ports/port={port-id}/statistics
```

#### Get VLAN Statistics
```http
GET /rest/restconf/data/openconfig-vlan:vlans/vlan={vlan-id}/statistics
```

---

## API Testing Framework Integration

### Testing Agent Location

`backend/src/agents/nosApiTester.js`

### Test Template Location

`data/api_test_templates/`

### Usage Example

```javascript
const { NOSApiTester } = require('./agents/nosApiTester');

// Initialize tester
const tester = new NOSApiTester({
  baseUrl: 'https://10.1.1.1',
  username: 'admin',
  password: 'password',
  validateCerts: false
});

// Run single test
const result = await tester.testGet('/rest/restconf/data/openconfig-system:system/state', {
  assertions: [
    { type: 'status', expected: 200, description: 'System info retrieved' },
    { type: 'jsonPathExists', path: 'state.hostname', description: 'Hostname present' }
  ]
});

// Run test suite from template
const testSuite = require('../data/api_test_templates/IPP_API_Test_Cases.json');
const results = await tester.runTestSuite(testSuite.tests);

console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
```

---

## Test Case Template Structure

### Complete Test Case JSON

```json
{
  "testSuite": {
    "name": "Feature Name API Tests",
    "feature": "EXOS-XXXXX",
    "baseUrl": "https://switch-ip",
    "description": "API test cases for feature",
    "tags": ["feature", "api"]
  },
  "tests": [
    {
      "id": "TC-API-001",
      "name": "Test Name",
      "description": "Test description",
      "method": "GET|POST|PUT|DELETE",
      "endpoint": "/rest/path/to/resource",
      "data": { },
      "options": {
        "assertions": [
          {
            "type": "status|statusRange|header|jsonPath|jsonPathExists|schema|responseTime",
            "expected": "<value>",
            "description": "What this assertion validates"
          }
        ]
      }
    }
  ]
}
```

### Assertion Types

| Type | Description | Example |
|------|-------------|---------|
| `status` | Exact status code match | `{ type: 'status', expected: 200 }` |
| `statusRange` | Status code range | `{ type: 'statusRange', expected: [200, 299] }` |
| `header` | Header value match | `{ type: 'header', header: 'Content-Type', expected: 'application/json' }` |
| `jsonPath` | JSON path exact value | `{ type: 'jsonPath', path: 'profile.pvid', expected: 100 }` |
| `jsonPathExists` | JSON path exists | `{ type: 'jsonPathExists', path: 'state.hostname' }` |
| `schema` | JSON schema validation | `{ type: 'schema', schema: { type: 'object' } }` |
| `responseTime` | Max response time (ms) | `{ type: 'responseTime', expected: 1000 }` |

---

## Integration with Workflow Stages

### Stage 6: Test Case Generation

When generating test cases for a feature:

1. **Extract API Examples from Skill File**:
   - Parse skill file for REST API code blocks
   - Extract endpoints, methods, request bodies
   - Auto-generate test cases

```javascript
const { NOSApiTester } = require('./agents/nosApiTester');
const skillFileContent = fs.readFileSync('skill-file.md', 'utf-8');
const tests = NOSApiTester.generateTestCasesFromSkillFile(skillFileContent);
```

2. **Generate Test Plan Section**:
   - API functional tests
   - API negative tests
   - API performance tests

### Stage 7: Test Execution

Execute API tests automatically:

```javascript
const tester = new NOSApiTester(config);
const results = await tester.runTestSuite(tests);

// Generate report
const report = {
  totalTests: results.totalTests,
  passed: results.passed,
  failed: results.failed,
  passRate: (results.passed / results.totalTests * 100).toFixed(2) + '%',
  duration: results.duration + 'ms',
  tests: results.tests.map(t => ({
    name: t.name,
    success: t.success,
    statusCode: t.statusCode,
    duration: t.duration,
    assertions: t.assertions
  }))
};
```

---

## Common Test Scenarios

### Scenario 1: CRUD Operations Test

```json
{
  "tests": [
    {
      "id": "TC-CRUD-001",
      "name": "Create Resource",
      "method": "POST",
      "endpoint": "/rest/resource",
      "data": { "name": "test" }
    },
    {
      "id": "TC-CRUD-002",
      "name": "Read Resource",
      "method": "GET",
      "endpoint": "/rest/resource/test"
    },
    {
      "id": "TC-CRUD-003",
      "name": "Update Resource",
      "method": "PUT",
      "endpoint": "/rest/resource/test",
      "data": { "name": "test", "updated": true }
    },
    {
      "id": "TC-CRUD-004",
      "name": "Delete Resource",
      "method": "DELETE",
      "endpoint": "/rest/resource/test"
    },
    {
      "id": "TC-CRUD-005",
      "name": "Verify Deletion",
      "method": "GET",
      "endpoint": "/rest/resource/test",
      "options": {
        "assertions": [
          { "type": "status", "expected": 404 }
        ]
      }
    }
  ]
}
```

### Scenario 2: Configuration Validation Test

Test that API configuration matches CLI configuration:

1. Configure via API
2. Retrieve via API (validate accepted)
3. Verify via CLI show commands
4. Check actual port/switch state

### Scenario 3: Negative Testing

```json
{
  "tests": [
    {
      "name": "Invalid Parameter - Rate Limit Out of Range",
      "method": "POST",
      "endpoint": "/rest/restconf/data/openconfig-policy-v3:policy/profiles/profile",
      "data": {
        "profile-name": "Invalid",
        "rate-limit-broadcast": 2000000
      },
      "options": {
        "assertions": [
          { "type": "statusRange", "expected": [400, 499] }
        ]
      }
    },
    {
      "name": "Missing Required Field",
      "method": "POST",
      "endpoint": "/rest/restconf/data/openconfig-policy-v3:policy/profiles/profile",
      "data": {
        "pvid": 100
      },
      "options": {
        "assertions": [
          { "type": "status", "expected": 400 }
        ]
      }
    }
  ]
}
```

---

## API vs CLI Verification

### Verification Pattern

For critical features (especially EXOS-39560 type bugs), verify API configuration is actually applied:

```javascript
// 1. Configure via API
await tester.testPost('/rest/restconf/data/openconfig-policy-v3:policy/profiles/profile', {
  "profile-name": "Test",
  "rate-limit-broadcast": 1000
});

// 2. Verify API shows configuration
await tester.testGet('/rest/restconf/data/openconfig-policy-v3:policy/profiles/profile=Test', {
  assertions: [
    { type: 'jsonPath', path: 'profile.rate-limit-broadcast', expected: 1000 }
  ]
});

// 3. CRITICAL: Verify actual port configuration (not just API response)
await tester.testGet('/rest/restconf/data/openconfig-port:ports/port=1:1/state', {
  assertions: [
    {
      type: 'jsonPathExists',
      path: 'state.rate-limit.broadcast.rate',
      description: 'Rate limit actually applied to port (EXOS-39560 check)'
    }
  ]
});

// 4. Verify via CLI (if available)
// Execute: show ports 1:1 information detail | include rate
// Confirm: Broadcast Rate: 1000 pps
```

---

## Error Handling

### Common Error Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Invalid JSON, missing required fields, parameter out of range |
| 401 | Unauthorized | Invalid credentials, expired session |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists, conflicting state |
| 500 | Internal Server Error | EXOS internal error, unsupported operation |
| 503 | Service Unavailable | EXOS not ready, feature disabled |

### Error Response Format

```json
{
  "error": {
    "code": 400,
    "message": "Invalid parameter value",
    "details": "rate-limit-broadcast must be between 1 and 1000000"
  }
}
```

---

## Best Practices

### 1. Test Ordering

**Setup → Test → Cleanup**

```json
{
  "setup": [
    { "name": "Create Test VLAN", "method": "POST", ... }
  ],
  "tests": [
    { "name": "Run Tests", ... }
  ],
  "cleanup": [
    { "name": "Delete Test VLAN", "method": "DELETE", ... }
  ]
}
```

### 2. Idempotent Tests

Tests should be repeatable:
- Clean up before and after
- Use unique names/IDs per test run
- Check existence before creation

### 3. Assertion Coverage

For each test, validate:
- ✅ Status code correct
- ✅ Response body structure valid
- ✅ Response data values correct
- ✅ Side effects occurred (if applicable)

### 4. Negative Testing

Test error conditions:
- Missing required fields
- Invalid values
- Out-of-range parameters
- Non-existent resources
- Conflicting operations

### 5. Performance Testing

Monitor response times:
```javascript
{
  "assertions": [
    {
      "type": "responseTime",
      "expected": 1000,
      "description": "Response within 1 second"
    }
  ]
}
```

---

## Troubleshooting

### Issue 1: SSL Certificate Errors

```javascript
const tester = new NOSApiTester({
  baseUrl: 'https://switch-ip',
  validateCerts: false  // Disable for self-signed certs
});
```

### Issue 2: Timeout Errors

```javascript
const tester = new NOSApiTester({
  timeout: 60000  // Increase to 60 seconds
});
```

### Issue 3: Authentication Failures

- Verify username/password correct
- Check user has API access permissions
- Ensure EXOS version supports REST API

### Issue 4: API Configuration Not Applied

**EXOS-39560 Pattern**: API accepts configuration but doesn't apply it

**Detection**:
1. API POST/PUT succeeds (200/201)
2. API GET shows configuration
3. Actual port/switch state doesn't reflect configuration

**Test Pattern**:
```javascript
const tests = [
  { name: 'Configure via API', ... },
  { name: 'Verify API shows config', ... },
  { name: 'Verify actual state', assertions: [ /* Check real state */ ] }
];
```

---

## Example: Complete IPP API Test Suite

See: `data/api_test_templates/IPP_API_Test_Cases.json`

Covers:
- ✅ Profile CRUD operations
- ✅ Rule creation and assignment
- ✅ Rate limit configuration
- ✅ Port state verification
- ✅ Negative tests (invalid values)
- ✅ Cleanup operations

**Execution**:
```javascript
const testSuite = require('./data/api_test_templates/IPP_API_Test_Cases.json');
const results = await tester.runTestSuite(testSuite.tests);
```

---

## Integration Script Example

Create `backend/src/routes/apiTest.js`:

```javascript
const express = require('express');
const router = express.Router();
const { NOSApiTester } = require('../agents/nosApiTester');
const fs = require('fs');

// Execute API tests for a workflow
router.post('/execute/:workflow_id', async (req, res) => {
  try {
    const { workflow_id } = req.params;
    const { switch_ip, username, password, test_suite_file } = req.body;
    
    // Load test suite
    const testSuite = JSON.parse(fs.readFileSync(test_suite_file, 'utf-8'));
    
    // Initialize tester
    const tester = new NOSApiTester({
      baseUrl: `https://${switch_ip}`,
      username,
      password,
      validateCerts: false
    });
    
    // Run tests
    const results = await tester.runTestSuite(testSuite.tests);
    
    // Save results to database
    db.prepare(`
      INSERT INTO api_test_results (workflow_id, results, timestamp)
      VALUES (?, ?, datetime('now'))
    `).run(workflow_id, JSON.stringify(results));
    
    res.json({
      success: true,
      results: {
        totalTests: results.totalTests,
        passed: results.passed,
        failed: results.failed,
        passRate: (results.passed / results.totalTests * 100).toFixed(2) + '%',
        duration: results.duration
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

---

## References

### Documentation
- EXOS User Guide: REST API chapter
- OpenConfig Models: https://openconfig.net/
- RESTCONF Specification: RFC 8040

### Related Files
- **API Tester Agent**: `backend/src/agents/nosApiTester.js`
- **Test Templates**: `data/api_test_templates/`
- **IPP API Tests**: `data/api_test_templates/IPP_API_Test_Cases.json`

### Related JIRA
- EXOS-39560: IPP RATE_LIMIT_BROADCAST - Example of API config not applied
- API testing prevents regressions where API accepts config but doesn't apply

---

## Summary

The NOS API Testing Framework provides:

✅ **Automated API Testing** - HTTP method support (GET, POST, PUT, DELETE)  
✅ **Flexible Assertions** - Status codes, JSON paths, schemas, response times  
✅ **Test Suite Execution** - Batch test execution with reporting  
✅ **Integration with Workflow** - Stage 6/7 test generation and execution  
✅ **Skill File Parsing** - Auto-generate tests from documentation  
✅ **Comprehensive Templates** - IPP and other feature test templates  
✅ **Bug Detection** - Catches EXOS-39560-style issues (API vs reality mismatch)  

**Recommendation**: For every feature with REST API support, create corresponding API test cases to ensure configuration is not only accepted but actually applied to the switch.
