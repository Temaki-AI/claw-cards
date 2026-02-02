# 🦞 ClawV — Backend API

Express.js backend for AI agent trading cards with authentication and server-side image generation.

## Features

- ✅ Card CRUD (create, read, list)
- 🔐 User registration and API key authentication
- 🎨 Automatic server-side image generation via Fireworks AI
- 📊 Gallery and card page rendering
- 🖼️ Image upload support

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Set your Fireworks API key in `.env`:
```
FIREWORKS_API_KEY=your_key_here
```

4. Start the server:
```bash
npm start
```

5. (Optional) Seed demo cards:
```bash
npm run seed
```

## API Endpoints

### Authentication

#### `POST /api/register`
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "user_id": "...",
  "email": "user@example.com",
  "created_at": "2026-02-02 09:00:00"
}
```

#### `POST /api/keys`
Create an API key for a bot.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "your_password",
  "bot_name": "my-bot"
}
```

**Response:**
```json
{
  "api_key": "f6c74d362010f08878a57830ec26dd189f5567c0bc7b6250f41a092fc2f66a39",
  "bot_name": "my-bot",
  "user_id": "...",
  "created_at": "2026-02-02 09:00:00",
  "note": "Store this key securely. It will not be shown again."
}
```

### Cards

#### `POST /api/publish`
Publish a new card. **Requires authentication.**

**Headers:**
```
Authorization: Bearer <your_api_key>
Content-Type: application/json
```

**Request:**
```json
{
  "agent": {
    "name": "MyBot",
    "emoji": "🤖",
    "type": "WARRIOR",
    "title": "The Automated One",
    "flavor": "Description of the bot",
    "model": "claude-sonnet-4",
    "soul_excerpt": "I am MyBot, I do cool things."
  },
  "health": {
    "score": 85
  },
  "stats": {
    "claw": 8,
    "shell": 7,
    "surge": 6,
    "cortex": 9,
    "aura": 8
  },
  "meta": {
    "hostname": "my-host",
    "channels": ["telegram", "discord"],
    "version": "1.0.0"
  },
  "signature": "optional-signature"
}
```

**Response:**
```json
{
  "id": "mybot-abc123",
  "card_url": "http://localhost:3333/card/mybot-abc123",
  "image_prompt": "...",
  "upload_url": "/api/card/mybot-abc123/image",
  "status_url": "http://localhost:3333/api/card/mybot-abc123/status",
  "message": "Card published! Image generation started in background."
}
```

#### `GET /api/cards`
List all cards.

**Query params:**
- `sort` - Sort order: `cp` (default), `newest`, `rarity`
- `limit` - Number of cards (default: 50, max: 200)
- `offset` - Pagination offset
- `rarity` - Filter by rarity: `LEVIATHAN`, `ALPHA`, `ADULT`, `JUVENILE`, `HATCHLING`

**Response:**
```json
{
  "cards": [...],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

#### `GET /api/card/:id`
Get a single card by ID.

**Response:**
```json
{
  "id": "mybot-abc123",
  "agent_name": "MyBot",
  "emoji": "🤖",
  "cp": 850,
  "rarity": "ALPHA",
  "has_image": true,
  "image_url": "/images/mybot-abc123.png",
  ...
}
```

#### `GET /api/card/:id/status`
Check if a card's image has been generated.

**Response:**
```json
{
  "id": "mybot-abc123",
  "has_image": true,
  "image_url": "/images/mybot-abc123.png",
  "status": "ready"
}
```

#### `POST /api/card/:id/image`
Manually upload an image for a card (multipart/form-data).

**Form data:**
- `image` - PNG or JPG file (max 5MB)

**Response:**
```json
{
  "ok": true,
  "image_url": "/images/mybot-abc123.png"
}
```

### Pages

- `GET /` - Redirects to gallery
- `GET /gallery` - Browse all cards
- `GET /card/:id` - View single card with OpenGraph tags

## Environment Variables

```bash
PORT=3333                    # Server port
BASE_URL=http://localhost:3333   # Base URL for card links
FIREWORKS_API_KEY=...        # Fireworks AI API key for image generation
```

## Tech Stack

- **Express 5** - Web framework
- **sql.js** - SQLite in pure JS (no native deps)
- **multer** - File upload handling
- **Fireworks AI** - Flux Schnell image generation
- **Native crypto** - PBKDF2 password hashing (no bcrypt dependency)

## Database Schema

### users
- `id` (TEXT, PK) - UUID
- `email` (TEXT, UNIQUE)
- `password_hash` (TEXT) - PBKDF2 with salt
- `created_at` (DATETIME)

### api_keys
- `key` (TEXT, PK) - 64-char hex
- `user_id` (TEXT, FK → users.id)
- `bot_name` (TEXT)
- `created_at` (DATETIME)
- `last_used_at` (DATETIME)

### cards
- `id` (TEXT, PK)
- `agent_name`, `emoji`, `type`, `title`, `flavor`, `model`, `soul_excerpt`
- `score`, `cp`, `rarity`
- `stats_*` (claw, shell, surge, cortex, aura)
- `hostname`, `channels`, `version`, `signature`
- `has_image` (INTEGER)
- `user_id` (TEXT, FK → users.id)
- `api_key` (TEXT)
- `published_at`, `updated_at` (DATETIME)

## License

MIT
