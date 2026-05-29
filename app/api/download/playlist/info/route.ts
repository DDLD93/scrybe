import { NextRequest } from "next/server";
import { buildYtdlpArgv } from "@/lib/download/argv-builder";
import { runYtdlpOrThrow } from "@/lib/download/executor";
import { validateDownloadUrl } from "@/lib/download/ssrf";
import { error, handleRoute, json } from "@/lib/api";

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) return error("Missing url");
    const safe = await validateDownloadUrl(url);
    const argv = buildYtdlpArgv(safe, { flatPlaylist: true });
    const result = await runYtdlpOrThrow(argv, { timeoutSec: 60 });
    const data = JSON.parse(result.stdout);
    const entries = (data.entries ?? []).map((e: { id?: string; title?: string; url?: string }) => ({
      id: e.id,
      title: e.title,
      url: e.url,
    }));
    return json({ playlist_count: data.playlist_count ?? entries.length, entries });
  });
}
