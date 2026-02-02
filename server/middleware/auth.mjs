// ═══════════════════════════════════════
// 🦞 CLAWV — Auth Middleware
// API key validation
// ═══════════════════════════════════════

import { getApiKey, updateApiKeyLastUsed } from '../db.mjs';

/**
 * Middleware to validate API key from Authorization header
 * Attaches apiKeyData to req object if valid
 */
export function requireApiKey(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <api_key>' });
  }

  const apiKey = authHeader.slice(7); // Remove 'Bearer '

  const keyData = getApiKey(apiKey);
  if (!keyData) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Update last used timestamp
  updateApiKeyLastUsed(apiKey);

  // Attach to request for use in route handlers
  req.apiKeyData = keyData;

  next();
}

export default requireApiKey;
