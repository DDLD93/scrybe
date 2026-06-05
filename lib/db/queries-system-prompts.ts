import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { systemPrompts, type SystemPromptFileType } from "@/lib/db/schema";

export async function listSystemPrompts(fileType?: SystemPromptFileType) {
  const db = getDb();
  const rows = await db.select().from(systemPrompts).orderBy(systemPrompts.name);
  if (!fileType) return rows;
  return rows.filter((r) => (r.fileTypes ?? []).includes(fileType));
}

export async function getSystemPrompt(id: string) {
  const db = getDb();
  const [row] = await db.select().from(systemPrompts).where(eq(systemPrompts.id, id)).limit(1);
  return row ?? null;
}

export async function createSystemPrompt(data: {
  id: string;
  name: string;
  fileTypes: SystemPromptFileType[];
  prompt: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(systemPrompts)
    .values({
      id: data.id,
      name: data.name.trim(),
      fileTypes: data.fileTypes,
      prompt: data.prompt.trim(),
    })
    .returning();
  return row;
}

export async function updateSystemPrompt(
  id: string,
  patch: { name?: string; fileTypes?: SystemPromptFileType[]; prompt?: string },
) {
  const db = getDb();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.fileTypes !== undefined) set.fileTypes = patch.fileTypes;
  if (patch.prompt !== undefined) set.prompt = patch.prompt.trim();
  const [row] = await db
    .update(systemPrompts)
    .set(set)
    .where(eq(systemPrompts.id, id))
    .returning();
  return row ?? null;
}

export async function deleteSystemPrompt(id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .delete(systemPrompts)
    .where(eq(systemPrompts.id, id))
    .returning({ id: systemPrompts.id });
  return rows.length > 0;
}

export async function countSystemPrompts() {
  const db = getDb();
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(systemPrompts);
  return row?.count ?? 0;
}
