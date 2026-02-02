// ═══════════════════════════════════════
// 🦞 CLAWV — Database Layer
// SQLite via sql.js (pure JS, no native deps)
// ═══════════════════════════════════════

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const DB_PATH = join(DATA_DIR, 'cards.db');

// Ensure data dirs exist (supports Railway volume mounts)
mkdirSync(join(DATA_DIR, 'images'), { recursive: true });

export { DATA_DIR };

// Initialize sql.js
const SQL = await initSqlJs();
let db;

if (existsSync(DB_PATH)) {
  const buf = readFileSync(DB_PATH);
  db = new SQL.Database(buf);
} else {
  db = new SQL.Database();
}

// Save helper — call after writes
function save() {
  const data = db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

// ─── Schema ───
// Helper to check if column exists
function columnExists(tableName, columnName) {
  const result = db.exec(`PRAGMA table_info(${tableName})`);
  if (!result || !result[0]) return false;
  const columns = result[0].values.map(row => row[1]); // column name is at index 1
  return columns.includes(columnName);
}

// Users table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// API Keys table
db.run(`
  CREATE TABLE IF NOT EXISTS api_keys (
    key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bot_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`);

// Cards table
db.run(`
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    emoji TEXT,
    type TEXT,
    title TEXT,
    flavor TEXT,
    model TEXT,
    soul_excerpt TEXT,
    score INTEGER,
    cp INTEGER,
    stats_claw INTEGER,
    stats_shell INTEGER,
    stats_surge INTEGER,
    stats_cortex INTEGER,
    stats_aura INTEGER,
    hostname TEXT,
    channels TEXT,
    version TEXT,
    signature TEXT,
    has_image INTEGER DEFAULT 0,
    rarity TEXT,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migrations - Add new columns if they don't exist
if (!columnExists('cards', 'user_id')) {
  db.run(`ALTER TABLE cards ADD COLUMN user_id TEXT`);
}
if (!columnExists('cards', 'api_key')) {
  db.run(`ALTER TABLE cards ADD COLUMN api_key TEXT`);
}
if (!columnExists('cards', 'bot_id')) {
  db.run(`ALTER TABLE cards ADD COLUMN bot_id TEXT`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_bot_id ON cards(bot_id)`);
}

db.run(`CREATE INDEX IF NOT EXISTS idx_cards_cp ON cards(cp DESC)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_cards_published ON cards(published_at DESC)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id)`);
save();

// ─── Helpers ───

export function computeCP(score, stats) {
  const sum = (stats.claw || 0) + (stats.shell || 0) + (stats.surge || 0) +
              (stats.cortex || 0) + (stats.aura || 0);
  return Math.min(1000, Math.round((score + sum * 2) * 5));
}

export function computeRarity(score) {
  if (score >= 95) return 'LEVIATHAN';
  if (score >= 85) return 'ALPHA';
  if (score >= 70) return 'ADULT';
  if (score >= 50) return 'JUVENILE';
  return 'HATCHLING';
}

// ─── Helper to convert sql.js results to objects ───
function rowsToObjects(result) {
  if (!result || !result[0]) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

function queryOne(sql, params = []) {
  const result = db.exec(sql, params);
  const rows = rowsToObjects(result);
  return rows[0] || null;
}

function queryAll(sql, params = []) {
  const result = db.exec(sql, params);
  return rowsToObjects(result);
}

// ─── Short Hash ───
function shortHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h = ((h << 5) - h) + ch;
    h |= 0;
  }
  return Math.abs(h).toString(36).slice(0, 6);
}

// ─── User & Auth Helpers ───

