/**
 * Jira Attachment Reader Agent
 *
 * STRICT RULE: All Jira attachments MUST be read during skill file and test plan
 * generation to ensure complete understanding of requirements, email threads,
 * and design specs attached to the story.
 *
 * Supported formats: .msg (Outlook), .docx, .pdf, .txt, .md
 */

const axios = require('axios');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Max size per attachment (bytes) — skip larger files
const MAX_ATTACHMENT_SIZE = 8 * 1024 * 1024; // 8MB
// Max chars to include from all attachments combined in prompt
const MAX_TOTAL_CHARS = 30000;
// Max chars per individual attachment
const MAX_CHARS_PER_ATTACHMENT = 8000;

/**
 * Build Jira auth header using env vars
 */
function getAuthHeader() {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) {
    throw new Error('JIRA_EMAIL and JIRA_API_TOKEN environment variables are required');
  }
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

/**
 * Fetch list of attachments for a Jira issue key (e.g. "EXOS-39366")
 * Returns array of { id, filename, mimeType, size, content_url }
 */
async function fetchAttachmentList(jiraKey) {
  const baseUrl = process.env.JIRA_BASE_URL || 'https://extremenetworks.atlassian.net';
  const url = `${baseUrl}/rest/api/3/issue/${jiraKey}?fields=attachment`;

  console.log(`[JiraAttachmentReader] Fetching attachments for ${jiraKey}`);

  const response = await axios.get(url, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: 'application/json'
    },
    timeout: 15000
  });

  const attachments = response.data?.fields?.attachment || [];
  console.log(`[JiraAttachmentReader] Found ${attachments.length} attachment(s) on ${jiraKey}`);

  return attachments.map(a => ({
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType || '',
    size: a.size || 0,
    content_url: a.content
  }));
}

/**
 * Download attachment binary from Jira
 */
async function downloadAttachment(contentUrl, filename) {
  console.log(`[JiraAttachmentReader] Downloading: ${filename}`);
  const response = await axios.get(contentUrl, {
    headers: {
      Authorization: getAuthHeader()
    },
    responseType: 'arraybuffer',
    timeout: 30000
  });
  return Buffer.from(response.data);
}

/**
 * Extract text from a .msg Outlook file.
 *
 * Strategy 1: Use @kenjiuno/msgreader (pure JS, no native deps) if available.
 * Strategy 2: Extract readable ASCII/Latin-1 text runs from the raw binary.
 *             MSG files store body text in OLE2 compound streams; ASCII runs
 *             are recoverable even without parsing the full OLE structure.
 */
function extractMsgText(buffer, filename) {
  // Strategy 1 — try optional Node.js MSG library
  try {
    const MsgReaderModule = require('@kenjiuno/msgreader');
    const MsgReader = MsgReaderModule.default || MsgReaderModule.MsgReader || MsgReaderModule;
    const reader = new MsgReader(buffer);
    const info = reader.getFileData();
    const parts = [];
    if (info.senderName || info.senderEmail) {
      parts.push(`From: ${info.senderName || ''} <${info.senderEmail || ''}>`);
    }
    if (info.recipients && info.recipients.length) {
      parts.push(`To: ${info.recipients.map(r => r.name || r.email || '').join(', ')}`);
    }
    if (info.subject) parts.push(`Subject: ${info.subject}`);
    if (info.creationTime) parts.push(`Date: ${info.creationTime}`);
    parts.push('');
    if (info.body) parts.push(info.body);
    else if (info.bodyHtml) {
      // Strip HTML tags
      parts.push(info.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }
    const result = parts.join('\n').substring(0, MAX_CHARS_PER_ATTACHMENT);
    console.log(`[JiraAttachmentReader] Parsed ${filename} with msgreader (${result.length} chars)`);
    return result;
  } catch (e) {
    console.log(`[JiraAttachmentReader] msgreader unavailable (${e.message}), falling back to raw text extraction`);
  }

  // Strategy 2 — raw ASCII/UTF-8 run extraction from OLE binary
  try {
    // Convert buffer to Latin-1 string to access all bytes
    const raw = buffer.toString('binary');
    // Extract sequences of printable ASCII characters (min 15 consecutive chars)
    const runs = raw.match(/[\x09\x0A\x0D\x20-\x7E]{15,}/g) || [];
    // Filter out OLE header garbage and keep meaningful text
    const meaningful = runs.filter(r => {
      // Keep runs that look like real text (contain spaces, letters)
      const hasLetters = /[a-zA-Z]{3,}/.test(r);
      const hasMeaningfulContent = r.trim().length > 10;
      return hasLetters && hasMeaningfulContent;
    });

    // Deduplicate and join
    const seen = new Set();
    const unique = meaningful.filter(r => {
      const key = r.substring(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const result = unique.join('\n').substring(0, MAX_CHARS_PER_ATTACHMENT);
    console.log(`[JiraAttachmentReader] Raw text extraction from ${filename}: ${result.length} chars`);
    return result || `[.msg file ${filename} — text extraction unsuccessful]`;
  } catch (e) {
    console.error(`[JiraAttachmentReader] Raw extraction failed for ${filename}:`, e.message);
    return `[.msg file ${filename} — could not extract text]`;
  }
}

/**
 * Extract text from a .docx file using mammoth
 */
async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.substring(0, MAX_CHARS_PER_ATTACHMENT);
}

/**
 * Try to extract text from a PDF buffer.
 * Uses pdf-parse if available, otherwise extracts readable ASCII runs.
 */
async function extractPdfText(buffer, filename) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text.substring(0, MAX_CHARS_PER_ATTACHMENT);
  } catch (e) {
    console.log(`[JiraAttachmentReader] pdf-parse unavailable, using raw extraction for ${filename}`);
    // Same raw text extraction fallback as .msg
    const raw = buffer.toString('binary');
    const runs = raw.match(/[\x09\x0A\x0D\x20-\x7E]{15,}/g) || [];
    return runs.join('\n').substring(0, MAX_CHARS_PER_ATTACHMENT);
  }
}

/**
 * Parse an attachment buffer to text based on file extension / mimeType
 */
async function parseAttachmentToText(buffer, filename, mimeType) {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.msg' || mimeType.includes('ms-outlook') || mimeType.includes('rfc822')) {
    return extractMsgText(buffer, filename);
  }

  if (ext === '.docx' || mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
    return await extractDocxText(buffer);
  }

  if (ext === '.pdf' || mimeType.includes('pdf')) {
    return await extractPdfText(buffer, filename);
  }

  if (['.txt', '.md', '.log', '.text', '.csv'].includes(ext) ||
      mimeType.startsWith('text/')) {
    return buffer.toString('utf-8').substring(0, MAX_CHARS_PER_ATTACHMENT);
  }

  console.log(`[JiraAttachmentReader] Unsupported type: ${filename} (${mimeType}) — skipping`);
  return null;
}

