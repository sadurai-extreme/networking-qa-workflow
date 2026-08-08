<#
.SYNOPSIS
    Auto-convert .doc files to .docx using Microsoft Word COM automation
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$SourceDir,
    
    [Parameter(Mandatory=$false)]
    [switch]$Recursive
)

$wdFormatDocumentDefault = 16
$wdDoNotSaveChanges = 0

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "         .doc to .docx Auto-Converter (Word COM)                " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $SourceDir)) {
    Write-Host "Error: Directory not found: $SourceDir" -ForegroundColor Red
    exit 1
}

$docFiles = Get-ChildItem -Path $SourceDir -Filter "*.doc" -File -Recurse:$Recursive | Where-Object { $_.Extension -eq ".doc" }

if ($docFiles.Count -eq 0) {
    Write-Host "No .doc files found in: $SourceDir" -ForegroundColor Yellow
    exit 0
}

Write-Host "Source Directory: $SourceDir" -ForegroundColor White
Write-Host "Found $($docFiles.Count) .doc file(s) to convert" -ForegroundColor White
Write-Host ""

Write-Host "Initializing Microsoft Word..." -ForegroundColor Cyan
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    Write-Host "Word initialized successfully" -ForegroundColor Green
}
catch {
    Write-Host "Error: Failed to initialize Microsoft Word" -ForegroundColor Red
    Write-Host "Make sure Microsoft Word is installed on this system" -ForegroundColor Yellow
    exit 1
}

$converted = 0
$failed = 0
$skipped = 0

try {
    foreach ($docFile in $docFiles) {
        $docPath = $docFile.FullName
        $docxPath = [System.IO.Path]::ChangeExtension($docPath, ".docx")
        $fileName = $docFile.Name
        
        Write-Host ""
        Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
        Write-Host "Processing: $fileName" -ForegroundColor White
        Write-Host "Size: $([math]::Round($docFile.Length / 1KB, 2)) KB" -ForegroundColor Gray
        
        if (Test-Path $docxPath) {
            $docxFile = Get-Item $docxPath
            $docxDate = $docxFile.LastWriteTime
            $docDate = $docFile.LastWriteTime
            
            if ($docxDate -gt $docDate) {
                Write-Host "Skipping (newer .docx exists): $([math]::Round($docxFile.Length / 1KB, 2)) KB" -ForegroundColor Yellow
                $skipped++
                continue
            }
            else {
                Write-Host "Overwriting existing .docx (source is newer)" -ForegroundColor Cyan
            }
        }
        
        try {
            Write-Host "Opening document..." -ForegroundColor Gray
            $doc = $word.Documents.Open($docPath, $false, $true)
            
            Write-Host "Converting to .docx format..." -ForegroundColor Gray
            $doc.SaveAs2([ref]$docxPath, [ref]$wdFormatDocumentDefault)
            
            $doc.Close([ref]$wdDoNotSaveChanges)
            
            if (Test-Path $docxPath) {
                $newSize = (Get-Item $docxPath).Length
                Write-Host "Success! Converted: $([math]::Round($newSize / 1KB, 2)) KB" -ForegroundColor Green
                Write-Host "Output: $docxPath" -ForegroundColor Gray
                $converted++
            }
            else {
                Write-Host "Failed: Output file not created" -ForegroundColor Red
                $failed++
            }
        }
        catch {
            Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
            $failed++
            
            try {
                if ($doc) {
                    $doc.Close([ref]$wdDoNotSaveChanges)
                }
            }
            catch {
            }
        }
    }
}
finally {
    Write-Host ""
    Write-Host "Cleaning up..." -ForegroundColor Cyan
    try {
        $word.Quit([ref]$wdDoNotSaveChanges)
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
        Write-Host "Word closed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "Warning: Error during cleanup: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "                      Conversion Summary                          " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "Converted: $converted" -ForegroundColor Green
Write-Host "Skipped:   $skipped (newer .docx exists)" -ForegroundColor Yellow
Write-Host "Failed:    $failed" -ForegroundColor Red
Write-Host "Total:     $($docFiles.Count)" -ForegroundColor White
Write-Host ""

if ($converted -gt 0) {
    Write-Host "Conversion completed! You can now use the .docx files." -ForegroundColor Green
}

exit $(if ($failed -gt 0) { 1 } else { 0 })
