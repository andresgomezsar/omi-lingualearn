# Omi LinguaLearn

A gamified language learning platform integrated with the Omi wearable device, featuring voice challenges, AI-powered feedback, and personalized coaching.

## Overview

Omi LinguaLearn transforms language learning into an engaging, personalized experience by combining real-time voice challenges with AI-powered analysis. Integrated with the Omi wearable device, it allows users to practice their target language naturally through conversation and receive instant feedback on grammar, vocabulary, and pronunciation.

## Features

### Voice Challenges
- AI-generated personalized speaking prompts based on user memories and facts
- Real-time speech-to-text transcription
- Comprehensive feedback with grammar, vocabulary, and pronunciation scores
- Difficulty levels: Beginner, Intermediate, Advanced
- Targeted language goals (past tense, subjunctive mood, idiomatic expressions, etc.)

### Gamification
- XP and streak tracking system
- Achievement badges
- Weekly progress heatmaps
- Level progression
- Progress statistics and visualization

### AI Coaching
- Dedicated chat feature for language coaching
- Gemini AI-powered conversational practice
- Contextual corrections and suggestions
- Personalized learning recommendations

### Omi Integration
- WebSocket connection for real-time device communication
- Voice challenge delivery through the Omi device
- Audio recording and analysis
- Chat tools integration for in-conversation language assistance

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
- **Google Gemini AI** for:
  - Challenge generation
  - Speech analysis and feedback
  - Language coaching chat
- **Gemini 2.0 Flash** model for low-latency responses

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

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# Google Cloud Storage (optional - for audio storage)
GCP_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GCP_BUCKET_NAME=your_bucket_name

# Session (automatically generated in development)
SESSION_SECRET=your_session_secret_here
```

### Getting API Keys

**Gemini API Key:**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy it to your `.env` file

**GCP Storage (Optional):**
1. Create a Google Cloud project
2. Enable Cloud Storage API
3. Create a storage bucket
4. Create a service account with storage permissions
5. Download the JSON key file
6. Stringify the JSON and add to `.env`

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

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Omi Integration
- `GET /.well-known/omi-tools.json` - Omi tools manifest
- `POST /api/omi/tools/analyze` - Analyze speech for language feedback
- `POST /api/omi/tools/practice` - Get practice suggestions
- `GET /api/omi/setup` - Setup page for Omi integration
- `POST /api/omi/auth` - Authenticate Omi user

### Voice Challenges
- `GET /api/challenges` - List all challenges
- `POST /api/challenges` - Create new challenge
- `POST /api/challenges/:id/submit` - Submit challenge response
- `GET /api/challenges/:id/feedback` - Get AI feedback

### User Progress
- `GET /api/user/facts` - Get user learning facts
- `POST /api/user/facts` - Add new fact
- `GET /api/user/stats` - Get progress statistics
- `GET /api/user/achievements` - Get achievements

### Chat
- `GET /api/chat/history` - Get chat history
- `POST /api/chat/message` - Send chat message

## Omi Device Integration

The app integrates with the Omi wearable device through WebSocket connections and REST APIs:

1. **Setup**: Users authenticate via `/api/omi/auth` with their Omi UID
2. **Real-time Communication**: WebSocket connection for live challenges
3. **Chat Tools**: In-conversation language assistance through Omi's chat interface
4. **Audio Processing**: Voice recordings are transcribed and analyzed for feedback

### Chat Tools Available
- `analyze_speech` - Get feedback on pronunciation and grammar
- `suggest_practice` - Receive personalized practice recommendations

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

## Acknowledgments

- [Omi](https://omi.me) - Wearable device integration
- [Google Gemini](https://ai.google.dev/) - AI-powered language analysis
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Tailwind CSS](https://tailwindcss.com/) - Styling framework

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review the design guidelines

---

Built with love for language learners everywhere.
