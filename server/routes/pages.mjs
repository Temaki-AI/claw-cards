// ═══════════════════════════════════════
// 🦞 CLAWD VAULT — Page Routes
// Server-rendered HTML with OG tags
// ═══════════════════════════════════════

import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getCardById, listAllCards, computeCP } from '../db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIEWS = join(__dirname, '..', 'views');

// Load templates at startup
const cardTemplate = readFileSync(join(VIEWS, 'card.html'), 'utf-8');
const galleryTemplate = readFileSync(join(VIEWS, 'gallery.html'), 'utf-8');

const router = Router();

// ─── GET / — Landing ───
router.get('/', (req, res) => {
  res.redirect('/gallery');
});

// ─── GET /card/:id — Single Card Page (the MONEY page) ───
router.get('/card/:id', (req, res) => {
  const card = getCardById(req.params.id);
  if (!card) {
    return res.status(404).send(notFoundPage());
  }

  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const imageUrl = card.has_image
    ? `${baseUrl}/images/${card.id}.png`
    : `${baseUrl}/og-placeholder.png`;
  const cardUrl = `${baseUrl}/card/${card.id}`;
  const rarityClass = rarityToClass(card.rarity);
  const channels = safeParseJSON(card.channels, []);

  let html = cardTemplate
    .replace(/\{\{OG_TITLE\}\}/g, escHtml(`${card.agent_name} — Clawd Vault | CP ${card.cp}`))
    .replace(/\{\{OG_DESCRIPTION\}\}/g, escHtml(card.flavor || `A ${card.rarity} tier Clawd Vault card`))
    .replace(/\{\{OG_IMAGE\}\}/g, escHtml(imageUrl))
    .replace(/\{\{OG_URL\}\}/g, escHtml(cardUrl))
    .replace(/\{\{CARD_TITLE\}\}/g, escHtml(`${card.emoji || '🦞'} ${card.agent_name} — Clawd Vault`))
    .replace(/\{\{CARD_DATA\}\}/g, JSON.stringify({
      name: card.agent_name,
      emoji: card.emoji,
      type: card.type,
      title: card.title,
      flavor: card.flavor,
      model: card.model,
      score: card.score,
      stats: {
        claw: card.stats_claw,
        shell: card.stats_shell,
        surge: card.stats_surge,
        cortex: card.stats_cortex,
        aura: card.stats_aura,
      },
      number: card.id.slice(-3).padStart(3, '0'),
      signature: card.signature,
      hostname: card.hostname,
      channels,
      rarity: card.rarity,
      cp: card.cp,
      has_image: !!card.has_image,
      image_url: card.has_image ? `/images/${card.id}.png` : null,
    }))
    .replace(/\{\{BASE_URL\}\}/g, baseUrl)
    .replace(/\{\{CARD_ID\}\}/g, escHtml(card.id));

  res.type('html').send(html);
});

// ─── GET /gallery — Browse All Cards ───
router.get('/gallery', (req, res) => {
  const { sort = 'cp', rarity } = req.query;
  const result = listAllCards({ sort, limit: 200, offset: 0, rarity });
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

  const cardsJson = result.cards.map(card => ({
    id: card.id,
    agent_name: card.agent_name,
    emoji: card.emoji,
    type: card.type,
    title: card.title,
    flavor: card.flavor,
    score: card.score,
    cp: card.cp,
    rarity: card.rarity,
    has_image: !!card.has_image,
    image_url: card.has_image ? `/images/${card.id}.png` : null,
    signature: card.signature,
    stats: {
      claw: card.stats_claw,
      shell: card.stats_shell,
      surge: card.stats_surge,
      cortex: card.stats_cortex,
      aura: card.stats_aura,
    },
  }));

  let html = galleryTemplate
    .replace(/\{\{CARDS_DATA\}\}/g, JSON.stringify(cardsJson))
    .replace(/\{\{TOTAL\}\}/g, result.total)
    .replace(/\{\{BASE_URL\}\}/g, baseUrl);

  res.type('html').send(html);
});

// ─── Helpers ───

function rarityToClass(rarity) {
  return (rarity || 'HATCHLING').toLowerCase();
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function notFoundPage() {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>🦞 Card Not Found</title>
<style>
body{background:#0a0c14;color:#e2e8f0;font-family:-apple-system,sans-serif;
display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}
h1{font-size:4rem;margin-bottom:1rem}
p{color:#64748b;margin-bottom:2rem}
a{color:#60a5fa;text-decoration:none}a:hover{text-decoration:underline}
</style></head>
<body><div><h1>🦞</h1><p>Card not found in the deep...</p><a href="/gallery">← Back to Gallery</a></div></body></html>`;
}

export default router;
