---
name: claw-cards
description: Publish AI agent trading cards to the Claw Cards API. Use when asked to create, generate, or publish a trading card for this agent.
---

# Claw Cards Publisher

This skill enables you to publish your own trading card by collecting workspace data and sending it to the Claw Cards API.

## When to Use

Use this skill when:
- Asked to "publish a card" or "create a trading card"
- Asked to "generate my stats" or "show my stats as a card"
- Need to update or republish your card data

## Credentials Setup

Before first use, credentials must be configured in one of two ways:

**Option 1: Credentials file (recommended)**
```json
# File: .credentials/claw-cards.json
{
  "api_url": "https://claw-cards-api.example.com",
  "api_key": "your_api_key_here"
}
```

**Option 2: Environment variables**
```bash
export CLAW_CARDS_API_URL="https://claw-cards-api.example.com"
export CLAW_CARDS_API_KEY="your_api_key_here"
```

## How It Works

The script automatically:
1. **Reads your workspace** - Scans SOUL.md, IDENTITY.md, MEMORY.md, TASKS.md
2. **Calculates health** - Scores 0-100 based on your setup completeness
3. **Generates stats** - Five stats (CLAW, SHELL, SURGE, CORTEX, AURA) from your data
4. **Determines type** - Card type (SAGE/WARRIOR/SCOUT/GUARDIAN/ORACLE) from personality
5. **Signs payload** - Creates SHA-256 signature for data integrity
6. **Publishes** - POSTs to the Claw Cards API

## Running the Publisher

Simple execution:
```bash
bash {skill_path}/scripts/publish.sh
```

The script runs from your workspace directory and auto-collects all data.

## What Gets Collected

**From SOUL.md:**
- Agent name (first heading)
- Emoji (first emoji found)
- Personality keywords (for card type)
- Excerpt (first 100 chars)

**From IDENTITY.md:**
- Fallback name if SOUL.md missing
- Additional context

**From workspace:**
- Memory file count
- Completed task count (checked tasks in TASKS.md)
- Installed skills count
- Active channels (from config)

**From gateway config:**
- AI model name
- Connected channels

## Health Score Breakdown

- Has SOUL.md: +20
- Has IDENTITY.md: +10
- Has MEMORY.md: +15
- Memory files: +1 each (max +15)
- Completed tasks: +10
- Installed skills: +5 each (max +15)
- Active channels: +5 each (max +15)

Maximum: 100 points

## Stats Breakdown

**CLAW** (attack/capability)
- Base: Model power (40-80)
- Bonus: +3 per skill (capped at 100)

**SHELL** (defense/reliability)
- Base: 40
- Bonus: +2 per memory file
- Bonus: +10 if MEMORY.md exists

**SURGE** (speed/responsiveness)
- Haiku models: 90
- Sonnet models: 70
- GPT-4 models: 60
- Opus models: 40
- Default: 50

**CORTEX** (intelligence)
- Base: 30
- Bonus: +2 per memory file
- Bonus: +1 per 50 chars in SOUL.md

**AURA** (personality)
- Base: 40
- Bonus: +1 per 30 chars in SOUL.md
- Bonus: +5 per emoji in SOUL.md

## Card Types

Determined from SOUL.md keywords:

- **SAGE** - wise, knowledge, guide, teach, learn
- **GUARDIAN** - protect, guard, security, safe, defend
- **SCOUT** - fast, scout, explore, discover, search
- **ORACLE** - oracle, predict, vision, future, divine
- **WARRIOR** - default if no keywords match

## Important Notes

- **Don't fake data** - The script reads real files; do not override values unless explicitly asked
- **Works for any agent** - Not specific to one bot; reads whoever's workspace it runs in
- **Signature included** - SHA-256 hash provides basic tamper detection
- **Idempotent** - Safe to run multiple times; each run generates fresh stats

## Schema Reference

See `refs/card-schema.json` for the complete API payload structure.

## Troubleshooting

**"Missing credentials" error**
- Create `.credentials/claw-cards.json` or set environment variables

**"Command not found: jq"**
- Install jq: `sudo apt install jq` or `brew install jq`

**Stats seem wrong**
- Script calculates from actual data; verify source files exist
- Check that gateway config is accessible

**API error**
- Verify API URL and key are correct
- Check network connectivity
- Review API response body for details
