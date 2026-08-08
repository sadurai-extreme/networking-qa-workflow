#!/bin/bash
# Restart NOS QA Workflow Dashboard

echo "Stopping existing services..."
pkill -f 'node src/server.js' 2>/dev/null
pkill -f 'serve dist' 2>/dev/null
sleep 2

echo "Loading NVM..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 16

echo "Starting backend on port 5100..."
cd ~/networking-qa-workflow/backend
node src/server.js > backend.log 2>&1 &
BACKEND_PID=$!

echo "Starting frontend on port 5101..."
cd ~/networking-qa-workflow/frontend
npx serve dist -l 5101 -n > frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Waiting for services to start..."
sleep 5

echo "Services started:"
echo "  Backend PID: $BACKEND_PID"
echo "  Frontend PID: $FRONTEND_PID"
echo ""
echo "Checking ports..."
netstat -tlnp 2>/dev/null | grep -E "5100|5101"
