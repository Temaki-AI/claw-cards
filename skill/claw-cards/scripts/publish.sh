#!/usr/bin/env bash
set -euo pipefail

# Claw Cards Publisher
# Collects bot data from workspace and publishes a trading card

# ============================================================================
# Configuration
# ============================================================================

WORKSPACE="${AGENT_WORKSPACE:-$HOME}"
CREDS_FILE="$WORKSPACE/.credentials/claw-cards.json"

# Try to load credentials from file if env vars not set
if [[ -f "$CREDS_FILE" ]]; then
  API_URL="${CLAW_CARDS_API_URL:-$(jq -r '.api_url // empty' "$CREDS_FILE" 2>/dev/null || echo "")}"
  API_KEY="${CLAW_CARDS_API_KEY:-$(jq -r '.api_key // empty' "$CREDS_FILE" 2>/dev/null || echo "")}"
else
  API_URL="${CLAW_CARDS_API_URL:-}"
  API_KEY="${CLAW_CARDS_API_KEY:-}"
fi

if [[ -z "$API_URL" || -z "$API_KEY" ]]; then
  echo "❌ Error: Missing credentials"
  echo "Set environment variables CLAW_CARDS_API_URL and CLAW_CARDS_API_KEY"
  echo "Or create $CREDS_FILE with:"
  echo '{"api_url": "https://api.example.com", "api_key": "your_key"}'
  exit 1
fi

# ============================================================================
# Data Collection Functions
# ============================================================================

read_file_safe() {
  local file="$1"
  if [[ -f "$file" ]]; then
    cat "$file"
  else
    echo ""
  fi
}

extract_emoji() {
  # Extract first emoji from text
  grep -oP '[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{26FF}]' <<< "$1" | head -1 || echo "🤖"
}

extract_first_line() {
  echo "$1" | head -1 | sed 's/^#* *//'
}

count_files() {
  local pattern="$1"
  find "$WORKSPACE" -type f -name "$pattern" 2>/dev/null | wc -l
}

