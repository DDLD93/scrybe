import { NextRequest, NextResponse } from "next/server";
import { buildYtdlpArgv } from "@/lib/download/argv-builder";
import { runYtdlpOrThrow } from "@/lib/download/executor";
import { validateDownloadUrl } from "@/lib/download/ssrf";
import { error, handleRoute } from "@/lib/api";

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) return error("Missing url");
    const safe = await validateDownloadUrl(url);
    const argv = buildYtdlpArgv(safe, { getUrl: true });
    const result = await runYtdlpOrThrow(argv, { timeoutSec: 60 });
    const streamUrl = result.stdout.trim().split("\n")[0];
    return NextResponse.redirect(streamUrl, 302);
  });
}
