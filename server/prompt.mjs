// ═══════════════════════════════════════
// 🦞 CLAW CARDS — Image Prompt Engine
// Generates prompts for Banana Pro / SDXL
// ═══════════════════════════════════════

const RARITY_MODIFIERS = {
  HATCHLING: 'soft pastel colors, gentle, cute, watercolor style, peaceful underwater scene',
  JUVENILE: 'ocean blue tones, bioluminescent, growing power, crystal clear water',
  ADULT: 'cosmic purple nebula, starfield, confident, ethereal mist, amethyst crystals',
  ALPHA: 'golden flames, intense power aura, dramatic lighting, ember particles, metallic gold',
  LEVIATHAN: 'holographic rainbow energy, reality-bending power, divine aura, cosmic explosion, legendary, maximum intensity',
};

const TYPE_MODIFIERS = {
  SAGE: 'wise wizard, magical staff, ancient knowledge, mystical runes',
  WARRIOR: 'battle-ready, determined, sword/weapon, armor accents',
  SCOUT: 'agile, quick, wind effects, dynamic pose',
  GUARDIAN: 'protective stance, shield energy, fortified, sturdy',
  ORACLE: 'all-seeing eye, future vision, data streams, prophetic',
};

const BASE_PROMPT = 'epic trading card art, digital illustration, centered character portrait, dark background';
const SUFFIX = 'masterpiece quality, no text, vertical portrait composition, 2:3 aspect ratio';

/**
 * Generate an image prompt from card data
 * @param {Object} cardData - Card row from database or publish payload
 * @returns {string} Prompt string optimized for Banana Pro / SDXL
 */
export function generatePrompt(cardData) {
  const parts = [BASE_PROMPT];

  // Agent personality from soul excerpt
  const soul = cardData.soul_excerpt || cardData.agent?.soul_excerpt || '';
  if (soul) {
    // Extract key personality words (first sentence or 80 chars)
    const personality = soul.slice(0, 80).replace(/[^a-zA-Z\s,]/g, '').trim();
    if (personality) {
      parts.push(`character essence: ${personality}`);
    }
  }

  // Agent name flavor
  const name = cardData.agent_name || cardData.agent?.name || 'mysterious figure';
  parts.push(`character inspired by the name "${name}"`);

  // Title adds flavor
  const title = cardData.title || cardData.agent?.title || '';
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
