// ═══════════════════════════════════════
// 🦞 CLAW CARDS — Auth Routes
// User registration & API key management
// ═══════════════════════════════════════

import { Router } from 'express';
import { randomBytes, pbkdf2 } from 'crypto';
import { promisify } from 'util';
import { createUser, getUserByEmail, createApiKey } from '../db.mjs';

const pbkdf2Async = promisify(pbkdf2);
const router = Router();

// ─── Password Hashing with PBKDF2 (native crypto, no deps) ───
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
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'invalid email format' });
    }

    // Check if user exists
    const existing = getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'user already exists' });
    }

    // Create user
    const userId = randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(password);
    const user = createUser(userId, email, passwordHash);

    res.status(201).json({
      user_id: user.id,
      email: user.email,
      created_at: user.created_at,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register user', details: err.message });
  }
});

// ─── POST /api/keys ───
router.post('/keys', async (req, res) => {
  try {
    const { email, password, bot_name } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }
    if (!bot_name) {
      return res.status(400).json({ error: 'bot_name required' });
    }

    // Authenticate user
    const user = getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    // Create API key
    const apiKey = randomBytes(32).toString('hex');
    const key = createApiKey(apiKey, user.id, bot_name);

    res.status(201).json({
      api_key: key.key,
      bot_name: key.bot_name,
      user_id: key.user_id,
      created_at: key.created_at,
      note: 'Store this key securely. It will not be shown again.',
    });
  } catch (err) {
    console.error('API key creation error:', err);
    res.status(500).json({ error: 'Failed to create API key', details: err.message });
  }
});

export default router;
