import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  downloadArtifacts,
  downloadJobs,
  transcribeChunks,
  transcribeJobs,
  transcribeSettings,
} from "@/lib/db/schema";
import type { DownloadOptions, DownloadProgress } from "@/lib/db/schema";

export async function listDownloadJobs(limit = 200) {
  const db = getDb();
  return db
    .select()
    .from(downloadJobs)
    .orderBy(desc(downloadJobs.createdAt))
    .limit(limit);
}

export async function getDownloadJob(id: string) {
  const db = getDb();
  const [job] = await db.select().from(downloadJobs).where(eq(downloadJobs.id, id)).limit(1);
  return job ?? null;
}

export async function getDownloadArtifacts(jobId: string) {
  const db = getDb();
  return db.select().from(downloadArtifacts).where(eq(downloadArtifacts.jobId, jobId));
}

export async function createDownloadJob(data: {
  id: string;
  url: string;
  preset?: string | null;
  optionsJson?: DownloadOptions;
}) {
  const db = getDb();
  const [job] = await db
    .insert(downloadJobs)
    .values({
      id: data.id,
      url: data.url,
      preset: data.preset ?? null,
      optionsJson: data.optionsJson ?? {},
      status: "pending",
    })
    .returning();
  return job;
}

export async function updateDownloadJob(
  id: string,
  patch: Partial<{
    status: string;
    progressJson: DownloadProgress | null;
    error: string | null;
  }>,
) {
  const db = getDb();
  await db
    .update(downloadJobs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(downloadJobs.id, id));
}

export async function insertDownloadArtifact(data: {
  id: string;
  jobId: string;
  name: string;
  objectKey: string;
  contentType?: string | null;
  fileSize?: number | null;
  role?: string;
}) {
  const db = getDb();
  await db.insert(downloadArtifacts).values(data);
}

export async function listTranscribeJobs(limit = 200) {
  const db = getDb();
  return db
    .select()
    .from(transcribeJobs)
    .orderBy(desc(transcribeJobs.createdAt))
    .limit(limit);
}

export async function getTranscribeJob(id: string) {
  const db = getDb();
  const [job] = await db.select().from(transcribeJobs).where(eq(transcribeJobs.id, id)).limit(1);
  return job ?? null;
}

export async function getTranscribeChunks(jobId: string) {
  const db = getDb();
  return db
    .select()
    .from(transcribeChunks)
    .where(eq(transcribeChunks.jobId, jobId))
    .orderBy(transcribeChunks.idx);
}

export async function createTranscribeJob(data: {
  id: string;
  filename: string;
  contentType?: string | null;
  fileSize?: number | null;
  chunkUnit: string;
  chunkSize: string;
  model: string;
  systemPrompt?: string | null;
  sourceKey?: string | null;
}) {
  const db = getDb();
  const [job] = await db
    .insert(transcribeJobs)
    .values({
      id: data.id,
      filename: data.filename,
      contentType: data.contentType ?? null,
      fileSize: data.fileSize ?? null,
      chunkUnit: data.chunkUnit,
      chunkSize: data.chunkSize,
      model: data.model,
      systemPrompt: data.systemPrompt ?? null,
      sourceKey: data.sourceKey ?? null,
      status: "pending",
    })
    .returning();
  return job;
}

export async function updateTranscribeJob(
  id: string,
  patch: Record<string, unknown>,
) {
  const db = getDb();
  await db
    .update(transcribeJobs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(transcribeJobs.id, id));
}

export async function upsertTranscribeChunk(data: {
  id: string;
  jobId: string;
  idx: number;
  objectKey: string;
  startSec?: string | null;
  durSec?: string | null;
}) {
  const db = getDb();
  await db
    .insert(transcribeChunks)
    .values({
      id: data.id,
      jobId: data.jobId,
      idx: data.idx,
      objectKey: data.objectKey,
      startSec: data.startSec ?? null,
      durSec: data.durSec ?? null,
      status: "pending",
    })
    .onConflictDoNothing({ target: [transcribeChunks.jobId, transcribeChunks.idx] });
}

export async function updateTranscribeChunk(
  id: string,
  patch: Record<string, unknown>,
) {
  const db = getDb();
  await db.update(transcribeChunks).set(patch).where(eq(transcribeChunks.id, id));
}

export async function getIncompleteTranscribeChunks(jobId: string) {
  const db = getDb();
  return db
    .select()
    .from(transcribeChunks)
    .where(and(eq(transcribeChunks.jobId, jobId), ne(transcribeChunks.status, "done")))
    .orderBy(transcribeChunks.idx);
}

export async function countDoneChunks(jobId: string) {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transcribeChunks)
    .where(and(eq(transcribeChunks.jobId, jobId), eq(transcribeChunks.status, "done")));
  return row?.count ?? 0;
}

export async function getTranscribeSettings() {
  const db = getDb();
  const [row] = await db
    .select()
    .from(transcribeSettings)
    .where(eq(transcribeSettings.id, "last_used"))
    .limit(1);
  return row ?? null;
}

export async function upsertTranscribeSettings(data: {
  chunkUnit?: string | null;
  chunkSize?: string | null;
  model?: string | null;
  systemPrompt?: string | null;
}) {
  const db = getDb();
  await db
    .insert(transcribeSettings)
    .values({
      id: "last_used",
      chunkUnit: data.chunkUnit ?? null,
      chunkSize: data.chunkSize ?? null,
      model: data.model ?? null,
      systemPrompt: data.systemPrompt ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: transcribeSettings.id,
      set: {
        chunkUnit: data.chunkUnit ?? null,
        chunkSize: data.chunkSize ?? null,
        model: data.model ?? null,
        systemPrompt: data.systemPrompt ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function getActiveDownloadJobs() {
  const db = getDb();
  return db
    .select({ id: downloadJobs.id })
    .from(downloadJobs)
    .where(inArray(downloadJobs.status, ["pending", "processing"]));
}

export async function getActiveTranscribeJobs() {
  const db = getDb();
  return db
    .select({ id: transcribeJobs.id })
    .from(transcribeJobs)
    .where(inArray(transcribeJobs.status, ["pending", "chunking", "processing"]));
}

export async function getExpiredDownloadJobs(cutoff: Date) {
  const db = getDb();
  return db
    .select()
    .from(downloadJobs)
    .where(
      and(
        inArray(downloadJobs.status, ["completed", "failed", "stopped"]),
        sql`${downloadJobs.createdAt} < ${cutoff}`,
        ne(downloadJobs.status, "expired"),
      ),
    );
}
