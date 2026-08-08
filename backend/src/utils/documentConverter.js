const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

/**
 * Convert various document formats to Markdown using Pandoc or fallback methods
 * Supports: .docx, .pdf, .txt, .md with image extraction
 * 
 * @param {string} filePath - Path to the document file
 * @param {Object} options - Conversion options
 * @param {boolean} options.extractImages - Whether to extract images (default: true)
 * @param {boolean} options.usePandoc - Try Pandoc first (default: true)
 * @returns {Promise<Object>} - { success, markdown, imagePath, method, warnings }
 */
async function convertToMarkdown(filePath, options = {}) {
  const {
    extractImages = true,
    usePandoc = true
  } = options;

  const ext = path.extname(filePath).toLowerCase();
  const fileDir = path.dirname(filePath);
  const baseName = path.basename(filePath, ext);
  
  console.log(`\n=== Document Converter ===`);
  console.log(`File: ${path.basename(filePath)}`);
  console.log(`Type: ${ext}`);
  console.log(`Extract images: ${extractImages}`);

  // Handle plain text and markdown files directly
  if (ext === '.txt' || ext === '.md') {
    console.log('✓ Reading as plain text');
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      success: true,
      markdown: content,
      imagePath: null,
      method: 'plain-text',
      warnings: []
    };
  }

  // Handle .doc files by converting to .docx first using LibreOffice
  if (ext === '.doc') {
    console.log('Detected .doc file, attempting conversion to .docx using LibreOffice...');
    try {
      const docxPath = await convertDocToDocx(filePath);
      console.log(`✓ Converted .doc to .docx: ${path.basename(docxPath)}`);
      // Now process the .docx file
      return await convertToMarkdown(docxPath, options);
    } catch (error) {
      console.log('⚠ LibreOffice conversion failed:', error.message);
      return {
        success: false,
        markdown: null,
        imagePath: null,
        method: 'none',
        warnings: [`Failed to convert .doc file: ${error.message}`]
      };
    }
  }

  // Try Pandoc first for best quality
  if (usePandoc && isPandocAvailable()) {
    try {
      console.log('Attempting conversion with Pandoc...');
      return await convertWithPandoc(filePath, extractImages);
    } catch (error) {
      console.log('⚠ Pandoc failed:', error.message);
      console.log('Falling back to alternative method...');
    }
  }

  // Fallback to format-specific converters
  switch (ext) {
    case '.docx':
      console.log('Using mammoth fallback for .docx...');
      return await convertDocxWithMammoth(filePath, extractImages);
    
    case '.pdf':
      console.log(`⚠ ${ext} files require Pandoc for conversion`);
      return {
        success: false,
        markdown: null,
        imagePath: null,
        method: 'none',
        warnings: [`${ext} files require Pandoc to be installed and available`]
      };
    
    default:
      return {
        success: false,
        markdown: null,
        imagePath: null,
        method: 'none',
        warnings: [`Unsupported file type: ${ext}`]
      };
  }
}

/**
 * Convert document using Pandoc (best quality)
 */
async function convertWithPandoc(filePath, extractImages) {
  const outputPath = filePath.replace(/\.[^.]+$/, '.md');
  const imageDir = path.join(path.dirname(filePath), 'extracted_images');
  const warnings = [];

  let command = `pandoc "${filePath}" -o "${outputPath}" --wrap=none --markdown-headings=atx --standalone`;
  
  if (extractImages) {
    fs.mkdirSync(imageDir, { recursive: true });
    command += ` --extract-media="${imageDir}"`;
  }

  try {
    execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    
    const markdown = fs.readFileSync(outputPath, 'utf8');
    
    // Check if images were extracted
    const hasImages = extractImages && fs.existsSync(imageDir) && 
                      fs.readdirSync(imageDir).length > 0;
    
    if (extractImages && !hasImages) {
      warnings.push('No images found in document');
    }

    console.log('✓ Pandoc conversion successful');
    console.log(`  Markdown length: ${markdown.length} characters`);
    if (hasImages) {
      const imageCount = countImagesInDirectory(imageDir);
      console.log(`  Images extracted: ${imageCount}`);
    }

    // Clean up temporary markdown file
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    return {
      success: true,
      markdown,
      imagePath: hasImages ? imageDir : null,
      method: 'pandoc',
      warnings
    };
  } catch (error) {
    throw new Error(`Pandoc conversion failed: ${error.message}`);
  }
}

/**
 * Convert .docx using mammoth (fallback)
 */
async function convertDocxWithMammoth(filePath, extractImages) {
  const imageDir = path.join(path.dirname(filePath), 'extracted_images');
  const warnings = [];
  let imageCount = 0;

  if (extractImages) {
    fs.mkdirSync(imageDir, { recursive: true });
  }

  const options = extractImages ? {
    convertImage: mammoth.images.imgElement(function(image) {
      return image.read("base64").then(function(imageBuffer) {
        imageCount++;
        const ext = image.contentType.split('/')[1] || 'png';
        const imageName = `image_${Date.now()}_${imageCount}.${ext}`;
        const imagePath = path.join(imageDir, imageName);
        
        fs.writeFileSync(imagePath, imageBuffer, { encoding: 'base64' });
        
        return {
          src: `extracted_images/${imageName}`,
          alt: image.altText || `Image ${imageCount}`
        };
      });
    })
  } : {};

  try {
    const result = await mammoth.extractRawText({ path: filePath }, options);
    
    if (result.messages && result.messages.length > 0) {
      result.messages.forEach(msg => warnings.push(msg.message));
    }

    console.log('✓ Mammoth conversion successful');
    console.log(`  Text length: ${result.value.length} characters`);
    if (extractImages && imageCount > 0) {
      console.log(`  Images extracted: ${imageCount}`);
    }

    return {
      success: true,
      markdown: result.value,
      imagePath: imageCount > 0 ? imageDir : null,
      method: 'mammoth',
      warnings
    };
  } catch (error) {
    throw new Error(`Mammoth conversion failed: ${error.message}`);
  }
}

