# Self-hosting and integrations

Start with the [README](../README.md) for the seeded demo. This page covers optional providers, the authenticated Omi relay, and privacy limits for real data.

## Remote deployment

Set `PUBLIC_ORIGIN` to the exact HTTPS browser origin and `HOST=0.0.0.0` behind a TLS reverse proxy. Configure proxy request and time limits. The app fails closed without a strong `APP_ACCESS_TOKEN`. Keep all credentials in server-side environment variables, never in Git or client variables. Scripts load `.env` automatically.

With no `OMI_UID`, the operator sees seeded demo data. A configured `OMI_UID` creates a separate workspace with demo facts disabled by default. Application data and sessions are in memory and disappear on restart; the Drizzle schema is not connected to runtime PostgreSQL.

## Optional integrations

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-side Google Gemini credential; required for feedback and coach chat |
| `GEMINI_MODEL` | Model override; defaults to `gemini-2.5-flash` |
| `OMI_UID` | The single allowed Omi account, 20–128 alphanumeric characters |
| `OMI_WEBHOOK_SECRET` | Separate random secret of at least 32 characters for authenticated relay delivery |
| `GCP_BUCKET_NAME` | Private application audio bucket |
| `GCP_SERVICE_ACCOUNT_JSON` | Server-side service account JSON with access restricted to that bucket |

### Webhook relay contract

Ingestion is **disabled** until both `OMI_UID` and `OMI_WEBHOOK_SECRET` are configured. Native Omi support for sending these authentication headers has not been verified. Use a trusted relay that verifies Omi's upstream delivery and adds the credentials below, or leave ingestion disabled. An unverified public relay would defeat this boundary.

Only these POST routes accept relay authentication:

- `/api/omi/hub` (event auto-detection, or `event=memory|transcript|audio|setup_complete`)
- `/api/omi/webhook/memory`, `/api/omi/webhook/transcript`, `/api/omi/webhook/audio`
- `/api/omi/setup-complete`

Each callback must include:

- Query `uid` matching the configured account; optional `session_id` with 1–128 letters, digits, underscores, or hyphens.
- `Authorization: Bearer <OMI_WEBHOOK_SECRET>`.
- `X-Event-Id`: a unique 16–128 character event ID (UUIDs work).
- `X-Event-Timestamp`: current Unix time in milliseconds, within five minutes.

IDs are retained for ten minutes to reject duplicate delivery. Retries of a rejected or failed request need a new event ID; the relay must determine whether an operation completed before retrying. This prototype does not provide durable exactly-once processing. Public Omi chat tools are disabled; their internal routes require an operator session.

JSON is limited to 64 KiB; PCM requests to 2 MiB. PCM must be mono, 16-bit, even byte length, at 8/16/24/48 kHz. At most four API requests run concurrently. The hub buffers up to eight sessions / 16 MiB with a five-minute idle expiry and uploads minute-long WAV segments. Partial final minutes are not flushed and can expire. Failed uploads retain the pending minute in the bounded pool until a later attempt succeeds or the idle timeout expires. Direct audio callbacks store up to eight chunks per session for manual compilation. Cloud reads are restricted to the configured bucket and account prefix, with a 6 MiB per-object and eight-object analysis limit.

## Privacy and limitations

- Browser sign-in exchanges the operator token for an HttpOnly, SameSite=Strict session cookie with a 12-hour lifetime. Remote cookies require HTTPS. Logout cancels queries and clears cached private data.
- User identifiers supplied by clients do not grant access. Numeric records are checked against the authenticated owner.
- Audio, transcripts and memories can contain other people's speech. Only ingest material you have permission to process. Relevant text/audio is sent to Google when AI features run; recordings remain in your private GCS bucket.
- API responses, transcripts, account identifiers and credentials are not logged by the application. Review your reverse proxy and hosting log settings separately.
- Reset clears local learning and audio metadata. It does **not** delete GCS recordings or provider-held data; delete recordings separately and configure a bucket lifecycle policy.
- Gemini scores are model-generated practice feedback, not a validated language proficiency assessment. CEFR is shown as unassessed.
- No live Omi, Gemini, GCS or hosting deployment was exercised by the offline regression suite. Durable storage, production identity management, persistent replay protection, a reliable queue, and end-to-end provider tests remain future work.
