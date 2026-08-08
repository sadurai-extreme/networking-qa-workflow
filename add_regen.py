#!/usr/bin/env python3
"""Adds the /regenerate endpoint to stage7.js"""

REGEN_CODE = '''
// Regenerate a single script with user feedback
router.post("/regenerate", async (req, res) => {
  const { script_id, user_feedback } = req.body;
  if (!script_id) return res.status(400).json({ error: "script_id required" });

  const script = db.prepare(
    "SELECT ts.*, tc.tc_number, tc.title, tc.description, tc.classification, tc.workflow_id " +
    "FROM tcl_scripts ts JOIN test_cases tc ON ts.test_case_id=tc.id WHERE ts.id=?"
  ).get(script_id);
  if (!script) return res.status(404).json({ error: "Script not found" });

  const testPlanDoc = db.prepare(
    "SELECT content FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type=\\'test_plan\\' ORDER BY created_at DESC LIMIT 1"
  ).get(script.workflow_id);

  const tclDocs = loadTclDocs();

  const feedback = user_feedback || "(No specific feedback — regenerate with improved quality and stricter framework compliance)";
  const tcSteps = extractTcStepsFromPlan(testPlanDoc ? testPlanDoc.content : "", script.tc_number);

  const systemPrompt = [
    "You are an EXOS TCL test automation specialist. Apply user feedback and fix framework violations.",
    "",
    "RULES:",
    "- SendACmd is THE ONLY CLI proc. NEVER use SendCliCommand.",
    "- Login before every DUT access.",
    "- proc name must match TC ID exactly, unquoted: proc 9.1.1 {} not proc \\"9.1.1\\" {}",
    "- CheckKeyValue pattern syntax: \\"{pattern} exist\\" with curly braces",
    "- Always unset parameterList after each CheckKeyValue block",
    "- NEVER use -fd $fd_res in CheckKeyValue",
    "- Use MapDUTPortId for ALL port refs — NEVER hardcode port numbers",
    "- StopPortsTransmit immediately after CheckRates",
    "- No CheckKeyValue after delete commands in cleanup",
    "- report_start_test / report_end_test must be paired in every step",
    "",
    "Framework Reference:",
    tclDocs.cli,
    "",
    "Traffic Patterns:",
    tclDocs.traffic,
    "",
    "Return ONLY the TCL script. No markdown fences, no explanation."
  ].join("\\n");

  const userPrompt = [
    `Regenerate the TCL script for TC ${script.tc_number}, incorporating the user feedback.`,
    "",
    `TC Number: ${script.tc_number}`,
    `Title: ${script.title}`,
    `Classification: ${script.classification}`,
    "",
    "## USER FEEDBACK / CHANGES REQUESTED:",
    feedback,
    "",
    "## CURRENT SCRIPT (revise this):",
    script.content,
    "",
    "## TEST PLAN STEPS:",
    tcSteps,
    "",
    "Return ONLY the complete TCL script. No markdown fences, no explanation, no prose."
  ].join("\\n");

  try {
    const content = await callLLM(systemPrompt, userPrompt, true);
    const dir = path.resolve(__dirname, "../../../uploads/scripts", script.workflow_id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, script.filename), content);
    db.prepare("UPDATE tcl_scripts SET content=? WHERE id=?").run(content, script_id);
    res.json({ success: true, content, filename: script.filename, tc_number: script.tc_number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

'''

with open("/root/networking-qa-workflow/backend/src/routes/stage7.js", "r") as f:
    content = f.read()

marker = "module.exports = router;"
if "/regenerate" in content:
    print("Regenerate endpoint already exists — skipping.")
else:
    content = content.replace(marker, REGEN_CODE + marker)
    with open("/root/networking-qa-workflow/backend/src/routes/stage7.js", "w") as f:
        f.write(content)
    print("DONE — regenerate endpoint added.")
