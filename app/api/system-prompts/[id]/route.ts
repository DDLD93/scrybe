import {
  deleteSystemPrompt,
  getSystemPrompt,
  updateSystemPrompt,
} from "@/lib/db/queries-system-prompts";
import { systemPromptUpdateSchema } from "@/lib/validators/system-prompt";
import { error, handleRoute, json } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

function toDto(row: NonNullable<Awaited<ReturnType<typeof getSystemPrompt>>>) {
  return {
    id: row.id,
    name: row.name,
    fileTypes: row.fileTypes,
    prompt: row.prompt,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

export async function GET(_req: Request, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const row = await getSystemPrompt(id);
    if (!row) return error("Not found", 404);
    return json({ prompt: toDto(row) });
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const existing = await getSystemPrompt(id);
    if (!existing) return error("Not found", 404);

    const body = await req.json().catch(() => null);
    const parsed = systemPromptUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.issues.map((i) => i.message).join("; "));
    }
    if (Object.keys(parsed.data).length === 0) {
      return error("No valid fields to update");
    }

    const row = await updateSystemPrompt(id, parsed.data);
    return json({ prompt: toDto(row!) });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const deleted = await deleteSystemPrompt(id);
    if (!deleted) return error("Not found", 404);
    return json({ deleted: true, id });
  });
}
