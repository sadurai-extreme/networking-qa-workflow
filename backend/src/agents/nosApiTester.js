/**
 * NOS API Testing Agent
 * 
 * Purpose: Automated testing of EXOS REST API endpoints
 * Supports: GET, POST, PUT, DELETE operations
 * Validates: Response codes, schema, data correctness
 * 
 * Integration: Used in Stage 6 (Test Case Creation) and Stage 7 (Test Execution)
 */

const axios = require('axios');
const https = require('https');

class NOSApiTester {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://switch-ip';
    this.username = config.username || 'admin';
    this.password = config.password || '';
    this.timeout = config.timeout || 30000;
    this.validateCerts = config.validateCerts !== false;
    
    // Create axios instance with defaults
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      auth: {
        username: this.username,
        password: this.password
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: this.validateCerts
      })
    });
  }

  /**
   * Test GET endpoint
   * @param {string} endpoint - API endpoint path
   * @param {object} options - Test options
   * @returns {object} Test result
   */
  async testGet(endpoint, options = {}) {
    const testStart = Date.now();
    const testResult = {
      endpoint,
      method: 'GET',
      timestamp: new Date().toISOString(),
      success: false,
      duration: 0,
      statusCode: null,
      response: null,
      error: null,
      assertions: []
    };

    try {
      const response = await this.client.get(endpoint, options);
      
      testResult.statusCode = response.status;
      testResult.response = response.data;
      testResult.duration = Date.now() - testStart;
      
      // Run assertions
      testResult.assertions = this.runAssertions(response, options.assertions || []);
      testResult.success = testResult.assertions.every(a => a.passed);
      
    } catch (error) {
      testResult.duration = Date.now() - testStart;
      testResult.error = {
        message: error.message,
        code: error.code,
        statusCode: error.response?.status,
        response: error.response?.data
      };
    }

    return testResult;
  }

  /**
   * Test POST endpoint
   * @param {string} endpoint - API endpoint path
   * @param {object} data - Request body
   * @param {object} options - Test options
   * @returns {object} Test result
   */
  async testPost(endpoint, data, options = {}) {
    const testStart = Date.now();
    const testResult = {
      endpoint,
      method: 'POST',
      timestamp: new Date().toISOString(),
      requestBody: data,
      success: false,
      duration: 0,
      statusCode: null,
      response: null,
      error: null,
      assertions: []
    };

    try {
      const response = await this.client.post(endpoint, data, options);
      
      testResult.statusCode = response.status;
      testResult.response = response.data;
      testResult.duration = Date.now() - testStart;
      
      testResult.assertions = this.runAssertions(response, options.assertions || []);
      testResult.success = testResult.assertions.every(a => a.passed);
      
    } catch (error) {
      testResult.duration = Date.now() - testStart;
      testResult.error = {
        message: error.message,
        code: error.code,
        statusCode: error.response?.status,
        response: error.response?.data
      };
    }

    return testResult;
  }

  /**
   * Test PUT endpoint
   * @param {string} endpoint - API endpoint path
   * @param {object} data - Request body
   * @param {object} options - Test options
   * @returns {object} Test result
   */
  async testPut(endpoint, data, options = {}) {
    const testStart = Date.now();
    const testResult = {
      endpoint,
      method: 'PUT',
      timestamp: new Date().toISOString(),
      requestBody: data,
      success: false,
      duration: 0,
      statusCode: null,
      response: null,
      error: null,
      assertions: []
    };

    try {
      const response = await this.client.put(endpoint, data, options);
      
      testResult.statusCode = response.status;
      testResult.response = response.data;
      testResult.duration = Date.now() - testStart;
      
      testResult.assertions = this.runAssertions(response, options.assertions || []);
      testResult.success = testResult.assertions.every(a => a.passed);
      
    } catch (error) {
      testResult.duration = Date.now() - testStart;
      testResult.error = {
        message: error.message,
        code: error.code,
        statusCode: error.response?.status,
        response: error.response?.data
      };
    }

    return testResult;
  }

  /**
   * Test DELETE endpoint
   * @param {string} endpoint - API endpoint path
   * @param {object} options - Test options
   * @returns {object} Test result
   */
  async testDelete(endpoint, options = {}) {
    const testStart = Date.now();
    const testResult = {
      endpoint,
      method: 'DELETE',
      timestamp: new Date().toISOString(),
      success: false,
      duration: 0,
      statusCode: null,
      response: null,
      error: null,
      assertions: []
    };

    try {
      const response = await this.client.delete(endpoint, options);
      
      testResult.statusCode = response.status;
      testResult.response = response.data;
      testResult.duration = Date.now() - testStart;
      
      testResult.assertions = this.runAssertions(response, options.assertions || []);
      testResult.success = testResult.assertions.every(a => a.passed);
      
    } catch (error) {
      testResult.duration = Date.now() - testStart;
      testResult.error = {
        message: error.message,
        code: error.code,
        statusCode: error.response?.status,
        response: error.response?.data
      };
    }

    return testResult;
  }

  /**
   * Run assertions on response
   * @param {object} response - Axios response object
   * @param {array} assertions - Array of assertion definitions
   * @returns {array} Assertion results
   */
  runAssertions(response, assertions) {
    return assertions.map(assertion => {
      const result = {
        description: assertion.description || 'Unnamed assertion',
        type: assertion.type,
        expected: assertion.expected,
        actual: null,
        passed: false
      };

      try {
        switch (assertion.type) {
          case 'status':
            result.actual = response.status;
            result.passed = response.status === assertion.expected;
            break;

          case 'statusRange':
            result.actual = response.status;
            const [min, max] = assertion.expected;
            result.passed = response.status >= min && response.status <= max;
            break;

          case 'header':
            result.actual = response.headers[assertion.header];
            result.passed = response.headers[assertion.header] === assertion.expected;
            break;

          case 'jsonPath':
            result.actual = this.getJsonPath(response.data, assertion.path);
            result.passed = result.actual === assertion.expected;
            break;

          case 'jsonPathExists':
            result.actual = this.getJsonPath(response.data, assertion.path);
            result.passed = result.actual !== undefined;
            break;

          case 'schema':
            result.passed = this.validateSchema(response.data, assertion.schema);
            result.actual = 'Schema validation';
            break;

          case 'responseTime':
            result.actual = response.duration;
            result.passed = response.duration <= assertion.expected;
            break;

          default:
            result.passed = false;
            result.error = `Unknown assertion type: ${assertion.type}`;
        }
      } catch (error) {
        result.passed = false;
        result.error = error.message;
      }

      return result;
    });
  }

  /**
   * Get value from JSON path
   * @param {object} obj - JSON object
   * @param {string} path - Dot-notated path
   * @returns {*} Value at path
   */
  getJsonPath(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[key];
    }
    
    return current;
  }

  /**
   * Validate JSON schema
   * @param {object} data - Data to validate
   * @param {object} schema - JSON schema
   * @returns {boolean} Validation result
   */
  validateSchema(data, schema) {
    // Simple schema validation - can be enhanced with ajv library
    if (schema.type && typeof data !== schema.type) {
      return false;
    }
    
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Run test suite
   * @param {array} tests - Array of test definitions
   * @returns {object} Test suite results
   */
  async runTestSuite(tests) {
    const results = {
      totalTests: tests.length,
      passed: 0,
      failed: 0,
      duration: 0,
      startTime: new Date().toISOString(),
      endTime: null,
      tests: []
    };

    const suiteStart = Date.now();

    for (const test of tests) {
      let result;
      
      switch (test.method.toUpperCase()) {
        case 'GET':
          result = await this.testGet(test.endpoint, test.options);
          break;
        case 'POST':
          result = await this.testPost(test.endpoint, test.data, test.options);
          break;
        case 'PUT':
          result = await this.testPut(test.endpoint, test.data, test.options);
          break;
        case 'DELETE':
          result = await this.testDelete(test.endpoint, test.options);
          break;
        default:
          result = {
            success: false,
            error: `Unknown method: ${test.method}`
          };
      }

      results.tests.push({
        name: test.name,
        ...result
      });

      if (result.success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }

    results.duration = Date.now() - suiteStart;
    results.endTime = new Date().toISOString();
    
    return results;
  }

  /**
   * Generate API test cases from skill file
   * @param {string} skillFileContent - Skill file markdown content
   * @returns {array} Generated test cases
   */
  static generateTestCasesFromSkillFile(skillFileContent) {
    const tests = [];
    
    // Extract REST API examples from skill file
    const apiExamples = this.extractApiExamples(skillFileContent);
    
    for (const example of apiExamples) {
      tests.push({
        name: example.description || 'API Test',
        method: example.method,
        endpoint: example.endpoint,
        data: example.requestBody,
        options: {
          assertions: example.assertions || [
            { type: 'statusRange', expected: [200, 299], description: 'Success status code' }
          ]
        }
      });
    }
    
    return tests;
  }

  /**
   * Extract API examples from skill file
   * @param {string} content - Skill file content
   * @returns {array} Extracted API examples
   */
  static extractApiExamples(content) {
    const examples = [];
    
    // Match JSON code blocks with REST API operations
    const jsonBlockRegex = /```json\s*(POST|GET|PUT|DELETE|PATCH)\s+([^\n]+)\s*\n([\s\S]*?)```/gi;
    let match;
    
    while ((match = jsonBlockRegex.exec(content)) !== null) {
      const [, method, endpoint, body] = match;
      
      try {
        const requestBody = body.trim() ? JSON.parse(body) : null;
        examples.push({
          method: method.toUpperCase(),
          endpoint: endpoint.trim(),
          requestBody,
          description: `Test ${method} ${endpoint}`
        });
      } catch (error) {
        console.warn(`Failed to parse JSON example: ${error.message}`);
      }
    }
    
    return examples;
  }
}

module.exports = { NOSApiTester };