/**
 * Main export: Read all attachments for a Jira issue.
 *
 * Returns array of:
 * {
 *   filename: string,
 *   size: number,
 *   content: string,   // extracted text
 *   error?: string
 * }
 *
 * STRICT RULE: This MUST be called before generating skill files or test plans.
 * Attachments often contain the most detailed requirements, email discussions,
 * and design decisions that are NOT in the Jira description.
 */
async function readJiraAttachments(jiraKey) {
  if (!jiraKey) {
    console.log('[JiraAttachmentReader] No jiraKey provided, skipping');
    return [];
  }

  let attachmentList;
  try {
    attachmentList = await fetchAttachmentList(jiraKey);
  } catch (err) {
    console.error(`[JiraAttachmentReader] Failed to fetch attachment list for ${jiraKey}:`, err.message);
    return [];
  }

  if (attachmentList.length === 0) {
    console.log(`[JiraAttachmentReader] No attachments on ${jiraKey}`);
    return [];
  }

  const results = [];
  let totalChars = 0;

  for (const attachment of attachmentList) {
    if (totalChars >= MAX_TOTAL_CHARS) {
      console.log(`[JiraAttachmentReader] Total char limit (${MAX_TOTAL_CHARS}) reached, stopping`);
      break;
    }

    if (attachment.size > MAX_ATTACHMENT_SIZE) {
      console.log(`[JiraAttachmentReader] Skipping ${attachment.filename} — too large (${attachment.size} bytes)`);
      results.push({
        filename: attachment.filename,
        size: attachment.size,
        content: `[Skipped: file too large (${Math.round(attachment.size / 1024)}KB)]`,
        skipped: true
      });
      continue;
    }

    try {
      const buffer = await downloadAttachment(attachment.content_url, attachment.filename);
      const text = await parseAttachmentToText(buffer, attachment.filename, attachment.mimeType);

      if (text) {
        const truncated = text.substring(0, MAX_TOTAL_CHARS - totalChars);
        totalChars += truncated.length;
        results.push({
          filename: attachment.filename,
          size: attachment.size,
          content: truncated
        });
        console.log(`[JiraAttachmentReader] ✓ ${attachment.filename}: ${truncated.length} chars`);
      } else {
        results.push({
          filename: attachment.filename,
          size: attachment.size,
          content: `[Unsupported file type: ${path.extname(attachment.filename)}]`,
          skipped: true
        });
      }
    } catch (err) {
      console.error(`[JiraAttachmentReader] Error reading ${attachment.filename}:`, err.message);
      results.push({
        filename: attachment.filename,
        size: attachment.size,
        content: `[Error reading attachment: ${err.message}]`,
        error: err.message
      });
    }
  }

  const readable = results.filter(r => !r.skipped && !r.error);
  console.log(`[JiraAttachmentReader] Completed: ${readable.length}/${attachmentList.length} attachments read successfully`);
  return results;
}

module.exports = { readJiraAttachments };
