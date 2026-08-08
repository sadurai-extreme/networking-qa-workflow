const fs = require('fs');
const path = require('path');

/**
 * Script Skill Analyzer
 * Analyzes existing automation folders to extract patterns, procs, and lib files
 * Creates "script skill files" for better script generation
 */

class ScriptSkillAnalyzer {
  constructor(automationBasePath = '/root/exos-tcl-automation/automation/Functionaltest') {
    this.basePath = automationBasePath;
    this.automationIndexPath = path.resolve(__dirname, '../../../data/tcl_framework_docs/automation_index.json');
  }

  /**
   * List all available automation functional areas (ALL folders from filesystem)
   */
  listAvailableAreas() {
    const areas = [];
    
    // Scan directory to get ALL folders (not just index)
    if (fs.existsSync(this.basePath)) {
      const folders = fs.readdirSync(this.basePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => {
          const folderPath = path.join(this.basePath, dirent.name);
          
          // Count TCL files in the folder
          let tclFileCount = 0;
          try {
            const files = fs.readdirSync(folderPath);
            tclFileCount = files.filter(f => f.endsWith('.tcl')).length;
          } catch (err) {
            console.warn(`Cannot read folder ${dirent.name}:`, err.message);
          }
          
          return {
            name: dirent.name,
            path: folderPath,
            fileCount: tclFileCount,
            source: 'filesystem'
          };
        })
        .filter(area => area.fileCount > 0); // Only include folders with TCL files
      
      return folders;
    }

    return [];
  }

  /**
   * Analyze a specific functional area folder
   */
  analyzeFunctionalArea(areaName) {
    const areaPath = path.join(this.basePath, areaName);
    
    if (!fs.existsSync(areaPath)) {
      throw new Error(`Functional area not found: ${areaName}`);
    }

    const analysis = {
      areaName,
      areaPath,
      libFiles: [],
      testScripts: [],
      procedures: [],
      commonPatterns: [],
      dependencies: new Set(),
      analyzedAt: new Date().toISOString()
    };

    // Scan for TCL files
    const files = this.scanTclFiles(areaPath);
    
    // Separate lib files and test scripts
    analysis.libFiles = files.filter(f => f.name.toLowerCase().includes('_lib.tcl'));
    analysis.testScripts = files.filter(f => !f.name.toLowerCase().includes('_lib.tcl') && 
                                              !f.name.toLowerCase().includes('_setup.tcl'));

    // Extract procedures from lib files
    analysis.libFiles.forEach(libFile => {
      const procs = this.extractProcedures(libFile.path);
      analysis.procedures.push(...procs.map(p => ({ ...p, sourceFile: libFile.name })));
    });

    // Extract common patterns from test scripts
    const sampleScripts = analysis.testScripts.slice(0, 10); // Analyze first 10 scripts
    sampleScripts.forEach(script => {
      const patterns = this.extractPatterns(script.path);
      analysis.commonPatterns.push(...patterns);
    });

    // Extract dependencies (source commands)
    analysis.testScripts.forEach(script => {
      const deps = this.extractDependencies(script.path);
      deps.forEach(dep => analysis.dependencies.add(dep));
    });

    analysis.dependencies = Array.from(analysis.dependencies);

    return analysis;
  }

