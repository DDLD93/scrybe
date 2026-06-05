import { config } from "@/lib/config";
import type { TranscriptWord } from "@/lib/db/schema";

export type ModelInfo = { id: string; name: string };

type OpenRouterArchitecture = {
  input_modalities?: string[];
  output_modalities?: string[];
};

type OpenRouterModel = {
  id: string;
  name?: string;
  architecture?: OpenRouterArchitecture;
};

type ModelsCache = {
  at: number;
  models: ModelInfo[];
  sttOnlyIds: Set<string>;
  chatAudioIds: Set<string>;
  visionIds: Set<string>;
  allModels: OpenRouterModel[];
};

let modelsCache: ModelsCache | null = null;

const FALLBACK_MODELS: ModelInfo[] = [
  { id: "openai/whisper-large-v3-turbo", name: "Whisper Large V3 Turbo" },
  { id: "openai/whisper-1", name: "Whisper 1" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
];

const FALLBACK_VISION_MODELS: ModelInfo[] = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
];

const FALLBACK_STT_ONLY = new Set([
  "openai/whisper-large-v3-turbo",
  "openai/whisper-large-v3",
  "openai/whisper-1",
  "openai/gpt-4o-transcribe",
  "openai/gpt-4o-mini-transcribe",
  "google/chirp-3",
]);

const routeCache = new Map<string, "stt" | "chat">();

async function fetchOpenRouterModels(url: string): Promise<OpenRouterModel[]> {
  const res = await fetch(url, {
    headers: config.openrouterApiKey
      ? { Authorization: `Bearer ${config.openrouterApiKey}` }
      : {},
  });
  if (!res.ok) throw new Error(`models fetch failed: ${url}`);
  const json = (await res.json()) as { data?: OpenRouterModel[] };
  return json.data ?? [];
}

