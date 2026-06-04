import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  transcribeChunks,
  transcribeFolders,
  transcribeJobs,
  transcribeSettings,
} from "@/lib/db/schema";

export async function listTranscribeJobs(limit = 200) {
  const db = getDb();
  return db
    .select({
      job: transcribeJobs,
      folderName: transcribeFolders.name,
    })
    .from(transcribeJobs)
    .leftJoin(transcribeFolders, eq(transcribeJobs.folderId, transcribeFolders.id))
    .orderBy(desc(transcribeJobs.createdAt))
    .limit(limit);
}

export async function countJobsInFolder(folderId: string) {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transcribeJobs)
    .where(eq(transcribeJobs.folderId, folderId));
  return row?.count ?? 0;
}

export async function listTranscribeFolders() {
  const db = getDb();
  const rows = await db
    .select({
      id: transcribeFolders.id,
      name: transcribeFolders.name,
      createdAt: transcribeFolders.createdAt,
      updatedAt: transcribeFolders.updatedAt,
      jobCount: sql<number>`count(${transcribeJobs.id})::int`,
    })
    .from(transcribeFolders)
    .leftJoin(transcribeJobs, eq(transcribeJobs.folderId, transcribeFolders.id))
    .groupBy(transcribeFolders.id)
    .orderBy(asc(transcribeFolders.name));
  return rows;
}

export async function getTranscribeFolder(id: string) {
  const db = getDb();
  const [folder] = await db
    .select()
    .from(transcribeFolders)
    .where(eq(transcribeFolders.id, id))
    .limit(1);
  return folder ?? null;
}

export async function findTranscribeFolderByName(name: string, excludeId?: string) {
  const db = getDb();
  const normalized = name.trim().toLowerCase();
  const rows = await db.select().from(transcribeFolders);
  return (
    rows.find(
      (f) =>
        f.name.trim().toLowerCase() === normalized &&
        (!excludeId || f.id !== excludeId),
    ) ?? null
  );
}

export async function createTranscribeFolder(data: { id: string; name: string }) {
  const db = getDb();
  const [folder] = await db
    .insert(transcribeFolders)
    .values({
      id: data.id,
      name: data.name.trim(),
    })
    .returning();
  return folder;
}

export async function updateTranscribeFolder(id: string, patch: { name: string }) {
  const db = getDb();
  const [folder] = await db
    .update(transcribeFolders)
    .set({ name: patch.name.trim(), updatedAt: new Date() })
    .where(eq(transcribeFolders.id, id))
    .returning();
  return folder ?? null;
}

export async function deleteTranscribeFolder(id: string): Promise<"deleted" | "not_empty" | "not_found"> {
  const count = await countJobsInFolder(id);
  if (count > 0) return "not_empty";

  const db = getDb();
  const rows = await db
    .delete(transcribeFolders)
    .where(eq(transcribeFolders.id, id))
    .returning({ id: transcribeFolders.id });
  if (rows.length === 0) return "not_found";
  return "deleted";
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
  folderId?: string | null;
  status?: string;
  sourceUrl?: string | null;
  fetchPreset?: string | null;
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
      folderId: data.folderId ?? null,
      status: data.status ?? "pending",
      sourceUrl: data.sourceUrl ?? null,
      fetchPreset: data.fetchPreset ?? null,
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

export async function deleteTranscribeJob(id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .delete(transcribeJobs)
    .where(eq(transcribeJobs.id, id))
    .returning({ id: transcribeJobs.id });
  return rows.length > 0;
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

export async function getActiveTranscribeJobs() {
  const db = getDb();
  return db
    .select({ id: transcribeJobs.id })
    .from(transcribeJobs)
    .where(inArray(transcribeJobs.status, ["fetching", "pending", "chunking", "processing"]));
}
