# DryRun

Local-first system design mock interview practice (Phase 1: scaffold and app shell).

## Prerequisites

- Node.js 20+
- npm

## Install

```bash
npm install
```

## Database

Create the SQLite database and apply migrations:

```bash
mkdir -p data
npx prisma migrate deploy
```

(Or `npx prisma migrate dev` during development after schema changes.)

The database file is stored at `./data/dryrun.db` (gitignored).

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build
npm start
```

## Environment

Copy `.env.example` to `.env` and set `DATABASE_URL`. API keys (`DEEPGRAM_API_KEY`, `OPENROUTER_API_KEY`) are read server-side only and never sent to the browser.

### Live transcription (Phase 3)

- `DEEPGRAM_API_KEY` must have **Member scope or higher** — lower-scoped keys cannot mint the short-lived browser grant tokens used by `POST /api/deepgram/token`.
- The browser asks for **microphone permission** the first time you press **Start mic**. Chrome only grants it on `localhost` or HTTPS.
- **Headphones are strongly recommended.** They prevent the microphone from transcribing the interviewer and allow sustained-speech barge-in.
- If you use speakers, open Settings and turn **I am using headphones** off. Automatic barge-in is then disabled; use the message Stop button or Escape to stop interviewer audio manually.

See `PROJECT.md` for architecture, pinned integration facts, and the phase roadmap.
