import { getSystemPrompt } from "@/lib/db/queries-system-prompts";
import type { SystemPromptFileType } from "@/lib/db/schema";

export type ResolvedSystemPrompt = {
  systemPromptId: string | null;
  systemPrompt: string | null;
};

export async function resolveSystemPromptForJob(opts: {
  fileType: SystemPromptFileType;
  systemPromptId?: string | null;
  customPrompt?: string | null;
}): Promise<ResolvedSystemPrompt | "invalid_preset"> {
  const custom = opts.customPrompt?.trim() ?? "";
  if (custom) {
    return {
      systemPromptId: opts.systemPromptId ?? null,
      systemPrompt: custom,
    };
  }

  if (!opts.systemPromptId) {
    return { systemPromptId: null, systemPrompt: null };
  }

  const preset = await getSystemPrompt(opts.systemPromptId);
  if (!preset) return "invalid_preset";
  if (!(preset.fileTypes ?? []).includes(opts.fileType)) return "invalid_preset";

  return {
    systemPromptId: preset.id,
    systemPrompt: preset.prompt,
  };
}

export function detectJobKind(
  filename: string,
  contentType?: string | null,
): "audio" | "pdf" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf") || contentType === "application/pdf") return "pdf";
  return "audio";
}
