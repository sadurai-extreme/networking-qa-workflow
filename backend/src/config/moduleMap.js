/**
 * MODULE_MAP: Knowledge base mapping EXOS source code paths to test modules
 * 
 * This configuration drives intelligent test recommendations by mapping:
 * - Source code directories → Functional test module names
 * - Code changes → Impacted feature areas
 * - Keywords for test matching
 * 
 * Structure:
 * {
 *   "path/in/xos_exos": {
 *     testModules: ["TestModuleName1", "TestModuleName2"],
 *     keywords: ["keyword1", "keyword2"],
 *     impacts: ["feature1", "feature2"],  // Other areas affected when this changes
 *     severityWeight: 1-5  // 5=critical, affects severity calculation
 *   }
 * }
 */

const MODULE_MAP = {
  // ==================== LAYER 2 PROTOCOLS ====================
  
  'l2protocol/vlan': {
    testModules: ['VlanEnableDisable', 'VMAN', 'EXOS_Protocol_VLAN'],
    keywords: ['vlan', 'vman', 'cvid', 'svid', 'tagged', 'untagged'],
    impacts: ['stp', 'lacp', 'mlag', 'netlogin', 'eaps', 'ospf', 'vrrp'],
    severityWeight: 5
  },

  'l2protocol/lacp': {
    testModules: ['LACP', 'LACP_Fabric_Routing'],
    keywords: ['lacp', 'lag', 'port-channel', 'aggregation'],
    impacts: ['mlag', 'vlan', 'stp', 'lldp'],
    severityWeight: 4
  },

  'l2protocol/stp': {
    testModules: ['MSTP', 'STP', 'RSTP', 'PVST'],
    keywords: ['stp', 'mstp', 'rstp', 'spanning-tree', 'bpdu'],
    impacts: ['vlan', 'eaps', 'mlag', 'vrrp'],
    severityWeight: 5
  },

  'l2protocol/mlag': {
    testModules: ['MLAG', 'MLAG_Plus'],
    keywords: ['mlag', 'multi-chassis', 'isc', 'peer'],
    impacts: ['lacp', 'vlan', 'stp', 'vrrp', 'ospf', 'bgp'],
    severityWeight: 5
  },

  'l2protocol/lldp': {
    testModules: ['LLDP', 'LLDP_MED'],
    keywords: ['lldp', 'neighbor', 'discovery', 'tlv'],
    impacts: ['edp', 'eaps'],
    severityWeight: 3
  },

  'l2protocol/eaps': {
    testModules: ['EAPS', 'EAPS_Shared_Port'],
    keywords: ['eaps', 'ring', 'master', 'transit'],
    impacts: ['stp', 'vlan', 'mlag'],
    severityWeight: 4
  },

  // ==================== LAYER 3 ROUTING ====================

  'l3protocol/ospf': {
    testModules: ['OSPF', 'OSPFv3'],
    keywords: ['ospf', 'lsa', 'area', 'neighbor', 'adjacency'],
    impacts: ['vrrp', 'mlag', 'vlan', 'bfd'],
    severityWeight: 5
  },

  'l3protocol/bgp': {
    testModules: ['BGP', 'BGP_EVPN'],
    keywords: ['bgp', 'peer', 'neighbor', 'as', 'route'],
    impacts: ['vrrp', 'mlag', 'vxlan', 'ospf'],
    severityWeight: 5
  },

  'l3protocol/vrrp': {
    testModules: ['VRRP', 'VRRP_Fabric_Routing'],
    keywords: ['vrrp', 'virtual-router', 'vrid', 'priority'],
    impacts: ['ospf', 'bgp', 'mlag', 'vlan'],
    severityWeight: 4
  },

  'l3protocol/pim': {
    testModules: ['PIM', 'IGMP'],
    keywords: ['pim', 'multicast', 'igmp', 'rendezvous'],
    impacts: ['ospf', 'vlan'],
    severityWeight: 3
  },

  // ==================== SECURITY ====================

  'security/acl': {
    testModules: ['ACL', 'Policy'],
    keywords: ['acl', 'policy', 'access-list', 'permit', 'deny'],
    impacts: ['qos', 'netlogin', 'vlan'],
    severityWeight: 4
  },

  'security/netlogin': {
    testModules: ['Netlogin', 'Netlogin_MAC', 'Netlogin_Web'],
    keywords: ['netlogin', 'authentication', '802.1x', 'radius'],
    impacts: ['vlan', 'acl'],
    severityWeight: 4
  },

  'security/macsec': {
    testModules: ['MACSEC'],
    keywords: ['macsec', 'encryption', 'mka', 'cak'],
    impacts: ['lacp', 'vlan'],
    severityWeight: 4
  },

  // ==================== QOS ====================

  'qos': {
    testModules: ['QoS', 'QoS_Policy'],
    keywords: ['qos', 'cos', 'dscp', 'priority', 'queue'],
    impacts: ['acl', 'vlan'],
    severityWeight: 3
  },

  // ==================== NETWORK MANAGEMENT ====================

  'nettools/telemetry': {
    testModules: ['Telemetry', 'IQAgent'],
    keywords: ['telegraf', 'telemetry', 'iqagent', 'metrics'],
    impacts: ['snmp', 'cli'],
    severityWeight: 3
  },

  'nettools/snmp': {
    testModules: ['SNMP'],
    keywords: ['snmp', 'mib', 'oid', 'trap', 'community'],
    impacts: ['cli', 'telemetry'],
    severityWeight: 4
  },

  'nettools/cli': {
    testModules: ['CLI'],
    keywords: ['cli', 'command', 'show', 'configure'],
    impacts: ['ALL'],
    severityWeight: 3
  },

  'nettools/syslog': {
    testModules: ['Syslog'],
    keywords: ['syslog', 'logging', 'log', 'severity'],
    impacts: ['snmp'],
    severityWeight: 2
  },

  // ==================== VIRTUALIZATION ====================

  'virtualization/vm': {
    testModules: ['VM'],
    keywords: ['vm', 'virtual-machine', 'hypervisor'],
    impacts: ['vlan', 'acl'],
    severityWeight: 3
  },

  'virtualization/vxlan': {
    testModules: ['VXLAN'],
    keywords: ['vxlan', 'vtep', 'vni', 'overlay'],
    impacts: ['bgp', 'ospf', 'mlag', 'vlan'],
    severityWeight: 4
  },

  // ==================== HAL / DRIVERS (Critical) ====================

  'hal/pib': {
    testModules: ['L2', 'VLAN', 'LACP', 'STP', 'ACL', 'QoS'],
    keywords: ['pib', 'hal', 'hardware', 'asic'],
    impacts: ['ALL'],
    severityWeight: 5
  },

  'hal/common': {
    testModules: ['L2', 'VLAN', 'LACP', 'STP'],
    keywords: ['hal', 'hardware', 'driver'],
    impacts: ['ALL'],
    severityWeight: 5
  },

  'hal/driver': {
    testModules: ['L2', 'VLAN', 'Port'],
    keywords: ['driver', 'hardware', 'port'],
    impacts: ['ALL'],
    severityWeight: 5
  },

  // ==================== PLATFORM / SYSTEM ====================

  'platform/init': {
    testModules: ['Boot', 'System'],
    keywords: ['init', 'boot', 'startup'],
    impacts: ['ALL'],
    severityWeight: 5
  },

  'platform/exos': {
    testModules: ['System'],
    keywords: ['system', 'platform'],
    impacts: ['ALL'],
    severityWeight: 4
  },

  // ==================== UTILITIES ====================

  'util/common': {
    testModules: ['System'],
    keywords: ['utility', 'common', 'library'],
    impacts: [],
    severityWeight: 2
  }
};

