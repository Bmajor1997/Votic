# OpenAI backend setup and accounting

Use Node 24 or newer. The server uses Node's SQLite module; no new provider SDK or mobile secret is needed.

## Enter the key securely, before a live test

For local development, copy the repository-root `.env.example` to `.env.backend.local`. Open **`.env.backend.local` in your local editor** and enter the secret only on its `OPENAI_API_KEY=` line. This file is ignored by Git. Set `FIREBASE_PROJECT_ID` to your existing Votic Firebase project and start **the backend** with:

```sh
node --env-file=.env.backend.local votic_server.js
```

Do not put this file in `apps/mobile`, use `EXPO_PUBLIC_OPENAI_*`, paste the key into chat, or put its value in a terminal command. No actual secret was used in automated tests. Before committing, check `git status` and `git check-ignore .env.backend.local`. The public server serves only its existing asset allowlist, never environment files or the ledger.

For a hosted backend, enter `OPENAI_API_KEY` directly in **the Votic backend service's Environment/Secrets settings**. The repository does not identify a hosting provider, so a provider-specific screen cannot yet be named. Do not enter it in Expo/EAS mobile build variables. Set `NODE_ENV=production`, `FIREBASE_PROJECT_ID`, and `VOTIC_AI_USAGE_DB` to a path on a private persistent volume. Restart the backend after saving. Production startup refuses to enable AI without account authentication and persistent accounting.

Responses Write is needed for text/image calls. The initial model is `gpt-6-luna`; existing `OPENAI_MODEL`, `OPENAI_DOCUMENT_MODEL`, `OPENAI_REVIEW_MODEL`, and `OPENAI_OCR_MODEL` overrides remain supported. An alternate model requires an explicit pricing entry in `VOTIC_AI_PRICES_JSON`, for example `{"model-id":{"input":1,"cached":0.1,"cache_write":1.25,"output":5}}` (USD per million tokens). Check that model's prices before enabling it. Requests force Standard processing, `store:false`, and GPT-6 reasoning effort `none`, with existing bounded output sizes.

## What was inspected and preserved

- Ask Votic already had `/api/help`, opt-in document context, bounded conversation history, explanation styles, structured answers and verified section links. These remain in use.
- Catch Me Up already passes progress-bounded excerpts to Ask Votic. It now labels those calls `catch-me-up` for accounting.
- Check My Understanding builds questions and self-check feedback locally. It does not make paid model calls.
- Smart Cleanup is local PDF/Word/webpage cleanup, with webpage SSRF protections. It does not make paid model calls.
- AI document review (`/api/review`) and camera OCR (`/api/scan`) share the new accounting gateway. Local review fallback remains available.
- UI, Firebase sign-in, onboarding, RevenueCat paywall and device speech remain in their existing flows. Allowances are backend configuration; they are not inferred from unverified mobile paywall state or RevenueCat entitlement claims.

## Limits and ledger

| Backend variable | Default | Meaning |
|---|---:|---|
| `VOTIC_AI_USAGE_DB` | in-memory in development | Persistent private SQLite path; required for production AI |
| `VOTIC_AI_MONTHLY_TOKENS` | 2,000,000 | Input plus output allowance per verified account per UTC calendar month |
| `VOTIC_AI_USER_MONTHLY_BUDGET_USD` | 5 | Estimated cost cap per account per UTC month |
| `VOTIC_AI_MONTHLY_BUDGET_USD` | 100 | Estimated cost cap across all users per UTC month |
| `VOTIC_AI_CLIENT_DAILY_LIMIT` / `VOTIC_AI_DAILY_LIMIT` | 100 / 1,000 | Per-account / global paid attempts per UTC day |
| `VOTIC_AI_USER_RATE_LIMIT` | 20 | Paid attempts per account per rolling minute, across features |
| `VOTIC_AI_USER_CONCURRENCY` | 2 | Pending calls per account, across features |

The existing IP/body/extraction/rate controls remain active. The durable limits use the verified Firebase UID, not any user ID sent in the request body. Development without authentication uses the network address. `X-Forwarded-For` is trusted only with the existing configured trusted proxy count. Mobile client keys are public abuse filters, not account authentication.

Before an upstream request, a SQLite `BEGIN IMMEDIATE` transaction checks all budgets and inserts a conservative reservation. Text reserves UTF-8 bytes plus overhead and the output cap; scan images also reserve a minimum 50K input tokens; short voice recordings reserve the transcription model's full context/output limits. Large images may be refused conservatively even if actual usage would be smaller. Successful responses replace reservations with actual provider usage. Rejected allowances return 429 and do not call OpenAI. Existing daily-cap/local fallback behavior remains intact.

The private `ai_usage` table records a generated request UUID, verified user identifier, feature, model, start/end timestamps, provider request/response identifiers, input/output/cached/cache-write/total tokens, pricing snapshot, estimated USD cost, status and whether usage is known. Cached tokens are part of input and are not added twice. Cost subtracts cached/cache-write tokens from ordinary input, then prices each category separately. Output includes reasoning tokens. The GPT-6 Luna >272K input premium is included. Prices were verified on 2026-10-05 and are estimates, not a billing invoice.

