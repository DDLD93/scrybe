import { listModels } from "@/lib/transcribe/openrouter";
import { handleRoute, json } from "@/lib/api";

export async function GET() {
  return handleRoute(async () => {
    const models = await listModels();
    return json({ models });
  });
}
