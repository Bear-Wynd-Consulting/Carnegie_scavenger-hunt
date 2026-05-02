# Carnegie Libraries — Ontario Scavenger Hunt

A mobile-first progressive web app for exploring and tracking visits to all 94 Carnegie Libraries in Ontario. Share the link with anyone — each person gets their own anonymous tracker with a shared leaderboard.

## Features

- **94 Carnegie Libraries** with addresses, coordinates, architect info, and current status
- **Visit tracking** with dates — persisted in Neon PostgreSQL so it survives across devices
- **Photo capture** from phone camera, stored locally on device
- **Google Maps directions** — Drive or Walk buttons open Google Maps directly (no embedded map)
- **Distance sorting** using GPS
- **Leaderboard** — see who's visited the most libraries
- **PWA support** — Add to Home Screen for native app feel

## Tech Stack

- **Next.js 14** (App Router)
- **Neon** (Serverless PostgreSQL) for visits & leaderboard
- **Vercel** for hosting
- **localStorage** for photos and offline fallback

## Deployment

### 1. Set up Neon database

Go to [console.neon.tech](https://console.neon.tech) → your project (`org-broad-violet-23323853`) and create a new database (or use default `neondb`). Copy the connection string.

### 2. Clone and configure

```bash
git clone https://github.com/Bear-Wynd-Consulting/Carnegie_scavenger-hunt.git
cd Carnegie_scavenger-hunt
npm install
```

Create `.env` file:
```
DATABASE_URL="postgresql://username:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 3. Run database migration

```bash
npm run db:migrate
```

This creates the `visits`, `library_stats`, and `hunters` tables.

### 4. Deploy to Vercel

**Option A: Vercel CLI**
```bash
npx vercel --prod
```

**Option B: Push to GitHub (recommended)**
```bash
git add .
git commit -m "Initial Carnegie scavenger hunt app"
git push origin main
```

Then in [Vercel Dashboard](https://vercel.com/bear-wynd-consulting):
1. Import the `Carnegie_scavenger-hunt` repo
2. Add `DATABASE_URL` environment variable (Settings → Environment Variables)
3. Deploy

### 5. Share the URL

The deployed URL (e.g., `carnegie-scavenger-hunt.vercel.app`) works on any phone browser. Users can:
- Add to Home Screen for full-screen PWA experience
- Set a hunter name on the Leaderboard tab
- Each user gets a unique anonymous ID automatically

## Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture Notes

- **Visits** are stored server-side in Neon — any user on any device contributes to the leaderboard
- **Photos** are stored client-side in localStorage — they stay on the user's device (too large for DB, and privacy-friendly)
- **User identity** is an anonymous UUID stored in localStorage. No accounts needed.
- **Offline resilience**: visits are also cached in localStorage as fallback if the API is unreachable
- Each library has coordinates from the Wikipedia list of Carnegie libraries in Canada

## PWA Icons

Add `icon-192.png` and `icon-512.png` to `/public` for the Add to Home Screen icon. A simple approach:
- Use any Carnegie library photo or the WRP logo
- Resize to 192×192 and 512×512

## Database Schema

```sql
visits (id, user_id, library_id, visited_at)     -- per-user visit log
library_stats (library_id, visit_count)           -- aggregate counters
hunters (user_id, display_name, total_visits, last_visit_at, created_at)
```
