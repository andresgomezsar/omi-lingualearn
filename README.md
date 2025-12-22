# Omi LinguaLearn

A gamified language learning platform integrated with the Omi wearable device, featuring voice challenges, **real audio pronunciation analysis**, and **idiomatic-focused AI coaching** that teaches you to sound like a native speaker.

## Overview

Omi LinguaLearn transforms language learning into an engaging, personalized experience by combining real-time voice challenges with advanced AI-powered analysis. Integrated with the Omi wearable device, it allows users to practice their target language naturally through conversation and receive **instant feedback on pronunciation (from actual audio), idiomatic expressions, and cultural appropriateness** - not just grammar correctness.

### 🎯 What Makes It Different

- **Real Audio Analysis**: Uses Gemini 2.0 Flash multimodal to analyze your actual pronunciation from audio files, not just text
- **Idiomatic Focus**: Teaches you to sound like a native speaker, not a textbook - flags "correct but unnatural" phrases
- **Cultural Context**: Provides feedback on what natives actually say in real conversations
- **Multi-User Support**: Secure authentication with User ID as API key, complete data isolation per user
- **Auto-Challenge Matching**: No trigger phrases needed - automatically detects when you're responding to challenges
- **Memory-Powered**: Generates personalized challenges from your actual Omi memories and conversations

## Features

### 🎤 Voice Challenges with Real Audio Analysis
- **AI-generated personalized prompts** based on your actual Omi memories and facts
- **Real pronunciation scoring** from actual audio files using Gemini 2.0 Flash multimodal
- **Multi-file audio handling** for responses longer than 60 seconds
- **Idiomatic-focused feedback**: Learn what natives actually say, not just what's grammatically correct
- **Cultural appropriateness** evaluation
- **Comprehensive scoring**:
  - Grammar accuracy (0-100)
  - Vocabulary usage (0-100)
  - **Pronunciation from audio** (0-100)
  - **Idiomatic naturalness** (0-100) - most important!
- **Language goals** focused on natural speech:
  - Natural idiomatic expressions
  - Colloquial phrases and slang
  - Cultural context and appropriateness
  - Conversational flow and naturalness
  - Past tense with idiomatic verbs
  - Subjunctive mood in everyday speech
  - Conditional sentences in natural contexts
  - And more...

### Gamification
- XP and streak tracking system
- Achievement badges
- Weekly progress heatmaps
- Level progression
- Progress statistics and visualization

### 🤖 AI Coaching (Native Speaker Perspective)
- **Idiomatic-first approach**: Flags textbook phrases even if grammatically correct
- **Cultural context**: Explains why natives say things a certain way
- **Gemini AI-powered** conversational practice
- **Personalized learning** recommendations based on your speech patterns
- **Real-time analysis** of ALL your speech (no trigger phrases needed!)
- **Learning items** created automatically from your conversations

### 🎧 Advanced Omi Integration
- **Automatic memory extraction**: User facts pulled from conversations, locations, and actions
- **Auto-challenge matching**: Detects when you're responding to challenges automatically
- **Multi-file audio processing**: Handles audio chunks seamlessly (up to multiple minutes)
- **GCP-based audio storage**: User-specific folders with timestamp-based organization
- **VAD-powered**: Leverages Omi's Voice Activity Detection to know when conversations happen
- **No trigger phrases**: All your speech is analyzed for learning opportunities

### 🔐 Multi-User Authentication
- **User ID as API key**: Simple, secure authentication
- **Auto-login** from localStorage
- **Complete data isolation** per user
- **User-specific GCP storage**: `{userId}/compiled/...`
- Beautiful auth modal with error handling

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Wouter** for routing
- **TanStack Query** for data fetching and caching
- **Tailwind CSS** with custom design system
- **Radix UI** component primitives
- **Framer Motion** for animations
- **shadcn/ui** components

### Backend
- **Express.js** server with TypeScript
- **PostgreSQL** database with Drizzle ORM
- **Passport.js** authentication
- **WebSocket** (ws) for real-time communication
- **Google Cloud Storage** for audio file management

### AI & APIs
- **Google Gemini AI** models:
  - **Gemini 2.0 Flash**: Challenge generation (text-only)
  - **Gemini 2.0 Flash Exp**: Challenge analysis with **real audio input** (multimodal)
  - **Gemini 2.5 Flash**: Text-based speech analysis
- **16,000 token output** for detailed audio pronunciation feedback
- **Base64 WAV encoding** for audio transmission to Gemini
- **Idiomatic-focused prompts** with native speaker perspective

## Prerequisites

