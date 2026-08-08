const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

class TopologyAnalyzer {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.model = process.env.ANTHROPIC_MODEL_LIGHT || 'claude-sonnet-4-6';
  }

  /**
   * Analyze topology from file (image or text)
   * @param {string} filePath - Path to topology file
   * @param {string} fileType - File extension (png, jpg, txt, md, json, yaml)
   * @param {string} userInstructions - Optional user instructions about the topology
   * @returns {Promise<Object>} - Topology analysis result
   */
  async analyzeTopology(filePath, fileType, userInstructions = '') {
    console.log(`[TopologyAnalyzer] Analyzing topology from ${filePath} (${fileType})`);
    
    try {
      const isImage = ['png', 'jpg', 'jpeg', 'svg'].includes(fileType.toLowerCase());
      const isPdf = fileType.toLowerCase() === 'pdf';
      
      if (isImage) {
        return await this.analyzeImageTopology(filePath, fileType, userInstructions);
      } else if (isPdf) {
        return await this.analyzePdfTopology(filePath, userInstructions);
      } else {
        return await this.analyzeTextTopology(filePath, fileType, userInstructions);
      }
    } catch (error) {
      console.error('[TopologyAnalyzer] Error:', error);
      throw error;
    }
  }

  /**
   * Analyze topology from image file using vision API
   */
  async analyzeImageTopology(filePath, fileType, userInstructions) {
    console.log('[TopologyAnalyzer] Using vision API for image analysis...');
    
    // Read image file and encode to base64
    const imageData = fs.readFileSync(filePath);
    const base64Image = imageData.toString('base64');
    
    // Determine media type
    const mediaType = fileType === 'svg' ? 'image/svg+xml' : `image/${fileType}`;
    
    const systemPrompt = `You are a network topology analyzer specialized in EXOS test automation.

Analyze the network topology diagram and extract:

1. **Topology Type**: Identify if this is:
   - Single-node: One switch only
   - 2-node: Two switches with IXIA traffic generator
   - 5-node: Five switches in mesh/ring for routing protocols
   - Custom: Other configuration

2. **Device Information**:
   - Number of switches (DUT1, DUT2, etc.)
   - Switch models/types if visible
   - IXIA/traffic generator ports

3. **Connections**:
   - Port-to-port connections between devices
   - Which ports connect to IXIA
   - Physical link topology

4. **Port Mapping**:
   - Identify port numbers on each device
   - Connection patterns (e.g., DUT1 port 1:1 ←→ DUT2 port 1:1)

5. **Test Applicability**:
   - What types of tests this topology supports
   - Recommended TCL framework port procs: MapDUTPortId for IXIA ports, GetATrunkPort for DUT-to-DUT trunk ports

${userInstructions ? `\n**User Instructions**:\n${userInstructions}\n` : ''}

Return your analysis in JSON format:
\`\`\`json
{
  "topology_type": "2-node",
  "device_count": 2,
  "devices": [
    {"name": "DUT1", "type": "EXOS Switch", "ports": ["1:1", "1:2"]},
    {"name": "DUT2", "type": "EXOS Switch", "ports": ["1:1", "1:2"]},
    {"name": "IXIA", "type": "Traffic Generator", "ports": ["A", "B"]}
  ],
  "connections": [
    {"from": "DUT1:port-to-DUT2", "to": "DUT2:port-to-DUT1", "proc": "GetATrunkPort 1 2 1 / GetATrunkPort 2 1 1"},
    {"from": "DUT1:ixia-port", "to": "IXIA:port1", "proc": "MapDUTPortId 1 1"},
    {"from": "DUT2:ixia-port", "to": "IXIA:port2", "proc": "MapDUTPortId 2 2"}
  ],
  "tcl_variables": {
    "DUT1_CONNECT": "DUT1 connection string",
    "DUT2_CONNECT": "DUT2 connection string",
    "ixia_port_dut1": "[MapDUTPortId 1 1] — IXIA port 1 on DUT1",
    "trunk_dut1_dut2": "[GetATrunkPort 1 2 1] — DUT1 trunk port to DUT2"
  },
  "test_types_supported": ["L2 forwarding", "VLAN traffic", "QoS", "Rate limiting"],
  "ascii_diagram": "ASCII representation of topology",
  "summary": "Brief description of the topology"
}
\`\`\``;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: 'Analyze this network topology diagram and extract all relevant information for test automation.',
            },
          ],
        },
      ],
      system: systemPrompt,
    });

    const content = response.content[0].text;
    
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) || 
                      content.match(/```\n([\s\S]+?)\n```/);
    
    if (jsonMatch) {
      const topologyData = JSON.parse(jsonMatch[1]);
      console.log('[TopologyAnalyzer] Image analysis complete:', topologyData.topology_type);
      return topologyData;
    } else {
      // Try to parse entire response as JSON
      const topologyData = JSON.parse(content);
      return topologyData;
    }
  }

  /**
   * Analyze topology from text file (TXT, MD, JSON, YAML)
   */
  async analyzePdfTopology(filePath, userInstructions) {
    console.log('[TopologyAnalyzer] Extracting text from PDF via Python...');
    let textContent;
    try {
      textContent = execSync(
        `python3 -c "from pdfminer.high_level import extract_text; print(extract_text('${filePath.replace(/'/g, "'\\''")}'))"`,
        { encoding: 'utf-8', timeout: 30000 }
      );
    } catch (err) {
      console.error('[TopologyAnalyzer] PDF extraction failed:', err.message);
      throw new Error('Failed to extract text from PDF. Ensure it is a text-based PDF.');
    }
    console.log(`[TopologyAnalyzer] Extracted ${textContent.length} chars from PDF`);
    return await this.analyzeTextTopology(filePath, 'pdf', userInstructions, textContent);
  }

  /**
   * Analyze topology from text file (TXT, MD, JSON, YAML)
   */
  async analyzeTextTopology(filePath, fileType, userInstructions, overrideContent = null) {
    console.log('[TopologyAnalyzer] Analyzing text-based topology...');
    
    // Read text file (or use pre-extracted content e.g. from PDF)
    const textContent = overrideContent !== null ? overrideContent : fs.readFileSync(filePath, 'utf-8');
    
    const systemPrompt = `You are a network topology analyzer specialized in EXOS test automation.

Analyze the network topology description and extract:

1. **Topology Type**: Identify if this is:
   - Single-node: One switch only
   - 2-node: Two switches with IXIA traffic generator
   - 5-node: Five switches in mesh/ring for routing protocols
   - Custom: Other configuration

2. **Device Information**:
   - Number of switches (DUT1, DUT2, etc.)
   - Switch models/types
   - IXIA/traffic generator ports

3. **Connections**:
   - Port-to-port connections between devices
   - Which ports connect to IXIA
   - Physical link topology

4. **Port Mapping**:
   - Identify port numbers on each device
   - Connection patterns

5. **Test Applicability**:
   - What types of tests this topology supports
   - Recommended TCL framework variables

${userInstructions ? `\n**User Instructions**:\n${userInstructions}\n` : ''}

Return your analysis in JSON format:
\`\`\`json
{
  "topology_type": "2-node",
  "device_count": 2,
  "devices": [
    {"name": "DUT1", "type": "EXOS Switch", "ports": ["1:1", "1:2"]},
    {"name": "DUT2", "type": "EXOS Switch", "ports": ["1:1", "1:2"]},
    {"name": "IXIA", "type": "Traffic Generator", "ports": ["A", "B"]}
  ],
  "connections": [
    {"from": "DUT1:port-to-DUT2", "to": "DUT2:port-to-DUT1", "proc": "GetATrunkPort 1 2 1 / GetATrunkPort 2 1 1"},
    {"from": "DUT1:ixia-port", "to": "IXIA:port1", "proc": "MapDUTPortId 1 1"},
    {"from": "DUT2:ixia-port", "to": "IXIA:port2", "proc": "MapDUTPortId 2 2"}
  ],
  "tcl_variables": {
    "DUT1_CONNECT": "DUT1 connection string",
    "DUT2_CONNECT": "DUT2 connection string",
    "ixia_port_dut1": "[MapDUTPortId 1 1] - IXIA port 1 on DUT1",
    "trunk_dut1_dut2": "[GetATrunkPort 1 2 1] - DUT1 trunk port to DUT2"
  },
  "test_types_supported": ["L2 forwarding", "VLAN traffic", "QoS", "Rate limiting"],
  "ascii_diagram": "ASCII representation of topology",
  "summary": "Brief description of the topology"
}
\`\`\``;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `Analyze this topology description:\n\n${textContent}`,
        },
      ],
      system: systemPrompt,
    });

    const content = response.content[0].text;
    
    // Extract JSON from response
    const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) || 
                      content.match(/```\n([\s\S]+?)\n```/);
    
    if (jsonMatch) {
      const topologyData = JSON.parse(jsonMatch[1]);
      console.log('[TopologyAnalyzer] Text analysis complete:', topologyData.topology_type);
      return topologyData;
    } else {
      const topologyData = JSON.parse(content);
      return topologyData;
    }
  }

  /**
   * Generate topology section for test plan prompt
   */
  generateTopologyPromptSection(topologyData) {
    if (!topologyData) return '';
    
    return `
## TOPOLOGY INFORMATION (FROM UPLOADED FILE)

**Topology Type**: ${topologyData.topology_type}
**Device Count**: ${topologyData.device_count}

**Devices**:
${topologyData.devices.map(d => `- ${d.name}: ${d.type} (Ports: ${d.ports.join(', ')})`).join('\n')}

**Connections**:
${topologyData.connections.map(c => `- ${c.from} ←→ ${c.to}`).join('\n')}

**TCL Variables Required**:
\`\`\`tcl
${Object.entries(topologyData.tcl_variables).map(([key, val]) => `global ${key}  # ${val}`).join('\n')}
\`\`\`

**Test Types Supported**: ${topologyData.test_types_supported.join(', ')}

**ASCII Diagram**:
\`\`\`
${topologyData.ascii_diagram}
\`\`\`

**Summary**: ${topologyData.summary}

**CRITICAL PORT NAMING REQUIREMENTS**:
1. IXIA-connected ports: Use [MapDUTPortId ixiaPortId DUTId] — NEVER hardcode port numbers.
   - Example: [MapDUTPortId 1 1] = DUT1 port connected to Ixia logical port 1
   - Example: [MapDUTPortId 10 5] = DUT5 port connected to Ixia logical port 10
2. DUT-to-DUT trunk/uplink ports: Use [GetATrunkPort fromDUT toDUT index]
   - Example: [GetATrunkPort 2 1 1] = DUT2's 1st trunk port going to DUT1 (FA proxy uplink)
   - Example: [GetATrunkPort 3 4 1] = DUT3's trunk port to DUT4 (MLAG ISC)
   - Example: [GetATrunkPort 1 2 2] = DUT1's 2nd trunk port to DUT2 (LAG member)
3. All CLI commands must use these proc calls: SendACmd "configure fabric attach uplink [GetATrunkPort 2 1 1]"
4. Include all 7 IXIA parameters if traffic testing: -txPortId, -destMac, -sourceMac, -numFrames, -frameRate, -streamType, -frameSize
5. Match topology connections in test cases using correct proc names
6. NEVER use hardcoded ports like "1:1" or made-up variable names like "MapDUTPort1"
`;
  }
}

module.exports = TopologyAnalyzer;
