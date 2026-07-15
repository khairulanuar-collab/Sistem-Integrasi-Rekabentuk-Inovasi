#!/bin/bash
# SIRI-AI JTM — persistent dev server supervisor
# Restarts the Next.js dev server if it dies. Used to keep the server alive
# between bash tool calls.
cd /home/z/my-project
set -a
source /home/z/my-project/.env
set +a
export NODE_OPTIONS="--max-old-space-size=2048"

while true; do
  echo "[$(date '+%H:%M:%S')] Starting Next.js dev server..."
  node node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1
  EXIT_CODE=$?
  echo "[$(date '+%H:%M:%S')] Dev server exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