- Node.js 20+
- PostgreSQL database
- Google Cloud Platform account (for storage)
- Google Gemini API key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/andresgomezsar/omi-lingualearn.git
cd omi-lingualearn
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see Configuration section below)

4. Initialize the database:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/lingualearn

# Google Gemini AI (REQUIRED for audio analysis)
GEMINI_API_KEY=your_gemini_api_key_here

# Google Cloud Storage (REQUIRED - for audio pronunciation analysis)
GCP_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"..."}
GCP_BUCKET_NAME=your_bucket_name

# Session (automatically generated in development)
SESSION_SECRET=your_session_secret_here
```

### ⚠️ Important Notes

**GCP Storage is now REQUIRED** for pronunciation analysis:
- Audio files are stored in user-specific folders: `{userId}/compiled/{timestamp}.wav`
- WAV files are downloaded and sent to Gemini for real pronunciation scoring
- Without GCP, pronunciation scores will be estimated from text only

### Getting API Keys

**Gemini API Key (Required):**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy it to your `.env` file
4. Make sure you have access to:
   - `gemini-2.0-flash` (challenge generation)
   - `gemini-2.0-flash-exp` (audio analysis - multimodal)
   - `gemini-2.5-flash` (text analysis)

**GCP Storage (Required for Audio Analysis):**
1. Create a Google Cloud project
2. Enable **Cloud Storage API**
3. Create a storage bucket (e.g., `omi-lingualearn-audio`)
4. Create a service account with **Storage Object Admin** permissions
5. Download the JSON key file
6. Copy the ENTIRE JSON content to `GCP_SERVICE_ACCOUNT_JSON` in `.env`
7. Set `GCP_BUCKET_NAME` to your bucket name

**Example GCP Service Account JSON:**
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "service-account@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

## Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start            # Start production server
npm run check        # Run TypeScript type checking
npm run db:push      # Push database schema changes
```

## Project Structure

```
omi-lingualearn/
├── client/              # Frontend React application
│   └── src/
│       ├── components/  # Reusable UI components
│       ├── hooks/       # Custom React hooks
│       ├── lib/         # Utilities and configurations
│       └── pages/       # Route pages
├── server/              # Backend Express application
│   ├── replit_integrations/  # Replit AI integrations
│   ├── tests/           # Integration tests
│   ├── gemini-challenge.ts   # AI challenge generation
│   ├── gcp-storage.ts   # Cloud storage utilities
│   ├── routes.ts        # API routes
│   └── storage.ts       # Database operations
├── shared/              # Shared TypeScript types and schemas
│   └── schema.ts        # Drizzle database schema
├── migrations/          # Database migrations
└── script/              # Build and utility scripts
```

## API Endpoints

### 👥 Multi-User Authentication
- `GET /api/users` - List all users
- `GET /api/users/current` - Get most recent user (auto-detection)
- `GET /api/user/profile?userId={id}` - Get user profile
- `PATCH /api/user/preferences` - Update language preferences (native/target)
- `POST /api/user/reset` - Reset user data

**Note:** All endpoints now support `?userId={id}` parameter. If not provided, falls back to most recent user.

### 🎧 Omi Integration
- `GET /.well-known/omi-tools.json` - Omi tools manifest
- `POST /api/omi/hub?event={type}&uid={omiUid}` - Main Omi webhook:
  - `event=audio` - Receive audio bytes (PCM16)
  - `event=memory` - Process conversation memory
  - `event=transcript` - Analyze speech transcript
- `POST /api/omi/tools/analyze` - Analyze speech for idiomatic feedback
- `POST /api/omi/tools/status` - Get learning status
- `POST /api/omi/tools/challenges` - Get available challenges
- `GET /api/omi/setup` - Setup page for Omi integration

### 🎤 Voice Challenges (with Audio Analysis)
- `GET /api/voice-challenges` - List user's challenges
- `GET /api/voice-challenges/active` - Get active challenge
- `POST /api/voice-challenges/generate` - Generate new personalized challenge
- `POST /api/voice-challenges/:id/respond` - Submit challenge response (with audio)
- `POST /api/voice-challenges/:id/skip` - Skip and get new challenge

**Audio Analysis Features:**
- Automatically finds audio files in time range
- Supports multi-file responses (>60s)
- Downloads WAV files from GCP
- Sends to Gemini with transcript for real pronunciation scoring

### 📊 User Progress
- `GET /api/user-facts` - Get user facts from Omi memories
- `POST /api/user-facts` - Manually add fact
- `POST /api/user-facts/sync-omi` - Sync facts from Omi
- `GET /api/stats/overview` - Overall progress stats
- `GET /api/stats/weekly` - Weekly heatmap data
- `GET /api/achievements` - Get achievements

