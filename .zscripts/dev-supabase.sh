#!/bin/bash
cd /home/z/my-project
pkill -f "next-server" 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 2
set -a
source /home/z/my-project/.env
set +a
export NODE_OPTIONS="--max-old-space-size=3072"
exec node node_modules/.bin/next dev -p 3000