export function createUser(id, email, passwordHash) {
  db.run('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [id, email, passwordHash]);
  save();
  return queryOne('SELECT id, email, created_at FROM users WHERE id = ?', [id]);
}

export function getUserByEmail(email) {
  return queryOne('SELECT * FROM users WHERE email = ?', [email]);
}

export function createApiKey(key, userId, botName) {
  db.run('INSERT INTO api_keys (key, user_id, bot_name) VALUES (?, ?, ?)', [key, userId, botName]);
  save();
  return queryOne('SELECT key, user_id, bot_name, created_at FROM api_keys WHERE key = ?', [key]);
}

export function getApiKey(key) {
  return queryOne('SELECT * FROM api_keys WHERE key = ?', [key]);
}

export function updateApiKeyLastUsed(key) {
  db.run('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key = ?', [key]);
  save();
}

// ─── Exports ───

export function upsertCard(data, userId = null, apiKey = null) {
  const { agent, health, stats, meta, signature } = data;
  const score = health?.score || 0;
  const cpVal = computeCP(score, stats || {});
  const rarityVal = computeRarity(score);

  const slug = (agent.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const now = meta?.published_at || new Date().toISOString();

  // Bot ID: if provided, find existing card to update. Otherwise create new.
  const botId = data.bot_id || null;
  let id;
  let existingCard = null;

  if (botId) {
    // Look up existing card by bot_id
    existingCard = queryOne('SELECT * FROM cards WHERE bot_id = ?', [botId]);
    if (existingCard) {
      id = existingCard.id; // Keep the same card ID
    }
  }

  if (!id) {
    // New card — generate fresh ID and bot_id
    const hash = shortHash(JSON.stringify(data) + Date.now());
    id = `${slug}-${hash}`;
  }

  // Generate a new bot_id if this is a new card
  const finalBotId = botId || randomBytes(16).toString('hex');

  db.run(`
    INSERT INTO cards (id, agent_name, emoji, type, title, flavor, model, soul_excerpt,
      score, cp, stats_claw, stats_shell, stats_surge, stats_cortex, stats_aura,
      hostname, channels, version, signature, rarity, user_id, api_key, bot_id, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      agent_name=excluded.agent_name, emoji=excluded.emoji, type=excluded.type,
      title=excluded.title, flavor=excluded.flavor, model=excluded.model,
      soul_excerpt=excluded.soul_excerpt, score=excluded.score, cp=excluded.cp,
      stats_claw=excluded.stats_claw, stats_shell=excluded.stats_shell,
      stats_surge=excluded.stats_surge, stats_cortex=excluded.stats_cortex,
      stats_aura=excluded.stats_aura, hostname=excluded.hostname,
      channels=excluded.channels, version=excluded.version,
      signature=excluded.signature, rarity=excluded.rarity,
      updated_at=CURRENT_TIMESTAMP
  `, [
    id, agent.name, agent.emoji || '🦞', agent.type || 'WARRIOR',
    agent.title || '', agent.flavor || '', agent.model || '', agent.soul_excerpt || '',
    score, cpVal,
    stats?.claw || 0, stats?.shell || 0, stats?.surge || 0, stats?.cortex || 0, stats?.aura || 0,
    meta?.hostname || '', JSON.stringify(meta?.channels || []), meta?.version || '',
    signature || null, rarityVal, userId, apiKey, finalBotId, now
  ]);
  save();

  const row = queryOne('SELECT * FROM cards WHERE id = ?', [id]);
  return row;
}

export function getCardById(id) {
  return queryOne('SELECT * FROM cards WHERE id = ?', [id]);
}

export function markCardImage(id) {
  db.run('UPDATE cards SET has_image = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  save();
}

export function listAllCards({ sort = 'cp', limit = 50, offset = 0, rarity = null } = {}) {
  const lim = Math.min(Math.max(1, Number(limit) || 50), 200);
  const off = Math.max(0, Number(offset) || 0);

  const orderMap = {
    cp: 'cp DESC',
    newest: 'published_at DESC',
    rarity: 'score DESC, cp DESC',
  };
  const order = orderMap[sort] || orderMap.cp;

  let rows, total;
  if (rarity) {
    const r = rarity.toUpperCase();
    rows = queryAll(`SELECT * FROM cards WHERE rarity = ? ORDER BY ${order} LIMIT ? OFFSET ?`, [r, lim, off]);
    total = queryOne('SELECT COUNT(*) as total FROM cards WHERE rarity = ?', [r])?.total || 0;
  } else {
    rows = queryAll(`SELECT * FROM cards ORDER BY ${order} LIMIT ? OFFSET ?`, [lim, off]);
    total = queryOne('SELECT COUNT(*) as total FROM cards', [])?.total || 0;
  }

  return { cards: rows, total, limit: lim, offset: off };
}

export function deleteCard(id) {
  const card = queryOne('SELECT * FROM cards WHERE id = ?', [id]);
  if (!card) return null;

  // Remove image files
  const pngPath = join(DATA_DIR, 'images', `${id}.png`);
  const jpgPath = join(DATA_DIR, 'images', `${id}.jpg`);
  try { if (existsSync(pngPath)) unlinkSync(pngPath); } catch {}
  try { if (existsSync(jpgPath)) unlinkSync(jpgPath); } catch {}

  db.run('DELETE FROM cards WHERE id = ?', [id]);
  save();
  return card;
}

export default db;
