/**
 * NOS API Agent
 *
 * Loads the NOS OpenAPI spec from /root/NOS-OpenAPI/nos-openapi.yaml
 * and extracts relevant REST API endpoints for a given Jira story/feature.
 *
 * Used by skillFileGenerator and testPlanGenerator to enrich prompts
 * with real NOS REST API context.
 */

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const NOS_OPENAPI_PATH = process.env.NOS_OPENAPI_PATH ||
  '/root/NOS-OpenAPI/nos-openapi.yaml';

// Domain keyword map: EXOS feature keywords → OpenAPI tag/path patterns
const DOMAIN_KEYWORDS = {
  vrrp:       ['vrrp', 'virtual-router', 'virtual router'],
  ospf:       ['ospf', 'open shortest'],
  vlan:       ['vlan', 'port-vlan', 'private-vlan'],
  lag:        ['lag', 'lacp', 'port-channel'],
  lldp:       ['lldp', 'link layer'],
  stp:        ['stp', 'spanning-tree', 'rstp', 'mstp'],
  acl:        ['acl', 'access-list', 'access control'],
  qos:        ['qos', 'quality of service', 'dscp', 'priority'],
  bgp:        ['bgp', 'border gateway'],
  poe:        ['poe', 'power-over-ethernet', 'power over'],
  macsec:     ['macsec', 'mac security'],
  mlag:       ['mlag', 'multi-switch', 'multi switch'],
  snmp:       ['snmp', 'simple network management'],
  ntp:        ['ntp', 'network time'],
  radius:     ['radius', 'aaa', 'authentication server'],
  syslog:     ['syslog', 'log'],
  stacking:   ['stacking', 'stack'],
  dhcp:       ['dhcp', 'dynamic host'],
  igmp:       ['igmp', 'multicast'],
  mirroring:  ['mirror', 'port mirror', 'monitor'],
  vrf:        ['vrf', 'virtual routing', 'virtual-routing'],
  spbm:       ['spbm', 'shortest path bridging'],
  cfm:        ['cfm', 'connectivity fault'],
  elrp:       ['elrp', 'extreme loop'],
  fabric:     ['fabric', 'fabric-attach', 'fabric attach'],
  autosense:  ['autosense', 'auto-sense'],
  system:     ['system', 'device', 'node-alias', 'timezone'],
  certificate:['certificate', 'ssl', 'tls'],
  license:    ['license'],
  ipsg:       ['ip-source-guard', 'ipsg'],
  anycast:    ['anycast', 'anycast-gateway'],
  forwarding: ['forwarding', 'l3-forwarding'],
};

class NosApiAgent {
  constructor() {
    this._spec = null;
    this._loadedAt = null;
    this._cacheTtl = 60 * 60 * 1000; // 1 hour cache
  }

  /**
   * Load (and cache) the OpenAPI spec from disk.
   * Parses only once per hour to avoid repeated 2.9MB YAML parse.
   */
  loadSpec() {
    const now = Date.now();
    if (this._spec && this._loadedAt && (now - this._loadedAt) < this._cacheTtl) {
      return this._spec;
    }

    if (!fs.existsSync(NOS_OPENAPI_PATH)) {
      console.log(`[NosApiAgent] Spec not found at ${NOS_OPENAPI_PATH}`);
      return null;
    }

    try {
      console.log('[NosApiAgent] Loading NOS OpenAPI spec from disk...');
      const raw = fs.readFileSync(NOS_OPENAPI_PATH, 'utf8');
      this._spec = YAML.parse(raw);
      this._loadedAt = now;
      const pathCount = Object.keys(this._spec.paths || {}).length;
      console.log(`[NosApiAgent] Loaded spec: ${pathCount} paths`);
      return this._spec;
    } catch (err) {
      console.error('[NosApiAgent] Failed to parse spec:', err.message);
      return null;
    }
  }

  /**
   * Extract keywords from a Jira story for API search
   */
  extractKeywords(jiraStory) {
    const text = `${jiraStory.id || ''} ${jiraStory.title || ''} ${jiraStory.description || ''}`.toLowerCase();
    const stopWords = new Set(['the','a','an','and','or','for','of','to','in','is','are','with','this','that','have','will','when','can','how','what','which','feature','support','add','new','update','fix','change','improve']);

    const words = text.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    return [...new Set(words)];
  }

  /**
   * Determine which API domains are relevant for a given story
   */
  getRelevantDomains(keywords) {
    const matched = new Set();
    for (const [domain, patterns] of Object.entries(DOMAIN_KEYWORDS)) {
      for (const pattern of patterns) {
        if (keywords.some(kw => kw.includes(pattern) || pattern.includes(kw))) {
          matched.add(domain);
          break;
        }
      }
    }
    return [...matched];
  }

