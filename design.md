# Scrybe — High-Level System Design

> **Note:** The standalone Media Downloader (`/download`, `download_jobs`) has been removed. URL import uses `lib/media-fetch` and `POST /api/transcribe/jobs/from-url`. Download-specific sections below are historical.

This document is the **implementation blueprint** for coding agents building Scrybe.
It defines architecture, module boundaries, API contracts, data models, and UI behavior.

Scrybe is a **Next.js application** with two independent core modules behind one product:

| Module | Purpose |
|---|---|
| **Media Downloader** | Full yt-dlp wrapper — extract metadata, download media, subtitles, playlists, live streams |
| **Audio Transcriber** | Upload or ingest audio, transcribe via OpenRouter, play back from object storage with **word-level sync** |

Both modules share infrastructure (Postgres, S3-compatible storage, background workers) but remain **loosely coupled**. Either module must degrade gracefully when the other's dependencies are unavailable.

**Reference inputs:**
- yt-dlp feature surface: [yt-dlp help](https://ytdlp.online/ytdlp-help.html) (full CLI option set)
- Transcriber baseline: [`specs.md`](./specs.md) — this design **extends and overrides** where noted below

---

## 1. System architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Next.js App (Scrybe)                                │
│  ┌──────────────────────┐              ┌────────────────────────────────┐ │
│  │  Media Downloader UI │              │  Transcriber UI                 │ │
│  │  /download           │              │  /transcribe                    │ │
│  └──────────┬───────────┘              └───────────────┬────────────────┘ │
│             │                                          │                    │
│  ┌──────────▼──────────────────────────────────────────▼────────────────┐ │
│  │                    API Route Handlers (App Router)                    │ │
│  │  /api/download/*          /api/transcribe/*                           │ │
│  └──────────┬──────────────────────────────────────────┬────────────────┘ │
└─────────────┼────────────────────────────────────────────┼──────────────────┘
              │                                            │
              ▼                                            ▼
┌─────────────────────────────┐            ┌─────────────────────────────────┐
│  Download Worker             │            │  Transcription Worker            │
│  (yt-dlp subprocess)         │            │  (ffmpeg chunker + OpenRouter)   │
│  FIFO queue, 1 job at a time │            │  FIFO queue, 1 job at a time     │
└──────────────┬──────────────┘            └──────────────┬──────────────────┘
               │                                          │
               ▼                                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Postgres                          S3-compatible object storage (MinIO/AWS) │
│  download_jobs, transcribe_jobs,   downloads/{id}/…  jobs/{id}/source/…     │
│  transcribe_chunks, settings       playback-optimized audio + transcripts     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Key architectural decisions

1. **Next.js App Router** for UI and JSON/streaming API routes.
2. **Separate in-process workers** (or a dedicated worker process in production) for long-running yt-dlp and transcription jobs. HTTP handlers enqueue; workers drain queues.
3. **All durable artifacts in object storage** — never serve multi-GB files from local disk in production.
4. **Range-request streaming** from object storage for audio playback (HTTP `206 Partial Content`).
5. **Word-level transcript JSON** stored alongside (or instead of) segment Markdown for the interactive player.
6. **Module isolation:** `/download` and `/api/download/*` must work even when Postgres, storage, or OpenRouter are down (info-only endpoints that call yt-dlp directly may still work).

### 1.2 Recommended repo layout

```
app/
  download/page.tsx              # Media Downloader UI
  transcribe/page.tsx            # Transcriber UI
  transcribe/[jobId]/page.tsx    # Transcript + synced player
  api/download/…                 # Download API routes
  api/transcribe/…               # Transcriber API routes
lib/
  download/                      # yt-dlp wrapper, option builder, job processor
  transcribe/                    # chunker, OpenRouter client, word-alignment
  storage/                       # S3 client wrapper
  db/                            # Postgres pool, queries, migrations
  worker/                        # shared queue pump
workers/
  server.ts                      # optional standalone worker entry (prod)
migrations/                      # ordered SQL migrations
```

---

## 2. Module A — Media Downloader (yt-dlp wrapper)

### 2.1 Goal

Provide a **complete, user-friendly wrapper** around [yt-dlp](https://github.com/yt-dlp/yt-dlp) covering the full CLI surface documented at [ytdlp.online/ytdlp-help.html](https://ytdlp.online/ytdlp-help.html), exposed through:

- A **guided UI** (presets + advanced panel)
- A **REST API** (simple endpoints + raw option passthrough)
- **Background jobs** for downloads that take longer than a request timeout

The wrapper does **not** re-implement extractors — it shells out to (or embeds) the official `yt-dlp` binary with a validated, allowlisted option map.

### 2.2 yt-dlp capability map (feature groups)

Organize all CLI options into these groups for UI tabs and API schema:

| Group | Representative options | UI treatment |
|---|---|---|
| **General** | `--version`, `--ignore-errors`, `--flat-playlist`, `--live-from-start` | Advanced toggles |
| **Network** | `--proxy`, `--socket-timeout`, `--impersonate`, `-4`/`-6` | Advanced panel |
| **Geo** | `--geo-verification-proxy`, `--xff` | Advanced panel |
| **Video selection** | `-I/--playlist-items`, `--match-filters`, `--no-playlist`, `--date*`, `--max-downloads` | Playlist + filter section |
| **Download** | `-N`, `-r`, `-R`, `--fragment-retries`, `--download-sections` | Advanced / power user |
| **Filesystem** | `-o/--output`, `-a/--batch-file`, `-w`, `-c`, `--write-info-json` | Output template field |
| **Thumbnails** | `--write-thumbnail`, `--list-thumbnails` | Checkbox |
| **Simulation** | `-s`, `-j/-J`, `-F/--list-formats`, `--list-subs` | "Inspect only" mode |
| **Format** | `-f`, `-S`, `--merge-output-format`, `--check-formats` | Primary format picker |
| **Subtitles** | `--write-subs`, `--write-auto-subs`, `--sub-langs`, `--sub-format` | Subtitle section |
| **Auth** | `--cookies`, `--cookies-from-browser`, `-u/-p`, `--video-password` | Secure credentials UI |
| **Post-process** | `-x`, `--audio-format`, `--audio-quality`, `--remux-video`, `--embed-*`, `--split-chapters` | Preset-driven |
| **SponsorBlock** | `--sponsorblock-mark`, `--sponsorblock-remove` | YouTube-only toggles |
| **Extractor** | `--extractor-args`, `--extractor-retries` | Advanced |
| **Presets** | `-t mp3`, `-t aac`, `-t mp4`, `-t mkv`, `-t sleep` | One-click preset buttons |

**Preset aliases (must ship in UI):**

| Preset | Equivalent yt-dlp flags |
|---|---|
| MP3 | `-t mp3` |
| AAC | `-t aac` |
| MP4 | `-t mp4` |
| MKV | `-t mkv` |
| Audio only | `-x --audio-format mp3` (configurable) |
| Best video | `-f bestvideo+bestaudio/best` |

### 2.3 Download workflows

#### Workflow 1 — Inspect (synchronous, no job)

Used for format/subtitle/thumbnail listing and metadata preview.

```
Client → GET /api/download/info?url=…
       → yt-dlp --dump-single-json --no-download URL
       → 200 { metadata }

Client → GET /api/download/formats?url=…
       → yt-dlp -F --no-download URL (parse stdout)
       → 200 { formats: [...] }

Client → GET /api/download/subtitles?url=…&lang=en&format=srt
       → yt-dlp --write-auto-subs --sub-langs en --skip-download …
       → 200 { content, lang, format }
```

#### Workflow 2 — Download (async job)

```
Client → POST /api/download/jobs  { url, options }
       → 202 { jobId }
Worker → build yt-dlp argv from validated options
       → download to temp dir
       → upload artifact(s) to storage
       → update job row (completed | failed)
Client → GET /api/download/jobs/{id}  (poll)
       → GET /api/download/jobs/{id}/file/{name}  (stream from storage)
```

#### Workflow 3 — Live stream redirect

```
Client → GET /api/download/live/stream?url=…
       → yt-dlp -g --no-download URL  (get direct stream URL)
       → 302 Location: <stream_url>
```

#### Workflow 4 — Playlist inspect

```
Client → GET /api/download/playlist/info?url=…
       → yt-dlp --flat-playlist -J URL
       → 200 { playlist_count, entries: [{ id, title, url }] }
```

### 2.4 Download API contract

Base path: `/api/download`

| Method | Path | Sync/Async | Description |
|---|---|---|---|
| `GET` | `/info` | Sync | Full video metadata JSON (`--dump-single-json`) |
| `GET` | `/formats` | Sync | Available formats (`-F`) |
| `GET` | `/subtitles` | Sync | Extract subtitle text |
| `GET` | `/playlist/info` | Sync | Flat playlist metadata |
| `GET` | `/live/stream` | Sync | 302 redirect to underlying stream URL |
| `POST` | `/jobs` | Async | Start download job |
| `GET` | `/jobs` | Sync | List recent jobs (limit 200) |
| `GET` | `/jobs/{id}` | Sync | Job status + artifacts |
| `GET` | `/jobs/{id}/file/{name}` | Sync | Stream completed file (supports `Range`) |
| `POST` | `/jobs/{id}/stop` | Sync | Cooperative stop |
| `POST` | `/jobs/{id}/resume` | Sync | Re-enqueue failed/stopped job |
| `POST` | `/jobs/{id}/transcribe` | Async | **Bridge:** create transcriber job from downloaded audio |

**Start job body (`POST /api/download/jobs`):**

```json
{
  "url": "https://www.youtube.com/watch?v=…",
  "preset": "mp3",
  "options": {
    "format": "bestaudio/best",
    "extractAudio": true,
    "audioFormat": "mp3",
    "writeSubs": false,
    "subLangs": ["en"],
    "playlistItems": "1:5",
    "noPlaylist": false,
    "outputTemplate": "%(title)s.%(ext)s",
    "cookiesFromBrowser": null,
    "proxy": null,
    "downloadSections": null,
    "sponsorblockRemove": ["sponsor", "intro"],
    "extraArgs": []
  }
}
```

- `preset` expands to a known flag set; explicit `options` override preset defaults.
- `extraArgs` is **allowlist-validated** against the full yt-dlp option registry — reject unknown flags.
- Never accept raw shell strings (injection-safe argv builder only).

**Job status response:**

```json
{
  "id": "uuid",
  "url": "…",
  "status": "processing",
  "progress": { "percent": 42, "speed": "1.2MiB/s", "eta": 30 },
  "artifacts": [
    { "name": "Video Title.mp3", "key": "downloads/{id}/Video Title.mp3", "size": 5242880, "contentType": "audio/mpeg" }
  ],
  "error": null,
  "createdAt": "…",
  "updatedAt": "…"
}
```

Parse yt-dlp stderr/stdout for progress (`--progress-template` / `--newline`) and persist to the job row.

### 2.5 Download object storage layout

```
downloads/{jobId}/{filename}           primary media file
downloads/{jobId}/{filename}.info.json   optional metadata sidecar
downloads/{jobId}/subs/{lang}.{ext}    optional subtitles
downloads/{jobId}/thumb.jpg              optional thumbnail
```

Retention: configurable (`DOWNLOAD_RETENTION_HOURS`, default 24h). A sweeper deletes expired objects and marks jobs `expired`.

### 2.6 Download database schema

```sql
CREATE TABLE download_jobs (
  id            uuid PRIMARY KEY,
  url           text NOT NULL,
  preset        text,
  options_json  jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'pending',  -- pending|processing|completed|failed|stopped|expired
  progress_json jsonb,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE download_artifacts (
  id            uuid PRIMARY KEY,
  job_id        uuid NOT NULL REFERENCES download_jobs(id) ON DELETE CASCADE,
  name          text NOT NULL,
  object_key    text NOT NULL,
  content_type  text,
  file_size     bigint,
  role          text NOT NULL DEFAULT 'media'  -- media|subtitle|thumbnail|metadata
);
```

### 2.7 Download UI (`/download`)

Dark-themed page (consistent with transcriber). Sections:

1. **URL input** — single or batch (one URL per line)
2. **Preset bar** — MP3, AAC, MP4, MKV, Best
3. **Format inspector** — after URL blur/submit, show title, duration, thumbnail, format table; user picks format code
4. **Options accordion** — subtitles, playlist items, audio quality, output template, SponsorBlock, cookies upload
5. **Action** — "Download" starts async job; show progress bar from polling
6. **Recent downloads table** — status, filename, size, actions: Download file | Send to Transcriber
7. **API docs link** — collapsible reference for `/api/download/*`

**Progress UX:** poll `GET /api/download/jobs/{id}` every 2s while active; on `completed`, enable file download link.

### 2.8 yt-dlp execution requirements

- Bundle **yt-dlp** + **ffmpeg** + **ffprobe** in the deployment image (glibc base — not Alpine).
- Set `--ffmpeg-location` to bundled binaries.
- Default output to a temp directory; upload to storage on success.
- Timeouts: info endpoints 60s; download jobs configurable (`DOWNLOAD_JOB_TIMEOUT_SEC`, default 3600).
- Concurrency: **one active yt-dlp process** per worker instance (queue FIFO) to avoid CPU/RAM contention.

---

## 3. Module B — Audio Transcriber

### 3.1 Goal

Transcribe audio with high accuracy and provide an **interactive playback experience**:

- Source audio stored in **object storage** (not ephemeral disk)
- Playback uses **HTTP range requests** so the browser can buffer/seek without downloading the full file
- Transcript includes **word-level timestamps**; the UI highlights the active word during playback

This module inherits most behavior from [`specs.md`](./specs.md) §4 (routes, worker, chunking, OpenRouter routing, resumability). **Sections below override or extend specs.md.**

### 3.2 Notable changes from specs.md

| Topic | specs.md | Scrybe design |
|---|---|---|
| Result format | Segment-level Markdown only | **Word-level JSON** (primary) + optional Markdown export |
| Playback | Download Markdown / no player | **In-app synced player** with buffered streaming |
| Audio storage | `jobs/{id}/source/{filename}` | Same key layout; add **`playback_key`** pointing to a normalized streaming-friendly copy |
| Chunk transcripts | Plain text per chunk | Text + **`words[]`** array with `{ word, start, end, confidence? }` |
| Upload source | Manual file upload only | Upload **or** ingest from Download module (`POST …/transcribe` bridge) |
| UI | Jobs table + Markdown link | Jobs table + **"Open player"** link to `/transcribe/{jobId}` |

### 3.3 Playback-optimized audio pipeline

After source upload (or ingestion from a download job):

1. **Probe** with ffprobe (duration, codec, bitrate).
2. **Normalize for streaming** — ffmpeg remux/transcode to **AAC in MP4** (`audio/mp4`) or **MP3** with `-movflags +faststart` (MP4) so metadata sits at file start for fast range seeks.
3. Upload normalized file to `jobs/{jobId}/playback/audio.m4a` (or `.mp3`).
4. Store `playback_key`, `playback_content_type`, `duration_sec` on the job row.
5. Keep original at `jobs/{jobId}/source/{filename}` for archival/re-processing.

**Streaming endpoint:**

```
GET /api/transcribe/jobs/{id}/audio
  → Accept: Range
  → Proxy range request to S3 GetObject with Range header
  → 206 Partial Content / 200
  → Headers: Accept-Ranges: bytes, Content-Type, Content-Length, Content-Range
```

Use **presigned URLs** (short TTL) as an alternative for direct client→storage streaming if the storage provider supports CORS.

### 3.4 Word-level transcript model

Store a single compiled transcript at `jobs/{jobId}/transcript.json`:

```json
{
  "version": 1,
  "language": "en",
  "duration": 1834.2,
  "words": [
    { "word": "Hello", "start": 0.32, "end": 0.58, "confidence": 0.98 },
    { "word": "world", "start": 0.59, "end": 0.91, "confidence": 0.97 }
  ],
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 30.0,
      "text": "Hello world …",
      "wordStartIdx": 0,
      "wordEndIdx": 42
    }
  ]
}
```

**Obtaining word timestamps:**

1. **Primary:** Use OpenRouter STT models that return word-level timing (e.g. Whisper-style `verbose_json` with `word_timestamps=true` when supported).
2. **Per-chunk merge:** Each chunk returns words with timestamps **relative to chunk start**; offset by `chunk.start_sec` when merging.
3. **Fallback:** If the model returns segment text only, run a lightweight **alignment pass** (e.g. whisper.cpp alignment, or forced alignment via ffmpeg + model) — implement only if primary path lacks word timings.
4. **Deduplication:** When stitching chunk boundaries, merge overlapping windows (±500ms) and dedupe words by time proximity.

Chunk DB row adds:

```sql
ALTER TABLE transcribe_chunks ADD COLUMN words_json jsonb;
```

Job row adds:

```sql
ALTER TABLE transcribe_jobs ADD COLUMN
  playback_key text,
  playback_content_type text,
  duration_sec numeric,
  transcript_key text,
  language text;
```

### 3.5 Transcriber API (inherits specs.md + additions)

All routes from specs.md §4.1 remain. Add/change:

| Method | Path | Change |
|---|---|---|
| `GET` | `/api/transcribe/jobs/{id}/audio` | **New** — range-enabled audio stream |
| `GET` | `/api/transcribe/jobs/{id}/transcript` | **New** — word-level JSON |
| `GET` | `/api/transcribe/jobs/{id}/result` | Keep — Markdown export (generated from JSON) |
| `POST` | `/api/transcribe/from-download/{downloadJobId}` | **New** — start job from download artifact |

**Start job** — same as specs.md (`POST /api/transcribe` with raw body + query params), plus optional `source=download&downloadJobId=…` query path for bridge.

**Transcript response (`GET …/transcript`):**

```json
{
  "jobId": "…",
  "language": "en",
  "duration": 1834.2,
  "words": [ … ],
  "segments": [ … ]
}
```

Return `404 { error: "Transcript not ready" }` until job `status === 'completed'`.

### 3.6 Transcriber worker changes

Extend specs.md §4.7 `processJob`:

1. After source upload → **run playback normalization** (before or in parallel with chunking).
2. During transcription → persist `words_json` on each chunk.
3. Compile phase → merge words + segments into `transcript.json`, upload to storage, set `transcript_key`.
4. Optionally generate `result.md` from JSON for backward-compatible export.

**Status values** unchanged: `pending` → `chunking` → `processing` → `completed` | `failed` | `stopped`.

**Resumability** unchanged: skip chunking when `total_chunks > 0`; only re-process non-`done` chunks.

### 3.7 Transcriber UI

#### `/transcribe` — job launcher + list

Same as specs.md §4.11, plus:

- **"From URL" tab** — URL field that calls Download module to fetch audio, then auto-starts transcription (or two-step: download → transcribe button).
- Jobs table action: **Open player** when `completed`.

#### `/transcribe/[jobId]` — synced player page

Layout:

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back          Transcription: {filename}                  │
├─────────────────────────────────────────────────────────────┤
│  [ Audio player — HTML5 <audio> or custom with Range src ] │
│  ├─ progress bar with segment markers                       │
│  └─ play/pause, seek, speed, current time                   │
├─────────────────────────────────────────────────────────────┤
│  Transcript (scrollable)                                     │
│  … word word [ACTIVE WORD] word word …                       │
│  - active word: highlight + auto-scroll into view            │
│  - click word → seek audio to word.start                     │
└─────────────────────────────────────────────────────────────┘
```

**Player behavior:**

- `audio.src = /api/transcribe/jobs/{id}/audio` (browser handles buffering via Range).
- On `timeupdate` (or `requestAnimationFrame`): binary-search `words[]` for index where `start <= t < end`; apply highlight class.
- Debounce seek-on-click to ±10ms.
- Show segment boundaries as subtle markers on the progress bar.
- Export actions: Download JSON, Download Markdown.

**Word highlight styling:** cyan accent (`#38bdf8`) background on active word; dim past/future words slightly.

---

## 4. Cross-module integration

### 4.1 Download → Transcribe bridge

```
POST /api/download/jobs/{downloadJobId}/transcribe
  ?model=openai/whisper-1&size=30&unit=seconds
```

Steps:

1. Verify download job `completed` and artifact role=`media` with audio content type (or video that will be normalized).
2. Copy or reference storage object into transcriber `source` key (prefer **server-side copy**, not re-download).
3. Create `transcribe_jobs` row; enqueue transcription worker.
4. Return `202 { jobId, downloadJobId }`.

### 4.2 Shared navigation

Global nav: **Download** | **Transcribe**. Both pages share dark theme, card layout, shadcn/ui components.

---

## 5. Shared infrastructure

### 5.1 Configuration (environment variables)

| Variable | Default | Module | Purpose |
|---|---|---|---|
| `HOST` / `PORT` | `127.0.0.1` / `3000` | server | Bind address |
| `DATABASE_URL` | — | both | Postgres connection |
| `AWS_S3_*` | — | both | Object storage (see specs.md §2) |
| `AWS_S3_BUCKET_NAME` | `scrybe` | both | Shared bucket, different prefixes |
| `OPENROUTER_API_KEY` | — | transcriber | STT / chat models |
| `YTDLP_PATH` | `yt-dlp` | download | Path to yt-dlp binary |
| `FFMPEG_PATH` | bundled | both | ffmpeg binary |
| `DOWNLOAD_RETENTION_HOURS` | `24` | download | Artifact TTL |
| `DOWNLOAD_JOB_TIMEOUT_SEC` | `3600` | download | Max job runtime |
| `TRANSCRIBE_UPLOAD_MAX_BYTES` | `1GiB` | transcriber | Upload cap |
| `WORKER_CONCURRENCY` | `1` | both | Jobs per worker (keep 1 initially) |

### 5.2 Object storage bucket layout (combined)

```
scrybe/
  downloads/{downloadJobId}/…
  jobs/{transcribeJobId}/source/…
  jobs/{transcribeJobId}/playback/audio.m4a
  jobs/{transcribeJobId}/chunks/…
  jobs/{transcribeJobId}/transcript.json
  jobs/{transcribeJobId}/result.md
```

Single bucket with prefix isolation. Ensure CORS allows `GET` + `Range` from the app origin if using presigned URLs.

### 5.3 Database migrations

- One `migrations/` folder, ordered SQL files.
- Advisory lock at startup (see specs.md §4.8).
- Migrations cover **both** modules.

### 5.4 Background worker

Single worker process with two FIFO queues (or one queue with job `type` discriminator):

```typescript
type WorkerJob =
  | { type: "download"; jobId: string }
  | { type: "transcribe"; jobId: string };
```

Pump runs one job at a time globally (or one per type if `WORKER_CONCURRENCY` increased later).

On startup:

1. Run migrations.
2. Ensure bucket exists.
3. `recover()` — re-enqueue all `pending|processing|chunking` jobs for **both** modules.

### 5.5 Error handling conventions

- JSON errors: `{ "error": "message" }` with appropriate HTTP status.
- Handler exceptions → `500 { error: err.message }`.
- Long operations return `202 Accepted` with `{ jobId }`.
- All list endpoints cap at **200** rows, most recent first.

---

## 6. Security & operational notes

1. **SSRF protection** on download URLs — block private IP ranges, `file://`, link-local, metadata endpoints.
2. **Auth (future)** — design assumes single-user/local-first initially; API routes unauthenticated. Add API keys or session auth before public deployment.
3. **Cookie/credential uploads** — encrypt at rest if persisted; prefer ephemeral temp files deleted after job.
4. **Rate limiting** — per-IP on expensive endpoints (`/info`, `/jobs` POST).
5. **Content-Disposition** — sanitize filenames; use RFC 5987 encoding.
6. **Health check** — `GET /api/health` returns `{ download: ok, transcriber: ok|degraded, storage: ok|fail, db: ok|fail }`.

---

## 7. Deployment

- **Docker image:** Node 24 slim (glibc), bundled yt-dlp, ffmpeg, ffprobe.
- **Services:** web (Next.js), worker (same image, different CMD), Postgres, MinIO.
- **Volumes:** none required for media (all in object storage).
- **Resource limits:** yt-dlp + ffmpeg are CPU/RAM heavy; size containers accordingly (≥2 GB RAM recommended).

---

## 8. Implementation phases (for coding agents)

Execute in order. Each phase is independently testable.

### Phase 1 — Foundation
- [ ] Postgres migrations (download + transcribe tables)
- [ ] S3 storage wrapper (put/get/stream/range, ensure bucket)
- [ ] Shared worker queue + recovery
- [ ] `/api/health`

### Phase 2 — Media Downloader core
- [ ] yt-dlp argv builder with allowlisted options
- [ ] Sync endpoints: `/info`, `/formats`, `/playlist/info`
- [ ] Async download jobs + artifact upload
- [ ] `/download` UI with presets, format inspector, job table

### Phase 3 — Transcriber core (specs.md parity)
- [ ] Transcribe routes from specs.md
- [ ] Chunker + OpenRouter integration + worker
- [ ] `/transcribe` upload UI + jobs table

### Phase 4 — Playback + word sync (Scrybe differentiators)
- [ ] Playback normalization pipeline + `playback_key`
- [ ] Range-enabled `/api/transcribe/jobs/{id}/audio`
- [ ] Word-level transcript merge + `transcript.json`
- [ ] `/transcribe/[jobId]` synced player UI

### Phase 5 — Integration & polish
- [ ] Download → Transcribe bridge endpoint
- [ ] "From URL" flow on transcriber page
- [ ] Retention sweeper for download artifacts
- [ ] Subtitle download, SponsorBlock presets, cookies support in download UI

---

## 9. Behavioral invariants

1. **Download inspect endpoints** work without DB/storage (yt-dlp only).
2. **Transcriber playback** never loads full audio into memory server-side — stream via Range.
3. **Word timestamps** are monotonically increasing after merge; gaps logged but non-fatal.
4. **Jobs are resumable** across restarts (both modules).
5. **One yt-dlp / one transcribe job** at a time per worker instance unless concurrency explicitly raised.
6. **Module failure isolation** — download UI loads even if OpenRouter/Postgres is down; transcriber surfaces clear errors when dependencies missing.

---

## 10. References

- yt-dlp CLI options: https://ytdlp.online/ytdlp-help.html
- yt-dlp upstream: https://github.com/yt-dlp/yt-dlp
- ytdlp.online API pattern (inspiration): https://ytdlp.online/ytdlp-api-docs
- Transcriber baseline spec: [`specs.md`](./specs.md)
