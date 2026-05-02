# CLAUDE.md — Carnegie Libraries Ontario Scavenger Hunt

## Project Overview

A mobile-first progressive web app for tracking visits to 94 Carnegie Libraries across Ontario. Public-facing — anyone with the link can use it. No authentication required; users get an anonymous UUID on first visit.

**Live URL**: (set after first deploy)
**Repo**: https://github.com/Bear-Wynd-Consulting/Carnegie_scavenger-hunt.git
**Vercel Team**: bear-wynd-consultings-projects
**Neon Org**: org-broad-violet-23323853

## Stack

- **Framework**: Next.js 14 (App Router, `src/` directory)
- **Database**: Neon serverless PostgreSQL via `@neondatabase/serverless`
- **Hosting**: Vercel
- **Styling**: Inline styles (no Tailwind, no CSS modules — keep it single-file simple)
- **Fonts**: Playfair Display (headings), DM Sans (body) via Google Fonts CDN
- **State**: React hooks client-side, localStorage for photos + offline fallback, Neon for visits + leaderboard

## Architecture

```
src/
  app/
    layout.js          — Root layout, metadata, font imports, PWA meta tags
    globals.css        — Minimal global styles, animations, scrollbar hiding
    page.js            — Server component wrapper (just renders HuntApp)
    HuntApp.js         — Main client component ('use client'), ALL UI lives here
    api/
      visits/route.js  — GET (fetch user visits), POST (toggle visit/unvisit)
      stats/route.js   — GET (leaderboard + global stats), POST (set display name)
  lib/
    db.js              — Neon connection helper (reads DATABASE_URL)
    libraries.js       — Static array of 94 libraries with coords, status, notes
    migrate.mjs        — Run with `npm run db:migrate` to create tables
public/
  manifest.json        — PWA manifest for Add to Home Screen
```

## Database Schema

```sql
visits (id SERIAL PK, user_id TEXT, library_id INT, visited_at TIMESTAMPTZ)
  — UNIQUE(user_id, library_id)
  — INDEX on user_id

library_stats (library_id INT PK, visit_count INT DEFAULT 0)
  — Aggregate counter, incremented/decremented on visit toggle

hunters (user_id TEXT PK, display_name TEXT, total_visits INT, last_visit_at TIMESTAMPTZ, created_at TIMESTAMPTZ)
  — Leaderboard table, updated on each visit toggle
```

**Connection string env var**: `DATABASE_URL`
**Migration**: `npm run db:migrate` (idempotent, uses IF NOT EXISTS)

## Key Design Decisions

1. **No embedded maps** — Drive/Walk buttons construct Google Maps deep links and open in a new tab. Origin is set from GPS if available.
2. **Photos in localStorage only** — base64-encoded, per-library. No server upload. This is intentional for privacy and simplicity.
3. **Anonymous users** — UUID generated client-side via `crypto.randomUUID()`, stored in localStorage as `carnegie-user-id`. No signup flow.
4. **Optimistic UI** — Visit toggles update state immediately, then sync to Neon in background. Failures are silent (localStorage fallback).
5. **Dark theme** — `#1a1a2e` background, `#c9a96e` gold accent, `#16213e` card backgrounds. This is the brand. Don't change to light theme.
6. **Mobile-first** — Bottom tab navigation, touch-sized tap targets, no hover-dependent interactions.

## Library Data

`src/lib/libraries.js` contains 94 Ontario Carnegie libraries sourced from the Wikipedia "List of Carnegie libraries in Canada" article. Each entry has:

- `id` (integer, stable — used as foreign key in visits table)
- `name`, `place`, `address`
- `lat`, `lng` (decimal degrees)
- `status`: one of `library` | `repurposed` | `closed` | `demolished` | `standing`
- `notes` (architect info, historical context)

**Do not change library IDs** — they're referenced in the database. Add new libraries with IDs > 94.

## Environment Variables

| Variable | Where | Value |
|----------|-------|-------|
| `DATABASE_URL` | Vercel + local `.env` | Neon pooler connection string with `?sslmode=require` |

## Common Tasks

### Add a new library
1. Add entry to `src/lib/libraries.js` with `id` > 94
2. Update the `totalCount` display if hardcoded anywhere (currently derived from `LIBRARIES.length`)

### Update library data from a Google Sheet
If Chris provides a CSV or Google Sheet export with updated coordinates or new libraries:
1. Parse the CSV
2. Map columns to the library object shape in `libraries.js`
3. Merge with existing data, preserving IDs for existing libraries
4. New libraries get sequential IDs starting from max existing + 1

### Add a new API route
1. Create `src/app/api/{name}/route.js`
2. Use `import { getDb } from '@/lib/db'` for database access
3. Always wrap in try/catch, return `NextResponse.json()`
4. Neon's serverless driver uses tagged template literals: `` sql`SELECT * FROM visits WHERE user_id = ${userId}` ``

### Deploy
```bash
git add . && git commit -m "description" && git push
```
Vercel auto-deploys from main branch. Or manually: `vercel --prod --scope bear-wynd-consultings-projects`

### Run migration
```bash
export DATABASE_URL="..."
npm run db:migrate
```

## Style Guide

- **No Tailwind** — this project uses inline styles for portability
- **Color palette**: background `#1a1a2e`, cards `#16213e`, gold accent `#c9a96e`, text `#e8d5b7`, muted `#8a7e6b`, status colors in `STATUS_COLORS` object
- **Font sizes**: 24px page titles, 18-20px section headers, 14-15px body, 11-13px metadata
- **Border radius**: 10-12px for cards, 20px for pills/badges, 8px for inputs
- **Animations**: Keep minimal — CSS transitions on width/transform, `fadeIn` keyframe for photos
- **No emojis in body text** — emojis are used only for icons in nav and buttons (📚 📊 🏆 📍 🚗 🚶 📷)

## Testing Checklist

Before deploying changes, verify:
- [ ] `npx next build` passes clean
- [ ] Library list renders and scrolls smoothly
- [ ] Search filters correctly
- [ ] Sort by distance works (requires GPS permission)
- [ ] Tapping a library opens detail view
- [ ] Drive/Walk buttons open Google Maps in new tab
- [ ] Mark as Visited toggles and shows date
- [ ] Photo capture opens camera on mobile
- [ ] Stats tab shows correct counts
- [ ] Leaderboard tab loads (may be empty in dev without DB)
- [ ] Back navigation works from detail view

## What NOT to Do

- Don't add authentication — this is intentionally anonymous
- Don't embed Google Maps or any map SDK — directions open externally
- Don't move photos to server storage — localStorage is the design choice
- Don't split HuntApp.js into multiple component files unless it exceeds 800 lines — single-file is easier to reason about for this scale
- Don't upgrade to Next.js 15 without testing — stick with 14.2.x
- Don't change library IDs — they're database foreign keys
