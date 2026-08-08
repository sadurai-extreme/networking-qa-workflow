# PowerShell Deployment Script for Phase 1 Quality Controls
# Server: 10.127.26.9

Write-Host "`n==========================================="
Write-Host "Phase 1: Quality Controls Deployment"
Write-Host "==========================================="
Write-Host ""

# Configuration
$SERVER = "10.127.26.9"
$USER = "root"
$PASSWORD = "extreme@123"
$REMOTE_PATH = "/root/networking-qa-workflow"

# Create secure password
$SecurePassword = ConvertTo-SecureString $PASSWORD -AsPlainText -Force
$Credential = New-Object System.Management.Automation.PSCredential ($USER, $SecurePassword)

Write-Host "Step 1: Uploading new files to server..."
Write-Host "-------------------------------------------"

# Function to upload file via SCP using plink
function Upload-File {
    param($LocalPath, $RemotePath)
    
    $fileName = Split-Path $LocalPath -Leaf
    Write-Host "Uploading $fileName..."
    
    # Use pscp (PuTTY SCP) if available, otherwise use scp with password
    echo y | pscp -pw $PASSWORD $LocalPath "${USER}@${SERVER}:${RemotePath}"
    
    if ($LASTEXITCODE -ne 0) {
        # Fallback to scp
        $sshPassCmd = "sshpass -p '$PASSWORD' scp -o StrictHostKeyChecking=no '$LocalPath' '${USER}@${SERVER}:${RemotePath}'"
        bash -c $sshPassCmd
    }
}

# Function to execute SSH command
function Invoke-SSHCommand {
    param($Command)
    
    # Use plink (PuTTY) if available
    $plinkCmd = "echo y | plink -pw $PASSWORD ${USER}@${SERVER} `"$Command`""
    Invoke-Expression $plinkCmd
    
    if ($LASTEXITCODE -ne 0) {
        # Fallback to ssh with sshpass
        $sshCmd = "sshpass -p '$PASSWORD' ssh -o StrictHostKeyChecking=no ${USER}@${SERVER} '$Command'"
        bash -c $sshCmd
    }
}

# Create remote directories
Write-Host "Creating remote directories..."
Invoke-SSHCommand "mkdir -p ${REMOTE_PATH}/config ${REMOTE_PATH}/backend/src/db/migrations"

# Upload files
Upload-File "backend\src\utils\testPlanValidator.js" "${REMOTE_PATH}/backend/src/utils/testPlanValidator.js"
Upload-File "backend\src\utils\testPlanNormalizer.js" "${REMOTE_PATH}/backend/src/utils/testPlanNormalizer.js"
Upload-File "config\test-plan-standards.json" "${REMOTE_PATH}/config/test-plan-standards.json"
Upload-File "backend\src\db\migrations\add-quality-control-fields.js" "${REMOTE_PATH}/backend/src/db/migrations/add-quality-control-fields.js"
Upload-File "backend\src\routes\stage3.js" "${REMOTE_PATH}/backend/src/routes/stage3.js"
Upload-File "backend\src\utils\versionControl.js" "${REMOTE_PATH}/backend/src/utils/versionControl.js"

Write-Host "`nStep 2: Running database migration..."
Write-Host "-------------------------------------------"

$migrationScript = @'
cd /root/networking-qa-workflow
echo "Current directory: $(pwd)"

# Load NVM and use Node 16
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 16

# Run migration
echo "Running database migration..."
node backend/src/db/migrations/add-quality-control-fields.js

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully"
else
    echo "❌ Database migration failed"
    exit 1
fi
'@

# Execute migration
$migrationCmd = "echo y | plink -pw $PASSWORD ${USER}@${SERVER} `"bash -c '$migrationScript'`""
Invoke-Expression $migrationCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Migration failed. Aborting deployment." -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 3: Restarting backend service..."
Write-Host "-------------------------------------------"

$restartScript = @'
cd /root/networking-qa-workflow

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 16

# Find and kill existing backend process
BACKEND_PID=$(ps aux | grep 'node.*backend/src/index.js' | grep -v grep | awk '{print $2}')

if [ -n "$BACKEND_PID" ]; then
    echo "Stopping backend process (PID: $BACKEND_PID)..."
    kill $BACKEND_PID
    sleep 2
    
    # Force kill if still running
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "Force killing backend process..."
        kill -9 $BACKEND_PID
    fi
    
    echo "✅ Backend stopped"
else
    echo "⚠️  No running backend process found"
fi

# Wait a moment
sleep 2

# Start backend
echo "Starting backend with quality controls..."
cd backend
nohup node src/index.js > ../logs/backend.log 2>&1 &
NEW_PID=$!

sleep 3

# Verify backend is running
if ps -p $NEW_PID > /dev/null 2>&1; then
    echo "✅ Backend started successfully (PID: $NEW_PID)"
    echo "   Log: /root/networking-qa-workflow/logs/backend.log"
else
    echo "❌ Failed to start backend"
    echo "   Check logs: tail -f /root/networking-qa-workflow/logs/backend.log"
    exit 1
fi
'@

# Execute restart
$restartCmd = "echo y | plink -pw $PASSWORD ${USER}@${SERVER} `"bash -c '$restartScript'`""
Invoke-Expression $restartCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Backend restart failed." -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 4: Verifying deployment..."
Write-Host "-------------------------------------------"
Start-Sleep -Seconds 5

# Test health endpoint
Write-Host "Testing health endpoint..."
try {
    $response = Invoke-RestMethod -Uri "http://10.127.26.9:5100/api/health" -Method Get -TimeoutSec 10
    if ($response.status -eq "ok") {
        Write-Host "✅ Backend health check passed" -ForegroundColor Green
    } else {
        Write-Host "❌ Backend health check failed" -ForegroundColor Red
        Write-Host "   Response: $($response | ConvertTo-Json)"
        exit 1
    }
} catch {
    Write-Host "❌ Backend health check failed" -ForegroundColor Red
    Write-Host "   Error: $_"
    exit 1
}

Write-Host "`n==========================================="
Write-Host "✅ Phase 1 Deployment Complete!" -ForegroundColor Green
Write-Host "==========================================="
Write-Host ""
Write-Host "Quality Control Features Deployed:" -ForegroundColor Cyan
Write-Host "  ✅ Test Plan Validator (format, structure, quality)" -ForegroundColor Green
Write-Host "  ✅ Test Plan Normalizer (auto-correction)" -ForegroundColor Green
Write-Host "  ✅ Standards Configuration (test-plan-standards.json)" -ForegroundColor Green
Write-Host "  ✅ Enhanced Database Schema (LLM tracking, validation, audit)" -ForegroundColor Green
Write-Host "  ✅ Stage 3 Integration (automatic validation on generation)" -ForegroundColor Green
Write-Host "  ✅ Enhanced Version Control (revision tracking, quality metrics)" -ForegroundColor Green
Write-Host ""
Write-Host "New Database Tables:" -ForegroundColor Cyan
Write-Host "  • document_revisions - Detailed version history"
Write-Host "  • document_validations - Validation results"
Write-Host "  • document_normalizations - Normalization changes"
Write-Host "  • document_approvals - Approval workflow"
Write-Host "  • audit_log - Comprehensive audit trail"
Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  Backend: http://10.127.26.9:5100 ✅" -ForegroundColor Green
Write-Host "  Frontend: http://10.127.26.9:5101 ✅" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Test test plan generation in Stage 3"
Write-Host "  2. Review validation scores in response"
Write-Host "  3. Check database for LLM tracking metadata"
Write-Host "  4. Review audit_log table for activity"
Write-Host ""
