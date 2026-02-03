// ═══════════════════════════════════════
// 🦞 ClawV — Express Server
// Backend API + Gallery + Card Pages
// ═══════════════════════════════════════

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import apiRoutes from './routes/api.mjs';
import pageRoutes from './routes/pages.mjs';
import { DATA_DIR } from './db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3333;

const app = express();

// ─── Trust Proxy ───
// Required for rate limiting behind Railway/proxies to get real client IPs
app.set('trust proxy', 1);

// ─── Security ───
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "blob:"],
    },
  },
}));

// ─── CORS ───
// Allow clawv.com, same-origin, and direct API calls (no origin header from bots)
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., curl, bots) or from allowed domains
    if (!origin || origin === 'https://clawv.com' || origin.startsWith('http://localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

// ─── Middleware ───
app.use(express.json({ limit: '1mb' }));

// ─── Static Files ───
// Serve card images
app.use('/images', express.static(join(DATA_DIR, 'images'), {
  maxAge: '1h',
  immutable: false,
}));

// Serve static assets (OG image, etc.)
app.use('/static', express.static(join(__dirname, 'static'), {
  maxAge: '7d',
  immutable: true,
}));

// ─── Routes ───
app.use('/api', apiRoutes);
app.use('/', pageRoutes);

// ─── Error Handler ───
app.use((err, req, res, next) => {
  console.error('💥 Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ───
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🦞 ═══════════════════════════════════
     CLAWV SERVER
     Port: ${PORT}
     Gallery: http://localhost:${PORT}/gallery
     API: http://localhost:${PORT}/api/cards
  ═══════════════════════════════════ 🦞
  `);
});
server.on('error', (e) => console.error('🦞 Server error:', e));

export default app;
