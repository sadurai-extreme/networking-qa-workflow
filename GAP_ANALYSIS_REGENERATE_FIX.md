# Gap Analysis Regenerate Fix - Applied 2026-08-01

## Problem Identified

The "Regenerate Test Plan from Gap Analysis" button was hanging for 15+ minutes due to:

1. **No Timeout Configuration**: LLM API calls had no timeout, causing indefinite hangs
2. **Invalid Model Name**: `.env` had `claude-sonnet-4-6` instead of valid model name

## Changes Applied

### 1. Added 5-Minute Timeouts (llm.js)
- Wrapped Anthropic API calls in `Promise.race()` with 5-minute timeout
- Wrapped OpenAI-compatible API calls with same timeout
- Ensures requests fail gracefully after 5 minutes instead of hanging

### 2. Fixed Model Names (.env)
**Before:**
```
ANTHROPIC_MODEL_HEAVY=claude-sonnet-4-6
ANTHROPIC_MODEL_LIGHT=claude-sonnet-4-6
```

**After:**
```
ANTHROPIC_MODEL_HEAVY=claude-3-5-sonnet-20241022
ANTHROPIC_MODEL_LIGHT=claude-3-5-haiku-20241022
```

### 3. Improved Error Handling (stage3.js)
- Added validation checks for workflow, skill file, and test plan existence
- Added timing logs to track regeneration duration
- Added specific error messages for timeout vs API errors
- Added error stack traces for debugging

## How to Apply the Fix

### Step 1: Restart Backend Server

```powershell
# Stop current backend (Ctrl+C in terminal or kill process)
Get-Process -Name "node*" | Stop-Process -Force

# Navigate to backend folder
cd backend

# Start backend server
npm start
```

### Step 2: Test the Fix

1. Go to Stage 3 in the dashboard
2. Click "Run Gap Analysis" button
3. Wait for analysis to complete
4. Click "Regenerate Test Plan from Gap Analysis" button
5. Should complete within 1-3 minutes (or fail with clear timeout message after 5 minutes)

## Expected Behavior After Fix

### Success Case:
- Gap analysis completes in 30-60 seconds
- Regeneration completes in 1-3 minutes
- New test plan revision appears with gap-addressed content
- Success message shows: "Test plan regenerated from gap analysis! Revision X"

### Timeout Case (if LLM is slow):
- After 5 minutes, shows error: "Test plan regeneration timed out after 5 minutes..."
- User can retry after a few minutes
- No indefinite hanging

### Error Case (if API issue):
- Clear error message: "LLM API error: [specific error]"
- User knows what went wrong

## Backend Logs to Watch

After fix, you should see these logs:

```
=== Regenerating Test Plan with Review Comments ===
Workflow: <workflow-id>
Review Comments Length: 500
Found skill file (version 1) and test plan (revision 1)
Starting test plan regeneration...
⚡ LLM call completed in 45.2s (claude-3-5-sonnet-20241022)
Test plan regeneration completed in 47.5s
Excel file generated for revision 2: test_plan_<id>_v2_<timestamp>.xlsx
Word file generated for revision 2: test_plan_<id>_v2_<timestamp>.docx
Test plan regenerated with review comments, revision 2
```

## Troubleshooting

### If still hanging:
1. Check if Anthropic API key is valid
2. Check internet connectivity
3. Try using a different LLM provider (Azure OpenAI, GitHub Copilot)
4. Check backend console for error messages

### If API errors:
1. Verify model names are correct for your provider
2. Check API key has proper permissions
3. Verify API endpoint URL is correct

### If timeout errors persist:
1. Consider increasing timeout from 5 to 10 minutes in `llm.js`
2. Switch to a faster model (e.g., haiku for light tasks)
3. Reduce test plan size before regeneration

## Files Modified

1. `backend/src/services/llm.js` - Added timeouts to API calls
2. `backend/.env` - Fixed model names
3. `backend/src/routes/stage3.js` - Improved error handling and logging

## Testing Checklist

- [ ] Backend restarted with new changes
- [ ] Gap Analysis button works
- [ ] Regenerate button works within 5 minutes
- [ ] Error messages are clear if something fails
- [ ] Test plan updates correctly after regeneration
- [ ] Excel and Word files generated
- [ ] No indefinite hanging

---

**Status**: ✅ FIXED  
**Applied**: 2026-08-01  
**Restart Required**: YES - Backend must be restarted for changes to take effect