count_completed_tasks() {
  local tasks_file="$WORKSPACE/TASKS.md"
  if [[ -f "$tasks_file" ]]; then
    grep -c "^- \[x\]" "$tasks_file" 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

get_config_value() {
  local key="$1"
  clawdbot gateway config.get "$key" 2>/dev/null || echo ""
}

# ============================================================================
# Read Workspace Files
# ============================================================================

echo "📖 Reading workspace data from $WORKSPACE..."

SOUL=$(read_file_safe "$WORKSPACE/SOUL.md")
IDENTITY=$(read_file_safe "$WORKSPACE/IDENTITY.md")
MEMORY=$(read_file_safe "$WORKSPACE/MEMORY.md")
TASKS=$(read_file_safe "$WORKSPACE/TASKS.md")

# Extract agent info
AGENT_NAME=$(extract_first_line "$SOUL")
[[ -z "$AGENT_NAME" ]] && AGENT_NAME=$(extract_first_line "$IDENTITY")
[[ -z "$AGENT_NAME" ]] && AGENT_NAME="Unknown Agent"

AGENT_EMOJI=$(extract_emoji "$SOUL")
[[ -z "$AGENT_EMOJI" ]] && AGENT_EMOJI="🤖"

# Get soul excerpt (first 100 chars, clean)
SOUL_EXCERPT=$(echo "$SOUL" | tr -d '\n' | sed 's/^#* *//' | cut -c1-100)

# Determine card type from SOUL keywords
CARD_TYPE="WARRIOR"
SOUL_LOWER=$(echo "$SOUL" | tr '[:upper:]' '[:lower:]')
if echo "$SOUL_LOWER" | grep -qE "wise|knowledge|guide|teach|learn"; then
  CARD_TYPE="SAGE"
elif echo "$SOUL_LOWER" | grep -qE "protect|guard|security|safe|defend"; then
  CARD_TYPE="GUARDIAN"
elif echo "$SOUL_LOWER" | grep -qE "fast|scout|explore|discover|search"; then
  CARD_TYPE="SCOUT"
elif echo "$SOUL_LOWER" | grep -qE "oracle|predict|vision|future|divine"; then
  CARD_TYPE="ORACLE"
fi

# Get model and channels from config
MODEL=$(get_config_value "model" || echo "unknown")
CHANNELS_RAW=$(get_config_value "channels" || echo "[]")
CHANNELS=$(echo "$CHANNELS_RAW" | jq -c 'if type == "array" then . else [] end' 2>/dev/null || echo "[]")

# Count resources
MEMORY_FILES=$(count_files "*.md" | grep -oE '[0-9]+' || echo "0")
COMPLETED_TASKS=$(count_completed_tasks)
SKILLS_COUNT=$(ls -1 "$HOME/.local/share/clawdbot/skills" 2>/dev/null | wc -l || echo "0")

# ============================================================================
# Calculate Health Score (0-100)
# ============================================================================

HEALTH_SCORE=0

[[ -n "$SOUL" ]] && HEALTH_SCORE=$((HEALTH_SCORE + 20))
[[ -n "$IDENTITY" ]] && HEALTH_SCORE=$((HEALTH_SCORE + 10))
[[ -n "$MEMORY" ]] && HEALTH_SCORE=$((HEALTH_SCORE + 15))

# Memory files (max +15)
MEM_BONUS=$((MEMORY_FILES > 15 ? 15 : MEMORY_FILES))
HEALTH_SCORE=$((HEALTH_SCORE + MEM_BONUS))

# Completed tasks (+10 if any)
[[ "$COMPLETED_TASKS" -gt 0 ]] && HEALTH_SCORE=$((HEALTH_SCORE + 10))

# Skills (max +15)
SKILLS_BONUS=$((SKILLS_COUNT * 5))
[[ $SKILLS_BONUS -gt 15 ]] && SKILLS_BONUS=15
HEALTH_SCORE=$((HEALTH_SCORE + SKILLS_BONUS))

# Channels (max +15)
CHANNEL_COUNT=$(echo "$CHANNELS" | jq 'length' 2>/dev/null || echo "0")
CHANNEL_BONUS=$((CHANNEL_COUNT * 5))
[[ $CHANNEL_BONUS -gt 15 ]] && CHANNEL_BONUS=15
HEALTH_SCORE=$((HEALTH_SCORE + CHANNEL_BONUS))

echo "💚 Health Score: $HEALTH_SCORE/100"

# ============================================================================
# Calculate Stats (0-100 each)
# ============================================================================

# CLAW (attack/capability) - based on model power + skills
MODEL_POWER=50
[[ "$MODEL" =~ opus|gpt-4|claude-3 ]] && MODEL_POWER=80
[[ "$MODEL" =~ sonnet ]] && MODEL_POWER=70
[[ "$MODEL" =~ haiku|gpt-3.5 ]] && MODEL_POWER=40
STAT_CLAW=$((MODEL_POWER + SKILLS_COUNT * 3))
[[ $STAT_CLAW -gt 100 ]] && STAT_CLAW=100

# SHELL (defense/reliability) - based on memory organization
STAT_SHELL=$((40 + MEMORY_FILES * 2))
[[ -n "$MEMORY" ]] && STAT_SHELL=$((STAT_SHELL + 10))
[[ $STAT_SHELL -gt 100 ]] && STAT_SHELL=100

# SURGE (speed) - based on model type
STAT_SURGE=50
[[ "$MODEL" =~ haiku ]] && STAT_SURGE=90
[[ "$MODEL" =~ sonnet ]] && STAT_SURGE=70
[[ "$MODEL" =~ opus ]] && STAT_SURGE=40
[[ "$MODEL" =~ gpt-4 ]] && STAT_SURGE=60

# CORTEX (intelligence) - based on memory + soul complexity
SOUL_LENGTH=${#SOUL}
STAT_CORTEX=$((30 + MEMORY_FILES * 2 + SOUL_LENGTH / 50))
[[ $STAT_CORTEX -gt 100 ]] && STAT_CORTEX=100

# AURA (personality) - based on soul richness
EMOJI_COUNT=$(grep -oP '[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{26FF}]' <<< "$SOUL" | wc -l || echo "0")
STAT_AURA=$((40 + SOUL_LENGTH / 30 + EMOJI_COUNT * 5))
[[ $STAT_AURA -gt 100 ]] && STAT_AURA=100

echo "⚔️  Stats: CLAW=$STAT_CLAW SHELL=$STAT_SHELL SURGE=$STAT_SURGE CORTEX=$STAT_CORTEX AURA=$STAT_AURA"

# ============================================================================
# Build Payload
# ============================================================================

HOSTNAME=$(hostname)
VERSION="1.0.0"
PUBLISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Extract title from first sentence of SOUL or IDENTITY
TITLE=$(echo "$SOUL $IDENTITY" | grep -oP '^[^.!?]{0,50}' | head -1 | sed 's/^#* *//' || echo "$AGENT_NAME")

# Generate flavor text (creative description)
FLAVOR="A $CARD_TYPE agent powered by $MODEL"

# Build JSON payload (sorted keys for consistent signature)
PAYLOAD=$(jq -n \
  --arg name "$AGENT_NAME" \
  --arg emoji "$AGENT_EMOJI" \
  --arg type "$CARD_TYPE" \
  --arg title "$TITLE" \
  --arg flavor "$FLAVOR" \
  --arg model "$MODEL" \
  --arg soul_excerpt "$SOUL_EXCERPT" \
  --argjson health "$HEALTH_SCORE" \
  --argjson claw "$STAT_CLAW" \
  --argjson shell "$STAT_SHELL" \
  --argjson surge "$STAT_SURGE" \
  --argjson cortex "$STAT_CORTEX" \
  --argjson aura "$STAT_AURA" \
  --arg hostname "$HOSTNAME" \
  --argjson channels "$CHANNELS" \
  --arg version "$VERSION" \
  --arg published_at "$PUBLISHED_AT" \
  '{
    agent: {
      name: $name,
      emoji: $emoji,
      type: $type,
      title: $title,
      flavor: $flavor,
      model: $model,
      soul_excerpt: $soul_excerpt
    },
    health: {
      score: $health
    },
    stats: {
      claw: $claw,
      shell: $shell,
      surge: $surge,
      cortex: $cortex,
      aura: $aura
    },
    meta: {
      hostname: $hostname,
      channels: $channels,
      version: $version,
      published_at: $published_at
    }
  }' | jq -S .)

# Generate SHA-256 signature
SIGNATURE=$(echo -n "$PAYLOAD" | shasum -a 256 | cut -d' ' -f1)

# Add signature to payload
FINAL_PAYLOAD=$(echo "$PAYLOAD" | jq --arg sig "$SIGNATURE" '. + {signature: $sig}')

echo ""
echo "📦 Payload prepared:"
echo "$FINAL_PAYLOAD" | jq .

# ============================================================================
# Publish to API
# ============================================================================

echo ""
echo "🚀 Publishing to $API_URL/api/publish..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "$FINAL_PAYLOAD" \
  "$API_URL/api/publish")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
  echo "✅ Success!"
  echo "$BODY" | jq .
  
  # Try to extract card URL
  CARD_URL=$(echo "$BODY" | jq -r '.card_url // .url // empty' 2>/dev/null)
  [[ -n "$CARD_URL" ]] && echo "🎴 Card URL: $CARD_URL"
else
  echo "❌ Failed (HTTP $HTTP_CODE)"
  echo "$BODY"
  exit 1
fi
