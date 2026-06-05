import { resolveToolPath } from "@/lib/tools/binaries";

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

  ffmpegPath: resolveToolPath(env("FFMPEG_PATH", "ffmpeg")!),
  ffprobePath: resolveToolPath(env("FFPROBE_PATH", "ffprobe")!),

  transcribeUploadMaxBytes: envInt("TRANSCRIBE_UPLOAD_MAX_BYTES", 1024 * 1024 * 1024),
  workerConcurrency: envInt("WORKER_CONCURRENCY", 1),

  pdfRenderDpi: envInt("PDF_RENDER_DPI", 150),
  pdfMaxPages: envInt("PDF_MAX_PAGES", 500),

  sessionSecret: env("SESSION_SECRET", "dev-session-secret-change-me")!,
  appUrl: env("APP_URL", "http://127.0.0.1:3000")!,

  smtp: {
    host: env("SMTP_HOST"),
    port: envInt("SMTP_PORT", 587),
    user: env("SMTP_USER"),
    pass: env("SMTP_PASS"),
    from: env("SMTP_FROM", "noreply@scrybe.local"),
    secure: env("SMTP_SECURE") === "true",
  },
} as const;
