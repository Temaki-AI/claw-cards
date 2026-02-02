// ═══════════════════════════════════════
// 🦞 CLAW CARDS — API Routes
// ═══════════════════════════════════════

import { Router } from 'express';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { upsertCard, getCardById, markCardImage, listAllCards } from '../db.mjs';
import { generatePrompt } from '../prompt.mjs';
import { requireApiKey } from '../middleware/auth.mjs';
import { generateCardImageAsync } from '../imagegen.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, '..', 'data', 'images');

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: IMAGES_DIR,
  filename: (req, file, cb) => {
    const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    cb(null, `${req.params.id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPG images allowed'), false);
    }
  },
});

const router = Router();

// ─── POST /api/publish ───
router.post('/publish', requireApiKey, (req, res) => {
  try {
    const data = req.body;

    // Validate required fields
    if (!data.agent?.name) {
      return res.status(400).json({ error: 'agent.name is required' });
    }
    if (!data.health || typeof data.health.score !== 'number') {
      return res.status(400).json({ error: 'health.score is required' });
    }
    if (!data.stats) {
      return res.status(400).json({ error: 'stats object is required' });
    }

    // Attach user and API key from auth middleware
    const userId = req.apiKeyData.user_id;
    const apiKey = req.apiKeyData.key;

    const card = upsertCard(data, userId, apiKey);
    const imagePrompt = generatePrompt(card);

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    // Trigger image generation in background (non-blocking)
    generateCardImageAsync(card);

    res.json({
      id: card.id,
      card_url: `${baseUrl}/card/${card.id}`,
      image_prompt: imagePrompt,
      upload_url: `/api/card/${card.id}/image`,
      status_url: `${baseUrl}/api/card/${card.id}/status`,
      message: 'Card published! Image generation started in background.',
    });
  } catch (err) {
    console.error('Publish error:', err);
    res.status(500).json({ error: 'Failed to publish card', details: err.message });
  }
});

// ─── POST /api/card/:id/image ───
router.post('/card/:id/image', (req, res) => {
  const card = getCardById(req.params.id);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    markCardImage(req.params.id);

    const ext = req.file.mimetype === 'image/png' ? '.png' : '.jpg';
    res.json({
      ok: true,
      image_url: `/images/${req.params.id}${ext}`,
    });
  });
});

// ─── GET /api/cards ───
router.get('/cards', (req, res) => {
  try {
    const { sort, limit, offset, rarity } = req.query;
    const result = listAllCards({ sort, limit, offset, rarity });

    // Add image URLs to cards
    result.cards = result.cards.map(card => ({
      ...card,
      channels: safeParseJSON(card.channels, []),
      image_url: card.has_image ? getImageUrl(card.id) : null,
      card_url: `/card/${card.id}`,
    }));

    res.json(result);
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: 'Failed to list cards' });
  }
});

// ─── GET /api/card/:id ───
router.get('/card/:id', (req, res) => {
  const card = getCardById(req.params.id);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  res.json({
    ...card,
    channels: safeParseJSON(card.channels, []),
    image_url: card.has_image ? getImageUrl(card.id) : null,
  });
});

// ─── GET /api/card/:id/status ───
router.get('/card/:id/status', (req, res) => {
  const card = getCardById(req.params.id);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  res.json({
    id: card.id,
    has_image: !!card.has_image,
    image_url: card.has_image ? getImageUrl(card.id) : null,
    status: card.has_image ? 'ready' : 'generating',
  });
});

// ─── Helpers ───

function getImageUrl(id) {
  if (existsSync(join(IMAGES_DIR, `${id}.png`))) return `/images/${id}.png`;
  if (existsSync(join(IMAGES_DIR, `${id}.jpg`))) return `/images/${id}.jpg`;
  return null;
}

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

export default router;
