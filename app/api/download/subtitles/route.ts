import { NextRequest } from "next/server";
import { buildYtdlpArgv } from "@/lib/download/argv-builder";
import { runYtdlpOrThrow } from "@/lib/download/executor";
import { validateDownloadUrl } from "@/lib/download/ssrf";
import { error, handleRoute, json } from "@/lib/api";

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const url = req.nextUrl.searchParams.get("url");
    const lang = req.nextUrl.searchParams.get("lang") ?? "en";
    const format = req.nextUrl.searchParams.get("format") ?? "srt";
    if (!url) return error("Missing url");
    const safe = await validateDownloadUrl(url);
    const argv = buildYtdlpArgv(safe, { writeSubs: true, subLangs: lang, subFormat: format });
    const result = await runYtdlpOrThrow(argv, { timeoutSec: 60 });
    return json({ content: result.stdout, lang, format });
  });
}
