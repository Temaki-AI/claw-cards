#!/bin/bash
# 🦞 Claw Cards — Production Runner
# Starts server + Cloudflare tunnel

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
CREDS_FILE="${CREDS_FILE:-/home/fmfamaral/clawd-agents/pippin/.credentials/fireworks.json}"
LOG_DIR="/tmp"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🦞 Claw Cards — Production Startup${NC}"

# Kill existing processes
pkill -f "node.*index.mjs.*3333" 2>/dev/null
pkill -f "cloudflared.*3333" 2>/dev/null
sleep 1

# Load Fireworks API key
if [ -f "$CREDS_FILE" ]; then
  FIREWORKS_API_KEY=$(python3 -c "import json; print(json.load(open('$CREDS_FILE'))['apiKey'])")
  export FIREWORKS_API_KEY
  echo -e "${GREEN}✅ Fireworks API key loaded${NC}"
else
  echo -e "${RED}❌ No credentials file at $CREDS_FILE${NC}"
  echo "   Set FIREWORKS_API_KEY env var manually or create the file"
fi

# Install deps if needed
cd "$SERVER_DIR"
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Start server
export PORT=3333
nohup node index.mjs > "$LOG_DIR/claw-cards.log" 2>&1 &
SERVER_PID=$!
echo -e "${GREEN}✅ Server started (PID: $SERVER_PID)${NC}"
sleep 2

# Start Cloudflare tunnel
if command -v cloudflared &>/dev/null || [ -x "$HOME/.local/bin/cloudflared" ]; then
  CF_BIN="${HOME}/.local/bin/cloudflared"
  [ ! -x "$CF_BIN" ] && CF_BIN="cloudflared"
  nohup "$CF_BIN" tunnel --url http://localhost:3333 --no-autoupdate > "$LOG_DIR/cf-tunnel.log" 2>&1 &
  TUNNEL_PID=$!
  echo -e "${GREEN}✅ Cloudflare tunnel started (PID: $TUNNEL_PID)${NC}"
  sleep 8
  TUNNEL_URL=$(grep -o 'https://[^ ]*trycloudflare.com' "$LOG_DIR/cf-tunnel.log" | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    echo -e "${CYAN}🌐 Public URL: $TUNNEL_URL${NC}"
    echo -e "${CYAN}🖼️  Gallery:    $TUNNEL_URL/gallery${NC}"
    echo -e "${CYAN}📡 API:        $TUNNEL_URL/api/cards${NC}"
    # Update BASE_URL for the server
    kill $SERVER_PID 2>/dev/null
    sleep 1
    BASE_URL="$TUNNEL_URL" nohup node index.mjs > "$LOG_DIR/claw-cards.log" 2>&1 &
    SERVER_PID=$!
    echo -e "${GREEN}✅ Server restarted with public BASE_URL${NC}"
  else
    echo -e "${RED}⚠️  Tunnel started but URL not found yet. Check $LOG_DIR/cf-tunnel.log${NC}"
  fi
else
  echo -e "${RED}⚠️  cloudflared not found — server running locally only${NC}"
  echo -e "${CYAN}🖼️  Gallery: http://localhost:3333/gallery${NC}"
fi

echo ""
echo -e "${CYAN}📋 Logs: tail -f $LOG_DIR/claw-cards.log${NC}"
echo -e "${CYAN}🔗 Tunnel: tail -f $LOG_DIR/cf-tunnel.log${NC}"
echo ""
echo -e "${GREEN}🦞 Claw Cards is live!${NC}"
