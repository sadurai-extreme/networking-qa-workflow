#!/usr/bin/env pwsh
# Skill File Generation Demonstration with New Features

Write-Host "=== NOS QA Workflow: Skill File Generation Demo ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login
Write-Host "[1] Logging in..." -ForegroundColor Yellow
$loginResponse = curl.exe -s -X POST http://10.127.26.9:5100/api/auth/login `
    -H "Content-Type: application/json" `
    -d '{"username":"extreme","password":"extreme"}' | ConvertFrom-Json

$token = $loginResponse.token
Write-Host "✓ Logged in successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Create a workflow for a story
Write-Host "[2] Creating workflow for story EXOS-39369..." -ForegroundColor Yellow
$storyData = @{
    jira_story_id = "EXOS-39369"
    title = "Fabric Attach Zero Touch Client Bypass Netlogin"
    jira_release = "EXOS 34.1"
    jira_story_type = "Story"
    jira_story_description = "Implement bypass netlogin authentication for Fabric Attach zero-touch clients"
} | ConvertTo-Json

$workflow = curl.exe -s -X POST http://10.127.26.9:5100/api/workflows `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -d $storyData | ConvertFrom-Json

Write-Host "✓ Workflow created: ID = $($workflow.id)" -ForegroundColor Green
Write-Host ""

# Step 3: Generate skill file WITH additional CLI commands
Write-Host "[3] Generating skill file with CLI commands..." -ForegroundColor Yellow
Write-Host "    Using new 'additional_cli' feature!" -ForegroundColor Cyan

# Create a temporary file for the multipart form data
$boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
$bodyLines = @(
    "--$boundary",
    'Content-Disposition: form-data; name="workflow_id"',
    '',
    $workflow.id,
    "--$boundary",
    'Content-Disposition: form-data; name="jira_story"',
    '',
    $storyData,
    "--$boundary",
    'Content-Disposition: form-data; name="additional_cli"',
    '',
    @"
configure fabric attach zero-touch-client <client> [vlan [[<vlan_name>|<vlan_id>] [nsi <nsi>|isid <isid>] {priority [<priority> | dot1p]} {bypass-netlogin [on | off]} {enable | disable} | none] | enable | disable]

debug lldp show fabric attach database

show fabric attach elements

show fabric attach statistics
"@,
    "--$boundary--"
)

$bodyContent = $bodyLines -join "`r`n"
$bodyFile = "c:\My_Projects\networking-qa-workflow\temp_generate_body.txt"
$bodyContent | Out-File -FilePath $bodyFile -Encoding ascii -NoNewline

$generateResponse = curl.exe -s -X POST http://10.127.26.9:5100/api/stage2/generate `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: multipart/form-data; boundary=$boundary" `
    --data-binary "@$bodyFile"

Remove-Item $bodyFile -ErrorAction SilentlyContinue

$result = $generateResponse | ConvertFrom-Json

if ($result.content) {
    Write-Host "✓ Skill file generated successfully!" -ForegroundColor Green
    Write-Host "  Length: $($result.content.Length) characters" -ForegroundColor Gray
    Write-Host "  Filename: $($result.filename)" -ForegroundColor Gray
    
    # Save to file
    $outputFile = "c:\My_Projects\networking-qa-workflow\generated_skill_EXOS-39369.md"
    $result.content | Out-File -FilePath $outputFile -Encoding utf8
    Write-Host "  Saved to: $outputFile" -ForegroundColor Gray
    Write-Host ""
    
    # Show preview
    Write-Host "[4] Skill File Preview:" -ForegroundColor Yellow
    Write-Host "─" * 80 -ForegroundColor DarkGray
    $lines = $result.content -split "`n"
    $lines[0..30] | ForEach-Object { Write-Host $_ }
    Write-Host "..." -ForegroundColor DarkGray
    Write-Host "─" * 80 -ForegroundColor DarkGray
    Write-Host ""
} else {
    Write-Host "✗ Generation failed: $($result.error)" -ForegroundColor Red
    Write-Host $generateResponse
}

# Step 4: Demonstrate feedback/regeneration feature
Write-Host "[5] Testing Chat/Feedback Feature..." -ForegroundColor Yellow
Write-Host "    Sending feedback to fix incorrect commands..." -ForegroundColor Cyan

$feedbackData = @{
    workflow_id = $workflow.id
    current_content = $result.content
    user_feedback = @"
The skill file contains incorrect commands. Please make these corrections:

REMOVE these incorrect commands:
- enable netlogin
- configure netlogin bypass-authentication enable
- configure netlogin bypass-client-type IoT

KEEP the correct command:
- configure fabric attach zero-touch-client (this is correct)

Add more examples of the 'show fabric attach' commands with proper formatting.
"@
    jira_story = @{
        id = "EXOS-39369"
        title = "Fabric Attach Zero Touch Client Bypass Netlogin"
        release = "EXOS 34.1"
    }
} | ConvertTo-Json -Depth 10

Write-Host "    Calling /api/stage2/regenerate endpoint..." -ForegroundColor Gray
$regenerateResponse = curl.exe -s -X POST http://10.127.26.9:5100/api/stage2/regenerate `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -d $feedbackData | ConvertFrom-Json

if ($regenerateResponse.content) {
    Write-Host "✓ Skill file regenerated based on feedback!" -ForegroundColor Green
    Write-Host "  New version: $($regenerateResponse.version)" -ForegroundColor Gray
    Write-Host "  New filename: $($regenerateResponse.filename)" -ForegroundColor Gray
    
    # Save regenerated version
    $outputFile2 = "c:\My_Projects\networking-qa-workflow\regenerated_skill_EXOS-39369_v$($regenerateResponse.version).md"
    $regenerateResponse.content | Out-File -FilePath $outputFile2 -Encoding utf8
    Write-Host "  Saved to: $outputFile2" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "✓ Chat/Feedback system working!" -ForegroundColor Green
} else {
    Write-Host "✗ Regeneration failed: $($regenerateResponse.error)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Demo Complete! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary of New Features:" -ForegroundColor Yellow
Write-Host "  ✓ CLI Input Field: Accepts custom CLI commands via 'additional_cli' parameter" -ForegroundColor Green
Write-Host "  ✓ Chat/Feedback: Regenerate skill files with user feedback via /regenerate endpoint" -ForegroundColor Green
Write-Host "  ✓ Version Control: Each regeneration creates a new version" -ForegroundColor Green
Write-Host "  ✓ Chat History: Track all user feedback and system responses" -ForegroundColor Green
Write-Host ""
Write-Host "Access the UI at: http://10.127.26.9:5101" -ForegroundColor Cyan
