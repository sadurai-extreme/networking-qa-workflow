import json, subprocess, sys

payload = {
    "workflow_id": "0eb053b8-4346-437e-86b5-00f952e2c08f",
    "author": "Test User",
    "version": "1.0"
}

with open("/tmp/payload.json", "w") as f:
    json.dump(payload, f)

result = subprocess.run(
    ["curl", "-s", "-o", "/tmp/out.docx", "-w", "HTTP:%{http_code} SIZE:%{size_download}",
     "-X", "POST", "http://localhost:5100/api/stage9/generate-docx-template",
     "-H", "Content-Type: application/json",
     "-d", "@/tmp/payload.json"],
    capture_output=True, text=True
)
print(result.stdout, result.stderr)
