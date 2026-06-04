# Scrybe

Scrybe is a self-hosted audio transcriber: upload files or fetch media from URLs with [yt-dlp](https://github.com/yt-dlp/yt-dlp), transcribe through [OpenRouter](https://openrouter.ai), and replay transcripts with **word-level sync** from object storage.

Built on Next.js with a transcript-centric UI.

| Surface | Route | What it does |
|---------|-------|--------------|
| **Transcripts** | `/transcribe` | Library, folders, new upload/URL jobs |
| **Player** | `/transcribe/[jobId]` | Full-width transcript reader with docked playback |

---

## How it works

```
Browser  →  Next.js (UI + API)  →  Postgres (jobs, settings)
                    ↓
              Worker process  →  yt-dlp / ffmpeg / OpenRouter
                    ↓
              S3-compatible storage (sources, chunks, transcripts)
```

HTTP handlers enqueue work. A separate **worker** drains the transcription queue (URL fetch + chunking + STT). All durable files live in object storage.

Infrastructure is **remote**: point environment variables at your Postgres and S3 bucket.

---

## Prerequisites

**On the machine running the app and worker:**

- Node.js 20+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — standalone binary (for URL import)
- [ffmpeg](https://ffmpeg.org) and ffprobe

**Remote services:**

- PostgreSQL
- S3-compatible object storage
- [OpenRouter](https://openrouter.ai) API key

---

## Quick start

```bash
git clone <repo-url> scrybe && cd scrybe
npm install
cp .env.example .env   # fill in DATABASE_URL, S3, OPENROUTER_API_KEY
npm run db:push        # apply schema to Postgres
```

Run the web app and worker in separate terminals:

```bash
npm run dev            # http://localhost:3000
npm run worker         # drains transcription queue
```

Open `/` (redirects to `/transcribe`).

**Migrating from the old download module:** run [`scripts/drop-download-tables.sql`](scripts/drop-download-tables.sql) on your database, then `npm run db:push`.

---

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `AWS_S3_*` | Yes | Object storage |
| `OPENROUTER_API_KEY` | Yes | STT / model access |
| `YTDLP_PATH` | URL import | yt-dlp binary (default: `yt-dlp`) |
| `YTDLP_COOKIES_FILE` / `YTDLP_COOKIES_CONTENT` | No | YouTube auth |
| `FFMPEG_PATH` / `FFPROBE_PATH` | Yes | ffmpeg binaries |
| `TRANSCRIBE_FETCH_TIMEOUT_SEC` | No | Max yt-dlp runtime per URL job (default: 3600) |
| `TRANSCRIBE_UPLOAD_MAX_BYTES` | No | Upload cap (default: 1 GiB) |
| `WORKER_CONCURRENCY` | No | Parallel jobs per worker (default: 1) |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run worker` | Background job processor |
| `npm run db:push` | Push Drizzle schema to Postgres |
| `npm run db:reset` | Reset database (destructive) |
| `npm run lint` | ESLint |

---

## UI overview

**Transcripts** — library with folders, search, and **New Transcript** (upload or URL). Desktop shows a recent-jobs sidebar on transcribe routes.

**Player** — full-width synced transcript; audio controls docked at the bottom. Click words to seek; export JSON or Markdown.

---

## API

Notable routes under `/api/transcribe/*`:

- `POST /api/transcribe` — upload audio (raw body + query params)
- `POST /api/transcribe/jobs/from-url` — start job from media URL (yt-dlp fetch → transcribe)
- `GET /api/transcribe/jobs/[id]` — job status
- `GET /api/transcribe/jobs/[id]/audio` — range-request streaming
- `GET /api/transcribe/jobs/[id]/transcript` — word-level JSON

---

## Project layout

```
app/
  transcribe/        Transcript library + player
  api/transcribe/    Route handlers
components/          UI + transcribe feature components
lib/
  media-fetch/       yt-dlp URL fetch (internal)
  transcribe/        Chunker, OpenRouter, compiler
  storage/           S3 client
  db/                Drizzle schema and queries
  worker/            Job queue
workers/
  server.ts          Standalone worker entrypoint
```

---

## Production notes

- Run **two processes**: Next.js server and `npm run worker`.
- S3 keys are created under `jobs/{id}/…`.
- ffmpeg and yt-dlp must be available wherever the worker runs.

---

## License

Private — see repository settings.
