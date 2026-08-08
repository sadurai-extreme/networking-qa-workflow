#!/usr/bin/env python3
"""Add AI review endpoint to stage7.js"""

REVIEW_CODE = '''
// AI Review — Senior EXOS Networking Architect agent reviews the script
router.post("/review", async (req, res) => {
  const { script_id } = req.body;
  if (!script_id) return res.status(400).json({ error: "script_id required" });

  const script = db.prepare(
    "SELECT ts.*, tc.tc_number, tc.title, tc.description, tc.classification, tc.workflow_id " +
    "FROM tcl_scripts ts JOIN test_cases tc ON ts.test_case_id=tc.id WHERE ts.id=?"
  ).get(script_id);
  if (!script) return res.status(404).json({ error: "Script not found" });

  const testPlanDoc = db.prepare(
    "SELECT content FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type=\\'test_plan\\' ORDER BY created_at DESC LIMIT 1"
  ).get(script.workflow_id);

  const tcSteps = extractTcStepsFromPlan(testPlanDoc ? testPlanDoc.content : "", script.tc_number);

  const systemPrompt = `You are a Senior Networking Architect at Extreme Networks with 15+ years of EXOS expertise and deep mastery of the exos-tcl-automation framework. You review TCL test scripts with the eye of someone who has personally written thousands of EXOS automation tests.

Your review covers:
1. FRAMEWORK COMPLIANCE — strict rule violations that cause runtime failure
2. EXOS CLI ACCURACY — are commands syntactically correct EXOS CLI?
3. TEST COVERAGE — does the script fully cover the test plan steps?
4. AUTOMATION QUALITY — good assertions, timing, cleanup
5. CODE QUALITY — readability, structure, naming

FRAMEWORK RULES TO CHECK (any violation = CRITICAL):
- SendACmd is the ONLY CLI proc. SendCliCommand = instant fail.
- Login must precede every DUT access
- proc name must match TC ID exactly, unquoted: proc 9.1.1 {} not proc "9.1.1" {}
- CheckKeyValue: pattern must use curly braces: "{pattern} exist"
- unset parameterList after every CheckKeyValue block
- NEVER -fd $fd_res in any CheckKeyValue call
- MapDUTPortId for ALL port refs — hardcoded port numbers = instant fail
- StopPortsTransmit must immediately follow CheckRates
- No CheckKeyValue after delete commands in cleanup
- report_start_test / report_end_test must be paired in every step
- open_result_file and close_result_file must be present
- result_h1 for main title, result_h2 for each step

Return a JSON object ONLY — no prose, no markdown fences. Structure:
{
  "verdict": "PASS" | "NEEDS_REVISION" | "FAIL",
  "score": <integer 0-100>,
  "summary": "<1-2 sentence overall assessment from the architect's perspective>",
  "issues": [
    {
      "severity": "CRITICAL" | "WARNING" | "SUGGESTION",
      "category": "<Framework|CLI|Coverage|Quality>",
      "description": "<specific issue description>",
      "line_hint": "<relevant code snippet or proc name, optional>"
    }
  ],
  "positives": [
    "<thing done well>"
  ]
}`;

  const userPrompt = `Review this TCL automation script for TC ${script.tc_number}.

TC Number: ${script.tc_number}
Title: ${script.title}
Classification: ${script.classification}

SCRIPT TO REVIEW:
${script.content}

TEST PLAN STEPS (expected coverage):
${tcSteps}

Return ONLY a valid JSON object. No markdown, no explanation.`;

  try {
    const raw = await callLLM(systemPrompt, userPrompt, true);
    // Strip markdown fences if LLM wraps it anyway
    const clean = raw.replace(/^```(?:json)?\\s*/i, "").replace(/\\s*```$/i, "").trim();
    let review;
    try {
      review = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: "Review parse failed", raw });
    }
    res.json({ success: true, review, tc_number: script.tc_number, filename: script.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

'''

with open("/root/networking-qa-workflow/backend/src/routes/stage7.js", "r") as f:
    content = f.read()

marker = "module.exports = router;"
if "/review" in content and 'Senior Networking Architect' in content:
    print("Review endpoint already exists — skipping.")
else:
    content = content.replace(marker, REVIEW_CODE + marker)
    with open("/root/networking-qa-workflow/backend/src/routes/stage7.js", "w") as f:
        f.write(content)
    print("DONE — AI review endpoint added.")
