import { getTranscribeSettings } from "@/lib/db/queries";
import { handleRoute, json } from "@/lib/api";

export async function GET() {
  return handleRoute(async () => {
    const settings = await getTranscribeSettings();
    return json({
      settings: settings
        ? {
            chunkUnit: settings.chunkUnit,
            chunkSize: settings.chunkSize,
            model: settings.model,
            systemPrompt: settings.systemPrompt,
            lastSystemPromptId: settings.lastSystemPromptId,
          }
        : null,
    });
  });
}