### 💬 Learning Items
- `GET /api/learning-items` - Get all learning items (idiomatic corrections)
- `POST /api/learning-items` - Create manual learning item

### 💬 Chat
- `GET /api/chat/messages?challengeId={id}` - Get chat history
- `POST /api/chat/send` - Send chat message (AI-powered responses)
- `DELETE /api/chat/clear` - Clear chat history

## Omi Device Integration

The app deeply integrates with the Omi wearable device for seamless language learning:

### 📡 Audio Pipeline
1. **Omi captures audio** (PCM16 format, 16kHz, mono)
2. **Sent to server** at `/api/omi/hub?event=audio&uid={USER_UID}`
3. **Buffered until ~60 seconds** (1,920,000 bytes)
4. **WAV file created** (44-byte header + PCM data)
5. **Uploaded to GCP**: `gs://bucket/{userId}/compiled/{timestamp}.wav`

### 💬 Memory Processing
1. **Conversation ends** → Omi sends memory event with transcript
2. **Automatic fact extraction** from:
   - Structured title and overview
   - Action items
   - Location data
   - Conversation context
3. **Challenge auto-matching**:
   - Detects active challenges
   - Finds relevant audio files (handles >60s responses)
   - Analyzes with both transcript AND audio
   - Awards XP based on performance
4. **Speech analysis** (no trigger phrases!):
   - ALL user speech analyzed for learning opportunities
   - Creates learning items for idiomatic improvements
   - Focuses on naturalness over correctness

### 🎯 Challenge Flow
```
User speaks → Omi memory event → Check for active challenge
   ↓
   YES: Auto-submit response
   ├─ Find audio files in time range
   ├─ Download WAV files from GCP
   ├─ Send to Gemini (transcript + audio)
   └─ Get real pronunciation scores

   NO: Analyze for learning
   ├─ Extract user facts for future challenges
   └─ Create learning items from speech
```

### 🛠️ Chat Tools Available
- `analyze_speech` - Get idiomatic feedback on your speech
- `suggest_practice` - Receive personalized practice recommendations
- `status` - Check your learning progress
- `challenges` - View available practice challenges

## Development

### Database Schema Updates

After modifying `shared/schema.ts`, push changes to the database:

```bash
npm run db:push
```

### Type Safety

The project uses TypeScript throughout. Run type checking:

```bash
npm run check
```

### Adding New Routes

1. Define route handlers in `server/routes.ts`
2. Add corresponding API calls in client using TanStack Query
3. Update shared types in `shared/schema.ts` if needed

## Design System

The app follows a gamified design approach inspired by Duolingo and modern SaaS applications:

- **Typography**: Inter (body) + Fredoka (headings)
- **Colors**: Playful gradients with accessible contrast
- **Components**: Consistent spacing using Tailwind's 4px scale
- **Animations**: Smooth transitions with Framer Motion

See `design_guidelines.md` for detailed design specifications.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- All API keys and credentials use environment variables
- Session management with secure cookies
- Input validation with Zod schemas
- SQL injection prevention through Drizzle ORM

**Never commit:**
- `.env` files
- API keys or credentials
- Service account JSON files
- Private keys

## License

MIT

## 🎯 Key Innovation: Idiomatic Learning

Traditional language apps teach you to be **grammatically correct**. Omi LinguaLearn teaches you to **sound like a native speaker**.

**Example:**
```
❌ Textbook (correct but unnatural):
"Yo fui a Japón dos veces. Fue muy bonito. Me gustó mucho la comida."

✅ Native (idiomatic and natural):
"Fui a Japón un par de veces. Fue una pasada. La comida me flipó."
```

**Our AI Feedback:**
```json
{
  "corrections": [
    {
      "original": "Fue muy bonito",
      "corrected": "Fue una pasada / Fue alucinante",
      "explanation": "Natives use more expressive idioms like 'fue una pasada' instead of textbook 'muy bonito'",
      "category": "idiomatic"
    }
  ],
  "pronunciationScore": 82,  // From ACTUAL audio analysis!
  "suggestions": [
    "Work on rolling your 'r' sounds - detected slight English accent in the audio"
  ]
}
```

## Acknowledgments

- [Omi](https://omi.me) - Wearable device integration
- [Google Gemini](https://ai.google.dev/) - AI-powered language analysis with multimodal audio support
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Tailwind CSS](https://tailwindcss.com/) - Styling framework
- [Google Cloud Storage](https://cloud.google.com/storage) - Audio file storage and management

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review the design guidelines

---

Built with love for language learners everywhere.