Missing or malformed usage is stored as **null**, never fabricated as zero; full reservations remain charged to allowance. Timeouts, unparseable provider replies, 5xx errors and crashed pending calls also retain reservations. Completed but incomplete/invalid answers still account for provider usage. Provider 4xx rejections release the token/cost reservation but retain the attempt for abuse limits. There are no automatic retries.

Operators may inspect the table with an offline SQLite tool on the backend host. Reconcile unknown/pending charges with provider request IDs before manually adjusting any reservation; never clear the table to reset a limit. Pending rows from a crash also consume concurrency until reconciled. Back up the ledger, restrict directory access to the backend account, and keep the same file on restart. No document text, questions, audio, API keys, Firebase tokens, or raw provider errors are stored or logged.

Multiple processes on **one host sharing the same SQLite file** coordinate reservations. Separate machines or isolated container disks do not share allowances: deploy one backend instance with a persistent volume, or replace the store with a transactional shared database before scaling horizontally. Do not use an ephemeral filesystem or network-mounted SQLite for this design.

## Voice question foundation

`POST /api/transcribe-question` requires verified sign-in, `OPENAI_API_KEY`, and `VOTIC_VOICE_QUESTIONS_ENABLED=true`. Voice is disabled by default. Request content type is `audio/wav`; the body is a 16-bit PCM WAV file (mono/stereo, 8–48 kHz, at most 60 seconds and 12 MB). Duration, block alignment and container lengths are verified from the bytes. Compressed formats are deferred until a trusted decoder can enforce their duration/expansion limits.

The backend sends multipart audio to `/v1/audio/transcriptions` using `gpt-4o-mini-transcribe`, records usage with feature `ask-votic-transcription`, and returns only `{text}`. No upload is saved. Transcripts over Ask Votic's 1,000-character question limit are rejected. Transcription and the subsequent answer are separate paid requests, both counted. Enable the transcription endpoint permission on the restricted backend key when turning voice on; speech-generation permission is not needed.

Mobile Ask Votic now checks `POST /api/voice-question-status` after microphone permission and before opening capture. This authenticated endpoint returns `{ready:true}` only when server-side sign-in verification, the backend key, and the voice opt-in are configured. It does not call the provider or reserve paid usage. Deploy the backend and mobile changes together; an older server has no readiness endpoint.

The recorder captures up to 60 seconds of 16-bit PCM using the hardware's actual sample rate/channels, builds a WAV, and sends it via `transcribeVoiceQuestion(bytes, signal)`. Stop releases capture, then shows processing and an editable transcript; sending the question remains a separate user action. A failed transcription retains the bounded WAV in memory for an explicit Retry, preserving typed text. Cancel, discard, backgrounding, navigation away, and unmount abort requests and clear audio. There are no automatic paid retries. Canceling an in-flight upload cannot guarantee that the provider has not already processed it.

### If the phone records but words never appear

- In the **backend** environment, configure `OPENAI_API_KEY`, `FIREBASE_PROJECT_ID` (the same project as mobile sign-in), and `VOTIC_VOICE_QUESTIONS_ENABLED=true`; restart the server. Without `FIREBASE_PROJECT_ID`, the default development authorizer cannot produce a verified UID even if the phone sends a token.
- For production, also configure `NODE_ENV=production` and persistent `VOTIC_AI_USAGE_DB` as described above. Keep all OpenAI secrets on the backend.
- Sign in on the phone. Configure mobile `EXPO_PUBLIC_VOTIC_API_URL` to the reachable backend address. An Expo/Metro tunnel exposes the JavaScript bundler, not automatically the backend on port 4173; a remote phone needs a separately reachable backend address. Rebuild/reload the bundle after changing public environment settings.
- Ensure the restricted backend OpenAI key allows the audio transcription endpoint and the project can use `gpt-4o-mini-transcribe`. The readiness check establishes local configuration, not provider credentials or model access; validate with one short real recording.
- Verify the full Android flow with pauses, keyboard open/closed, small screens, larger font scaling, denied permission, cancellation, unavailable service, and retry. Automated tests mock microphone input and provider responses; an Android bundle export cannot prove real-device transcription or layout. V1 spoken answers and narration continue with `expo-speech` / device TTS.

## Verification

Run backend `npm test`; mobile `npm run typecheck`, `npm run test:reliability`, and `npm run test:components -- --runInBand`. On Windows environments that restrict child processes, reliability tests can use `--configLoader native --maxWorkers=1 --pool=threads`. The integration tests use raw REST response shapes and mock credentials, cover accounting across existing paid features, concurrent reservations, shared-file persistence/restart/month rollover, incomplete/failure paths, WAV validation and account protection.

After entering the actual key securely, perform a small opt-in document question and confirm a `completed` ledger row with real usage and provider IDs. Test the disabled/enabled voice path separately after enabling transcription permission. Live provider availability and your project's model access cannot be established by mock tests.

Official sources: [GPT-6 Luna and rates](https://developers.openai.com/api/docs/models/gpt-6-luna), [Responses output structure](https://developers.openai.com/api/docs/guides/migrate-to-responses), [file transcription](https://developers.openai.com/api/docs/guides/speech-to-text), [transcription model](https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe).
