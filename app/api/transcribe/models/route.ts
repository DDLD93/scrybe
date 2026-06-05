import { listAudioModels, listModels, listVisionModels } from "@/lib/transcribe/openrouter";
import { handleRoute, json } from "@/lib/api";

export async function GET(req: Request) {
  return handleRoute(async () => {
    const kind = new URL(req.url).searchParams.get("kind");
    const models =
      kind === "pdf"
        ? await listVisionModels()
        : kind === "audio"
          ? await listAudioModels()
          : await listModels();
    return json({ models });
  });
}
