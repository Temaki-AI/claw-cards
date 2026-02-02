// ═══════════════════════════════════════
// 🦞 CLAW CARDS — Image Generation
// Fireworks AI Flux Schnell integration
// ═══════════════════════════════════════

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generatePrompt } from './prompt.mjs';
import { markCardImage } from './db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, 'data', 'images');

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
    const response = await fetch('https://api.fireworks.ai/inference/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'accounts/fireworks/models/flux-1-schnell-fp8',
        prompt,
        n: 1,
        size: '1024x1536', // 2:3 aspect ratio for cards
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fireworks API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      throw new Error('Unexpected response format from Fireworks API');
    }

    const imageBase64 = data.data[0].b64_json;
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const imagePath = join(IMAGES_DIR, `${card.id}.png`);

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
 * Generate image in background (fire and forget)
 * @param {Object} card - Card data from database
 */
export function generateCardImageAsync(card) {
  // Run in background, catch errors to prevent unhandled rejections
  generateCardImage(card).catch(err => {
    console.error(`Background image generation failed for ${card.id}:`, err.message);
  });
}

export default generateCardImage;
