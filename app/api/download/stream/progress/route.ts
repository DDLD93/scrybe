import { NextRequest } from "next/server";
import { error, handleRoute } from "@/lib/api";
import { getStreamProgress } from "@/lib/download/stream-progress";

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return error("Missing sessionId", 400);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;

        const close = () => {
          if (closed) return;
          closed = true;
          clearInterval(interval);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        const interval = setInterval(() => {
          if (closed) return;
          const progress = getStreamProgress(sessionId);
          if (progress) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
            if (progress.done) close();
          }
        }, 500);

        req.signal.addEventListener("abort", close);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  });
}
