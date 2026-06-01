import {
  bigint,
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export type DownloadProgress = {
  percent?: number;
  speed?: string;
  eta?: number;
};

export type DownloadOptions = Record<string, unknown>;

export type TranscriptWord = {
  word: string;
  start: number;
  end: number;
  confidence?: number;
};

export type TranscriptSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
  wordStartIdx: number;
  wordEndIdx: number;
};

export const transcribeFolders = pgTable("transcribe_folders", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transcribeJobs = pgTable("transcribe_jobs", {
  id: uuid("id").primaryKey(),
  filename: text("filename").notNull(),
  contentType: text("content_type"),
  fileSize: bigint("file_size", { mode: "number" }),
  chunkUnit: text("chunk_unit").notNull(),
  chunkSize: numeric("chunk_size", { precision: 12, scale: 4 }).notNull(),
  model: text("model").notNull(),
  systemPrompt: text("system_prompt"),
  folderId: uuid("folder_id").references(() => transcribeFolders.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  totalChunks: integer("total_chunks").notNull().default(0),
  completedChunks: integer("completed_chunks").notNull().default(0),
  sourceKey: text("source_key"),
  resultKey: text("result_key"),
  playbackKey: text("playback_key"),
  playbackContentType: text("playback_content_type"),
  durationSec: numeric("duration_sec", { precision: 12, scale: 4 }),
  transcriptKey: text("transcript_key"),
  hasWordTimings: boolean("has_word_timings").notNull().default(false),
  language: text("language"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transcribeChunks = pgTable(
  "transcribe_chunks",
  {
    id: uuid("id").primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => transcribeJobs.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    objectKey: text("object_key").notNull(),
    startSec: numeric("start_sec", { precision: 12, scale: 4 }),
    durSec: numeric("dur_sec", { precision: 12, scale: 4 }),
    status: text("status").notNull().default("pending"),
    transcript: text("transcript"),
    wordsJson: jsonb("words_json").$type<TranscriptWord[]>(),
    error: text("error"),
  },
  (t) => [unique().on(t.jobId, t.idx)],
);

export const transcribeSettings = pgTable("transcribe_settings", {
  id: text("id").primaryKey().default("last_used"),
  chunkUnit: text("chunk_unit"),
  chunkSize: numeric("chunk_size", { precision: 12, scale: 4 }),
  model: text("model"),
  systemPrompt: text("system_prompt"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const downloadJobs = pgTable("download_jobs", {
  id: uuid("id").primaryKey(),
  url: text("url").notNull(),
  preset: text("preset"),
  optionsJson: jsonb("options_json").$type<DownloadOptions>().notNull().default({}),
  status: text("status").notNull().default("pending"),
  progressJson: jsonb("progress_json").$type<DownloadProgress>(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const downloadArtifacts = pgTable("download_artifacts", {
  id: uuid("id").primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => downloadJobs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type"),
  fileSize: bigint("file_size", { mode: "number" }),
  role: text("role").notNull().default("media"),
});