/**
 * Find matching test modules for a given file path
 * @param {string} filePath - Path of changed file in xos_exos
 * @returns {Object|null} - MODULE_MAP entry or null
 */
function findModuleForPath(filePath) {
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // Find longest matching prefix (most specific match wins)
  let bestMatch = null;
  let bestMatchLength = 0;
  
  for (const [mapPath, config] of Object.entries(MODULE_MAP)) {
    if (normalizedPath.startsWith(mapPath)) {
      if (mapPath.length > bestMatchLength) {
        bestMatch = { path: mapPath, ...config };
        bestMatchLength = mapPath.length;
      }
    }
  }
  
  return bestMatch;
}

/**
 * Get all impacted test modules for a list of changed files
 * @param {Array<Object>} files - Array of {path, status} objects
 * @returns {Object} - {testModules: Set, keywords: Set, impacts: Set, criticalChanges: boolean}
 */
function getImpactedModules(files) {
  const testModules = new Set();
  const keywords = new Set();
  const impacts = new Set();
  let maxSeverity = 0;
  
  for (const file of files) {
    const match = findModuleForPath(file.path);
    if (match) {
      // Add test modules
      match.testModules?.forEach(m => testModules.add(m));
      
      // Add keywords
      match.keywords?.forEach(k => keywords.add(k));
      
      // Add impacted areas
      if (match.impacts) {
        if (match.impacts.includes('ALL')) {
          impacts.add('ALL');
        } else {
          match.impacts.forEach(i => impacts.add(i));
        }
      }
      
      // Track max severity
      if (match.severityWeight > maxSeverity) {
        maxSeverity = match.severityWeight;
      }
    }
  }
  
  // If "ALL" impact is present, add core test modules
  if (impacts.has('ALL')) {
    ['L2', 'VLAN', 'LACP', 'STP', 'OSPF', 'BGP', 'VRRP', 'ACL', 'QoS'].forEach(m => testModules.add(m));
  }
  
  // Expand impacted areas to test modules
  for (const impact of impacts) {
    if (impact !== 'ALL') {
      // Find modules matching the impact keyword
      for (const [, config] of Object.entries(MODULE_MAP)) {
        if (config.keywords?.includes(impact)) {
          config.testModules?.forEach(m => testModules.add(m));
        }
      }
    }
  }
  
  return {
    testModules: Array.from(testModules),
    keywords: Array.from(keywords),
    impacts: Array.from(impacts),
    criticalChanges: maxSeverity >= 5
  };
}

module.exports = {
  MODULE_MAP,
  findModuleForPath,
  getImpactedModules
};
