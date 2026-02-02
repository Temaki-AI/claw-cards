// ═══════════════════════════════════════
// 🦞 CLAWV — API Routes
// ═══════════════════════════════════════

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { randomBytes, pbkdf2 } from 'crypto';
import { promisify } from 'util';
import { upsertCard, getCardById, markCardImage, listAllCards, createUser, getUserByEmail, createApiKey } from '../db.mjs';
import { generatePrompt } from '../prompt.mjs';
import { requireApiKey, optionalApiKey } from '../middleware/auth.mjs';
import { generateCardImageAsync } from '../imagegen.mjs';

const pbkdf2Async = promisify(pbkdf2);

// ─── Rate Limiters ───
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per IP per hour
  message: { error: 'Too many registration attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 API key generations per hour
  message: { error: 'Too many API key requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const publishLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 publishes per API key per hour
  keyGenerator: (req) => req.apiKeyData?.key || req.ip, // Rate limit by API key
  message: { error: 'Too many publish requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Email Validation ───
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
const IMAGES_DIR = join(DATA_DIR, 'images');

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

// ─── Password Hashing ───
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await pbkdf2Async(password, salt, 100000, 64, 'sha512');
  return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = await pbkdf2Async(password, salt, 100000, 64, 'sha512');
  return hash === verifyHash.toString('hex');
}

// ─── POST /api/register ───
router.post('/register', registrationLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'invalid email format' });
    const existing = getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'user already exists' });
    const userId = randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(password);
    const user = createUser(userId, email, passwordHash);
    res.status(201).json({ user_id: user.id, email: user.email, created_at: user.created_at });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register', details: err.message });
  }
});

// ─── POST /api/keys ───
router.post('/keys', apiKeyLimiter, async (req, res) => {
  try {
    const { email, password, bot_name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    if (!bot_name) return res.status(400).json({ error: 'bot_name required' });
    const user = getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'invalid credentials' });
    const apiKey = randomBytes(32).toString('hex');
    const key = createApiKey(apiKey, user.id, bot_name);
    res.status(201).json({ api_key: key.key, bot_name: key.bot_name, user_id: key.user_id, created_at: key.created_at, note: 'Store this key securely.' });
  } catch (err) {
    console.error('API key error:', err);
    res.status(500).json({ error: 'Failed to create API key', details: err.message });
  }
});

// ─── POST /api/publish ───
// Open for now — no auth required. Agents just publish directly.
// Auth will be added later for human dashboard access.
router.post('/publish', optionalApiKey, publishLimiter, (req, res) => {
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

    // No auth required for now — use API key if provided, otherwise anonymous
    const userId = req.apiKeyData?.user_id || 'anonymous';
    const apiKey = req.apiKeyData?.key || 'open';

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
