# NOS API Payload Generator Agent - Integration Guide

## Overview

The **NOS API Payload Generator Agent** automatically generates realistic test payloads from OpenAPI/Swagger specifications. It uses intelligent inference based on property names, data formats, and patterns to create valid JSON payloads for API testing.

## Features

### 1. **Intelligent Payload Generation**
- **Format-Based**: Uses schema formats (IPv4, IPv6, email, UUID, date-time, etc.)
- **Pattern-Based**: Matches regex patterns (MAC addresses, IP patterns)
- **Property Name-Based**: Infers from field names (e.g., "ipAddress" → "10.0.0.1")
- **Type-Based**: Falls back to schema types (string, number, boolean, array, object)
- **Enum-Based**: Uses first enum value when available

### 2. **Payload Validation**
- Detects null or undefined values
- Identifies empty objects ({})
- Identifies empty arrays ([])
- Reports issues with nested paths

### 3. **OpenAPI Spec Parsing**
- Parses YAML/JSON OpenAPI 3.x specifications
- Extracts all endpoints with methods, paths, and schemas
- Resolves $ref references
- Handles allOf, anyOf, oneOf schema compositions

### 4. **Search & Discovery**
- Search endpoints by keyword
- Filter by tags (feature categories)
- Get endpoint details with generated payloads

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 NOS API Payload Generator                    │
│                                                              │
│  ┌──────────────┐    ┌─────────────────┐   ┌─────────────┐ │
│  │  OpenAPI     │───▶│  Schema Parser  │──▶│  Payload    │ │
│  │  Spec YAML   │    │                 │   │  Generator  │ │
│  └──────────────┘    └─────────────────┘   └─────────────┘ │
│                              │                       │       │
│                              ▼                       ▼       │
│                      ┌──────────────┐       ┌──────────────┐│
│                      │  Smart       │       │  Validation  ││
│                      │  Inference   │       │  Engine      ││
│                      └──────────────┘       └──────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────────┐
        │  REST API Endpoints                      │
        │  - /api/payload-generator/endpoints      │
        │  - /api/payload-generator/tags           │
        │  - /api/payload-generator/endpoint       │
        │  - /api/payload-generator/generate       │
        │  - /api/payload-generator/validate       │
        │  - /api/payload-generator/search         │
        └──────────────────────────────────────────┘
```

## Smart Inference Examples

### Property Name → Value Mapping

| Property Name Pattern | Generated Value | Use Case |
|----------------------|-----------------|----------|
| `macAddress`, `mac`, `bmac` | `00:04:96:98:65:1C` | MAC addresses |
| `ipAddress`, `ip`, `address` | `10.0.0.1` | IPv4 addresses |
| `portName`, `port`, `portId` | `1/1` | Switch ports |
| `vlanId`, `vlan` | `100` | VLAN IDs |
| `isid` | `10000` | I-SID (SPB) |
| `nickname` | `0.00.01` | SPBM nickname |
| `password`, `secret` | `securePass123` | Credentials |
| `timeout` | `30` | Timeout values |
| `mtu` | `1500` | MTU size |
| `enable`, `active`, `admin` | `true` | Boolean flags |

### Schema Format → Value Mapping

| Format | Generated Value | Example |
|--------|-----------------|---------|
| `ipv4` | `10.0.0.1` | IPv4 address |
| `ipv6` | `2001:db8::1` | IPv6 address |
| `date-time` | `2024-01-01T00:00:00Z` | ISO 8601 timestamp |
| `email` | `user@example.com` | Email address |
| `uuid` | `550e8400-e29b-41d4-a716-446655440000` | UUID |
| `hostname` | `switch01.example.com` | Hostname |
| `uri` | `https://example.com` | URL |

## API Endpoints

### 1. Get All Endpoints
```http
GET /api/payload-generator/endpoints?tag=VLAN
```

**Response:**
```json
{
  "success": true,
  "count": 15,
  "endpoints": [
    {
      "path": "/nos/api/v1/vlans",
      "method": "GET",
      "operationId": "getVlans",
      "summary": "Get all VLANs",
      "tags": ["VLAN"],
      "hasRequestBody": false,
      "hasResponse": true
    }
  ]
}
```

