import type { TranscriptSegment, TranscriptWord } from "@/lib/db/schema";

export type CompiledTranscript = {
  version: 1;
  language: string;
  duration: number;
  words: TranscriptWord[];
  segments: TranscriptSegment[];
};

export function mergeWords(chunks: Array<{ words?: TranscriptWord[]; startSec: number; text: string }>): TranscriptWord[] {
  const all: TranscriptWord[] = [];
  for (const chunk of chunks) {
    if (chunk.words?.length) {
      all.push(...chunk.words);
    }
  }
  if (all.length === 0) return [];
  all.sort((a, b) => a.start - b.start);
  const deduped: TranscriptWord[] = [];
  for (const w of all) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.start - w.start) < 0.5 && prev.word === w.word) continue;
    deduped.push(w);
  }
  return deduped;
}

export function buildSegmentsFromWords(words: TranscriptWord[], segmentDuration = 30): TranscriptSegment[] {
  if (words.length === 0) return [];
  const segments: TranscriptSegment[] = [];
  const totalDuration = words[words.length - 1].end;
  let segId = 0;
  for (let start = 0; start < totalDuration; start += segmentDuration) {
    const end = Math.min(start + segmentDuration, totalDuration);
    const slice = words.filter((w) => w.start >= start && w.start < end);
    if (slice.length === 0) continue;
    const wordStartIdx = words.indexOf(slice[0]);
    const wordEndIdx = words.indexOf(slice[slice.length - 1]);
    segments.push({
      id: segId++,
      start,
      end,
      text: slice.map((w) => w.word).join(" "),
      wordStartIdx,
      wordEndIdx,
    });
  }
  return segments;
}

export function compileMarkdown(
  filename: string,
  model: string,
  chunkUnit: string,
  chunkSize: string,
  chunks: Array<{ idx: number; startSec: number | string | null; durSec: number | string | null; transcript: string | null }>,
): string {
  const lines = [
    `# Transcription: ${filename}`,
    "",
    `- **Model:** ${model}`,
    `- **Chunking:** ${chunkSize} ${chunkUnit}`,
    `- **Segments:** ${chunks.length}`,
    `- **Generated:** ${new Date().toISOString()}`,
    "",
    "---",
    "",
  ];

  for (const c of chunks) {
    const start = Number(c.startSec ?? 0);
    const dur = Number(c.durSec ?? 0);
    const text = (c.transcript ?? "").trim() || "_(no speech detected)_";
    lines.push(`## Segment ${c.idx + 1} (${fmtTime(start)}–${fmtTime(start + dur)})`, "", text, "");
  }
  return lines.join("\n");
}

export function compileFromWords(
  words: TranscriptWord[],
  language = "en",
): CompiledTranscript {
  const duration = words.length ? words[words.length - 1].end : 0;
  const segments = buildSegmentsFromWords(words);
  return { version: 1, language, duration, words, segments };
}

export function compileFromChunks(
  chunks: Array<{
    idx: number;
    startSec: number | string | null;
    durSec: number | string | null;
    transcript: string | null;
  }>,
  language = "unknown",
): CompiledTranscript {
  const segments: TranscriptSegment[] = [];
  for (const c of chunks) {
    const text = (c.transcript ?? "").trim();
    if (!text) continue;
    const start = Number(c.startSec ?? 0);
    const end = start + Number(c.durSec ?? 0);
    segments.push({
      id: c.idx,
      start,
      end,
      text,
      wordStartIdx: 0,
      wordEndIdx: 0,
    });
  }
  const duration = segments.length ? segments[segments.length - 1].end : 0;
  return { version: 1, language, duration, words: [], segments };
}

function fmtTime(sec: number): string {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function markdownFromTranscript(t: CompiledTranscript, filename: string, model: string): string {
  const lines = [
    `# Transcription: ${filename}`,
    "",
    `- **Model:** ${model}`,
    `- **Duration:** ${fmtTime(t.duration)}`,
    `- **Generated:** ${new Date().toISOString()}`,
    "",
    "---",
    "",
  ];
  for (const seg of t.segments) {
    lines.push(`## Segment ${seg.id + 1} (${fmtTime(seg.start)}–${fmtTime(seg.end)})`, "", seg.text, "");
  }
  if (t.segments.length === 0 && t.words.length) {
    lines.push(t.words.map((w) => w.word).join(" "));
  }
  return lines.join("\n");
}
