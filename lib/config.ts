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

  ytdlpPath: env("YTDLP_PATH", "yt-dlp")!,
  ffmpegPath: env("FFMPEG_PATH", "ffmpeg")!,
  ffprobePath: env("FFPROBE_PATH", "ffprobe")!,

  downloadRetentionHours: envInt("DOWNLOAD_RETENTION_HOURS", 24),
  downloadJobTimeoutSec: envInt("DOWNLOAD_JOB_TIMEOUT_SEC", 3600),
  transcribeUploadMaxBytes: envInt("TRANSCRIBE_UPLOAD_MAX_BYTES", 1024 * 1024 * 1024),
  workerConcurrency: envInt("WORKER_CONCURRENCY", 1),
} as const;
