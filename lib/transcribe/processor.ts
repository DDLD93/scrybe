import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import {
  audioFormatFromExt,
  extFromFilename,
  normalizeForPlayback,
  probe,
  split,
} from "@/lib/transcribe/chunker";
import { transcribeChunk } from "@/lib/transcribe/openrouter";
import {
  compileFromChunks,
  compileFromWords,
  compileMarkdown,
  markdownFromTranscript,
  mergeWords,
} from "@/lib/transcribe/compiler";
import {
  countDoneChunks,
  getIncompleteTranscribeChunks,
  getTranscribeChunks,
  getTranscribeJob,
  updateTranscribeChunk,
  updateTranscribeJob,
  upsertTranscribeChunk,
} from "@/lib/db/queries";
import { getBuffer, getFile, putBuffer, putFile } from "@/lib/storage/s3";

const queuedStops = new Set<string>();

export function requestTranscribeStop(jobId: string) {
  queuedStops.add(jobId);
}

export function clearTranscribeStop(jobId: string) {
  queuedStops.delete(jobId);
}

async function isStopped(jobId: string): Promise<boolean> {
  if (queuedStops.has(jobId)) return true;
  const job = await getTranscribeJob(jobId);
  return job?.status === "stopped";
}

export async function processTranscribeJob(jobId: string): Promise<void> {
  const job = await getTranscribeJob(jobId);
  if (!job || job.status === "completed") return;
  if (!job.sourceKey) {
    await updateTranscribeJob(jobId, { status: "failed", error: "Missing source_key" });
    return;
  }

  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(join(tmpdir(), "scrybe-tx-"));
    const ext = extFromFilename(job.filename);
    const sourcePath = join(workDir, `source.${ext}`);

    if (job.totalChunks === 0) {
      await updateTranscribeJob(jobId, { status: "chunking", error: null });
      await getFile(job.sourceKey, sourcePath);

      const playbackPath = join(workDir, "playback.m4a");
      await normalizeForPlayback(sourcePath, playbackPath);
      const playbackKey = `jobs/${jobId}/playback/audio.m4a`;
      await putFile(playbackKey, playbackPath, "audio/mp4");
      const { duration } = await probe(sourcePath);
      await updateTranscribeJob(jobId, {
        playbackKey,
        playbackContentType: "audio/mp4",
        durationSec: String(duration),
      });

      const chunkSize = Number(job.chunkSize);
      const segments = await split(sourcePath, workDir, job.chunkUnit, chunkSize, ext);

      for (const seg of segments) {
        if (await isStopped(jobId)) return;
        const objectKey = `jobs/${jobId}/chunks/${String(seg.idx).padStart(3, "0")}.${ext}`;
        await putFile(objectKey, seg.path, job.contentType ?? "application/octet-stream");
        await upsertTranscribeChunk({
          id: randomUUID(),
          jobId,
          idx: seg.idx,
          objectKey,
          startSec: String(seg.startSec),
          durSec: String(seg.durSec),
        });
      }
      await updateTranscribeJob(jobId, { totalChunks: segments.length });
    }

    await updateTranscribeJob(jobId, { status: "processing", error: null });
    const pending = await getIncompleteTranscribeChunks(jobId);
    const format = audioFormatFromExt(ext);

    for (const chunk of pending) {
      if (await isStopped(jobId)) return;
      await updateTranscribeChunk(chunk.id, { status: "processing", error: null });
      try {
        const buf = await getBuffer(chunk.objectKey);
        const base64 = buf.toString("base64");
        const result = await transcribeChunk(job.model, base64, format, {
          prompt: job.systemPrompt,
          chunkStartSec: Number(chunk.startSec ?? 0),
        });
        await updateTranscribeChunk(chunk.id, {
          status: "done",
          transcript: result.text,
          wordsJson: result.words ?? null,
          error: null,
        });
        const done = await countDoneChunks(jobId);
        await updateTranscribeJob(jobId, { completedChunks: done });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateTranscribeChunk(chunk.id, { status: "failed", error: msg });
        throw new Error(`chunk ${chunk.idx}: ${msg}`);
      }
    }

    const allChunks = await getTranscribeChunks(jobId);
    const words = mergeWords(
      allChunks.map((c) => ({
        words: c.wordsJson ?? undefined,
        startSec: Number(c.startSec ?? 0),
        text: c.transcript ?? "",
      })),
    );

    const transcriptKey = `jobs/${jobId}/transcript.json`;
    let resultMd: string;
    let language: string | undefined;
    if (words.length > 0) {
      const compiled = compileFromWords(words);
      await putBuffer(transcriptKey, JSON.stringify(compiled), "application/json");
      resultMd = markdownFromTranscript(compiled, job.filename, job.model);
      language = compiled.language;
    } else {
      const compiled = compileFromChunks(allChunks, job.language ?? undefined);
      await putBuffer(transcriptKey, JSON.stringify(compiled), "application/json");
      resultMd = compileMarkdown(
        job.filename,
        job.model,
        job.chunkUnit,
        String(job.chunkSize),
        allChunks,
      );
      language = compiled.language;
    }
    await updateTranscribeJob(jobId, { transcriptKey, language });

    const resultKey = `jobs/${jobId}/result.md`;
    await putBuffer(resultKey, resultMd, "text/markdown");
    await updateTranscribeJob(jobId, {
      status: "completed",
      resultKey,
      completedChunks: allChunks.length,
      hasWordTimings: words.length > 0,
      error: null,
    });
    clearTranscribeStop(jobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const current = await getTranscribeJob(jobId);
    if (current?.status === "stopped") return;
    await updateTranscribeJob(jobId, { status: "failed", error: msg });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
