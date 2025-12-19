# LinguaFlow - Passive Language Learning with Omi AI

## Overview
LinguaFlow is a language learning application that integrates with the Omi AI necklace to analyze real conversations. It uses Gemini AI to identify grammar and vocabulary mistakes from user speech, generates personalized daily challenges, and employs SM-2 spaced repetition for optimal learning.

## Current State
The application is fully functional with:
- Beautiful landing page with feature showcase
- Dashboard with streak tracking, XP progress, and daily challenges
- Challenge system with grammar/vocabulary correction cards
- Learning items queue with spaced repetition scheduling
- Progress tracking with weekly activity charts
- Achievement system for gamification
- Settings page with language and notification preferences
- Dark/light theme support

## Tech Stack
- **Frontend**: React, TypeScript, TailwindCSS, Framer Motion, Shadcn UI
- **Backend**: Express.js, TypeScript
- **AI**: Gemini AI (via Replit AI Integrations)
- **Database**: PostgreSQL (available), currently using in-memory storage
- **Styling**: Custom playful theme with Fredoka/Inter fonts

## Project Structure
```
client/
  src/
    components/     # Reusable UI components (challenge-card, streak-counter, etc.)
    pages/          # Page components (landing, home, challenges, etc.)
    lib/            # Utilities (queryClient, theme-provider)
    hooks/          # Custom React hooks
server/
  routes.ts         # API endpoints
  storage.ts        # Data storage with SM-2 algorithm
shared/
  schema.ts         # TypeScript types and Drizzle schema
```

## Key Features
1. **Omi Integration**: Webhooks at `/api/omi/audio` and `/api/omi/transcript` for processing speech
2. **Gemini Analysis**: Analyzes text for grammar/vocabulary issues
3. **SM-2 Algorithm**: Implements spaced repetition for optimal review intervals
4. **Gamification**: XP, levels, streaks, and achievements
5. **Responsive Design**: Works on all device sizes with sidebar navigation

## API Endpoints
- `GET /api/stats/overview` - Dashboard statistics
- `GET /api/stats/weekly` - Weekly activity data
- `GET /api/stats/progress` - Progress metrics
- `GET /api/challenges/today` - Today's challenges
- `PATCH /api/challenges/:id/complete` - Complete a challenge
- `GET /api/learning-items` - All learning items
- `POST /api/learning-items` - Create learning item
- `GET /api/achievements` - User achievements
- `POST /api/omi/audio` - Omi audio webhook
- `POST /api/omi/transcript` - Omi transcript webhook
- `POST /api/analyze-text` - Analyze text with Gemini

## Design System
- Primary: Purple (#8B5CF6)
- Secondary: Yellow (#FACC15)
- Accent: Teal (#14B8A6)
- Fonts: Fredoka (display), Inter (body)
- Animations: Framer Motion for playful interactions

## User Preferences
- Playful, Duolingo-inspired design
- No emojis in UI
- Smooth animations throughout
- Dark mode support
