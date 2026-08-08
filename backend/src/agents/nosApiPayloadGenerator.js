/**
 * NOS API Payload Generator Agent
 * 
 * Generates realistic test payloads from OpenAPI/Swagger specifications.
 * Uses intelligent inference based on property names, formats, and patterns.
 * 
 * Based on the NOS API Payload Generator tool from Extreme Networks.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

class NOSApiPayloadGenerator {
  constructor(openApiSpecPath = null) {
    this.spec = null;
    this.schemas = {};
    this.endpoints = [];
    
    if (openApiSpecPath) {
      this.loadSpec(openApiSpecPath);
    }
  }

  /**
   * Load OpenAPI specification from YAML file
   */
  loadSpec(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      this.spec = yaml.parse(content);
      this.schemas = this.spec.components?.schemas || {};
      this.endpoints = this.extractEndpoints();
      console.log(`✅ Loaded OpenAPI spec: ${this.endpoints.length} endpoints`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to load OpenAPI spec: ${error.message}`);
      return false;
    }
  }

  /**
   * Extract all endpoints from the OpenAPI spec
   */
  extractEndpoints() {
    const endpoints = [];
    
    if (!this.spec || !this.spec.paths) {
      return endpoints;
    }

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['parameters', 'summary', 'description'].includes(method)) continue;
        
        endpoints.push({
          path,
          method: method.toUpperCase(),
          operationId: operation.operationId,
          summary: operation.summary || '',
          description: operation.description || '',
          tags: operation.tags || [],
          parameters: operation.parameters || [],
          requestBodySchema: this.getRequestBodySchema(operation),
          responseSchema: this.getResponseSchema(operation),
        });
      }
    }

    return endpoints;
  }

  /**
   * Get request body schema from operation
   */
  getRequestBodySchema(operation) {
    return operation?.requestBody?.content?.['application/json']?.schema || null;
  }

  /**
   * Get response schema from operation (200/201 responses)
   */
  getResponseSchema(operation) {
    if (!operation?.responses) return null;
    
    const successResponse = operation.responses['200'] || 
                           operation.responses['201'] || 
                           operation.responses['default'];
    
    return successResponse?.content?.['application/json']?.schema || null;
  }

  /**
   * Resolve $ref reference to actual schema
   */
  resolveRef(ref) {
    if (!ref || !ref.startsWith('#/components/schemas/')) return null;
    const schemaName = ref.replace('#/components/schemas/', '');
    return this.schemas[schemaName] || null;
  }

  /**
   * Infer realistic string value based on schema format and property name
   */
  inferStringValue(schema, propName = '') {
    // Format-based inference
    if (schema.format === 'ipv4') return '10.0.0.1';
    if (schema.format === 'ipv6') return '2001:db8::1';
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'date') return new Date().toISOString().split('T')[0];
    if (schema.format === 'uri' || schema.format === 'url') return 'https://example.com';
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'uuid') return '550e8400-e29b-41d4-a716-446655440000';
    if (schema.format === 'hostname') return 'switch01.example.com';
    
    // Pattern-based inference (MAC address, IP address)
    if (schema.pattern) {
      if (schema.pattern.includes('Fa-f') || schema.pattern.includes('0-9A-F')) {
        return '00:04:96:98:65:1C';
      }
      if (schema.pattern.includes('\\d{1,3}\\.')) {
        return '10.0.0.1';
      }
    }

    // Property name-based inference
    if (propName) {
      return this.inferFromPropertyName(propName);
    }

    return 'example';
  }

  /**
   * Infer value from property name (smart inference)
   */
  inferFromPropertyName(name) {
    const lower = name.toLowerCase();

    // MAC addresses
    if (lower.includes('macaddr') || lower === 'mac' || lower === 'bmac' || 
        lower === 'virtualbmac' || lower === 'lacpsmlt') {
      return '00:04:96:98:65:1C';
    }

    // IP addresses
    if (lower.includes('ipaddr') || lower === 'ip' || lower === 'address' || 
        lower === 'nexthop' || lower.includes('srcip') || lower.includes('remoteip') ||
        lower.includes('sourceip') || lower.includes('gatewayip')) {
      return '10.0.0.1';
    }

    // Port names
    if (lower.includes('portname') || lower === 'port' || lower === 'portid' || 
        lower === 'loopbackport') {
      return '1/1';
    }

    // VLAN IDs
    if (lower.includes('vlanid') || lower === 'vlan' || lower === 'mvpnisid') {
      return 100;
    }

    // ISID
    if (lower.includes('isid') && !lower.includes('list')) {
      return 10000;
    }

    // Nickname (SPBM)
    if (lower.includes('nickname')) {
      return '0.00.01';
    }

    // Views, Groups, Maps
    if (lower.includes('viewname')) return 'defaultView';
    if (lower.includes('groupname')) return 'defaultGroup';
    if (lower.includes('routemap')) return 'routeMap1';

    // Security
    if (lower.includes('password') || lower.includes('secret')) {
      return 'securePass123';
    }

    // Timeouts and numeric values
    if (lower.includes('timeout')) return 30;
    if (lower.includes('mtu')) return 1500;
    if (lower.includes('bandwidth') || lower.includes('speed')) return 1000;
    if (lower.includes('metric') || lower.includes('cost') || lower.includes('weight')) return 1;
    if (lower.includes('priority') || lower.includes('precedence')) return 0;

    // Names and labels
    if (lower.includes('name') || lower.includes('label') || lower.includes('description')) {
      return 'example';
    }

    // IDs and counts
    if (lower.includes('id') || lower.includes('num') || lower.includes('slot') || 
        lower.includes('queue') || lower.includes('count') || lower.includes('size') || 
        lower.includes('length')) {
      return 1;
    }

    // Boolean flags
    if (lower.includes('enable') || lower.includes('active') || lower.includes('admin')) {
      return true;
    }

    // Enumerations
    if (lower.includes('role') || lower.includes('state') || lower.includes('status') || 
        lower.includes('type') || lower.includes('mode') || lower.includes('level') || 
        lower.includes('direction') || lower.includes('origin') || lower.includes('class') || 
        lower.includes('duplex') || lower.includes('trust')) {
      return 'string';
    }

    return 'example';
  }

  /**
   * Generate example payload from schema (recursive)
   */
  generateExample(schema, visited = new Set(), propName = '') {
    if (!schema) return null;

    // Use explicit example or default if provided
    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;

    // Use first enum value if available
    if (schema.enum && schema.enum.length > 0) {
      return schema.enum[0];
    }

    // Handle $ref (resolve reference)
    if (schema.$ref) {
      if (visited.has(schema.$ref)) {
        return null; // Circular reference detected
      }
      visited.add(schema.$ref);
      const resolved = this.resolveRef(schema.$ref);
      if (!resolved) return null;
      return this.generateExample(resolved, visited, propName);
    }

    // Handle allOf, anyOf, oneOf (merge schemas)
    if (schema.allOf || schema.anyOf || schema.oneOf) {
      const merged = {};
      let primitiveValue = undefined;

      // Merge properties from base schema
      if (schema.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
          const val = this.generateExample(value, new Set(visited), key);
          if (val !== undefined && val !== null) {
            merged[key] = val;
          }
        }
      }

      // Merge allOf schemas
      const schemasToMerge = schema.allOf || schema.anyOf || schema.oneOf || [];
      for (const subSchema of schemasToMerge) {
        const val = this.generateExample(subSchema, new Set(visited), propName);
        if (val !== null && val !== undefined) {
          if (typeof val === 'object' && !Array.isArray(val)) {
            Object.assign(merged, val);
          } else if (primitiveValue === undefined) {
            primitiveValue = val;
          }
        }
      }

      if (Object.keys(merged).length > 0) return merged;
      if (primitiveValue !== undefined) return primitiveValue;
      return null;
    }

    // Handle object type
    if (schema.type === 'object' || schema.properties) {
      const obj = {};
      if (schema.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
          const val = this.generateExample(value, new Set(visited), key);
          if (val !== undefined && val !== null) {
            obj[key] = val;
          }
        }
      }
      return obj;
    }

    // Handle array type
    if (schema.type === 'array') {
      if (schema.items) {
        const item = this.generateExample(schema.items, new Set(visited));
        return [item !== null && item !== undefined ? item : 'example'];
      }
      return [];
    }

    // Handle string type
    if (schema.type === 'string') {
      return this.inferStringValue(schema, propName);
    }

    // Handle integer/number type
    if (schema.type === 'integer' || schema.type === 'number') {
      if (schema.minimum !== undefined) return schema.minimum;
      if (schema.maximum !== undefined && schema.maximum < 100) return schema.maximum;
      return 0;
    }

    // Handle boolean type
    if (schema.type === 'boolean') {
      return false;
    }

    // Fallback to property name inference
    if (propName) {
      return this.inferFromPropertyName(propName);
    }

    return 'example';
  }

  /**
   * Generate payload for a specific endpoint
   */
  generatePayload(method, path) {
    const endpoint = this.endpoints.find(
      e => e.method === method.toUpperCase() && e.path === path
    );

    if (!endpoint) {
      throw new Error(`Endpoint not found: ${method} ${path}`);
    }

    if (!endpoint.requestBodySchema) {
      return null; // No request body for this endpoint
    }

    const payload = this.generateExample(endpoint.requestBodySchema);
    return payload;
  }

  /**
   * Validate that a payload doesn't have null values or empty objects
   */
  validatePayload(payload) {
    const issues = [];

    const checkForIssues = (obj, path = '') => {
      if (obj === null || obj === undefined) {
        issues.push({ path, issue: 'null or undefined value' });
        return;
      }

      if (typeof obj === 'object') {
        if (Array.isArray(obj)) {
          if (obj.length === 0) {
            issues.push({ path, issue: 'empty array' });
          } else {
            obj.forEach((item, index) => {
              checkForIssues(item, `${path}[${index}]`);
            });
          }
        } else {
          const keys = Object.keys(obj);
          if (keys.length === 0) {
            issues.push({ path, issue: 'empty object' });
          } else {
            for (const [key, value] of Object.entries(obj)) {
              checkForIssues(value, path ? `${path}.${key}` : key);
            }
          }
        }
      }
    };

    checkForIssues(payload);
    return { valid: issues.length === 0, issues };
  }

  /**
   * Get all endpoints for a specific tag (feature category)
   */
  getEndpointsByTag(tag) {
    return this.endpoints.filter(e => e.tags.includes(tag));
  }

  /**
   * Get all unique tags from the spec
   */
  getTags() {
    const tagsSet = new Set();
    this.endpoints.forEach(e => {
      e.tags.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }

  /**
   * Get endpoint details including schema and generated payload
   */
  getEndpointDetails(method, path) {
    const endpoint = this.endpoints.find(
      e => e.method === method.toUpperCase() && e.path === path
    );

    if (!endpoint) {
      return null;
    }

    let requestPayload = null;
    let responsePayload = null;

    if (endpoint.requestBodySchema) {
      requestPayload = this.generateExample(endpoint.requestBodySchema);
    }

    if (endpoint.responseSchema) {
      responsePayload = this.generateExample(endpoint.responseSchema);
    }

    return {
      ...endpoint,
      requestPayload,
      responsePayload,
      requestPayloadValidation: requestPayload ? this.validatePayload(requestPayload) : null,
      responsePayloadValidation: responsePayload ? this.validatePayload(responsePayload) : null,
    };
  }

  /**
   * Search endpoints by keyword in path, summary, or description
   */
  searchEndpoints(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return this.endpoints.filter(e => 
      e.path.toLowerCase().includes(lowerKeyword) ||
      e.summary.toLowerCase().includes(lowerKeyword) ||
      e.description.toLowerCase().includes(lowerKeyword) ||
      e.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))
    );
  }
}

module.exports = NOSApiPayloadGenerator;
