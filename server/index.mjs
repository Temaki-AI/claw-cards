// ═══════════════════════════════════════
// 🦞 ClawV — Express Server
// Backend API + Gallery + Card Pages
// ═══════════════════════════════════════

import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import apiRoutes from './routes/api.mjs';
import pageRoutes from './routes/pages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3333;

const app = express();

// ─── Middleware ───
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ─── Static Files ───
// Serve card images
app.use('/images', express.static(join(__dirname, 'data', 'images'), {
  maxAge: '1h',
  immutable: false,
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
