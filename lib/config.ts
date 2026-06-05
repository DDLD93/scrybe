import { resolveToolPath } from "@/lib/tools/binaries";
import { resolveYtdlpCookiesPath } from "@/lib/media-fetch/cookies";

function env(key: string, fallback?: string): string | undefined {
  const v = process.env[key];
  if (v !== undefined && v !== "") return v;
  return fallback;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  host: env("HOST", "127.0.0.1")!,
  port: envInt("PORT", 3000),

  databaseUrl: env("DATABASE_URL"),

  s3: {
    endpoint: env("AWS_S3_ENDPOINT"),
    region: env("AWS_S3_REGION", env("AWS_REGION", "us-east-1"))!,
    accessKeyId: env("AWS_ACCESS_KEY_ID"),
    secretAccessKey: env("AWS_SECRET_ACCESS_KEY"),
    bucket: env("AWS_S3_BUCKET_NAME", "scrybe")!,
    forcePathStyle:
      env("AWS_S3_FORCE_PATH_STYLE") === "true" ||
      (env("AWS_S3_FORCE_PATH_STYLE") !== "false" && !!env("AWS_S3_ENDPOINT")),
  },

  openrouterApiKey: env("OPENROUTER_API_KEY"),
  /** Optional — when set, Whisper models use OpenAI's transcription API for word-level timestamps. */
  openaiApiKey: env("OPENAI_API_KEY"),

  ytdlpPath: resolveToolPath(env("YTDLP_PATH", "yt-dlp")!),
  ffmpegPath: resolveToolPath(env("FFMPEG_PATH", "ffmpeg")!),
  ffprobePath: resolveToolPath(env("FFPROBE_PATH", "ffprobe")!),

  /** Netscape-format cookies file path (must exist in container). */
  ytdlpCookiesFile: resolveYtdlpCookiesPath(
    env("YTDLP_COOKIES_FILE"),
    env("YTDLP_COOKIES_CONTENT"),
  ),
  /** Optional proxy for datacenter IP blocks, e.g. socks5://127.0.0.1:1080 */
  ytdlpProxy: env("YTDLP_PROXY"),
  /** YouTube player clients — avoid ios (ignores cookies). */
  ytdlpYouTubePlayerClient: env(
    "YTDLP_YOUTUBE_PLAYER_CLIENT",
    "web,mweb,android,tv_embedded",
  )!,
  /** JS runtimes for yt-dlp EJS challenge solving (comma-separated). */
  ytdlpJsRuntimes: (env("YTDLP_JS_RUNTIMES", "deno,node") ?? "deno,node")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  transcribeFetchTimeoutSec: envInt("TRANSCRIBE_FETCH_TIMEOUT_SEC", 3600),
  transcribeUploadMaxBytes: envInt("TRANSCRIBE_UPLOAD_MAX_BYTES", 1024 * 1024 * 1024),
  workerConcurrency: envInt("WORKER_CONCURRENCY", 1),

  pdfRenderDpi: envInt("PDF_RENDER_DPI", 150),
  pdfMaxPages: envInt("PDF_MAX_PAGES", 500),
} as const;