  /**
   * Scan directory for TCL files
   */
  scanTclFiles(dirPath, maxDepth = 2, currentDepth = 0) {
    const files = [];
    
    if (currentDepth >= maxDepth) return files;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...this.scanTclFiles(fullPath, maxDepth, currentDepth + 1));
        } else if (entry.name.endsWith('.tcl')) {
          files.push({
            name: entry.name,
            path: fullPath,
            size: fs.statSync(fullPath).size
          });
        }
      }
    } catch (err) {
      console.warn(`Error scanning ${dirPath}:`, err.message);
    }

    return files;
  }

  /**
   * Extract procedure definitions from a TCL file
   */
  extractProcedures(filePath) {
    const procedures = [];
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Match proc definitions: proc ProcName {args} { ... }
      const procRegex = /proc\s+(\w+)\s*\{([^}]*)\}\s*\{/g;
      let match;
      
      while ((match = procRegex.exec(content)) !== null) {
        const procName = match[1];
        const params = match[2].trim();
        
        // Try to extract the procedure body (simplified)
        const procStart = match.index;
        const bodyStart = content.indexOf('{', procStart + match[0].length);
        
        procedures.push({
          name: procName,
          params: params,
          signature: `proc ${procName} {${params}}`
        });
      }
    } catch (err) {
      console.warn(`Error extracting procedures from ${filePath}:`, err.message);
    }

    return procedures;
  }

  /**
   * Extract common patterns from test script
   */
  extractPatterns(scriptPath) {
    const patterns = [];
    
    try {
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      // Pattern 1: Login/Logout patterns
      if (content.includes('Login $DUT')) {
        patterns.push({ type: 'login', pattern: 'Login $DUT*_CONNECT before SendACmd' });
      }
      
      // Pattern 2: Port mapping
      if (content.includes('MapDUTPortId')) {
        patterns.push({ type: 'port_mapping', pattern: 'Use MapDUTPortId for port references' });
      }
      
      // Pattern 3: Result reporting
      if (content.includes('report_start_test')) {
        patterns.push({ type: 'reporting', pattern: 'Wrap steps in report_start_test/report_end_test' });
      }
      
      // Pattern 4: Verification commands
      const checkCommands = ['CheckKeyValue', 'CheckCmdLegal', 'GetKeyValue'];
      checkCommands.forEach(cmd => {
        if (content.includes(cmd)) {
          patterns.push({ type: 'verification', pattern: `Use ${cmd} for verification` });
        }
      });
      
      // Pattern 5: Configuration cleanup
      if (content.includes('unconfigure') || content.includes('delete')) {
        patterns.push({ type: 'cleanup', pattern: 'Include cleanup/unconfigure commands' });
      }
      
    } catch (err) {
      console.warn(`Error extracting patterns from ${scriptPath}:`, err.message);
    }

    return patterns;
  }

  /**
   * Extract dependencies (source commands)
   */
  extractDependencies(scriptPath) {
    const dependencies = [];
    
    try {
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      // Match source commands: source "filename.tcl" or source filename.tcl
      const sourceRegex = /source\s+["']?([^"'\s]+\.tcl)["']?/g;
      let match;
      
      while ((match = sourceRegex.exec(content)) !== null) {
        dependencies.push(match[1]);
      }
    } catch (err) {
      console.warn(`Error extracting dependencies from ${scriptPath}:`, err.message);
    }

    return dependencies;
  }

  /**
   * Generate a script skill file from analysis
   */
  generateScriptSkillFile(analysis) {
    const skillFile = {
      metadata: {
        areaName: analysis.areaName,
        generatedAt: new Date().toISOString(),
        totalProcedures: analysis.procedures.length,
        totalLibFiles: analysis.libFiles.length,
        totalTestScripts: analysis.testScripts.length
      },
      
      libraryFiles: analysis.libFiles.map(f => f.name),
      
      dependencies: analysis.dependencies,
      
      availableProcedures: analysis.procedures.map(p => ({
        name: p.name,
        params: p.params,
        sourceFile: p.sourceFile,
        signature: p.signature
      })),
      
      commonPatterns: this.deduplicatePatterns(analysis.commonPatterns),
      
      usageGuidelines: this.generateUsageGuidelines(analysis),
      
      exampleScripts: this.extractExampleScripts(analysis)
    };

    return skillFile;
  }

  /**
   * Deduplicate patterns
   */
  deduplicatePatterns(patterns) {
    const seen = new Set();
    return patterns.filter(p => {
      const key = `${p.type}:${p.pattern}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Generate usage guidelines from analysis
   */
  generateUsageGuidelines(analysis) {
    const guidelines = [];
    
    // Add library file sourcing guideline
    if (analysis.libFiles.length > 0) {
      guidelines.push({
        category: 'Library Files',
        guideline: `Source the following library files at the beginning: ${analysis.libFiles.map(f => f.name).join(', ')}`
      });
    }

    // Add procedure usage guidelines
    const procsByType = this.categorizeProcedures(analysis.procedures);
    Object.keys(procsByType).forEach(type => {
      if (procsByType[type].length > 0) {
        guidelines.push({
          category: type,
          guideline: `Use these ${type} procedures: ${procsByType[type].slice(0, 5).map(p => p.name).join(', ')}${procsByType[type].length > 5 ? ', ...' : ''}`
        });
      }
    });

    return guidelines;
  }

  /**
   * Categorize procedures by common naming patterns
   */
  categorizeProcedures(procedures) {
    const categories = {
      'Configuration': [],
      'Verification': [],
      'Traffic': [],
      'Utility': []
    };

    procedures.forEach(proc => {
      const name = proc.name.toLowerCase();
      
      if (name.includes('config') || name.includes('setup') || name.includes('create')) {
        categories['Configuration'].push(proc);
      } else if (name.includes('check') || name.includes('verify') || name.includes('get')) {
        categories['Verification'].push(proc);
      } else if (name.includes('traffic') || name.includes('send') || name.includes('transmit')) {
        categories['Traffic'].push(proc);
      } else {
        categories['Utility'].push(proc);
      }
    });

    return categories;
  }

  /**
   * Extract example script snippets
   */
  extractExampleScripts(analysis) {
    const examples = [];
    
    // Read first 3 test scripts as examples
    const sampleScripts = analysis.testScripts.slice(0, 3);
    
    sampleScripts.forEach(script => {
      try {
        const content = fs.readFileSync(script.path, 'utf8');
        
        // Extract first 100 lines as example
        const lines = content.split('\n').slice(0, 100);
        
        examples.push({
          scriptName: script.name,
          snippet: lines.join('\n'),
          size: script.size
        });
      } catch (err) {
        console.warn(`Error reading example script ${script.name}:`, err.message);
      }
    });

    return examples;
  }

  /**
   * Save script skill file to database
   */
  saveSkillFile(analysis, workflow_id, db) {
    const skillFile = this.generateScriptSkillFile(analysis);
    const skillContent = JSON.stringify(skillFile, null, 2);
    
    // Save to documents table
    const docId = require('uuid').v4();
    
    // Generate a shorter filename if multiple areas are selected
    let filename;
    if (analysis.areaName.includes('+')) {
      const areaCount = analysis.areaName.split('+').length;
      const timestamp = Date.now();
      filename = `multi_area_${areaCount}areas_${timestamp}_script_skill.json`;
    } else {
      filename = `${analysis.areaName}_script_skill.json`;
    }
    
    const filepath = path.join('data', 'script_skills', filename);
    
    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Save to filesystem
    fs.writeFileSync(filepath, skillContent, 'utf8');
    
    // Save to database
    db.prepare(`
      INSERT INTO documents (
        id, workflow_id, stage_number, doc_type, filename, filepath, 
        content, version, created_by, change_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docId,
      workflow_id,
      7,
      'script_skill',
      filename,
      filepath,
      skillContent,
      1,
      'system',
      `Script skill file for ${analysis.areaName} functional area`
    );
    
    return { docId, filename, filepath, skillFile };
  }
}

module.exports = ScriptSkillAnalyzer;
