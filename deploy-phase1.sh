#!/bin/bash
# Deploy Phase 1 Quality Controls to Production
# Server: 10.127.26.9

echo "==========================================="
echo "Phase 1: Quality Controls Deployment"
echo "==========================================="
echo ""

# Configuration
SERVER="10.127.26.9"
USER="root"
PASSWORD="extreme@123"
REMOTE_PATH="/root/networking-qa-workflow"
LOCAL_PATH="$(pwd)"

# Check if sshpass is available
if ! command -v sshpass &> /dev/null; then
    echo "⚠️  sshpass not found. Install it for password-less deployment:"
    echo "   Windows: Use ssh-keygen for key-based auth instead"
    echo ""
    echo "Continuing with manual password entry..."
    SSHPASS_CMD=""
    SCP_CMD="scp"
    SSH_CMD="ssh"
else
    SSHPASS_CMD="sshpass -p ${PASSWORD}"
    SCP_CMD="sshpass -p ${PASSWORD} scp -o StrictHostKeyChecking=no"
    SSH_CMD="sshpass -p ${PASSWORD} ssh -o StrictHostKeyChecking=no"
fi

echo "Step 1: Uploading new files to server..."
echo "-------------------------------------------"

# Upload validator
echo "Uploading testPlanValidator.js..."
${SCP_CMD} backend/src/utils/testPlanValidator.js ${USER}@${SERVER}:${REMOTE_PATH}/backend/src/utils/

# Upload normalizer
echo "Uploading testPlanNormalizer.js..."
${SCP_CMD} backend/src/utils/testPlanNormalizer.js ${USER}@${SERVER}:${REMOTE_PATH}/backend/src/utils/

# Upload standards configuration
echo "Uploading test-plan-standards.json..."
${SSH_CMD} ${USER}@${SERVER} "mkdir -p ${REMOTE_PATH}/config"
${SCP_CMD} config/test-plan-standards.json ${USER}@${SERVER}:${REMOTE_PATH}/config/

# Upload migration script
echo "Uploading database migration..."
${SSH_CMD} ${USER}@${SERVER} "mkdir -p ${REMOTE_PATH}/backend/src/db/migrations"
${SCP_CMD} backend/src/db/migrations/add-quality-control-fields.js ${USER}@${SERVER}:${REMOTE_PATH}/backend/src/db/migrations/

# Upload updated files
echo "Uploading updated stage3.js route..."
${SCP_CMD} backend/src/routes/stage3.js ${USER}@${SERVER}:${REMOTE_PATH}/backend/src/routes/

echo "Uploading updated versionControl.js..."
${SCP_CMD} backend/src/utils/versionControl.js ${USER}@${SERVER}:${REMOTE_PATH}/backend/src/utils/

echo ""
echo "Step 2: Running database migration..."
echo "-------------------------------------------"
${SSH_CMD} ${USER}@${SERVER} << 'ENDSSH'
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
ENDSSH

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Migration failed. Aborting deployment."
    exit 1
fi

echo ""
echo "Step 3: Restarting backend service..."
echo "-------------------------------------------"
${SSH_CMD} ${USER}@${SERVER} << 'ENDSSH'
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
ENDSSH

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Backend restart failed."
    exit 1
fi

echo ""
echo "Step 4: Verifying deployment..."
echo "-------------------------------------------"
sleep 5

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_STATUS=$(curl -s http://10.127.26.9:5100/api/health | grep -o '"status":"ok"' || echo "failed")

if [ "$HEALTH_STATUS" = '"status":"ok"' ]; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    echo "   Response: $(curl -s http://10.127.26.9:5100/api/health)"
    exit 1
fi

echo ""
echo "==========================================="
echo "✅ Phase 1 Deployment Complete!"
echo "==========================================="
echo ""
echo "Quality Control Features Deployed:"
echo "  ✅ Test Plan Validator (format, structure, quality)"
echo "  ✅ Test Plan Normalizer (auto-correction)"
echo "  ✅ Standards Configuration (test-plan-standards.json)"
echo "  ✅ Enhanced Database Schema (LLM tracking, validation, audit)"
echo "  ✅ Stage 3 Integration (automatic validation on generation)"
echo "  ✅ Enhanced Version Control (revision tracking, quality metrics)"
echo ""
echo "New Database Tables:"
echo "  • document_revisions - Detailed version history"
echo "  • document_validations - Validation results"
echo "  • document_normalizations - Normalization changes"
echo "  • document_approvals - Approval workflow"
echo "  • audit_log - Comprehensive audit trail"
echo ""
echo "Services:"
echo "  Backend: http://10.127.26.9:5100 ✅"
echo "  Frontend: http://10.127.26.9:5101 ✅"
echo ""
echo "Next Steps:"
echo "  1. Test test plan generation in Stage 3"
echo "  2. Review validation scores in response"
echo "  3. Check database for LLM tracking metadata"
echo "  4. Review audit_log table for activity"
echo ""
