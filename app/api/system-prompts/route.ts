import { randomUUID } from "crypto";
import {
  createSystemPrompt,
  listSystemPrompts,
} from "@/lib/db/queries-system-prompts";
import type { SystemPromptFileType } from "@/lib/db/schema";
import { systemPromptCreateSchema } from "@/lib/validators/system-prompt";
import { error, handleRoute, json } from "@/lib/api";

function toDto(row: Awaited<ReturnType<typeof listSystemPrompts>>[number]) {
  return {
    id: row.id,
    name: row.name,
    fileTypes: row.fileTypes,
    prompt: row.prompt,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

export async function GET(req: Request) {
  return handleRoute(async () => {
    const fileType = new URL(req.url).searchParams.get("fileType");
    if (fileType && fileType !== "audio" && fileType !== "pdf") {
      return error("fileType must be audio or pdf");
    }
    const rows = await listSystemPrompts(fileType as SystemPromptFileType | undefined);
    return json({ prompts: rows.map(toDto) });
  });
}

export async function POST(req: Request) {
  return handleRoute(async () => {
    const body = await req.json().catch(() => null);
    const parsed = systemPromptCreateSchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const row = await createSystemPrompt({
      id: randomUUID(),
      name: parsed.data.name,
      fileTypes: parsed.data.fileTypes,
      prompt: parsed.data.prompt,
    });
    return json({ prompt: toDto(row!) }, 201);
  });
}
