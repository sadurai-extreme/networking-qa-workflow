/**
 * API Routes for NOS API Payload Generator
 * 
 * Endpoints:
 * - GET /api/payload-generator/endpoints - Get all endpoints
 * - GET /api/payload-generator/tags - Get all tags
 * - GET /api/payload-generator/endpoint/:method/:path - Get endpoint details
 * - POST /api/payload-generator/generate - Generate payload
 * - POST /api/payload-generator/validate - Validate payload
 * - GET /api/payload-generator/search?q=keyword - Search endpoints
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const NOSApiPayloadGenerator = require('../agents/nosApiPayloadGenerator');

// Initialize payload generator with OpenAPI spec
const specPath = path.join(__dirname, '../../../data/api_specs/nos-api-spec.yaml');
const payloadGenerator = new NOSApiPayloadGenerator(specPath);

/**
 * GET /api/payload-generator/endpoints
 * Get all endpoints from OpenAPI spec
 */
router.get('/endpoints', (req, res) => {
  try {
    const { tag } = req.query;
    
    let endpoints = payloadGenerator.endpoints;
    
    if (tag) {
      endpoints = payloadGenerator.getEndpointsByTag(tag);
    }

    res.json({
      success: true,
      count: endpoints.length,
      endpoints: endpoints.map(e => ({
        path: e.path,
        method: e.method,
        operationId: e.operationId,
        summary: e.summary,
        tags: e.tags,
        hasRequestBody: !!e.requestBodySchema,
        hasResponse: !!e.responseSchema,
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/payload-generator/tags
 * Get all unique tags (categories) from OpenAPI spec
 */
router.get('/tags', (req, res) => {
  try {
    const tags = payloadGenerator.getTags();
    res.json({
      success: true,
      count: tags.length,
      tags
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/payload-generator/endpoint
 * Get detailed information about a specific endpoint
 * Query params: method, path
 */
router.get('/endpoint', (req, res) => {
  try {
    const { method, path } = req.query;

    if (!method || !path) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: method and path'
      });
    }

    const details = payloadGenerator.getEndpointDetails(method, path);

    if (!details) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    res.json({
      success: true,
      endpoint: details
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/payload-generator/generate
 * Generate example payload for an endpoint
 * Body: { method: 'POST', path: '/api/v1/resource' }
 */
router.post('/generate', (req, res) => {
  try {
    const { method, path } = req.body;

    if (!method || !path) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: method and path'
      });
    }

    const payload = payloadGenerator.generatePayload(method, path);

    if (payload === null) {
      return res.json({
        success: true,
        message: 'No request body required for this endpoint',
        payload: null
      });
    }

    const validation = payloadGenerator.validatePayload(payload);

    res.json({
      success: true,
      payload,
      validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/payload-generator/validate
 * Validate a payload for null values, empty objects, etc.
 * Body: { payload: {...} }
 */
router.post('/validate', (req, res) => {
  try {
    const { payload } = req.body;

    if (!payload) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: payload'
      });
    }

    const validation = payloadGenerator.validatePayload(payload);

    res.json({
      success: true,
      validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/payload-generator/search
 * Search endpoints by keyword
 * Query param: q=keyword
 */
router.get('/search', (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: q (search query)'
      });
    }

    const results = payloadGenerator.searchEndpoints(q);

    res.json({
      success: true,
      count: results.length,
      query: q,
      results: results.map(e => ({
        path: e.path,
        method: e.method,
        operationId: e.operationId,
        summary: e.summary,
        tags: e.tags,
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/payload-generator/spec-info
 * Get general information about the loaded OpenAPI spec
 */
router.get('/spec-info', (req, res) => {
  try {
    res.json({
      success: true,
      info: {
        title: payloadGenerator.spec?.info?.title || 'Unknown',
        version: payloadGenerator.spec?.info?.version || 'Unknown',
        description: payloadGenerator.spec?.info?.description || '',
        totalEndpoints: payloadGenerator.endpoints.length,
        totalSchemas: Object.keys(payloadGenerator.schemas).length,
        tags: payloadGenerator.getTags(),
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
