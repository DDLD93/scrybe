import { listAudioModels, listModels, listVisionModels } from "@/lib/transcribe/openrouter";
import { handleRoute, json } from "@/lib/api";
import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";

export async function GET(req: Request) {
  return handleRoute(async () => {
    try {
      await requireAuth(req);
      const kind = new URL(req.url).searchParams.get("kind");
      const models =
        kind === "pdf"
          ? await listVisionModels()
          : kind === "audio"
            ? await listAudioModels()
            : await listModels();
      return json({ models });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
