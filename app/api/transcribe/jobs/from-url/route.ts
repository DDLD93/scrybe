import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import {
  createTranscribeJob,
  getTranscribeFolder,
  upsertTranscribeSettings,
} from "@/lib/db/queries";
import { validateMediaUrl } from "@/lib/media-fetch/ssrf";
import { resolveSystemPromptForJob } from "@/lib/system-prompts";
import { enqueue } from "@/lib/worker/queue";
import { accepted, error, handleRoute } from "@/lib/api";

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.url !== "string") return error("Missing url");

    const url = await validateMediaUrl(body.url);
    const preset = typeof body.preset === "string" ? body.preset : "mp3";
    const model = typeof body.model === "string" ? body.model : "openai/whisper-1";
    const sizeRaw = body.size ?? "30";
    const unit = body.unit === "mb" ? "mb" : "seconds";
    const size = parseFloat(String(sizeRaw));
    if (!Number.isFinite(size) || size <= 0) return error("Invalid size");

    const customPrompt = typeof body.prompt === "string" ? body.prompt : undefined;
    const systemPromptId =
      typeof body.systemPromptId === "string" ? body.systemPromptId : undefined;

    const resolved = await resolveSystemPromptForJob({
      fileType: "audio",
      systemPromptId,
      customPrompt,
    });
    if (resolved === "invalid_preset") return error("Invalid system prompt for audio", 400);

    let folderId: string | null = null;
    if (body.folderId && body.folderId !== "__none__") {
      const folder = await getTranscribeFolder(String(body.folderId));
      if (!folder) return error("Folder not found", 404);
      folderId = folder.id;
    }

    const jobId = randomUUID();
    await createTranscribeJob({
      id: jobId,
      filename: "url-import",
      chunkUnit: unit,
      chunkSize: String(size),
      model,
      jobKind: "audio",
      systemPromptId: resolved.systemPromptId,
      systemPrompt: resolved.systemPrompt,
      folderId,
      status: "fetching",
      sourceUrl: url,
      fetchPreset: preset,
    });

    await upsertTranscribeSettings({
      chunkUnit: unit,
      chunkSize: String(size),
      model,
      systemPrompt: resolved.systemPrompt,
      lastSystemPromptId: resolved.systemPromptId,
    });

    enqueue({ type: "transcribe", jobId });
    return accepted({ jobId });
  });
}
