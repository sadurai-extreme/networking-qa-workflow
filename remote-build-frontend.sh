#!/bin/bash
# Build frontend for NOS QA Workflow Dashboard

echo "Loading NVM..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 18

echo "Building frontend..."
cd ~/networking-qa-workflow/frontend
npm run build

echo "Build complete!"
ls -lh dist/
