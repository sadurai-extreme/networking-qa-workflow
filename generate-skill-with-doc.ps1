# Script to generate skill file with IPP document
param(
    [string]$JiraStory = "EXOS-39560"
)

# Login
$loginBody = @{
    username = "extreme"
    password = "extreme"
} | ConvertTo-Json

Write-Host "Logging in..." -ForegroundColor Cyan
$loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$token = $loginResponse.token

# Create workflow
$workflowBody = @{
    title = "Skill Generation for $JiraStory with IPP Spec"
    jira_story = $JiraStory
} | ConvertTo-Json

Write-Host "Creating workflow..." -ForegroundColor Cyan
$workflowResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/workflows" -Method POST -Body $workflowBody -ContentType "application/json" -Headers @{
    "Authorization" = "Bearer $token"
}
$workflowId = $workflowResponse.id
Write-Host "Workflow ID: $workflowId" -ForegroundColor Green

# Fetch real JIRA data
Write-Host "Fetching JIRA details..." -ForegroundColor Cyan
$jiraOutput = & node fetch-jira-ticket.js $JiraStory 2>&1 | Out-String
$summaryMatch = [regex]::Match($jiraOutput, "Summary:\s+(.+)")
$descMatch = [regex]::Match($jiraOutput, "Description:\s+([\s\S]+?)(?=\n====|$)")

$summary = if ($summaryMatch.Success) { $summaryMatch.Groups[1].Value.Trim() } else { "Unknown" }
$description = if ($descMatch.Success) { $descMatch.Groups[1].Value.Trim().Substring(0, [Math]::Min(2000, $descMatch.Groups[1].Value.Trim().Length)) } else { "No description" }

Write-Host "Summary: $summary" -ForegroundColor Yellow

# Prepare multipart form with IPP spec
$ippSpecPath = "C:\My_Projects\networking-qa-workflow\uploads\IPP_Functional_Spec.txt"
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

# Read IPP spec
$ippSpecContent = Get-Content $ippSpecPath -Raw

# Build multipart body
$bodyLines = @()
$bodyLines += "--$boundary"
$bodyLines += 'Content-Disposition: form-data; name="workflow_id"' + $LF
$bodyLines += $workflowId
$bodyLines += "--$boundary"
$bodyLines += 'Content-Disposition: form-data; name="jira_story"' + $LF
$bodyLines += (@{
    key = $JiraStory
    summary = $summary
    description = $description
} | ConvertTo-Json)
$bodyLines += "--$boundary"
$bodyLines += 'Content-Disposition: form-data; name="current_feature_spec"; filename="IPP_Spec.txt"'
$bodyLines += 'Content-Type: text/plain' + $LF
$bodyLines += $ippSpecContent
$bodyLines += "--$boundary--"

$body = $bodyLines -join $LF

Write-Host "`nGenerating skill file with IPP spec + JIRA data + commit analysis..." -ForegroundColor Cyan
Write-Host "This may take a few minutes..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/stage2/generate" `
        -Method POST `
        -Body $body `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Headers @{ "Authorization" = "Bearer $token" } `
        -TimeoutSec 300
    
    Write-Host "`n========== GENERATED SKILL FILE ==========" -ForegroundColor Green
    Write-Host $response.content -ForegroundColor White
    Write-Host "`n==========================================`n" -ForegroundColor Green
    
    $outputFile = "skill-$JiraStory-corrected.md"
    $response.content | Out-File -FilePath $outputFile -Encoding UTF8
    Write-Host "Skill file saved to: $outputFile" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Exception: $($_.Exception.Message)" -ForegroundColor Red
}
