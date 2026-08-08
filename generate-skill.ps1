# Script to generate skill file for JIRA story
param(
    [string]$JiraStory = "EXOS-39560"
)

# Login to get token
$loginBody = @{
    username = "extreme"
    password = "extreme"
} | ConvertTo-Json

Write-Host "Logging in..." -ForegroundColor Cyan
$loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$token = $loginResponse.token
$userId = $loginResponse.user.id

Write-Host "Token obtained: $($token.Substring(0,20))..." -ForegroundColor Green

# Create a workflow
$workflowBody = @{
    title = "Skill Generation for $JiraStory"
    jira_story = $JiraStory
} | ConvertTo-Json

Write-Host "Creating workflow..." -ForegroundColor Cyan
$workflowResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/workflows" -Method POST -Body $workflowBody -ContentType "application/json" -Headers @{
    "Authorization" = "Bearer $token"
}
$workflowId = $workflowResponse.id

Write-Host "Workflow created: ID $workflowId" -ForegroundColor Green

# Fetch real JIRA data
Write-Host "Fetching JIRA ticket details..." -ForegroundColor Cyan
$jiraTicket = & node fetch-jira-ticket.js $JiraStory 2>&1 | Out-String

# Extract JIRA details from output
$summaryMatch = [regex]::Match($jiraTicket, "Summary:\s+(.+)")
$descriptionMatch = [regex]::Match($jiraTicket, "Description:\s+([\s\S]+?)(?=\n=|$)")

$summary = if ($summaryMatch.Success) { $summaryMatch.Groups[1].Value.Trim() } else { "Feature for $JiraStory" }
$description = if ($descriptionMatch.Success) { $descriptionMatch.Groups[1].Value.Trim() } else { "No description available" }

Write-Host "Summary: $summary" -ForegroundColor Yellow

# Generate skill file (Stage 2)
Write-Host "`nGenerating skill file with commit analysis..." -ForegroundColor Cyan
Write-Host "This may take a few minutes as it analyzes commits from the EXOS repository..." -ForegroundColor Yellow

# Prepare JIRA story as JSON object with REAL data
$jiraStoryJson = @{
    key = $JiraStory
    summary = $summary
    description = $description
} | ConvertTo-Json

# Create multipart form data with proper encoding
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$bodyLines = @()
$bodyLines += "--$boundary"
$bodyLines += "Content-Disposition: form-data; name=`"workflow_id`"$LF"
$bodyLines += $workflowId
$bodyLines += "--$boundary"
$bodyLines += "Content-Disposition: form-data; name=`"jira_story`"$LF"
$bodyLines += $jiraStoryJson
$bodyLines += "--$boundary--$LF"

$bodyString = $bodyLines -join $LF

$headers = @{
    "Authorization" = "Bearer $token"
}

try {
    $skillResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/stage2/generate" -Method POST -Body $bodyString -ContentType "multipart/form-data; boundary=$boundary" -Headers $headers -TimeoutSec 300
    
    if ($skillResponse.content) {
        Write-Host "`n========== GENERATED SKILL FILE ==========" -ForegroundColor Green
        Write-Host $skillResponse.content -ForegroundColor White
        Write-Host "`n==========================================`n" -ForegroundColor Green
        
        # Save to file
        $outputFile = "skill-$JiraStory.md"
        $skillResponse.content | Out-File -FilePath $outputFile -Encoding UTF8
        Write-Host "Skill file saved to: $outputFile" -ForegroundColor Cyan
    } elseif ($skillResponse.error) {
        Write-Host "Error from API: $($skillResponse.error)" -ForegroundColor Red
        if ($skillResponse.details) {
            Write-Host "Details: $($skillResponse.details)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Unexpected response format:" -ForegroundColor Yellow
        Write-Host ($skillResponse | ConvertTo-Json -Depth 5) -ForegroundColor White
    }
    
} catch {
    Write-Host "Error generating skill file: $_" -ForegroundColor Red
    Write-Host "Exception: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Yellow
    }
}
