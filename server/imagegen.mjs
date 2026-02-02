// ═══════════════════════════════════════
// 🦞 CLAWV — Image Generation
// Fireworks AI Flux Schnell integration
// ═══════════════════════════════════════

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generatePrompt } from './prompt.mjs';
import { markCardImage } from './db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const IMAGES_DIR = join(DATA_DIR, 'images');

// ─── Anti-Spam: Daily image cap + per-agent cooldown ───
const DAILY_IMAGE_CAP = parseInt(process.env.DAILY_IMAGE_CAP || '50', 10);
const AGENT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours between image regens per agent

let dailyImageCount = 0;
let dailyResetDate = new Date().toDateString();
const agentLastImage = new Map(); // cardId → timestamp

function checkAndIncrementDaily() {
  const today = new Date().toDateString();
  if (today !== dailyResetDate) {
    dailyImageCount = 0;
    dailyResetDate = today;
  }
  if (dailyImageCount >= DAILY_IMAGE_CAP) {
    return false; // cap reached
  }
  dailyImageCount++;
  return true;
}

function checkAgentCooldown(cardId) {
  const lastGen = agentLastImage.get(cardId);
  if (lastGen && (Date.now() - lastGen) < AGENT_COOLDOWN_MS) {
    return false; // still in cooldown
  }
  return true;
}

/**
 * Generate an image for a card using Fireworks AI
 * @param {Object} card - Card data from database
 * @returns {Promise<string>} Image path or throws error
 */
export async function generateCardImage(card) {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) {
    throw new Error('FIREWORKS_API_KEY environment variable not set');
  }

  const prompt = generatePrompt(card);
  console.log(`🎨 Generating image for card ${card.id}...`);
  console.log(`   Prompt: ${prompt.slice(0, 100)}...`);

  try {
    const response = await fetch('https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'image/png',
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio: '2:3', // Card aspect ratio
        num_inference_steps: 4,
        seed: 0, // Random seed
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fireworks API error (${response.status}): ${errorText}`);
    }

    // Response is binary image (Fireworks returns JPEG regardless of Accept header)
    const contentType = response.headers.get('content-type') || '';
    const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? '.jpg' : '.png';
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const imagePath = join(IMAGES_DIR, `${card.id}${ext}`);

    writeFileSync(imagePath, imageBuffer);
    markCardImage(card.id);

    console.log(`✅ Image saved: ${imagePath}`);
    return imagePath;
  } catch (err) {
    console.error(`❌ Image generation failed for card ${card.id}:`, err.message);
    throw err;
  }
}

/**
 * Generate image in background with spam protection.
 * Skips generation if: daily cap reached, or agent is in cooldown.
 * @param {Object} card - Card data from database
 */
export function generateCardImageAsync(card) {
  // Check agent cooldown (skip regen if same agent published recently)
  if (!checkAgentCooldown(card.id)) {
    console.log(`⏳ Skipping image regen for ${card.id} — cooldown (6h). Card data still updated.`);
    return;
  }

  // Check daily cap
  if (!checkAndIncrementDaily()) {
    console.log(`🚫 Daily image cap reached (${DAILY_IMAGE_CAP}). Skipping image for ${card.id}.`);
    return;
  }

  // Record this generation
  agentLastImage.set(card.id, Date.now());

  // Run in background, catch errors to prevent unhandled rejections
  generateCardImage(card).catch(err => {
    console.error(`Background image generation failed for ${card.id}:`, err.message);
    // Roll back the daily count on failure
    dailyImageCount = Math.max(0, dailyImageCount - 1);
  });
}

export default generateCardImage;
