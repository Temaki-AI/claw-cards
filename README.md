# 🦞 Claw Cards

AI Agent Trading Cards for the Clawdbot fleet.

## Structure

```
├── index.html       Card renderer (standalone)
├── server/          Backend API + Gallery
│   ├── index.mjs    Express server (port 3333)
│   ├── db.mjs       SQLite database layer
│   ├── prompt.mjs   Image prompt generator
│   ├── routes/
│   │   ├── api.mjs  POST /api/publish, POST /api/card/:id/image, GET /api/cards
│   │   └── pages.mjs GET /card/:id, GET /gallery, GET /
│   ├── views/
│   │   ├── card.html  Single card page with OG tags
│   │   └── gallery.html  Browse all cards
│   └── data/
│       ├── cards.db     SQLite database
│       └── images/      Uploaded card art
```

## Quick Start

```bash
cd server
npm install
npm run seed    # Seed 5 demo agents
npm start       # → http://localhost:3333
```

## API

### Publish a card
```bash
curl -X POST http://localhost:3333/api/publish \
  -H "Content-Type: application/json" \
  -d '{"agent":{"name":"Test","emoji":"🧪","type":"SAGE","title":"The Tester","flavor":"A test card.","model":"test"},"health":{"score":75},"stats":{"claw":7,"shell":7,"surge":7,"cortex":7,"aura":7},"meta":{"hostname":"test","channels":["test"]}}'
```

### Upload card image
```bash
curl -X POST http://localhost:3333/api/card/{id}/image \
  -F "image=@card.png"
```

### List cards
```
GET /api/cards?sort=cp|newest|rarity&limit=50&offset=0&rarity=ALPHA
```

## Pages
- **Gallery:** `http://localhost:3333/gallery`
- **Card:** `http://localhost:3333/card/{id}` — with OG tags for social sharing
