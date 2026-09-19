# DryRun

Local-first system design mock interview practice against an AI interviewer, with whiteboard, live speech-to-text, and exportable session artifacts.

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

## Evaluation workflow (default)

DryRun does **not** require local OpenRouter evaluation.

1. Finish the interview and open the **report** page.
2. **Download PDF** (analysis packet).
3. Give that PDF to a strong external model and say: **follow the last page** (“How to evaluate this packet”).
4. Optionally **Download analysis bundle** (zip) if you want separate snapshot PNGs and `ANALYSIS_PROMPT.md`.

**Local evaluation** (optional): in **Settings**, enable **Local evaluation (uses OpenRouter credits)** to run the built-in rubric engine on the report page.

See `PROJECT.md` for architecture, pinned integration facts, and the phase roadmap.
