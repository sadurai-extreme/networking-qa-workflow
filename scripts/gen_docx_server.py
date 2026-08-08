#!/usr/bin/env python3
"""Helper: query DB and generate DOCX for the most recent (or specified) workflow."""
import sqlite3, json, subprocess, sys, os

DB   = "/root/networking-qa-workflow/backend/data/qa_workflow.db"
WF_ID = sys.argv[1] if len(sys.argv) > 1 else None
OUT  = sys.argv[2] if len(sys.argv) > 2 else "/tmp/generated_testplan.docx"

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

if WF_ID:
    wf = conn.execute("SELECT * FROM workflows WHERE id=?", (WF_ID,)).fetchone()
else:
    wf = conn.execute("SELECT * FROM workflows ORDER BY created_at DESC LIMIT 1").fetchone()

if not wf:
    print("No workflow found"); sys.exit(1)

wf = dict(wf)
WF_ID = wf["id"]
print("Workflow:", wf.get("title"))

rows = conn.execute(
    "SELECT tc_number, title, description, classification, result "
    "FROM test_cases WHERE workflow_id=? ORDER BY tc_number",
    (WF_ID,)
).fetchall()

print("TC count:", len(rows))

# Try to get steps/expected from workflow_stages
stage_steps = {}
try:
    for r in conn.execute(
        "SELECT stage_number, stage_data FROM workflow_stages WHERE workflow_id=?",
        (WF_ID,)
    ):
        sdata = json.loads(r[1]) if r[1] else {}
        stage_steps[r[0]] = sdata
except Exception as e:
    print("Stages not available:", e)

tcs = []
for row in rows:
    tc = dict(row)
    tc.setdefault("steps", "")
    tc.setdefault("expected", "")
    tcs.append(tc)

payload = {
    "title":      wf.get("title", ""),
    "jira_story": wf.get("jira_story_id", ""),
    "release":    wf.get("jira_release", ""),
    "story_type": wf.get("jira_story_type", "Feature"),
    "doc_type":   "New",
    "author":     "",
    "reviewer":   "",
    "approver":   "",
    "version":    "1.0",
    "output_path": OUT,
    "test_cases": tcs,
    "sessions":   [],
    "summary":    {"total": len(tcs)},
    "has_results": False
}

tmp_json = "/tmp/docx_payload.json"
with open(tmp_json, "w") as f:
    json.dump(payload, f)

with open(tmp_json) as stdin_file:
    rc = subprocess.call(
        ["python3", "/root/networking-qa-workflow/backend/src/scripts/generate_iso_docx.py"],
        stdin=stdin_file
    )

if rc == 0:
    print("SUCCESS:", OUT)
else:
    print("FAILED with return code:", rc)
    sys.exit(1)
