#!/bin/bash
# 🦞 Claw Cards — Quick Start
cd "$(dirname "$0")/server"

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

if [ ! -f "data/cards.db" ]; then
  echo "🌱 Seeding demo data..."
  node seed.mjs
fi

echo "🦞 Starting Claw Cards server..."
node index.mjs
