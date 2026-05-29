# Scrybe

Scrybe is a self-hosted media toolkit: download audio and video with [yt-dlp](https://github.com/yt-dlp/yt-dlp), transcribe it through [OpenRouter](https://openrouter.ai), and replay transcripts with **word-level sync** from object storage.

Two modules, one app — loosely coupled, built on Next.js.

| Module | Route | What it does |
|--------|-------|--------------|
| **Downloader** | `/download` | Inspect URLs, pick formats, queue yt-dlp jobs |
| **Transcriber** | `/transcribe` | Upload or ingest audio, chunk with ffmpeg, transcribe, export |
| **Player** | `/transcribe/[jobId]` | Range-streamed playback with clickable, highlighted words |

---

## How it works

```
Browser  →  Next.js (UI + API)  →  Postgres (jobs, settings)
                    ↓
              Worker process  →  yt-dlp / ffmpeg / OpenRouter
                    ↓
              S3-compatible storage (sources, chunks, transcripts)
```

HTTP handlers enqueue work. A separate **worker** drains the queue — one download job and one transcription job at a time by default. All durable files live in object storage; the app never serves multi-gigabyte uploads from local disk.

Infrastructure is **remote**: point environment variables at your Postgres and S3 bucket. No Docker Compose required.

---

## Prerequisites

**On the machine running the app and worker:**

- Node.js 20+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [ffmpeg](https://ffmpeg.org) and ffprobe

**Remote services:**

- PostgreSQL
- S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, etc.)
- [OpenRouter](https://openrouter.ai) API key (transcriber only)

---

## Quick start

```bash
git clone <repo-url> scrybe && cd scrybe
npm install
cp .env.example .env   # fill in remote DATABASE_URL, S3, OPENROUTER_API_KEY
npm run db:push        # apply schema to Postgres
```

Run the web app and worker in separate terminals:

```bash
npm run dev            # http://localhost:3000
npm run worker         # drains download + transcription queues
```

Open `/download` to fetch media, or `/transcribe` to upload audio and manage transcription jobs.

---

## Environment

Copy [`.env.example`](.env.example) and configure:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Remote Postgres connection string |
| `AWS_S3_ENDPOINT` | Yes | S3-compatible endpoint URL |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Yes | Storage credentials |
| `AWS_S3_BUCKET_NAME` | Yes | Target bucket |
| `AWS_S3_FORCE_PATH_STYLE` | Yes | `true` for MinIO-style; `false` for native AWS S3 |
| `OPENROUTER_API_KEY` | Transcriber | STT / chat model access |
| `YTDLP_PATH` | Download | Path to yt-dlp binary (default: `yt-dlp`) |
| `FFMPEG_PATH` / `FFPROBE_PATH` | Transcriber | ffmpeg binaries (default: `ffmpeg`, `ffprobe`) |
| `TRANSCRIBE_UPLOAD_MAX_BYTES` | No | Upload cap (default: 1 GiB) |
| `WORKER_CONCURRENCY` | No | Parallel jobs per worker (default: 1) |

The download module can inspect URLs without Postgres or storage. Transcription requires all three: Postgres, S3, and OpenRouter.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run worker` | Background job processor |
| `npm run db:push` | Push Drizzle schema to Postgres |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:reset` | Reset database (destructive) |
| `npm run lint` | ESLint |

---

## UI overview

**Download** — paste a URL, inspect formats, choose a preset (MP3, AAC, MP4, …), and track job progress. Completed downloads can be sent straight to the transcriber.

**Transcribe** — jobs table is the home screen. Click **New Transcript** to upload a file or fetch from URL. Configure chunk size, model, and an optional system prompt. Upload progress is shown while the file streams to storage.

**Player** — completed jobs open a synced transcript view. Click any word to seek; export JSON or Markdown.

---

## API

REST endpoints under `/api/download/*` and `/api/transcribe/*`. Notable routes:

- `GET /api/download/info?url=` — metadata preview (no job)
- `POST /api/download/jobs` — start a download
- `POST /api/transcribe` — upload audio (raw body + query params)
- `GET /api/transcribe/jobs/[id]/audio` — range-request streaming
- `GET /api/transcribe/jobs/[id]/transcript` — word-level JSON
- `POST /api/download/jobs/[id]/transcribe` — bridge download → transcription

See [`specs.md`](specs.md) for full contracts and [`design.md`](design.md) for architecture and data models.

---

## Project layout

```
app/
  download/          Downloader UI
  transcribe/        Transcriber UI + synced player
  api/               Route handlers
components/          shadcn/ui + feature components
lib/
  download/          yt-dlp wrapper and job processor
  transcribe/        Chunker, OpenRouter client, compiler
  storage/           S3 client
  db/                Drizzle schema and queries
  worker/            Shared job queue
workers/
  server.ts          Standalone worker entrypoint
```

---

## Production notes

- Run **at least two processes**: the Next.js server and `npm run worker`. They share Postgres and S3 via env vars.
- Ensure the S3 bucket exists and credentials have read/write access. The app creates keys under `downloads/` and `jobs/`.
- ffmpeg and yt-dlp must be on `PATH` (or set explicitly in env) wherever the worker runs.
- Set `AWS_S3_FORCE_PATH_STYLE=false` when using native AWS S3 without a custom endpoint.

---

## License

Private — see repository settings.
