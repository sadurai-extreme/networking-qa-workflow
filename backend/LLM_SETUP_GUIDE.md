# 🚀 Enterprise LLM Setup Guide

Your application now supports **3 LLM providers**. Choose the one you have access to:

---

## Option 1: Azure OpenAI / Enterprise Copilot ⭐ RECOMMENDED

**Best for**: Enterprise environments with Azure subscriptions

### Setup Steps:

1. **Get your Azure OpenAI credentials:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to your Azure OpenAI resource
   - Copy the **Endpoint** and **API Key** from "Keys and Endpoint"

2. **Update backend/.env:**
```bash
LLM_PROVIDER=azure-openai

AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-actual-api-key-here
AZURE_OPENAI_DEPLOYMENT_HEAVY=gpt-4o
AZURE_OPENAI_DEPLOYMENT_LIGHT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

3. **Restart backend:**
```powershell
cd c:\My_Projects\networking-qa-workflow\backend
node src/server.js
```

### Expected Performance:
- ⚡ **Commit Analysis**: 2-5 seconds (was 5 minutes)
- ⚡ **Skill File Generation**: 10-20 seconds (was 35-40 minutes)
- ⚡ **Total**: ~25 seconds (was 42 minutes) - **100x faster!**

---

## Option 2: GitHub Copilot Models

**Best for**: If you have GitHub Copilot Enterprise access

### Setup Steps:

1. **Get your GitHub Token:**
   - Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens)
   - Generate new token (classic) with `copilot` scope
   - Or use existing Copilot token

2. **Update backend/.env:**
```bash
LLM_PROVIDER=github-copilot

GITHUB_TOKEN=ghp_your_github_token_here
GITHUB_MODEL_HEAVY=gpt-4o
GITHUB_MODEL_LIGHT=gpt-4o-mini
```

3. **Restart backend**

### Expected Performance:
- Same as Azure OpenAI (~25 seconds total)

---

## Option 3: Anthropic Claude

**Best for**: If you prefer Claude or have Anthropic API access

### Setup Steps:

1. **Get Anthropic API Key:**
   - Go to [Anthropic Console](https://console.anthropic.com)
   - Create API key

2. **Update backend/.env:**
```bash
LLM_PROVIDER=anthropic

ANTHROPIC_API_KEY=sk-ant-your-api-key-here
ANTHROPIC_MODEL_HEAVY=claude-3-5-sonnet-20241022
ANTHROPIC_MODEL_LIGHT=claude-3-5-haiku-20241022
```

3. **Restart backend**

### Expected Performance:
- ⚡ **Commit Analysis**: 2-5 seconds
- ⚡ **Skill File Generation**: 10-15 seconds
- ⚡ **Total**: ~20 seconds - **Fastest option!**

---

## Keep Using Ollama (Local)

**Best for**: Offline development, no API costs

Already configured! Just keep:
```bash
LLM_PROVIDER=ollama
```

**Performance**: 30-42 minutes per skill file (slow but free)

---

## 🔍 How to Verify Setup

After updating .env and restarting backend, check the logs:

```
🤖 LLM Provider: azure-openai
✅ Using Azure OpenAI: gpt-4o (heavy), gpt-4o-mini (light)
```

Then test skill file generation - you'll see:
```
⚡ LLM call completed in 3.2s (gpt-4o)
```

---

## 💰 Cost Comparison

| Provider | Cost per Skill File | Speed |
|----------|---------------------|-------|
| Azure OpenAI (gpt-4o) | ~$0.10-0.15 | 25s |
| Azure OpenAI (gpt-4o-mini) | ~$0.02-0.03 | 30s |
| GitHub Copilot | Included in license | 25s |
| Claude 3.5 Sonnet | ~$0.15-0.20 | 20s |
| Claude 3.5 Haiku | ~$0.03-0.05 | 15s |
| Ollama (local) | FREE | 42min |

---

## 🎯 Recommended Configuration

For best quality + speed balance:

```bash
LLM_PROVIDER=azure-openai
AZURE_OPENAI_DEPLOYMENT_HEAVY=gpt-4o          # For skill files
AZURE_OPENAI_DEPLOYMENT_LIGHT=gpt-4o-mini     # For commit analysis
```

Or for fastest + cheapest:

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_MODEL_HEAVY=claude-3-5-haiku-20241022    # Fast & cheap!
ANTHROPIC_MODEL_LIGHT=claude-3-5-haiku-20241022
```

---

## 🐛 Troubleshooting

**Error: "Azure OpenAI requires AZURE_OPENAI_ENDPOINT"**
- Check .env has correct values
- Restart backend after changing .env

**Error: "Invalid API key"**
- Verify key is correct (no extra spaces)
- Check key has not expired
- For Azure: ensure API version is correct

**Slow generation with Azure/Claude**
- Check internet connection
- Verify you're not hitting rate limits
- Try switching to gpt-4o-mini or haiku for faster response

---

## 📞 Need Help?

1. Check backend console logs for error messages
2. Verify .env configuration matches examples above
3. Test with simple generation first (small Jira story)
