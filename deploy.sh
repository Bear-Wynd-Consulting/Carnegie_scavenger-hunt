#!/bin/bash
set -e

# ============================================================
# Carnegie Scavenger Hunt — One-Shot Deploy Script
# Run this from inside the carnegie-hunt/ directory
# ============================================================

echo ""
echo "🏛️  Carnegie Libraries — Ontario Scavenger Hunt"
echo "================================================"
echo ""

# ---- 1. Environment check ----
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org"
  exit 1
fi

if ! command -v git &> /dev/null; then
  echo "❌ Git not found."
  exit 1
fi

# ---- 2. Install dependencies ----
echo "📦 Installing dependencies..."
npm install

# ---- 3. Run Neon migration ----
echo ""
echo "🗄️  Running database migration..."

# Check if .env file exists and source it
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set. Please set it in the environment or in a .env file."
  exit 1
fi

node src/lib/migrate.mjs

# ---- 4. Verify build ----
echo ""
echo "🔨 Verifying Next.js build..."
npx next build
echo "✓ Build passed"

# ---- 5. Push to GitHub ----
echo ""
echo "📤 Pushing to GitHub..."
if [ ! -d ".git" ]; then
  git init
  git branch -M main
fi

# Check if remote exists
if ! git remote get-url origin &> /dev/null; then
  git remote add origin https://github.com/Bear-Wynd-Consulting/Carnegie_scavenger-hunt.git
fi

git add .
git commit -m "Carnegie scavenger hunt — initial deploy" --allow-empty
git push -u origin main --force

echo "✓ Pushed to GitHub"

# ---- 6. Deploy to Vercel ----
echo ""
echo "🚀 Deploying to Vercel..."

# Install Vercel CLI if needed
if ! command -v vercel &> /dev/null; then
  echo "  Installing Vercel CLI..."
  npm install -g vercel
fi

# Link to Vercel project (will prompt if first time)
# Using the Bear Wynd team scope
vercel link --yes --scope bear-wynd-consultings-projects 2>/dev/null || true

# Set the DATABASE_URL env var in Vercel
echo ""
echo "Setting DATABASE_URL in Vercel..."
echo "$DATABASE_URL" | vercel env add DATABASE_URL production --scope bear-wynd-consultings-projects 2>/dev/null || echo "  (env var may already exist — check Vercel dashboard if deploy fails)"

# Deploy to production
vercel --prod --scope bear-wynd-consultings-projects

echo ""
echo "============================================"
echo "✅ DEPLOYMENT COMPLETE"
echo ""
echo "Your app is live! Share the URL with anyone."
echo "Each visitor gets their own anonymous tracker."
echo "============================================"
