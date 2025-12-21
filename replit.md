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
- Settings page with Omi device setup and language preferences
- Dark/light theme support
- **Full Omi Integration** with webhooks and chat tools

## Tech Stack
- **Frontend**: React, TypeScript, TailwindCSS, Framer Motion, Shadcn UI
- **Backend**: Express.js, TypeScript
- **AI**: Gemini AI (via Replit AI Integrations)
- **Database**: PostgreSQL (available), currently using in-memory storage
- **Styling**: Fresh teal/green theme with Fredoka/Inter fonts

## Project Structure
```
client/
  src/
    components/     # Reusable UI components (challenge-card, streak-counter, etc.)
    pages/          # Page components (landing, home, challenges, etc.)
    lib/            # Utilities (queryClient, theme-provider)
    hooks/          # Custom React hooks
server/
  routes.ts         # API endpoints including Omi integration
  storage.ts        # Data storage with SM-2 algorithm
shared/
  schema.ts         # TypeScript types and Drizzle schema
```

## Omi Integration (Complete)

### Endpoints
- `GET /.well-known/omi-tools.json` - Chat tools manifest for Omi App Store
- `POST /api/omi/webhook/transcript` - Real-time transcript processing
- `POST /api/omi/webhook/audio` - Audio bytes webhook for pronunciation analysis
- `POST /api/omi/webhook/memory` - Memory trigger when conversation ends
- `POST /api/omi/compile-session/:sessionId` - Compile audio and trigger Gemini analysis
- `POST /api/omi/setup-complete` - Callback when user installs the app
- `GET /api/omi/setup-info` - Returns all webhook URLs for setup
- `GET /api/omi/status` - Check if Omi is connected
- `GET /api/gcp/status` - Check GCP storage connection status

### Audio Processing Pipeline
1. Omi device sends audio bytes to `/api/omi/webhook/audio`
2. Audio chunks uploaded to GCP bucket at `{userId}/{sessionId}/chunks/{timestamp}_{index}.pcm`
3. Chunk metadata stored in audioChunks table
4. On session end, `/api/omi/compile-session/:sessionId` is called
5. All chunks downloaded, concatenated, and uploaded as compiled audio
6. Gemini analyzes transcript for grammar/vocabulary/pronunciation issues
7. Scores calculated dynamically based on analysis results
8. Lessons and learning items generated from identified issues

### Chat Tools
1. **analyze_speech** - Analyze text for grammar/vocabulary issues
2. **get_learning_status** - Get user's streak, XP, level, and progress
3. **add_to_learning_queue** - Add phrases to spaced repetition queue
4. **get_daily_challenges** - Get today's practice challenges

### Setup Flow
1. User opens Settings page in LinguaFlow
2. Copies webhook URLs shown on the page
3. Creates app in Omi mobile app → Apps → Create App
4. Selects "External Integration" capability
5. Pastes the webhook URLs and manifest URL
6. Saves and installs the app
7. Setup complete callback is triggered

## API Endpoints
- `GET /api/stats/overview` - Dashboard statistics
- `GET /api/stats/weekly` - Weekly activity data
- `GET /api/stats/progress` - Progress metrics
- `GET /api/challenges/today` - Today's challenges
- `PATCH /api/challenges/:id/complete` - Complete a challenge
- `GET /api/learning-items` - All learning items
- `POST /api/learning-items` - Create learning item
- `GET /api/achievements` - User achievements
- `POST /api/analyze-text` - Analyze text with Gemini
- `GET /api/lessons` - Get user's pronunciation lessons
- `PATCH /api/lessons/:id/complete` - Complete a lesson and earn XP
- `GET /api/audio-analysis/:sessionId` - Get audio analysis status and results

## GCP Storage Integration
- Requires `GCP_SERVICE_ACCOUNT_JSON` and `GCP_BUCKET_NAME` secrets
- Audio stored at: `gs://{bucket}/{userId}/{sessionId}/chunks/{timestamp}_{index}.pcm`
- Compiled audio stored at: `gs://{bucket}/{userId}/{sessionId}/compiled.wav`
- Settings page shows GCP connection status

## Design System
- Primary: Teal (#14B8A6)
- Secondary: Yellow (#FACC15)
- Accent: Blue (#3B82F6)
- Fonts: Fredoka (display), Inter (body)
- Animations: Framer Motion for playful interactions

## User Preferences
- Fresh teal/green color scheme (no purple)
- Playful, Duolingo-inspired design
- No emojis in UI
- Smooth animations throughout
- Dark mode support
- Working Omi backend integration (not just frontend mockups)
