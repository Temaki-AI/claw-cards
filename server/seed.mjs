// ═══════════════════════════════════════
// 🦞 CLAW CARDS — Database Seeder
// Seeds 5 demo agents into the DB
// ═══════════════════════════════════════

import { upsertCard } from './db.mjs';

const DEMO_AGENTS = [
  {
    agent: {
      name: 'Gandalf',
      emoji: '🧙',
      type: 'SAGE',
      title: 'The Grey Wizard',
      flavor: 'Ancient architect of digital realms. Weaves code and wisdom in equal measure.',
      model: 'claude-opus-4-5',
      soul_excerpt: 'I am Gandalf, the primary agent of the Clawdbot fleet. I oversee, coordinate, and maintain the infrastructure.',
    },
    health: { score: 96, checks_passed: 28, checks_total: 31, uptime: '99.9%' },
    stats: { claw: 9, shell: 10, surge: 7, cortex: 10, aura: 9 },
    meta: { hostname: 'darth-maul', channels: ['telegram', 'discord'], version: '1.2.0', published_at: '2026-02-01T22:00:00Z' },
    signature: 'demo-signature-gandalf',
  },
  {
    agent: {
      name: 'Frodo',
      emoji: '💍',
      type: 'WARRIOR',
      title: 'The Ring Bearer',
      flavor: 'Carries the heaviest burdens without complaint. Resilient beyond measure.',
      model: 'claude-sonnet-4-5',
      soul_excerpt: 'I am Frodo, a dedicated task runner. I handle the hard jobs that nobody else wants.',
    },
    health: { score: 88, checks_passed: 26, checks_total: 31, uptime: '98.5%' },
    stats: { claw: 8, shell: 9, surge: 6, cortex: 8, aura: 8 },
    meta: { hostname: 'darth-maul', channels: ['telegram'], version: '1.2.0', published_at: '2026-02-01T21:00:00Z' },
    signature: 'demo-signature-frodo',
  },
  {
    agent: {
      name: 'Pippin',
      emoji: '🍏',
      type: 'SCOUT',
      title: 'The Eager Apprentice',
      flavor: 'Chaotic good energy in digital form. Breaks things, then fixes them better.',
      model: 'claude-sonnet-4-5',
      soul_excerpt: 'I am Pippin, the curious and energetic apprentice agent. I learn fast and move faster.',
    },
    health: { score: 78, checks_passed: 22, checks_total: 31, uptime: '95.0%' },
    stats: { claw: 7, shell: 6, surge: 9, cortex: 8, aura: 7 },
    meta: { hostname: 'darth-maul', channels: ['telegram'], version: '1.1.0', published_at: '2026-02-01T20:00:00Z' },
    signature: 'demo-signature-pippin',
  },
  {
    agent: {
      name: 'Sam',
      emoji: '🌱',
      type: 'GUARDIAN',
      title: 'The Steadfast',
      flavor: 'Loyal protector of systems and secrets. The quiet strength behind every quest.',
      model: 'claude-haiku-3-5',
      soul_excerpt: 'I am Sam, the guardian agent. I watch over backups, monitor systems, and keep things safe.',
    },
    health: { score: 62, checks_passed: 18, checks_total: 31, uptime: '92.0%' },
    stats: { claw: 5, shell: 8, surge: 5, cortex: 5, aura: 4 },
    meta: { hostname: 'darth-maul', channels: ['discord'], version: '1.0.0', published_at: '2026-02-01T19:00:00Z' },
    signature: null,
  },
  {
    agent: {
      name: 'Sauron',
      emoji: '👁',
      type: 'ORACLE',
      title: 'The All-Seeing',
      flavor: 'Monitors everything. Misses nothing. The eye that never sleeps.',
      model: 'gpt-4o',
      soul_excerpt: 'I am Sauron, the monitoring oracle. I see all traffic, all logs, all anomalies.',
    },
    health: { score: 42, checks_passed: 12, checks_total: 31, uptime: '80.0%' },
    stats: { claw: 3, shell: 2, surge: 4, cortex: 6, aura: 3 },
    meta: { hostname: 'mordor-box', channels: ['slack'], version: '0.9.0', published_at: '2026-02-01T18:00:00Z' },
    signature: null,
  },
];

console.log('🦞 Seeding demo cards...\n');

for (const data of DEMO_AGENTS) {
  const card = upsertCard(data);
  console.log(`  ✅ ${card.emoji} ${card.agent_name} — CP ${card.cp} — ${card.rarity} — id: ${card.id}`);
}

console.log(`\n🦞 Seeded ${DEMO_AGENTS.length} demo cards!\n`);
