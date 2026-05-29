import { getTranscribeJob } from "@/lib/db/queries";
import { getStream } from "@/lib/storage/s3";
import { error, handleRoute } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const job = await getTranscribeJob(id);
    if (!job?.resultKey) return error("Result not ready", 404);
    const stream = await getStream(job.resultKey);
    const base = job.filename.replace(/\.[^.]+$/, "");
    return new Response(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.md"`,
      },
    });
  });
}
