import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { finished } from "stream/promises";
import { mkdtemp, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { config } from "@/lib/config";
import {
  createTranscribeJob,
  getTranscribeFolder,
  getTranscribeSettings,
  listTranscribeJobs,
  upsertTranscribeSettings,
} from "@/lib/db/queries";
import { resolveChunkingForJob, resolveModelForJob, toSystemSettings } from "@/lib/transcribe/settings";
import { putFile } from "@/lib/storage/s3";
import { detectJobKind, resolveSystemPromptForJob } from "@/lib/system-prompts";
import { isVisionModelId } from "@/lib/transcribe/openrouter";
import { enqueue } from "@/lib/worker/queue";
import { accepted, error, handleRoute, json } from "@/lib/api";
import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import { assertFolderAccess, getFileScope } from "@/lib/auth/file-access";

function toJobSummary(row: Awaited<ReturnType<typeof listTranscribeJobs>>[number]) {
  const { job, folderName } = row;
  return {
    id: job.id,
    filename: job.filename,
    model: job.model,
    status: job.status,
    totalChunks: job.totalChunks,
    completedChunks: job.completedChunks,
    error: job.error,
    hasWordTimings: job.hasWordTimings,
    jobKind: job.jobKind ?? "audio",
    createdAt: job.createdAt?.toISOString(),
    folderId: job.folderId ?? null,
    folderName: folderName ?? null,
  };
}

async function resolveFolderId(
  raw: string | null,
  user: Awaited<ReturnType<typeof requireAuth>>,
): Promise<string | null | "invalid"> {
  if (!raw) return null;
  const folder = await getTranscribeFolder(raw);
  if (!folder) return "invalid";
  try {
    assertFolderAccess(user, folder);
  } catch {
    return "invalid";
  }
  return folder.id;
}

export async function GET(req: Request) {
  return handleRoute(async () => {
    try {
      const user = await requireAuth(req);
      const scope = getFileScope(user);
      const jobs = await listTranscribeJobs(200, scope);
      return json({ jobs: jobs.map(toJobSummary) });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    try {
      const user = await requireAuth(req);
      const sp = req.nextUrl.searchParams;
    const filename = (sp.get("filename") ?? "audio.mp3").replace(/[\\/]/g, "_");
    const sizeRaw = sp.get("size");
    const modelParam = sp.get("model");
    const customPrompt = sp.get("prompt");
    const systemPromptId = sp.get("systemPromptId");

    const folderIdRaw = sp.get("folderId");
    const folderId = await resolveFolderId(folderIdRaw, user);
    if (folderId === "invalid") return error("Folder not found", 404);

    const contentType = req.headers.get("content-type") ?? "application/octet-stream";
    const jobKind = detectJobKind(filename, contentType);
    const fileType = jobKind === "pdf" ? "pdf" : "audio";

    const settings = toSystemSettings(await getTranscribeSettings());
    const model = resolveModelForJob(settings, jobKind, modelParam);
    if (!model) return error("No model configured — set defaults in Settings");

    const { unit, size } = resolveChunkingForJob(
      settings,
      jobKind,
      sp.get("unit"),
      sizeRaw,
    );
    if (jobKind === "audio" && (!Number.isFinite(size) || size <= 0)) {
      return error("Invalid 'size'");
    }

    const resolved = await resolveSystemPromptForJob({
      fileType,
      systemPromptId:
        systemPromptId ??
        (fileType === "pdf"
          ? settings.lastPdfSystemPromptId
          : settings.lastSystemPromptId) ??
        undefined,
      customPrompt: customPrompt ?? settings.customSystemPrompt ?? undefined,
    });
    if (resolved === "invalid_preset") return error("Invalid system prompt for this file type", 400);

    if (jobKind === "pdf" && !(await isVisionModelId(model))) {
      return error("Selected model does not support image/PDF processing", 400);
    }

    let processLimitPages: number | null = null;
    let processLimitSec: string | null = null;

    if (jobKind === "pdf") {
      const raw = sp.get("processPages");
      if (raw) {
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n) || n < 1) return error("Invalid processPages");
        if (n > config.pdfMaxPages) {
          return error(`processPages cannot exceed ${config.pdfMaxPages}`);
        }
        processLimitPages = n;
      }
    } else {
      const raw = sp.get("processDurationSec");
      if (raw) {
        const n = parseFloat(raw);
        if (!Number.isFinite(n) || n < 1) return error("Invalid processDurationSec");
        processLimitSec = String(n);
      }
    }

    const jobId = randomUUID();
    const dir = await mkdtemp(join(tmpdir(), "scrybe-upload-"));
    const tempPath = join(dir, filename);

    let written = 0;
    const out = createWriteStream(tempPath);
    const body = req.body;
    if (!body) return error("Empty upload");

    const reader = body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        written += value.length;
        if (written > config.transcribeUploadMaxBytes) {
          return error("Upload exceeds 1 GB limit");
        }
        await new Promise<void>((resolve, reject) => {
          out.write(value, (err) => (err ? reject(err) : resolve()));
        });
      }
    } finally {
      out.end();
    }

    if (written === 0) return error("Empty upload");

    await finished(out);

    const sourceKey = `jobs/${jobId}/source/${filename}`;
    await putFile(sourceKey, tempPath, contentType);
    await unlink(tempPath).catch(() => {});

    await createTranscribeJob({
      id: jobId,
      filename,
      contentType,
      fileSize: written,
      chunkUnit: unit,
      chunkSize: String(size),
      model,
      jobKind,
      systemPromptId: resolved.systemPromptId,
      systemPrompt: resolved.systemPrompt,
      sourceKey,
      folderId,
      processLimitPages,
      processLimitSec,
      createdByUserId: user.id,
    });

    await upsertTranscribeSettings(
      jobKind === "pdf"
        ? {
            pdfModel: model,
            lastPdfSystemPromptId: resolved.systemPromptId ?? null,
          }
        : {
            chunkUnit: unit,
            chunkSize: String(size),
            model,
            lastSystemPromptId: resolved.systemPromptId ?? null,
          },
    );

    enqueue({ type: "transcribe", jobId });
    return accepted({ jobId });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
