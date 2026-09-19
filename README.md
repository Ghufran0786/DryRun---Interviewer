# DryRun — AI System Design Mock Interviewer

DryRun is a local-first web app for practicing system design interviews against an AI interviewer that **listens to you speak, watches your whiteboard, talks back, and manages the clock**. When the interview ends, it produces a PDF analysis packet you can hand to any strong LLM for a bar-raiser style evaluation.

It runs on your machine with your own API keys. No accounts, no hosted service, no data leaves your computer except the API calls you configure.

## What it does

- **Whiteboard**: an embedded [Excalidraw](https://excalidraw.com) canvas, the same tool used in many real remote interviews. Snapshots are captured automatically when the board changes.
- **Live speech-to-text**: your voice streams to Deepgram Nova-3 with a server-minted token; the transcript appears live with interim results and timestamps. Custom keyterms improve recognition of your name and technical vocabulary.
- **AI interviewer**: asks the problem, listens, probes trade-offs, nudges when you stall, and moves the interview through six phases (Requirements → Estimation → API → High-Level Design → Deep Dive → Wrap-up) on a time budget. It sees the current whiteboard image plus a text digest of your boxes and arrows.
- **Voice**: the interviewer speaks its questions aloud. **Browser voice** is free and the default (`window.speechSynthesis`). On Windows, use **Microsoft Edge** for the best built-in Natural voices. **OpenRouter** TTS is optional and billed per character. Barge-in: talk over it and it stops (with headphones).
- **Analysis packet**: a monochrome PDF with the transcript, phase timeline, stats, every whiteboard snapshot with its digest, and an evaluation prompt on the last page. A zip export bundles the same material as markdown, JSON, and PNGs.
- **Optional local evaluation**: an 8-dimension rubric scored by an LLM of your choice (off by default to save credits).

## Requirements

- Node.js 20 or newer, npm
- A **Deepgram** API key with **Member scope or higher** (needed to mint short-lived tokens). Get one at https://console.deepgram.com — choose the scope under "Advanced" when creating the key.
- An **OpenRouter** API key with a small credit balance. Get one at https://openrouter.ai/keys
- Headphones (strongly recommended; otherwise the mic hears the interviewer)
- A Chromium-based browser

## Quick start

```bash
git clone https://github.com/Ghufran0786/DryRun---Interviewer.git
cd DryRun---Interviewer
npm install
cp .env.example .env        # then paste your two keys into .env
mkdir -p data
npx prisma migrate deploy
npm run dev
```

Open http://localhost:3000.

`npm run dev` starts **one** Next.js process on port 3000. Speech streams directly to Deepgram with a short-lived token from the server (`DEEPGRAM_TRANSPORT=direct`, the default).

Set `DEEPGRAM_TRANSPORT=proxy` to also start the legacy Deepgram proxy on port 3001 (two processes).

| Port | Process | When |
|------|---------|------|
| 3000 | Next.js | Always |
| 3001 | Deepgram proxy | Only when `DEEPGRAM_TRANSPORT=proxy` |

If you see `EADDRINUSE`, an older instance is still up; stop all Node processes and run `npm run dev` again.

## Hosted mode (Vercel + Supabase)

For a personal deployment (authentication arrives in a later release), set:

| Variable | Purpose |
|----------|---------|
| `APP_MODE` | `hosted` — Postgres + Supabase Storage adapters |
| `DATABASE_URL` | Supabase pooled Postgres connection string |
| `DIRECT_URL` | Supabase direct connection (migrations) |
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for private snapshot bucket I/O |
| `SUPABASE_SNAPSHOT_BUCKET` | Private bucket name for PNG snapshots |

Build on Vercel with `npm run build:hosted`. Local clones keep `APP_MODE=local` and need only SQLite plus API keys.

## First-run setup

1. **Settings → Models.** Pick an OpenRouter model ID for each role and click **Test models**. Suggested starting point:
   - Classifier: a flash-lite class model (cheap, runs on every utterance)
   - Interviewer: a flash-class model with image input (the interviewer needs to see the board)
   - Evaluator: only used if you enable local evaluation
2. **Settings → Voice.** Leave **Browser voice — free** selected (default), pick a voice if you like, and click **Test voice**. On Windows, Edge gives the richest Natural voices. OpenRouter is optional and billed per character. Leave "Using headphones" on if you are; turn it off if you use speakers (barge-in becomes manual only).
3. **Settings → Keyterms.** Add your name and any vocabulary Deepgram keeps mishearing, one per line.
4. **Settings → Candidate.** Enter your name and target level. Paste your resume text if you want evaluations to judge role fit.

## Running an interview

1. Dashboard → **New interview**, pick a problem (default: "Design LeetCode") and target level.
2. **Start mic**, then **Begin interview**. The interviewer states the problem and hands over.
3. Talk through your design out loud and draw as you go. The interviewer probes, nudges if you stall for ~50 seconds, and advances phases when the budget runs out.
4. **End interview**. The final board is captured automatically.
5. On the report page, **Download PDF**. Give it to a strong model (Claude, GPT, Gemini, etc.) and say "follow the instructions on the last page." You get a verdict, scores with cited evidence, the three worst moments with better answers, a model interview, an ideal whiteboard, and a drill plan.

Tips that materially change your score: open by stating your phase plan out loud, reach the high-level design by minute 15, choose your own deep dive, and offer a hypothesis instead of asking the interviewer for the answer.

## Cost

The interview loop is designed to be cheap: filler and short fragments never reach a model, context is bounded, and images are only sent when the board changes. Browser TTS is free; a 45-minute mock on flash-class models typically costs a few cents if you stay on browser voice. OpenRouter TTS adds per-character cost. Evaluation is free when you use the PDF with an external model. Token usage per session is shown on the dashboard; OpenRouter TTS character usage appears on the report when greater than zero.

## Architecture in one paragraph

Next.js App Router with TypeScript, Tailwind, Prisma and SQLite (`data/dryrun.db`) in local mode. The browser streams `audio/webm;codecs=opus` over a WebSocket to Deepgram using a short-lived bearer token from `POST /api/deepgram/token`. Finalized transcript segments persist immediately; interim results are display-only. Turn-taking separates *detection* (Deepgram utterance boundaries plus a short client timer) from *reasoning* (a cheap classifier decides whether to respond; only then does the interviewer model generate a line). Whiteboard snapshots are event-driven and stored as PNG plus Excalidraw element JSON, from which a text digest is derived. The persisted session (transcript, snapshots, interventions, timings) is the source of truth; the PDF is a render of it. `PROJECT.md` documents the pinned technical facts that shaped every one of these decisions.

## Troubleshooting

- **"DEEPGRAM_API_KEY is not configured"** after adding it: environment variables are read when the server starts. Stop and rerun `npm run dev`.
- **Mic fails to connect**: check the key has Member scope. Open **Settings → Deepgram doctor** (`/debug/deepgram`) and run the four tests in order; each isolates one layer.
- **Interviewer never replies**: Settings → Test models. A mistyped model ID is the most common cause and shows there as an error.
- **Interviewer's own voice appears in the transcript**: wear headphones, or turn "Using headphones" off in Settings.
- **Blank boxes in snapshot PNGs**: Excalidraw loads its fonts from a CDN; the app needs internet access at capture time.

## Project status

Feature-complete for local single-user use. A hosted mode (Postgres, object storage, authentication) is being explored for personal deployments. Contributions and issues are welcome.

## License

MIT. See `LICENSE`.

## Disclaimer

DryRun is a practice tool. Its verdicts are model-generated opinions, not hiring decisions, and it is not affiliated with LeetCode, Excalidraw, Deepgram, OpenRouter, or any employer.
