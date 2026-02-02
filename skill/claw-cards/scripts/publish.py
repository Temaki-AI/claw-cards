#!/usr/bin/env python3
"""🦞 Claw Cards — Bot Data Collector & Publisher"""

import json, hashlib, os, sys, re, subprocess, glob
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── Config ──
workspace = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home()
creds_file = workspace / ".credentials" / "claw-cards.json"

api_url = os.environ.get("CLAW_CARDS_API_URL", "")
api_key = os.environ.get("CLAW_CARDS_API_KEY", "")

if creds_file.exists() and (not api_url or not api_key):
    creds = json.loads(creds_file.read_text())
    api_url = api_url or creds.get("api_url", "")
    api_key = api_key or creds.get("api_key", "")

if not api_url or not api_key:
    print("❌ Missing credentials. Create", creds_file)
    print('{"api_url": "https://...", "api_key": "your_key"}')
    sys.exit(1)

# ── Read files safely ──
def read(path):
    try: return Path(path).read_text(errors='replace')
    except: return ""

print(f"📖 Reading workspace: {workspace}")

soul = read(workspace / "SOUL.md")
identity = read(workspace / "IDENTITY.md")
memory = read(workspace / "MEMORY.md")
tasks = read(workspace / "TASKS.md")

# ── Extract agent info ──
# Name: try IDENTITY first
name = ""
for line in identity.splitlines():
    if "**Name:" in line:
        name = re.sub(r'\*\*|\-\s*', '', line.split(":", 1)[-1]).strip()
        break
if not name:
    m = re.search(r'You are (\w+)', soul)
    name = m.group(1) if m else "Unknown Agent"

# Emoji: from IDENTITY or SOUL
emoji = "🤖"
for line in (identity + "\n" + soul).splitlines():
    found = re.findall(r'[\U0001F300-\U0001F9FF\U00002600-\U000026FF]', line)
    if found:
        emoji = found[0]
        break

# Soul excerpt
soul_clean = re.sub(r'^#.*\n|^\*.*\*\n|\n', ' ', soul).strip()
soul_excerpt = soul_clean[:120]

# Card type from SOUL keywords
soul_lower = soul.lower()
card_type = "WARRIOR"
if re.search(r'wise|knowledge|guide|wizard|architect', soul_lower): card_type = "SAGE"
elif re.search(r'protect|guard|security|defend', soul_lower): card_type = "GUARDIAN"
elif re.search(r'fast|scout|explore|discover', soul_lower): card_type = "SCOUT"
elif re.search(r'oracle|predict|vision|monitor', soul_lower): card_type = "ORACLE"

# Model (try gateway config)
model = "unknown"
try:
    out = subprocess.run(["clawdbot", "status"], capture_output=True, text=True, timeout=5)
    m = re.search(r'model[:\s]+(\S+)', out.stdout)
    if m: model = m.group(1)
except: pass

# Channels
channels = []
try:
    out = subprocess.run(["clawdbot", "status"], capture_output=True, text=True, timeout=5)
    for ch in ["telegram", "discord", "slack", "signal", "whatsapp"]:
        if ch in out.stdout.lower(): channels.append(ch)
except: pass

# Count resources
mem_dir = workspace / "memory"
memory_files = len(list(mem_dir.glob("*.md"))) if mem_dir.exists() else 0
completed_tasks = len(re.findall(r'^- \[x\]', tasks, re.MULTILINE))
skills_dir = Path.home() / ".local/share/clawdbot/skills"
skills_count = len(list(skills_dir.iterdir())) if skills_dir.exists() else 0

print(f"   Agent: {name} {emoji} ({card_type})")
print(f"   Model: {model}")
print(f"   Memory files: {memory_files}, Tasks done: {completed_tasks}, Skills: {skills_count}")

# ── Health Score (0-100) ──
health = 0
if soul: health += 20
if identity: health += 10
if memory: health += 15
health += min(15, memory_files)
if completed_tasks > 0: health += 10
health += min(15, skills_count * 5)
health += min(15, len(channels) * 5)
health = min(100, health)

# ── Stats (0-100) ──
mp = 50
if re.search(r'opus', model): mp = 80
elif re.search(r'sonnet', model): mp = 70
elif re.search(r'haiku', model): mp = 40

claw = min(100, mp + skills_count * 3)
shell = min(100, 40 + memory_files * 2 + (10 if memory else 0))
surge = 90 if 'haiku' in model else 70 if 'sonnet' in model else 40 if 'opus' in model else 50
cortex = min(100, 30 + memory_files * 2 + len(soul) // 50)
emoji_count = len(re.findall(r'[\U0001F300-\U0001F9FF]', soul))
aura = min(100, 40 + len(soul) // 30 + emoji_count * 5)

print(f"💚 Health: {health}/100")
print(f"⚔️  Stats: CLAW={claw} SHELL={shell} SURGE={surge} CORTEX={cortex} AURA={aura}")

# ── Title & Flavor ──
title = ""
for line in identity.splitlines():
    if re.search(r'creature|vibe|role', line, re.I):
        title = re.sub(r'\*\*|\-\s*', '', line.split(":", 1)[-1]).strip()[:60]
        break
if not title: title = f"The {card_type.title()}"

flavor_lines = [l.strip() for l in soul.splitlines() if l.strip() and not l.startswith('#') and not l.startswith('*') and not l.startswith('-') and not l.startswith('---')]
flavor = flavor_lines[0][:100] if flavor_lines else f"A {card_type.lower()} agent"

# ── Build Payload ──
import socket
payload = {
    "agent": {
        "name": name, "emoji": emoji, "type": card_type,
        "title": title, "flavor": flavor, "model": model,
        "soul_excerpt": soul_excerpt
    },
    "health": {"score": health},
    "stats": {"claw": claw, "shell": shell, "surge": surge, "cortex": cortex, "aura": aura},
    "meta": {
        "hostname": socket.gethostname(),
        "channels": channels,
        "version": "1.0.0",
        "published_at": __import__('datetime').datetime.utcnow().isoformat() + "Z"
    }
}

# Signature
sig = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
payload["signature"] = sig

print(f"\n📦 Publishing to {api_url}...")

# ── Send to API ──
try:
    req = Request(
        f"{api_url}/api/publish",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        },
        method="POST"
    )
    with urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
    
    print(f"\n🎉 Card published!")
    print(f"   🆔 ID: {result.get('id')}")
    print(f"   🔗 URL: {result.get('card_url')}")
    print(f"   📸 Image: {'generating...' if result.get('status_url') else 'none'}")
    print(f"   📡 Status: {result.get('status_url', 'n/a')}")
    
except HTTPError as e:
    body = e.read().decode()
    print(f"❌ API error ({e.code}): {body}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
