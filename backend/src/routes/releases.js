const express = require('express');
const router = express.Router();
require('dotenv').config();

const JIRA_BASE = process.env.JIRA_BASE_URL;
const JIRA_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_PROJECT = process.env.JIRA_PROJECT || 'EXOS';

// Helper to create Basic Auth header (email + API token)
function getAuthHeader() {
  if (JIRA_EMAIL && JIRA_TOKEN) {
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
    return `Basic ${auth}`;
  }
  return `Bearer ${JIRA_TOKEN}`;
}

// Get all available EXOS releases
router.get('/', async (req, res) => {
  try {
    console.log(`Fetching versions from ${JIRA_BASE}/rest/api/3/project/${JIRA_PROJECT}/versions`);
    
    const response = await fetch(`${JIRA_BASE}/rest/api/3/project/${JIRA_PROJECT}/versions`, {
      headers: { 
        Authorization: getAuthHeader(), 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jira API error:', response.status, errorText);
      throw new Error(`Jira API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Found ${data.length} versions in Jira project ${JIRA_PROJECT}`);
    
    // Filter for EXOS releases that are not archived
    // Exclude 33.6.1 and earlier prior releases
    const releases = data
      .filter(v => !v.archived && v.name.includes('EXOS') && !v.name.includes('33.6.1'))
      .map(v => ({ 
        id: v.id, 
        name: v.name,
        description: v.description || '',
        releaseDate: v.releaseDate || null,
        startDate: v.startDate || null,
        released: v.released || false
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`Returning ${releases.length} EXOS releases`);
    res.json(releases);
  } catch (err) {
    console.error('Failed to fetch releases from Jira:', err);
    // Return mock EXOS releases if Jira not configured
    res.json([
      { id: '3310', name: 'EXOS 33.1.0', description: 'EXOS Release 33.1.0' },
      { id: '3311', name: 'EXOS 33.1.1', description: 'EXOS Release 33.1.1' },
      { id: '3320', name: 'EXOS 33.2.0', description: 'EXOS Release 33.2.0' },
      { id: '3410', name: 'EXOS 34.1.0', description: 'EXOS Release 34.1.0' },
      { id: '21144', name: 'EXOS 34.1.1', description: 'EXOS Release 34.1.1' },
      { id: '3420', name: 'EXOS 34.2.0', description: 'EXOS Release 34.2.0' },
      { id: '3510', name: 'EXOS 35.1.0', description: 'EXOS Release 35.1.0' },
      { id: '3511', name: 'EXOS 35.1.1', description: 'EXOS Release 35.1.1' },
    ]);
  }
});

// Get stories for a specific release from PLM Structure Board
// FIXED: Using correct Target Version custom field and PLM label filtering
router.get('/:release/stories', async (req, res) => {
  const { release } = req.params;

  try {
    console.log(`Fetching Epics and Stories for release: ${release}`);

    // Extract release label from release name (e.g., "EXOS 33.7.1" -> "PLM_33_7")
    const releaseLabelMatch = release.match(/EXOS\s([\d]+)\.([\d]+)/);
    const releaseLabel = releaseLabelMatch ? `PLM_${releaseLabelMatch[1]}_${releaseLabelMatch[2]}` : `PLM_${release.replace(/\./g, '_')}`;

    console.log(`Release label pattern: ${releaseLabel}`);

    // UNIFIED JQL: Fetch Epics/Initiatives + Stories using correct fields
    const jql = `project = ${JIRA_PROJECT} AND ((type = Initiative OR type = Epic OR type = Story) AND "Target Version" = "${release}") ORDER BY priority DESC, created DESC`;

    console.log('JQL Query:', jql);

    // Build URL with query parameters
    const params = new URLSearchParams({
      jql: jql,
      maxResults: 200,
      startAt: 0,
      fields: ['key', 'summary', 'description', 'status', 'priority', 'issuetype', 'assignee', 'labels', 'customfield_10001', 'customfield_10002', 'customfield_10016', 'parent', 'subtasks', 'customfield_10014']
    });

    const searchUrl = `${JIRA_BASE}/rest/api/3/search?${params.toString()}`;
    console.log('Search URL:', searchUrl);

    const searchResponse = await fetch(searchUrl, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Jira API error:', searchResponse.status, errorText);
      throw new Error(`Jira API error: ${searchResponse.status}`);
    }

    const data = await searchResponse.json();
    console.log(`Found ${data.issues.length} total items for ${release}`);

    // STEP 3: Combine all issues
    const allIssues = data.issues;
    
    console.log(`Total items fetched: ${allIssues.length}`);

    const stories = allIssues.map(issue => ({
      id: issue.key,
      title: issue.fields.summary,
      description: issue.fields.description || '',
      status: issue.fields.status?.name || 'Unknown',
      priority: issue.fields.priority?.name || 'Medium',
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      labels: issue.fields.labels || [],
      type: detectStoryType(issue.fields.summary, issue.fields.description, issue.fields.labels),
      epicName: issue.fields.customfield_10001 || null,
      storyPoints: issue.fields.customfield_10002 || null,
      sprint: issue.fields.customfield_10016 || null,
      parentEpic: issue.fields.parent?.key || null,
      epicLink: issue.fields.customfield_10014 || null,
      issueType: issue.fields.issuetype?.name || 'Story',
    }));

    console.log(`Returning ${stories.length} stories`);
    res.json(stories);
  } catch (err) {
    console.error(`Failed to fetch stories for release ${release}:`, err);
    // Return mock stories if Jira not configured
    res.json(getMockStoriesForRelease(release));
  }
});

// Detect story type based on title, description, and labels
function detectStoryType(title, description, labels = []) {
  const text = `${title} ${description || ''}`.toLowerCase();
  const labelText = labels.join(' ').toLowerCase();
  
  // Check for API-related keywords
  if (
    text.includes('api') || 
    text.includes('endpoint') || 
    text.includes('rest') ||
    text.includes('restconf') ||
    text.includes('cli') ||
    labelText.includes('api')
  ) {
    return 'NOS API Endpoint';
  }
  
  // Check for feature keywords
  if (
    text.includes('feature') ||
    text.includes('functionality') ||
    text.includes('enhancement') ||
    labelText.includes('feature')
  ) {
    return 'Feature Functionality';
  }
  
  // Default to Feature Functionality
  return 'Feature Functionality';
}

// Mock stories for testing without Jira connection
function getMockStoriesForRelease(release) {
  const releaseNum = release.replace('EXOS ', '').replace(/\./g, '');
  
  return [
    {
      id: `NOS-${releaseNum}01`,
      title: `BGP Routing Configuration API for ${release}`,
      description: 'Implement and validate BGP routing configuration endpoints for neighbor management, route advertisement, and policy configuration.',
      status: 'Open',
      priority: 'High',
      assignee: 'John Doe',
      labels: ['api', 'bgp', 'routing'],
      type: 'NOS API Endpoint',
      epicName: 'BGP Feature Set',
      storyPoints: 8,
    },
    {
      id: `NOS-${releaseNum}02`,
      title: `VLAN Tagging Feature Enhancement for ${release}`,
      description: 'Enhance VLAN tagging functionality to support 802.1Q double tagging and QinQ tunneling.',
      status: 'In Progress',
      priority: 'High',
      assignee: 'Jane Smith',
      labels: ['feature', 'vlan', 'l2'],
      type: 'Feature Functionality',
      epicName: 'L2 Switching',
      storyPoints: 5,
    },
    {
      id: `NOS-${releaseNum}03`,
      title: `OSPF REST API Implementation for ${release}`,
      description: 'Create RESTful API endpoints for OSPF area configuration, neighbor management, and route redistribution.',
      status: 'Open',
      priority: 'Medium',
      assignee: 'Bob Johnson',
      labels: ['api', 'ospf', 'routing'],
      type: 'NOS API Endpoint',
      epicName: 'OSPF Feature Set',
      storyPoints: 13,
    },
    {
      id: `NOS-${releaseNum}04`,
      title: `QoS Policy Engine for ${release}`,
      description: 'Implement Quality of Service policy engine with support for traffic shaping, rate limiting, and priority queuing.',
      status: 'Open',
      priority: 'Medium',
      assignee: 'Alice Williams',
      labels: ['feature', 'qos', 'traffic-management'],
      type: 'Feature Functionality',
      epicName: 'QoS Framework',
      storyPoints: 8,
    },
    {
      id: `NOS-${releaseNum}05`,
      title: `SNMP MIB API Extensions for ${release}`,
      description: 'Extend SNMP MIB API to support custom OIDs and trap configuration.',
      status: 'Open',
      priority: 'Low',
      assignee: 'Charlie Brown',
      labels: ['api', 'snmp', 'monitoring'],
      type: 'NOS API Endpoint',
      epicName: 'Network Monitoring',
      storyPoints: 3,
    },
    {
      id: `NOS-${releaseNum}06`,
      title: `LLDP Neighbor Discovery for ${release}`,
      description: 'Implement LLDP (Link Layer Discovery Protocol) for automatic neighbor discovery and topology mapping.',
      status: 'In Progress',
      priority: 'Medium',
      assignee: 'David Lee',
      labels: ['feature', 'lldp', 'discovery'],
      type: 'Feature Functionality',
      epicName: 'Network Discovery',
      storyPoints: 5,
    },
    {
      id: `NOS-${releaseNum}07`,
      title: `ACL Management REST API for ${release}`,
      description: 'Build REST API for Access Control List (ACL) creation, modification, and deletion with support for IPv4/IPv6.',
      status: 'Open',
      priority: 'High',
      assignee: 'Eve Martinez',
      labels: ['api', 'acl', 'security'],
      type: 'NOS API Endpoint',
      epicName: 'Security Features',
      storyPoints: 8,
    },
    {
      id: `NOS-${releaseNum}08`,
      title: `Port Mirroring Feature for ${release}`,
      description: 'Add port mirroring (SPAN/RSPAN) functionality for traffic analysis and debugging.',
      status: 'Open',
      priority: 'Low',
      assignee: 'Frank Garcia',
      labels: ['feature', 'mirroring', 'diagnostics'],
      type: 'Feature Functionality',
      epicName: 'Diagnostics Tools',
      storyPoints: 5,
    },
  ];
}

// Get consolidated release data (Epics + API Stories)
router.get('/:release/consolidated', async (req, res) => {
  const { release } = req.params;

  try {
    console.log(`Fetching consolidated data for release: ${release}`);

    // Extract release label from release name (e.g., "EXOS 33.7.1" -> "PLM_33_7")
    const releaseLabelMatch = release.match(/EXOS\s([\d]+)\.([\d]+)/);
    const releaseLabel = releaseLabelMatch 
      ? `PLM_${releaseLabelMatch[1]}_${releaseLabelMatch[2]}` 
      : `PLM_${release.replace(/\./g, '_')}`;

    console.log(`Release label pattern: ${releaseLabel}`);

    // Helper function to fetch from Jira
    const fetchFromJira = async (jql, description) => {
      const params = new URLSearchParams({
        jql: jql,
        maxResults: 200,
        startAt: 0,
        fields: ['key', 'summary', 'description', 'status', 'priority', 'issuetype', 'assignee', 'labels', 'components', 'customfield_10001', 'customfield_10002', 'customfield_10016', 'parent', 'subtasks', 'customfield_10014', 'issuelinks']
      });

      const searchUrl = `${JIRA_BASE}/rest/api/3/search/jql?${params.toString()}`;

      const response = await fetch(searchUrl, {
        headers: {
          Authorization: getAuthHeader(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Jira API error for ${description}:`, response.status, errorText);
        throw new Error(`Jira API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`${description}: ${data.issues.length} issues found`);
      return data.issues;
    };

    // Query 1: Get all Epics first
    const epicOnlyJQL = `project = ${JIRA_PROJECT} AND (type = Epic OR type = Initiative) AND "Target Version" = "${release}" ORDER BY priority DESC, created DESC`;
    const epics = await fetchFromJira(epicOnlyJQL, 'Epics/Initiatives');

    // Query 2: Get Stories linked to these epics
    const epicKeys = epics.map(e => e.key).join(',');
    let storiesFromEpics = [];
    if (epicKeys) {
      const storiesViaEpicJQL = `project = ${JIRA_PROJECT} AND (parent in (${epicKeys}) OR "Epic Link" in (${epicKeys})) AND "Target Version" = "${release}"`;
      storiesFromEpics = await fetchFromJira(storiesViaEpicJQL, 'Stories linked to Epics').catch(() => []);
    }

    // Query 3: Get any orphaned Stories without an Epic (for this release)
    const allStoriesJQL = `project = ${JIRA_PROJECT} AND type = Story AND "Target Version" = "${release}"`;
    const allStories = await fetchFromJira(allStoriesJQL, 'All Stories');

    // Query 4: API Component Stories (may overlap with above)
    const apiJQL = `"target version" in ("${release}") AND type in ("Story", "Improvement") AND Component in ("NetTools and Management : REST-API", "NET : REST", "NetTools and Management : Telemetry/Telegraf", "api")`;
    const apiStories = await fetchFromJira(apiJQL, 'API Stories');

    // Consolidate results - combine all sources
    const allIssues = new Map();

    // Add epics
    if (epics) {
      epics.forEach(issue => {
        allIssues.set(issue.key, {
          ...issue,
          sourceQuery: 'Epics'
        });
      });
    }

    // Add stories linked to epics
    if (storiesFromEpics) {
      storiesFromEpics.forEach(issue => {
        if (!allIssues.has(issue.key)) {
          allIssues.set(issue.key, {
            ...issue,
            sourceQuery: 'Stories from Epics'
          });
        }
      });
    }

    // Add all other stories (avoid duplicates)
    if (allStories) {
      allStories.forEach(issue => {
        if (!allIssues.has(issue.key)) {
          allIssues.set(issue.key, {
            ...issue,
            sourceQuery: 'All Stories'
          });
        }
      });
    }

    // Add API stories (avoid duplicates)
    if (apiStories) {
      apiStories.forEach(issue => {
        if (!allIssues.has(issue.key)) {
          allIssues.set(issue.key, {
            ...issue,
            sourceQuery: 'API Stories'
          });
        } else {
          const existing = allIssues.get(issue.key);
          existing.sourceQuery = `${existing.sourceQuery} + API`;
        }
      });
    }

    const consolidatedIssues = Array.from(allIssues.values());

    // Calculate breakdowns
    const byType = {};
    const byStatus = {};
    const byPriority = {};
    const byComponent = {};

    consolidatedIssues.forEach(issue => {
      const type = issue.fields.issuetype?.name || 'Unknown';
      const status = issue.fields.status?.name || 'Unknown';
      const priority = issue.fields.priority?.name || 'None';
      
      byType[type] = (byType[type] || 0) + 1;
      byStatus[status] = (byStatus[status] || 0) + 1;
      byPriority[priority] = (byPriority[priority] || 0) + 1;

      // Component breakdown
      const components = issue.fields.components || [];
      if (components.length === 0) {
        byComponent['None'] = (byComponent['None'] || 0) + 1;
      } else {
        components.forEach(comp => {
          byComponent[comp.name] = (byComponent[comp.name] || 0) + 1;
        });
      }
    });

    // Build Epic-Story hierarchy
    const epicsMap = new Map();
    const storiesMap = new Map();
    const orphanedStories = [];

    // Helper function to find the epic link from various sources
    const getEpicLink = (issue) => {
      // Try multiple possible epic link field IDs (common in Jira)
      const epicLinkFieldIds = [
        'customfield_10014', // Default
        'customfield_10007', // Alternative 1
        'customfield_10009', // Alternative 2
      ];

      for (const fieldId of epicLinkFieldIds) {
        if (issue.fields[fieldId]) {
          const epicValue = issue.fields[fieldId];
          // Handle both string keys and objects with key property
          return typeof epicValue === 'string' ? epicValue : epicValue.key;
        }
      }

      // Try parent relationship
      if (issue.fields.parent) {
        return issue.fields.parent.key;
      }

      return null;
    };

    consolidatedIssues.forEach((issue, idx) => {
      const epicLink = getEpicLink(issue);

      const issueData = {
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description,
        type: issue.fields.issuetype?.name,
        status: issue.fields.status?.name,
        priority: issue.fields.priority?.name,
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        components: issue.fields.components?.map(c => c.name) || [],
        labels: issue.fields.labels || [],
        parent: issue.fields.parent ? {
          key: issue.fields.parent.key,
          summary: issue.fields.parent.fields.summary
        } : null,
        sourceQuery: issue.sourceQuery,
        epicName: issue.fields.customfield_10001 || null,
        storyPoints: issue.fields.customfield_10002 || null,
        sprint: issue.fields.customfield_10016 || null,
        epicLink: epicLink,
        issuelinks: issue.fields.issuelinks || [],
        children: []
      };

      const type = issue.fields.issuetype?.name;
      if (type === 'Epic' || type === 'Initiative') {
        epicsMap.set(issue.key, issueData);
      } else if (type === 'Story' || type === 'Improvement' || type === 'Task' || type === 'Defect' || type === 'Sub-task' || type === 'Bug') {
        storiesMap.set(issue.key, issueData);
      } else {
        orphanedStories.push(issueData);
      }
    });

    // Link stories to their epics using parent relationship and epic link field
    storiesMap.forEach(story => {
      let linkedToEpic = false;

      // Try parent relationship first (most reliable)
      if (story.parent && epicsMap.has(story.parent.key)) {
        epicsMap.get(story.parent.key).children.push(story);
        linkedToEpic = true;
      }
      // Try epic link field
      else if (story.epicLink && epicsMap.has(story.epicLink)) {
        epicsMap.get(story.epicLink).children.push(story);
        linkedToEpic = true;
      }

      if (!linkedToEpic) {
        orphanedStories.push(story);
      }
    });

    // Process issue links to find additional children (implements, relates to, etc.)
    console.log(`Processing issuelinks for ${storiesMap.size} stories...`);
    let linksProcessed = 0;
    storiesMap.forEach(story => {
      if (story.issuelinks && story.issuelinks.length > 0) {
        linksProcessed++;
        console.log(`Story ${story.key} has ${story.issuelinks.length} issue links`);
        story.issuelinks.forEach(link => {
          // Check if this story is linked TO an epic
          // inwardIssue = this issue is the source, outwardIssue = this issue is the target
          const linkedEpicKey = link.outwardIssue?.key || link.inwardIssue?.key;
          const linkType = link.type?.name || '';
          
          console.log(`  Link: ${linkType} -> ${linkedEpicKey}`);
          
          if (linkedEpicKey && epicsMap.has(linkedEpicKey)) {
            // Check if this story is already a child (avoid duplicates)
            const epic = epicsMap.get(linkedEpicKey);
            const alreadyChild = epic.children.some(c => c.key === story.key);
            
            if (!alreadyChild) {
              // Only add for relevant link types
              const relevantTypes = ['implements', 'relates to', 'relates', 'is implemented by', 'clones', 'is cloned by'];
              if (relevantTypes.some(t => linkType.toLowerCase().includes(t.toLowerCase()))) {
                console.log(`Adding ${story.key} to ${linkedEpicKey} via ${linkType}`);
                epic.children.push(story);
                
                // Remove from orphaned if it was there
                const orphanIndex = orphanedStories.findIndex(s => s.key === story.key);
                if (orphanIndex > -1) {
                  orphanedStories.splice(orphanIndex, 1);
                }
              }
            }
          }
        });
      }
    });
    console.log(`Processed ${linksProcessed} stories with issuelinks`);

    // Build hierarchical structure - ONLY include epics that have children
    // This matches the reference dashboard behavior
    const epicsWithChildren = Array.from(epicsMap.values()).filter(epic => epic.children && epic.children.length > 0);
    
    console.log(`Total epics: ${epicsMap.size}, Epics with children: ${epicsWithChildren.length}, Orphaned stories: ${orphanedStories.length}`);
    
    const hierarchy = epicsWithChildren;

    // Sort epics by priority, then stories within each epic
    hierarchy.forEach(epic => {
      if (epic.children && epic.children.length > 0) {
        epic.children.sort((a, b) => {
          const priorityOrder = { 'P1 - Urgent': 1, 'P2 - High': 2, 'P3 - Medium': 3, 'P4 - Low': 4 };
          return (priorityOrder[a.priority] || 999) - (priorityOrder[b.priority] || 999);
        });
      }
    });

    // Format the response
    const response = {
      release: release,
      releaseLabel: releaseLabel,
      totalIssues: consolidatedIssues.length,
      totalEpics: epicsMap.size,
      totalStories: storiesMap.size,
      breakdowns: {
        byType,
        byStatus,
        byPriority,
        byComponent
      },
      hierarchy: hierarchy,
      issues: consolidatedIssues.map(issue => ({
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description,
        type: issue.fields.issuetype?.name,
        status: issue.fields.status?.name,
        priority: issue.fields.priority?.name,
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        components: issue.fields.components?.map(c => c.name) || [],
        labels: issue.fields.labels || [],
        parent: issue.fields.parent ? {
          key: issue.fields.parent.key,
          summary: issue.fields.parent.fields.summary
        } : null,
        sourceQuery: issue.sourceQuery,
        epicName: issue.fields.customfield_10001 || null,
        storyPoints: issue.fields.customfield_10002 || null,
        sprint: issue.fields.customfield_10016 || null,
        epicLink: issue.fields.customfield_10014 || null
      }))
    };

    console.log(`Returning ${response.totalIssues} consolidated issues (${response.totalEpics} epics, ${response.totalStories} stories)`);
    res.json(response);
  } catch (err) {
    console.error(`Failed to fetch consolidated data for release ${release}:`, err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