  /**
   * Score a path/operation for relevance to the story keywords
   */
  scoreEndpoint(pathKey, operation, keywords) {
    let score = 0;
    const text = [
      pathKey,
      operation.summary || '',
      operation.description || '',
      ...(operation.tags || [])
    ].join(' ').toLowerCase();

    for (const kw of keywords) {
      if (text.includes(kw)) score += 2;
    }

    return score;
  }

  /**
   * Format a single endpoint for prompt injection
   */
  formatEndpoint(method, pathKey, operation) {
    const lines = [];
    lines.push(`**${method.toUpperCase()} ${pathKey}**`);
    if (operation.summary) lines.push(`  Summary: ${operation.summary}`);
    if (operation.description) {
      const desc = operation.description.replace(/\n/g, ' ').substring(0, 200);
      lines.push(`  Description: ${desc}`);
    }
    if (operation.tags && operation.tags.length) {
      lines.push(`  Tags: ${operation.tags.join(', ')}`);
    }

    // Request body schema (key fields only)
    const requestBody = operation.requestBody;
    if (requestBody) {
      const schema = requestBody?.content?.['application/json']?.schema;
      if (schema) {
        const props = schema.properties ? Object.keys(schema.properties).slice(0, 6).join(', ') : '';
        if (props) lines.push(`  Request fields: ${props}`);
      }
    }

    // Response 200 schema (key fields only)
    const resp200 = operation.responses?.['200'];
    if (resp200) {
      const schema = resp200?.content?.['application/json']?.schema;
      if (schema) {
        const props = schema.properties ? Object.keys(schema.properties).slice(0, 6).join(', ') : '';
        if (props) lines.push(`  Response fields: ${props}`);
      }
    }

    // Parameters (path + query)
    const params = (operation.parameters || []).slice(0, 5);
    if (params.length > 0) {
      lines.push(`  Parameters: ${params.map(p => `${p.name} (${p.in})`).join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Main method: extract relevant NOS REST API endpoints for a Jira story.
   * Returns formatted string ready for prompt injection, or null if not found.
   */
  extractRelevantApis(jiraStory, maxEndpoints = 20) {
    console.log('[NosApiAgent] Extracting relevant NOS API endpoints...');

    const spec = this.loadSpec();
    if (!spec || !spec.paths) {
      console.log('[NosApiAgent] No spec available');
      return null;
    }

    const keywords = this.extractKeywords(jiraStory);
    const domains = this.getRelevantDomains(keywords);
    console.log(`[NosApiAgent] Keywords: ${keywords.slice(0, 8).join(', ')}`);
    console.log(`[NosApiAgent] Matched domains: ${domains.join(', ') || 'none (using keyword search)'}`);

    // Score all endpoints
    const scored = [];
    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      const methods = ['get', 'post', 'put', 'patch', 'delete'];
      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;
        const score = this.scoreEndpoint(pathKey, operation, keywords);
        if (score > 0) {
          scored.push({ method, pathKey, operation, score });
        }
      }
    }

    // Sort by score and take top N
    const top = scored.sort((a, b) => b.score - a.score).slice(0, maxEndpoints);

    if (top.length === 0) {
      console.log('[NosApiAgent] No relevant endpoints found');
      return null;
    }

    console.log(`[NosApiAgent] Found ${top.length} relevant endpoints (top score: ${top[0].score})`);

    // Group by path prefix for readability
    const grouped = {};
    for (const item of top) {
      const prefix = item.pathKey.split('/').slice(0, 4).join('/');
      if (!grouped[prefix]) grouped[prefix] = [];
      grouped[prefix].push(item);
    }

    // Build formatted output
    const sections = [];
    sections.push(`### 🔌 NOS REST API Reference (nos-openapi.yaml)\n`);
    sections.push(`**${top.length} relevant endpoint(s) found for this feature:**\n`);

    for (const [prefix, items] of Object.entries(grouped)) {
      for (const { method, pathKey, operation } of items) {
        sections.push(this.formatEndpoint(method, pathKey, operation));
        sections.push('');
      }
    }

    sections.push(`\n**API Base Path**: \`/rest/openapi/\` (on-device EXOS REST API)`);
    sections.push(`**Spec Source**: \`/root/NOS-OpenAPI/nos-openapi.yaml\` (auto-updated daily)`);
    sections.push(`\n**Instructions for using NOS API context:**`);
    sections.push(`- Document all relevant REST endpoints in the skill file under a dedicated "REST API" section`);
    sections.push(`- For test plan generation, create API-level test cases for each CRUD operation`);
    sections.push(`- Include endpoint URL, request/response schema, and expected HTTP status codes`);
    sections.push(`- Validate both positive cases (valid config) and negative cases (invalid params, auth errors)`);

    return sections.join('\n');
  }
}

// Export singleton
const nosApiAgent = new NosApiAgent();

module.exports = {
  nosApiAgent,
  extractRelevantNosApis: (jiraStory, maxEndpoints) =>
    nosApiAgent.extractRelevantApis(jiraStory, maxEndpoints)
};