/**
 * Convert .doc to .docx using LibreOffice OR Microsoft Word (STRICT - NEVER SKIP)
 * @param {string} docPath - Path to the .doc file
 * @returns {Promise<string>} - Path to the converted .docx file
 */
async function convertDocToDocx(docPath) {
  return new Promise(async (resolve, reject) => {
    const outputDir = path.dirname(docPath);
    const docxPath = docPath.replace(/\.doc$/i, '.docx');
    
    console.log(`🔄 STRICT CONVERSION MODE: Converting ${path.basename(docPath)} to .docx...`);
    
    // Method 1: Try LibreOffice first (works on Linux/Mac/Windows)
    try {
      execSync('soffice --version', { stdio: 'pipe' });
      console.log('  ✓ LibreOffice detected, using soffice...');
      
      const command = `soffice --headless --convert-to docx --outdir "${outputDir}" "${docPath}"`;
      execSync(command, { encoding: 'utf8', stdio: 'pipe' });
      
      if (fs.existsSync(docxPath)) {
        console.log(`  ✅ SUCCESS: Converted via LibreOffice → ${path.basename(docxPath)}`);
        return resolve(docxPath);
      }
    } catch (error) {
      console.log(`  ⚠ LibreOffice not available or failed: ${error.message}`);
    }
    
    // Method 2: Try Microsoft Word COM automation (Windows only)
    console.log('  🔄 Trying Microsoft Word automation (Windows)...');
    try {
      const converted = await convertDocToDocxWithWord(docPath);
      if (converted && fs.existsSync(docxPath)) {
        console.log(`  ✅ SUCCESS: Converted via Microsoft Word → ${path.basename(docxPath)}`);
        return resolve(docxPath);
      }
    } catch (error) {
      console.log(`  ⚠ Microsoft Word automation failed: ${error.message}`);
    }
    
    // Method 3: Critical error - no conversion method available
    const errorMsg = `
╔══════════════════════════════════════════════════════════════════╗
║  ❌ CRITICAL: .doc FILE CONVERSION FAILED                        ║
║                                                                  ║
║  File: ${path.basename(docPath).padEnd(56)} ║
║                                                                  ║
║  STRICT POLICY: All attached files MUST be processed!           ║
║                                                                  ║
║  Solutions:                                                      ║
║  1. Install LibreOffice:                                        ║
║     winget install LibreOffice.LibreOffice                      ║
║                                                                  ║
║  2. Or manually convert to .docx using Microsoft Word           ║
║                                                                  ║
║  This file contains critical content and CANNOT be skipped!     ║
╚══════════════════════════════════════════════════════════════════╝`;
    
    reject(new Error(errorMsg));
  });
}

/**
 * Convert .doc to .docx using Microsoft Word COM automation (Windows)
 * @param {string} docPath - Path to the .doc file
 * @returns {Promise<boolean>} - True if successful
 */
async function convertDocToDocxWithWord(docPath) {
  return new Promise((resolve, reject) => {
    const docxPath = docPath.replace(/\.doc$/i, '.docx');
    const absDocPath = path.resolve(docPath);
    const absDocxPath = path.resolve(docxPath);
    
    // PowerShell script to use Word COM automation
    const psScript = `
$ErrorActionPreference = "Stop"
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    
    Write-Host "Opening: ${absDocPath.replace(/\\/g, '\\\\')}"
    $doc = $word.Documents.Open("${absDocPath.replace(/\\/g, '\\\\')}")
    
    Write-Host "Converting to .docx format..."
    $doc.SaveAs2("${absDocxPath.replace(/\\/g, '\\\\')}", 16)  # 16 = wdFormatXMLDocument (.docx)
    
    $doc.Close()
    $word.Quit()
    
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    Write-Host "SUCCESS"
    exit 0
} catch {
    Write-Host "ERROR: $_"
    if ($word) {
        try { $word.Quit() } catch {}
    }
    exit 1
}`;
    
    // Save PowerShell script to temp file
    const tempScriptPath = path.join(path.dirname(docPath), `convert_${Date.now()}.ps1`);
    fs.writeFileSync(tempScriptPath, psScript, 'utf8');
    
    try {
      const result = execSync(`powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000 // 60 second timeout
      });
      
      // Clean up temp script
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
      
      if (result.includes('SUCCESS') && fs.existsSync(docxPath)) {
        resolve(true);
      } else {
        reject(new Error('Word automation completed but output file not found'));
      }
    } catch (error) {
      // Clean up temp script
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
      reject(new Error(`Word COM automation failed: ${error.message}`));
    }
  });
}

/**
 * Check if Pandoc is available on the system
 */
function isPandocAvailable() {
  try {
    execSync('pandoc --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Count images in a directory recursively
 */
function countImagesInDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  
  let count = 0;
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'];
  
  function scanDir(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (imageExtensions.includes(path.extname(item).toLowerCase())) {
        count++;
      }
    });
  }
  
  scanDir(dirPath);
  return count;
}

module.exports = {
  convertToMarkdown,
  isPandocAvailable
};
