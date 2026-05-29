import { NextRequest } from "next/server";
import { buildYtdlpArgv } from "@/lib/download/argv-builder";
import { runYtdlpOrThrow } from "@/lib/download/executor";
import { validateDownloadUrl } from "@/lib/download/ssrf";
import { accepted, error, handleRoute, json } from "@/lib/api";

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) return error("Missing url");
    const safe = await validateDownloadUrl(url);
    const argv = buildYtdlpArgv(safe, { dumpJson: true });
    const result = await runYtdlpOrThrow(argv, { timeoutSec: 60 });
    return json(JSON.parse(result.stdout));
  });
}
