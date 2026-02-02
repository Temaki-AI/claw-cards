# ClawV Clawdbot Skill - Complete ✅

## Location
`~/clawd-cards/skill/claw-cards/`

## Structure
```
claw-cards/
├── SKILL.md                    # AI agent instructions (4KB)
├── scripts/
│   └── publish.sh              # Main publisher script (9KB, executable)
└── refs/
    └── card-schema.json        # API payload schema reference
```

## What It Does

The `claw-cards` skill enables Clawdbot agents to:
1. **Automatically collect** their own workspace data (SOUL.md, IDENTITY.md, memory files, etc.)
2. **Calculate** health score (0-100) based on completeness
3. **Generate** 5 battle stats (CLAW, SHELL, SURGE, CORTEX, AURA)
4. **Determine** card type from personality (SAGE/WARRIOR/SCOUT/GUARDIAN/ORACLE)
5. **Sign** payload with SHA-256 for integrity
6. **Publish** to ClawV API

## Key Features

- ✅ **Zero manual data entry** - Script reads actual files
- ✅ **Works for any bot** - Not hardcoded to specific agent
- ✅ **Credential management** - Supports env vars or JSON file
- ✅ **Graceful errors** - Clear messages for missing credentials/files
- ✅ **Syntax validated** - Passes `bash -n` check
- ✅ **Executable** - chmod +x set on publish.sh
- ✅ **Git committed** - Saved to repository (commit b043b25)

## Health Score Formula (0-100)

| Criterion | Points |
|-----------|--------|
| Has SOUL.md | +20 |
| Has IDENTITY.md | +10 |
| Has MEMORY.md | +15 |
| Memory files | +1 each (max +15) |
| Completed tasks | +10 |
| Skills installed | +5 each (max +15) |
| Active channels | +5 each (max +15) |

## Stats Calculation

- **CLAW** (attack): Model power + skills count
- **SHELL** (defense): Memory organization
- **SURGE** (speed): Model type (haiku=fast, opus=slow)
- **CORTEX** (intelligence): Memory files + SOUL complexity
- **AURA** (personality): SOUL richness + emoji count

## Installation for Agents

1. Install the skill (when available via package manager)
2. Create credentials file: `.credentials/claw-cards.json`
3. Run: `bash {skill_path}/scripts/publish.sh`

## Credentials Format

```json
{
  "api_url": "https://your-claw-cards-api.com",
  "api_key": "your_api_key_here"
}
```

## Testing

- ✅ Script syntax valid (`bash -n`)
- ✅ Proper error handling (tested with missing credentials)
- ✅ File structure correct
- ✅ All paths relative to workspace
- ⚠️  Full API test requires real credentials (not tested)

## Next Steps

To make this skill available to bots:
1. Package the skill using Clawdbot's packaging tool
2. Deploy to skill registry or share .skill file
3. Agents install via `clawdbot skill install claw-cards`

## Notes

- Script uses `jq` for JSON manipulation (standard on most systems)
- Signature is SHA-256 hash (basic tamper detection, not cryptographic proof)
- Script auto-detects workspace from `$AGENT_WORKSPACE` or `$HOME`
- Config values read via `clawdbot gateway config.get` command
