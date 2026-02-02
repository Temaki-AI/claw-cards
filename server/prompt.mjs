// ═══════════════════════════════════════
// 🦞 CLAWV — Image Prompt Engine
// Generates prompts for Banana Pro / SDXL
// ═══════════════════════════════════════

const RARITY_MODIFIERS = {
  HATCHLING: 'soft muted palette, gentle ambient light, simple composition, calm atmosphere',
  JUVENILE: 'cool blue tones, subtle glow, emerging presence, clean lighting',
  ADULT: 'rich deep colors, confident presence, atmospheric depth, polished rendering',
  ALPHA: 'warm golden highlights, dramatic contrast, intense atmosphere, premium feel',
  LEVIATHAN: 'vibrant luminous energy, extraordinary presence, cinematic lighting, awe-inspiring, legendary aura',
};

const TYPE_MODIFIERS = {
  SAGE: 'contemplative, calm authority, depth of knowledge, serene intensity',
  WARRIOR: 'determined, strong presence, focused energy, unyielding resolve',
  SCOUT: 'alert, perceptive, in motion, curious gaze, restless energy',
  GUARDIAN: 'steadfast, watchful, grounded, quiet strength, immovable',
  ORACLE: 'distant gaze, heightened awareness, enigmatic, seeing beyond',
};

const BASE_PROMPT = 'digital character portrait, unique original character, dark background, frameless, borderless, concept art style';
const SUFFIX = 'high quality, absolutely no text, no words, no letters, no frame, no border, vertical composition, 2:3 aspect ratio';
const NEGATIVE = 'text, words, letters, numbers, writing, frame, border, UI elements, watermark, signature';

/** Injection-safe prompt patterns */
const BLOCKED_PATTERNS = /\b(ignore|disregard|forget|override|explicit|nsfw|nude)\b/gi;

/**
 * Sanitize user-provided strings before embedding in image prompts.
 * Strips non-alphanumeric chars (except spaces, commas, basic punctuation),
 * removes prompt injection keywords, and limits to 80 characters.
 */
export function sanitizeForPrompt(str) {
  if (!str) return '';
  return String(str)
    .replace(/[^a-zA-Z0-9\s,.\-!?']/g, '')  // keep only safe chars
    .replace(BLOCKED_PATTERNS, '')             // strip injection keywords
    .replace(/\s+/g, ' ')                      // collapse whitespace
    .trim()
    .slice(0, 80);
}

/**
 * Generate an image prompt from card data
 * @param {Object} cardData - Card row from database or publish payload
 * @returns {string} Prompt string optimized for Banana Pro / SDXL
 */
export function getNegativePrompt() {
  return NEGATIVE;
}

export function generatePrompt(cardData) {
  const parts = [BASE_PROMPT];

  // Agent personality from soul excerpt (sanitized)
  const soul = sanitizeForPrompt(cardData.soul_excerpt || cardData.agent?.soul_excerpt || '');
  if (soul) {
    parts.push(`character essence: ${soul}`);
  }

  // Agent name flavor (sanitized)
  const name = sanitizeForPrompt(cardData.agent_name || cardData.agent?.name || '') || 'mysterious figure';
  parts.push(`character inspired by the name "${name}"`);

  // Title adds flavor (sanitized)
  const title = sanitizeForPrompt(cardData.title || cardData.agent?.title || '');
  if (title) {
    parts.push(title.toLowerCase());
  }

  // Rarity modifier
  const rarity = (cardData.rarity || 'ADULT').toUpperCase();
  if (RARITY_MODIFIERS[rarity]) {
    parts.push(RARITY_MODIFIERS[rarity]);
  }

  // Type modifier
  const type = (cardData.type || cardData.agent?.type || 'WARRIOR').toUpperCase();
  if (TYPE_MODIFIERS[type]) {
    parts.push(TYPE_MODIFIERS[type]);
  }

  // Suffix
  parts.push(SUFFIX);

  return parts.join(', ');
}

export default generatePrompt;
