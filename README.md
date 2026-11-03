# Omi LinguaLearn

**Learn languages naturally, one conversation at a time.**

The idea behind LinguaLearn is simple: the mistakes you make in everyday conversations can become your next lesson. Memories from [Omi](https://github.com/BasedHardware/omi)—an open-source AI wearable necklace and conversation platform—ground speaking challenges in your own life. Gemini feedback and spaced-repetition review turn corrections into practice.

Built for DevHouse as a self-hosted prototype.

<p align="center"><a href="https://github.com/BasedHardware/omi"><img src="docs/images/omi-necklace.webp" width="190" alt="Omi wearable necklace" /></a></p>

## Preview

The screenshots show the seeded demo workspace. Omi is disconnected, and AI feedback remains unassessed until the integrations are configured.

![LinguaLearn landing page with an illustrative grammar challenge](docs/screenshots/landing.png)

| Dashboard | Progress |
| --- | --- |
| ![Demo dashboard showing challenges, review counts, and connection status](docs/screenshots/dashboard.png) | ![Progress view showing weekly activity and unassessed AI feedback](docs/screenshots/progress.png) |

## Try the demo

Requires Node.js 22.12 or newer and npm. No Omi account or Google credentials are needed for the seeded workspace.

```sh
npm ci
cp .env.example .env
openssl rand -hex 32
```

Paste the generated value into `APP_ACCESS_TOKEN` in `.env`, then run:

```sh
npm run dev
```

Open `http://localhost:5000` and sign in with the same token. You can explore the dashboard, seeded challenges, learning queue, and progress. Live Omi ingestion and Gemini features require [additional setup](docs/self-hosting.md).

If port 5000 is occupied, change both `PORT` and `PUBLIC_ORIGIN` in `.env` to the same new port. The browser URL must exactly match `PUBLIC_ORIGIN`, including `localhost` versus `127.0.0.1`.

## What it does

- React dashboard with speaking challenges, a learning queue, language settings, and progress from recorded activity.
- Express API for personal memories, challenge responses, coach chat, and SM-2 review scheduling.
- Gemini generates prompts and feedback. Failed analysis does not award a score; pronunciation is unavailable when no audio is analyzed.
- Optional PCM16 ingestion and WAV storage in Google Cloud Storage, scoped to one configured Omi account.

## Setup and limitations

This is a self-hosted, single-operator portfolio prototype, not a multi-user hosted service or Omi App Store release. Data and sessions live in memory and disappear on restart. The Drizzle schema describes a future persistence layer; PostgreSQL is not connected to the runtime. Omi ingestion is disabled without a trusted authenticated relay; Gemini and cloud audio are optional. See [self-hosting, webhook, and privacy details](docs/self-hosting.md) before connecting real data or deploying remotely.

Automatic corrections currently come only from conversations classified as language practice. Other Omi conversations can provide context for challenges, but the prototype does not yet turn their mistakes into review items.

Run `npm run check`, `npm test`, and `npm run build` to verify changes. Run `npm start` after building to serve the production bundle.

## Architecture

```mermaid
flowchart LR
    Browser[React workspace] -->|operator session| API[Express API]
    Omi[Omi events] --> Relay[Trusted authenticated relay]
    Relay -->|separate credential + account binding| API
    API --> Memory[In-memory learning state]
    API --> Gemini[Gemini prompts and feedback]
    API --> GCS[Private account-scoped audio]
```

Core code: `server/security.ts` (request boundary), `server/audio-ingestion.ts` (bounded PCM pipeline), `server/gcp-storage.ts` (cloud object access), `server/gemini-challenge.ts` (feedback), and `server/storage.ts` (practice scheduling).

## License

MIT. See [LICENSE](LICENSE).