function mergeModels(lists: OpenRouterModel[][]): ModelInfo[] {
  const byId = new Map<string, ModelInfo>();
  for (const list of lists) {
    for (const m of list) {
      if (!byId.has(m.id)) {
        byId.set(m.id, { id: m.id, name: m.name ?? m.id });
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function isSttOnlyModel(model: OpenRouterModel): boolean {
  const outputs = model.architecture?.output_modalities ?? [];
  return outputs.includes("transcription");
}

function isChatAudioModel(model: OpenRouterModel): boolean {
  const inputs = model.architecture?.input_modalities ?? [];
  const outputs = model.architecture?.output_modalities ?? [];
  return inputs.includes("audio") && outputs.includes("text") && !outputs.includes("transcription");
}

function isVisionModel(model: OpenRouterModel): boolean {
  const inputs = model.architecture?.input_modalities ?? [];
  const outputs = model.architecture?.output_modalities ?? [];
  return inputs.includes("image") && outputs.includes("text");
}

function buildModelsCache(allModels: OpenRouterModel[], sttModels: OpenRouterModel[]): ModelsCache {
  const sttOnlyIds = new Set(sttModels.filter(isSttOnlyModel).map((m) => m.id));
  const chatAudioIds = new Set(allModels.filter(isChatAudioModel).map((m) => m.id));
  const visionIds = new Set(allModels.filter(isVisionModel).map((m) => m.id));
  for (const id of FALLBACK_STT_ONLY) sttOnlyIds.add(id);
  for (const m of FALLBACK_VISION_MODELS) visionIds.add(m.id);

  return {
    at: Date.now(),
    models: mergeModels([allModels, sttModels]),
    sttOnlyIds,
    chatAudioIds,
    visionIds,
    allModels,
  };
}

async function ensureModelsCache(): Promise<ModelsCache> {
  if (modelsCache && Date.now() - modelsCache.at < 5 * 60 * 1000) {
    return modelsCache;
  }
  try {
    const [allModels, sttModels] = await Promise.all([
      fetchOpenRouterModels("https://openrouter.ai/api/v1/models"),
      fetchOpenRouterModels(
        "https://openrouter.ai/api/v1/models?output_modalities=transcription",
      ),
    ]);
    if (allModels.length + sttModels.length >= 2) {
      modelsCache = buildModelsCache(allModels, sttModels);
      return modelsCache;
    }
  } catch {
    /* fallback below */
  }

  modelsCache = {
    at: Date.now(),
    models: FALLBACK_MODELS,
    sttOnlyIds: new Set(FALLBACK_STT_ONLY),
    chatAudioIds: new Set(["google/gemini-2.5-flash"]),
    visionIds: new Set(FALLBACK_VISION_MODELS.map((m) => m.id)),
    allModels: [],
  };
  return modelsCache;
}

export async function listModels(): Promise<ModelInfo[]> {
  const cache = await ensureModelsCache();
  return cache.models;
}

export async function listAudioModels(): Promise<ModelInfo[]> {
  const cache = await ensureModelsCache();
  return cache.models.filter(
    (m) => cache.sttOnlyIds.has(m.id) || cache.chatAudioIds.has(m.id) || isSttModelHeuristic(m.id),
  );
}

export async function listVisionModels(): Promise<ModelInfo[]> {
  const cache = await ensureModelsCache();
  const fromApi = cache.allModels
    .filter(isVisionModel)
    .map((m) => ({ id: m.id, name: m.name ?? m.id }));
  if (fromApi.length > 0) {
    return fromApi.sort((a, b) => a.id.localeCompare(b.id));
  }
  return [...FALLBACK_VISION_MODELS];
}

export async function isVisionModelId(modelId: string): Promise<boolean> {
  const cache = await ensureModelsCache();
  return cache.visionIds.has(modelId);
}

export async function transcribePage(
  model: string,
  base64Png: string,
  prompt?: string | null,
): Promise<TranscribeChunkResult> {
  if (!config.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const userInstructions =
    prompt?.trim() || "Extract all visible text from this document page.";
  const system =
    "Extract or transcribe page content per the user instructions. Output plain text only — no preamble unless requested.";

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: userInstructions },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${base64Png}` },
          },
        ],
      },
    ],
  };

  const json = await openrouterFetch("https://openrouter.ai/api/v1/chat/completions", body);
  const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
  const text = choices?.[0]?.message?.content ?? "";
  return { text: text.trim(), words: undefined };
}

function isSttModelHeuristic(model: string): boolean {
  const id = model.toLowerCase();
  return /whisper|transcrib|\/asr|chirp|voxtral|parakeet|stt/.test(id);
}

function getRouteOrder(model: string, cache: ModelsCache): Array<"stt" | "chat"> {
  const cached = routeCache.get(model);
  if (cached) return [cached];

  const sttOnly = cache.sttOnlyIds.has(model) || isSttModelHeuristic(model);
  const chatAudio = cache.chatAudioIds.has(model);

  if (sttOnly && !chatAudio) return ["stt"];
  if (chatAudio && !sttOnly) return ["chat", "stt"];
  if (model.toLowerCase().includes("whisper")) return ["stt", "chat"];
  return ["stt", "chat"];
}

export type TranscribeChunkResult = {
  text: string;
  words?: TranscriptWord[];
};

function offsetWords(
  result: TranscribeChunkResult,
  chunkStartSec?: number,
): TranscribeChunkResult {
  if (chunkStartSec == null || !result.words) return result;
  return {
    ...result,
    words: result.words.map((w) => ({
      ...w,
      start: w.start + chunkStartSec,
      end: w.end + chunkStartSec,
    })),
  };
}

export async function transcribeChunk(
  model: string,
  base64Audio: string,
  format: string,
  opts?: { prompt?: string | null; chunkStartSec?: number },
): Promise<TranscribeChunkResult> {
  if (isWhisperModel(model) && config.openaiApiKey) {
    const result = await openaiWhisperRoute(model, base64Audio, format, opts?.prompt);
    return offsetWords(result, opts?.chunkStartSec);
  }

  if (!config.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const cache = await ensureModelsCache();
  const order = getRouteOrder(model, cache);

  let lastErr: Error | null = null;
  for (const route of order) {
    try {
      const result = route === "stt"
        ? await sttRoute(model, base64Audio, format, opts?.prompt)
        : await chatRoute(model, base64Audio, format, opts?.prompt);
      routeCache.set(model, route);
      return offsetWords(result, opts?.chunkStartSec);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (!isWrongEndpointError(lastErr)) throw lastErr;
    }
  }
  throw lastErr ?? new Error("Transcription failed");
}

function isWhisperModel(model: string): boolean {
  return model.toLowerCase().includes("whisper");
}

function whisperProviderOptions(): Record<string, unknown> {
  return {
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"],
  };
}

async function sttRoute(
  model: string,
  base64Audio: string,
  format: string,
  prompt?: string | null,
): Promise<TranscribeChunkResult> {
  const body: Record<string, unknown> = {
    model,
    input_audio: { data: base64Audio, format },
  };
  if (isWhisperModel(model)) {
    body.provider = {
      options: {
        openai: whisperProviderOptions(),
        groq: whisperProviderOptions(),
      },
    };
  }
  if (prompt) body.prompt = prompt;

  const json = await openrouterFetch("https://openrouter.ai/api/v1/audio/transcriptions", body);
  const text = (json.text ?? json.transcript ?? "") as string;
  const words = parseWords(json, 0);
  return { text, words };
}

async function openaiWhisperRoute(
  model: string,
  base64Audio: string,
  format: string,
  prompt?: string | null,
): Promise<TranscribeChunkResult> {
  const modelId = model.includes("/") ? model.split("/").pop()! : model;
  const audioBuffer = Buffer.from(base64Audio, "base64");
  const form = new FormData();
  form.append("file", new Blob([audioBuffer]), `audio.${format}`);
  form.append("model", modelId);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  if (prompt) form.append("prompt", prompt);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.openaiApiKey}` },
      body: form,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${text.slice(0, 500)}`);
    }
    const json = JSON.parse(text) as Record<string, unknown>;
    return {
      text: (json.text ?? "") as string,
      words: parseWords(json, 0),
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("OpenAI request timed out after 120s");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function chatRoute(
  model: string,
  base64Audio: string,
  format: string,
  prompt?: string | null,
): Promise<TranscribeChunkResult> {
  const system = `Transcribe the provided audio verbatim. Output only the transcript text — no preamble, commentary, or timestamps.${prompt ? `\n\n${prompt}` : ""}`;
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe this audio." },
          { type: "input_audio", input_audio: { data: base64Audio, format } },
        ],
      },
    ],
  };
  const json = await openrouterFetch("https://openrouter.ai/api/v1/chat/completions", body);
  const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
  const text = choices?.[0]?.message?.content ?? "";
  return { text: text.trim(), words: undefined };
}

type RawWord = { word: string; start: number; end: number; confidence?: number };

function mapWords(raw: RawWord[], offset: number): TranscriptWord[] {
  return raw.map((w) => ({
    word: w.word,
    start: w.start + offset,
    end: w.end + offset,
    confidence: w.confidence,
  }));
}

function parseWords(json: Record<string, unknown>, offset: number): TranscriptWord[] | undefined {
  const topLevel = json.words as RawWord[] | undefined;
  if (topLevel?.length) return mapWords(topLevel, offset);

  const segments = json.segments as Array<{ words?: RawWord[] }> | undefined;
  if (segments?.length) {
    const nested: RawWord[] = [];
    for (const seg of segments) {
      if (seg.words?.length) nested.push(...seg.words);
    }
    if (nested.length) return mapWords(nested, offset);
  }

  return undefined;
}

async function openrouterFetch(url: string, body: unknown): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`);
    }
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("OpenRouter request timed out after 120s");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isWrongEndpointError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  if (!msg.includes("400") && !msg.includes("404")) return false;
  const markers = [
    "does not exist",
    "not a valid",
    "no endpoints",
    "not support",
    "no allowed providers",
    "input_audio",
    "invalid_value",
    "unsupported",
  ];
  return markers.some((m) => msg.includes(m));
}