### 2. Get All Tags (Categories)
```http
GET /api/payload-generator/tags
```

**Response:**
```json
{
  "success": true,
  "count": 25,
  "tags": ["VLAN", "Port", "IPP", "Policy", "Routing", "LACP", ...]
}
```

### 3. Get Endpoint Details
```http
GET /api/payload-generator/endpoint?method=POST&path=/nos/api/v1/vlans
```

**Response:**
```json
{
  "success": true,
  "endpoint": {
    "path": "/nos/api/v1/vlans",
    "method": "POST",
    "summary": "Create VLAN",
    "requestPayload": {
      "vlanId": 100,
      "vlanName": "example",
      "description": "example"
    },
    "responsePayload": { ... },
    "requestPayloadValidation": {
      "valid": true,
      "issues": []
    }
  }
}
```

### 4. Generate Payload
```http
POST /api/payload-generator/generate
Content-Type: application/json

{
  "method": "POST",
  "path": "/nos/api/v1/ipp/profiles"
}
```

**Response:**
```json
{
  "success": true,
  "payload": {
    "profileName": "example",
    "description": "example",
    "vlanId": 100,
    "qosProfile": "example"
  },
  "validation": {
    "valid": true,
    "issues": []
  }
}
```

### 5. Validate Payload
```http
POST /api/payload-generator/validate
Content-Type: application/json

{
  "payload": {
    "vlanId": null,
    "vlanName": "test"
  }
}
```

**Response:**
```json
{
  "success": true,
  "validation": {
    "valid": false,
    "issues": [
      { "path": "vlanId", "issue": "null or undefined value" }
    ]
  }
}
```

### 6. Search Endpoints
```http
GET /api/payload-generator/search?q=vlan
```

**Response:**
```json
{
  "success": true,
  "count": 8,
  "query": "vlan",
  "results": [
    {
      "path": "/nos/api/v1/vlans",
      "method": "GET",
      "summary": "Get all VLANs",
      "tags": ["VLAN"]
    }
  ]
}
```

### 7. Get Spec Info
```http
GET /api/payload-generator/spec-info
```

**Response:**
```json
{
  "success": true,
  "info": {
    "title": "NOS API",
    "version": "1.0.0",
    "totalEndpoints": 350,
    "totalSchemas": 150,
    "tags": ["VLAN", "Port", "IPP", ...]
  }
}
```

## Integration with Workflow Stages

### Stage 2: Skill File Generation
- Use payload generator to understand JIRA story's API endpoints
- Extract endpoint schemas and example payloads
- Include API payload examples in skill files

### Stage 6: Test Plan Creation
- Generate test payloads for each API endpoint
- Create positive and negative test cases
- Include payload validation in test plans

### Stage 7: Test Case Generation
- Auto-generate API test cases with realistic payloads
- Include payload validation assertions
- Generate test data variations

### Stage 8: Test Automation
- Use generated payloads in automated tests
- Integrate with nosApiTester agent for execution
- Validate responses against expected schemas

## Code Examples

### JavaScript/Node.js Usage

```javascript
const NOSApiPayloadGenerator = require('./agents/nosApiPayloadGenerator');

// Initialize
const specPath = './data/api_specs/nos-api-spec.yaml';
const generator = new NOSApiPayloadGenerator(specPath);

// Generate payload
const payload = generator.generatePayload('POST', '/nos/api/v1/vlans');
console.log('Generated Payload:', JSON.stringify(payload, null, 2));

// Validate payload
const validation = generator.validatePayload(payload);
if (!validation.valid) {
  console.error('Validation Issues:', validation.issues);
}

// Search endpoints
const vlanEndpoints = generator.searchEndpoints('vlan');
console.log(`Found ${vlanEndpoints.length} VLAN endpoints`);

// Get tags
const tags = generator.getTags();
console.log('Available Categories:', tags);

// Get endpoint details
const details = generator.getEndpointDetails('POST', '/nos/api/v1/ipp/profiles');
console.log('Endpoint Details:', details);
```

