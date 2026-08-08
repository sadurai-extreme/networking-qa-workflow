/**
 * TCL Library Indexer
 * Scans all *Lib.tcl files under a given root, extracts proc signatures,
 * groups them by feature area, and writes automation_index.json.
 *
 * Usage:
 *   node scripts/index-tcl-libs.js [tcl-root-path]
 *
 * Default tcl-root-path: C:\My_Projects\exos-tcl-automation\automation\Functionaltest
 *
 * Output: data/tcl_framework_docs/automation_index.json
 */

const fs   = require('fs');
const path = require('path');

const TCL_ROOT = process.argv[2]
  || 'C:\\My_Projects\\exos-tcl-automation\\automation\\Functionaltest';

const OUTPUT = path.resolve(__dirname, '../data/tcl_framework_docs/automation_index.json');

// Derive feature area from file name (e.g. ExosSnmpLib.tcl → SNMP, BgpLib.tcl → BGP)
const AREA_KEYWORDS = [
  ['SNMP',       /snmp/i],
  ['BGP',        /bgp/i],
  ['OSPF',       /ospf/i],
  ['MPLS',       /mpls/i],
  ['VLAN',       /vlan/i],
  ['ACL',        /acl/i],
  ['STP',        /stp|rstp|mstp/i],
  ['VXLAN',      /vxlan/i],
  ['PTP',        /ptp/i],
  ['BFD',        /bfd/i],
  ['LACP',       /lacp/i],
  ['LLDP',       /lldp/i],
  ['QoS',        /qos|cos/i],
  ['Multicast',  /igmp|multicast|pim|mcast/i],
  ['DHCP',       /dhcp|bootp/i],
  ['DOT1X',      /dot1x|8021x/i],
  ['CLI',        /cli/i],
  ['Traffic',    /traffic|ixia|ixnet/i],
  ['CFM',        /cfm|oam/i],
  ['MIB',        /mib/i],
];

function getArea(filename) {
  for (const [area, re] of AREA_KEYWORDS) {
    if (re.test(filename)) return area;
  }
  return 'General';
}

// Extract proc names + parameter list from a TCL file
function extractProcs(content) {
  const procs = [];
  // Match: proc ProcName { args } or proc ProcName args
  const re = /^proc\s+(\S+)\s+\{([^}]*)\}/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const name   = m[1];
    const params = m[2].trim().replace(/\s+/g, ' ');
    procs.push({ name, params });
  }
  return procs;
}

function walkDir(dir, libFiles = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return libFiles; }

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkDir(full, libFiles);
    } else if (e.isFile() && /lib\.tcl$/i.test(e.name)) {
      libFiles.push(full);
    }
  }
  return libFiles;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`Scanning: ${TCL_ROOT}`);
const files = walkDir(TCL_ROOT);
console.log(`Found ${files.length} *Lib.tcl files`);

const byArea  = {};   // area → proc names[]
const allProcs = [];  // flat list for full-text search

for (const filePath of files) {
  const filename = path.basename(filePath);
  const area     = getArea(filename);
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch { continue; }

  const procs = extractProcs(content);
  if (procs.length === 0) continue;

  if (!byArea[area]) byArea[area] = [];

  for (const p of procs) {
    const entry = { name: p.name, params: p.params, file: filename, area };
    byArea[area].push(entry);
    allProcs.push(entry);
  }
}

// Deduplicate by proc name (keep first occurrence)
const seen    = new Set();
const deduped = allProcs.filter(p => {
  if (seen.has(p.name)) return false;
  seen.add(p.name);
  return true;
});

// Same dedup per area
for (const area of Object.keys(byArea)) {
  const seenArea = new Set();
  byArea[area] = byArea[area].filter(p => {
    if (seenArea.has(p.name)) return false;
    seenArea.add(p.name);
    return true;
  });
}

const index = {
  indexed_at:   new Date().toISOString(),
  tcl_root:     TCL_ROOT,
  total_files:  files.length,
  total_procs:  deduped.length,
  areas:        byArea,
  all_procs:    deduped,
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(index, null, 2), 'utf8');

console.log(`\nIndex written to: ${OUTPUT}`);
console.log(`Total unique procs: ${deduped.length}`);
console.log(`Feature areas:`);
for (const [area, procs] of Object.entries(byArea).sort()) {
  console.log(`  ${area.padEnd(12)} ${procs.length} procs`);
}
