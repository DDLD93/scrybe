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

export type SystemPromptFileType = "audio" | "pdf";

export type UserPermission =
  | "user:create"
  | "user:permission"
  | "settings:general"
  | "settings:systemprompt"
  | "file:all";

export type UserStatus = "active" | "suspended";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  permissions: jsonb("permissions").$type<UserPermission[]>().notNull().default([]),
  status: text("status").$type<UserStatus>().notNull().default("active"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const systemPrompts = pgTable("system_prompts", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  fileTypes: jsonb("file_types").$type<SystemPromptFileType[]>().notNull(),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transcribeFolders = pgTable("transcribe_folders", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
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
  jobKind: text("job_kind").notNull().default("audio"),
  systemPromptId: uuid("system_prompt_id").references(() => systemPrompts.id, {
    onDelete: "set null",
  }),
  systemPrompt: text("system_prompt"),
  folderId: uuid("folder_id").references(() => transcribeFolders.id, { onDelete: "set null" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  totalChunks: integer("total_chunks").notNull().default(0),
  completedChunks: integer("completed_chunks").notNull().default(0),
  sourceKey: text("source_key"),
  resultKey: text("result_key"),
  playbackKey: text("playback_key"),
  playbackContentType: text("playback_content_type"),
  durationSec: numeric("duration_sec", { precision: 12, scale: 4 }),
  processLimitPages: integer("process_limit_pages"),
  processLimitSec: numeric("process_limit_sec", { precision: 12, scale: 4 }),
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

export type LibraryViewMode = "grid" | "list";

export const transcribeSettings = pgTable("transcribe_settings", {
  id: text("id").primaryKey().default("last_used"),
  chunkUnit: text("chunk_unit"),
  chunkSize: numeric("chunk_size", { precision: 12, scale: 4 }),
  /** Default STT model for audio uploads. */
  model: text("model"),
  /** Default vision model for PDF uploads. */
  pdfModel: text("pdf_model"),
  defaultView: text("default_view").$type<LibraryViewMode>(),
  systemPrompt: text("system_prompt"),
  lastSystemPromptId: uuid("last_system_prompt_id").references(() => systemPrompts.id, {
    onDelete: "set null",
  }),
  lastPdfSystemPromptId: uuid("last_pdf_system_prompt_id").references(() => systemPrompts.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