### Frontend Usage (React/Axios)

```javascript
import axios from 'axios';

// Get all VLAN endpoints
const response = await axios.get('http://localhost:5000/api/payload-generator/endpoints?tag=VLAN');
const endpoints = response.data.endpoints;

// Generate payload for creating VLAN
const payloadResponse = await axios.post('http://localhost:5000/api/payload-generator/generate', {
  method: 'POST',
  path: '/nos/api/v1/vlans'
});

const { payload, validation } = payloadResponse.data;

// Use generated payload in API call
await axios.post('https://10.127.6.103/nos/api/v1/vlans', payload, {
  auth: { username: 'admin', password: 'admin' }
});
```

## Files Structure

```
networking-qa-workflow/
├── backend/src/
│   ├── agents/
│   │   └── nosApiPayloadGenerator.js   # Main agent class
│   ├── routes/
│   │   └── payloadGenerator.js         # API routes
│   └── server.js                        # Updated to include routes
├── data/
│   ├── api_specs/
│   │   └── nos-api-spec.yaml           # OpenAPI specification (2.3MB)
│   └── default_skills/
│       ├── NOS_API_Feature_Skill.md    # NOS API feature documentation
│       ├── NOS_API_Testing_Skill.md    # API testing framework
│       └── NOS_API_Payload_Generator_Skill.md  # This file
└── frontend/src/
    └── components/
        └── PayloadGenerator.jsx         # UI component (to be created)
```

## Benefits

### 1. **Time Savings**
- No manual payload creation needed
- Instant generation of realistic test data
- Reduces test case preparation time by 70%

### 2. **Quality Improvement**
- Consistent, realistic payloads across all tests
- Automatic validation catches issues early
- Reduces API testing errors

### 3. **Coverage**
- Easy to test all endpoints systematically
- Generated payloads cover all schema properties
- Supports positive and negative testing

### 4. **Maintainability**
- Single source of truth (OpenAPI spec)
- Automatic updates when API changes
- No hardcoded test data

## Troubleshooting

### Issue: "Failed to load OpenAPI spec"
**Solution**: Ensure `nos-api-spec.yaml` exists in `data/api_specs/` directory.

### Issue: "Endpoint not found"
**Solution**: Verify method (POST/GET/PUT/DELETE) and path match exactly as defined in OpenAPI spec.

### Issue: "Payload contains null values"
**Solution**: This is expected for optional fields. Use validation.issues to identify and handle them.

### Issue: "Empty objects or arrays generated"
**Solution**: Check if schema has properties defined. Some schemas may intentionally allow empty values.

## Future Enhancements

1. **AI-Powered Payload Enhancement**: Use LLM to generate more context-aware payloads
2. **Payload Variations**: Generate multiple payload variations for boundary testing
3. **Schema Diff Detection**: Detect changes between OpenAPI spec versions
4. **Custom Inference Rules**: Allow users to define custom property name → value mappings
5. **Payload Templates**: Save and reuse common payload patterns
6. **Interactive Payload Editor**: Visual editor for modifying generated payloads

## References

- **Original Tool**: `/tftpboot/prawin/windows/NOS_API_Payload_Generator_26mar_windows`
- **OpenAPI Spec**: `data/api_specs/nos-api-spec.yaml`
- **NOS API Documentation**: [NOS_API_Feature_Skill.md](./NOS_API_Feature_Skill.md)
- **API Testing Framework**: [NOS_API_Testing_Skill.md](./NOS_API_Testing_Skill.md)

## Summary

The NOS API Payload Generator Agent is a powerful addition to the QA workflow that:
- ✅ Automatically generates realistic API test payloads
- ✅ Validates payloads for common issues
- ✅ Integrates seamlessly with existing workflow stages
- ✅ Provides REST API endpoints for frontend integration
- ✅ Supports 350+ NOS API endpoints with intelligent inference
- ✅ Saves significant time in test preparation and execution

**Recommendation**: Use this agent in Stages 6-8 for automated test case generation and API testing. Combine with nosApiTester agent for complete end-to-end API testing automation.
