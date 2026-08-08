// Polyfill web APIs required by LLM SDKs on Node.js 16.
if (typeof globalThis.Headers === 'undefined') {
  const { fetch, Headers, Request, Response, FormData } = require('undici');
  Object.assign(globalThis, { fetch, Headers, Request, Response, FormData });
}

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

// LLM Provider Configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama';

// Initialize clients based on provider
let client, anthropicClient;
let HEAVY, LIGHT;

function initializeClient() {
  console.log(`🤖 LLM Provider: ${LLM_PROVIDER}`);
  
  switch (LLM_PROVIDER) {
    case 'azure-openai':
    case 'copilot':
      // Azure OpenAI / Enterprise Copilot
      const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const azureKey = process.env.AZURE_OPENAI_API_KEY;
      if (!azureEndpoint || !azureKey) {
        throw new Error('Azure OpenAI requires AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY');
      }
      client = new OpenAI({
        apiKey: azureKey,
        baseURL: `${azureEndpoint}/openai/deployments`,
        defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview' },
        defaultHeaders: { 'api-key': azureKey },
      });
      HEAVY = process.env.AZURE_OPENAI_DEPLOYMENT_HEAVY || 'gpt-4o';
      LIGHT = process.env.AZURE_OPENAI_DEPLOYMENT_LIGHT || 'gpt-4o-mini';
      console.log(`✅ Using Azure OpenAI: ${HEAVY} (heavy), ${LIGHT} (light)`);
      break;
      
    case 'github-copilot':
      // GitHub Models (Copilot Enterprise)
      const githubToken = process.env.GITHUB_TOKEN;
      if (!githubToken) {
        throw new Error('GitHub Copilot requires GITHUB_TOKEN');
      }
      client = new OpenAI({
        apiKey: githubToken,
        baseURL: 'https://models.inference.ai.azure.com',
      });
      HEAVY = process.env.GITHUB_MODEL_HEAVY || 'gpt-4o';
      LIGHT = process.env.GITHUB_MODEL_LIGHT || 'gpt-4o-mini';
      console.log(`✅ Using GitHub Copilot: ${HEAVY} (heavy), ${LIGHT} (light)`);
      break;
      
    case 'anthropic':
      // Anthropic Claude
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey) {
        throw new Error('Anthropic requires ANTHROPIC_API_KEY');
      }
      anthropicClient = new Anthropic({
        apiKey: anthropicKey,
      });
      HEAVY = process.env.ANTHROPIC_MODEL_HEAVY || 'claude-3-5-sonnet-20241022';
      LIGHT = process.env.ANTHROPIC_MODEL_LIGHT || 'claude-3-5-haiku-20241022';
      console.log(`✅ Using Anthropic Claude: ${HEAVY} (heavy), ${LIGHT} (light)`);
      break;
      
    case 'ollama':
    default:
      // Ollama (local)
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/v1';
      client = new OpenAI({
        baseURL: ollamaUrl,
        apiKey: 'ollama', // Ollama doesn't require a real key
      });
      HEAVY = process.env.OLLAMA_MODEL_HEAVY || process.env.LLM_MODEL_HEAVY || 'llama3.1:8b';
      LIGHT = process.env.OLLAMA_MODEL_LIGHT || process.env.LLM_MODEL_LIGHT || 'llama3.1:8b';
      console.log(`✅ Using Ollama: ${HEAVY} (heavy), ${LIGHT} (light)`);
      break;
  }
}

initializeClient();

async function callLLM(systemPrompt, userPrompt, useHeavy = true) {
  const model = useHeavy ? HEAVY : LIGHT;
  const startTime = Date.now();
  
  try {
    let response;
    
    if (LLM_PROVIDER === 'anthropic') {
      // Anthropic uses different API format
      // Extended thinking configuration for Claude 3.7+ and Opus 4+
      const requestConfig = {
        model,
        max_tokens: 12288,  // 12K is sufficient for skill files and faster than 16K
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      };
      
      // Enable extended thinking for Sonnet 4.6+, Opus 4.8+ models
      // NOTE: API updated - now uses "adaptive" thinking with output_config.effort
      if (model.includes('sonnet-4') || model.includes('opus-4')) {
        requestConfig.thinking = {
          type: 'adaptive'  // No budget_tokens parameter in new API
        };
        requestConfig.output_config = {
          effort: 'medium'  // 'medium' is 2-3x faster than 'high' with minimal quality drop
        };
        requestConfig.temperature = 1.0;  // Required by Claude API when thinking enabled
        console.log(`🧠 Extended thinking enabled for ${model} (adaptive, effort: medium)`);
      } else {
        // For models without thinking, use standard temperature
        requestConfig.temperature = 0.5;
      }
      
      response = await anthropicClient.messages.create(requestConfig);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⚡ LLM call completed in ${duration}s (${model})`);
      
      // Extract thinking content if present
      if (response.content.length > 1) {
        const thinkingBlock = response.content.find(c => c.type === 'thinking');
        if (thinkingBlock) {
          console.log(`💭 Thinking used: ${thinkingBlock.thinking?.length || 0} chars`);
        }
      }
      
      // Debug: Log response content structure
      console.log(`📦 Response content blocks: ${response.content.length}`);
      response.content.forEach((block, idx) => {
        console.log(`  Block ${idx}: type="${block.type}", hasText=${!!block.text}, textLength=${block.text?.length || 0}`);
      });
      
      // Find the text block (thinking blocks come first when enabled)
      const textBlock = response.content.find(c => c.type === 'text');
      if (!textBlock || !textBlock.text) {
        console.error('⚠️ No text content in response. Content structure:', JSON.stringify(response.content.map(c => ({ type: c.type, hasText: !!c.text, length: c.text?.length || 0 })), null, 2));
        return '';
      }
      
      return textBlock.text;
    } else {
      // OpenAI-compatible (Azure, GitHub, Ollama)
      response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      });
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⚡ LLM call completed in ${duration}s (${model})`);
      return response.choices[0].message.content;
    }
  } catch (error) {
    console.error('❌ LLM call failed:', error.message);
    throw error;
  }
}

module.exports = { callLLM, HEAVY, LIGHT };
