"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  IconCloudUpload,
  IconLink,
  IconUpload,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelSelect } from "@/components/transcribe/model-select";
import {
  buildPromptPayload,
  SystemPromptFields,
  type SystemPromptPreset,
} from "@/components/transcribe/system-prompt-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadOverlay } from "@/components/transcribe/upload-overlay";
import { detectFileKind, type FileKind } from "@/lib/detect-file-kind";
import { uploadTranscribeFile, type UploadProgress } from "@/lib/upload-with-progress";
import { cn } from "@/lib/utils";

import type { TranscribeFolder } from "@/hooks/use-transcribe-folders";

type Model = { id: string; name: string };

type NewTranscriptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  folders?: TranscribeFolder[];
};

const URL_PRESETS = ["mp3", "aac", "best"] as const;

export function NewTranscriptDialog({
  open,
  onOpenChange,
  onSuccess,
  folders = [],
}: NewTranscriptDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [presets, setPresets] = useState<SystemPromptPreset[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<FileKind>("audio");
  const [dragOver, setDragOver] = useState(false);
  const [unit, setUnit] = useState("seconds");
  const [size, setSize] = useState("30");
  const [model, setModel] = useState("");
  const [promptSelection, setPromptSelection] = useState("__none__");
  const [customPrompt, setCustomPrompt] = useState("");
  const [folderId, setFolderId] = useState<string>("__none__");
  const [url, setUrl] = useState("");
  const [preset, setPreset] = useState<string>("mp3");
  const [submitting, setSubmitting] = useState(false);
  const [urlPhase, setUrlPhase] = useState<"idle" | "fetching">("idle");
  const [uploadOverlay, setUploadOverlay] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    phase: "uploading",
    percent: 0,
  });

  const loadModelsAndPrompts = useCallback(async (kind: FileKind) => {
    const [mRes, pRes] = await Promise.all([
      fetch(`/api/transcribe/models?kind=${kind}`),
      fetch(`/api/system-prompts?fileType=${kind}`),
    ]);
    const mData = await mRes.json();
    const pData = await pRes.json();
    const list: Model[] = mData.models ?? [];
    setModels(list);
    setPresets(
      (pData.prompts ?? []).map((p: { id: string; name: string; prompt: string }) => ({
        id: p.id,
        name: p.name,
        prompt: p.prompt,
      })),
    );
    if (list.length && !list.some((m) => m.id === model)) {
      setModel(list[0].id);
    }
  }, [model]);

  useEffect(() => {
    if (!open) return;
    async function init() {
      try {
        const sRes = await fetch("/api/transcribe/settings");
        const sData = await sRes.json();
        const settings = sData.settings;
        await loadModelsAndPrompts("audio");
        if (settings) {
          if (settings.chunkUnit) setUnit(settings.chunkUnit);
          if (settings.chunkSize) setSize(String(settings.chunkSize));
          if (settings.lastSystemPromptId) {
            setPromptSelection(settings.lastSystemPromptId);
          } else if (settings.systemPrompt) {
            setPromptSelection("__custom__");
            setCustomPrompt(settings.systemPrompt);
          }
          if (settings.model) setModel(settings.model);
        }
      } catch {
        setModels([{ id: "openai/whisper-1", name: "Whisper 1" }]);
        setModel("openai/whisper-1");
      }
    }
    init();
  }, [open, loadModelsAndPrompts]);

  useEffect(() => {
    if (!file) return;
    const kind = detectFileKind(file);
    setFileKind(kind);
    void loadModelsAndPrompts(kind);
  }, [file, loadModelsAndPrompts]);

  const handleFile = useCallback((f: File | null) => {
    setFile(f);
    if (f) setFileKind(detectFileKind(f));
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || submitting) return;

    setSubmitting(true);
    setUploadOverlay(true);
    setUploadProgress({ phase: "uploading", percent: 0 });

    const promptPayload = buildPromptPayload(promptSelection, customPrompt);

    try {
      const data = await uploadTranscribeFile(
        file,
        {
          unit: fileKind === "pdf" ? "page" : unit,
          size: fileKind === "pdf" ? "1" : size,
          model,
          ...promptPayload,
          folderId: folderId === "__none__" ? undefined : folderId,
        },
        setUploadProgress,
      );
      toast.success(
        `${fileKind === "pdf" ? "Document" : "Transcription"} started — job ${data.jobId.slice(0, 8)}…`,
      );
      setFile(null);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
      setUploadOverlay(false);
    }
  }

  async function submitFromUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url || submitting) return;

    setSubmitting(true);
    setUrlPhase("fetching");

    const promptPayload = buildPromptPayload(promptSelection, customPrompt);

    try {
      const res = await fetch("/api/transcribe/jobs/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          preset,
          model,
          size,
          unit,
          ...promptPayload,
          folderId: folderId === "__none__" ? undefined : folderId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start");

      const jobId = data.jobId as string;
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await fetch(`/api/transcribe/jobs/${jobId}`);
        const payload = await st.json();
        const status = payload.job?.status;
        if (status && status !== "fetching") {
          if (status === "failed") throw new Error(payload.job?.error ?? "Fetch failed");
          break;
        }
      }

      toast.success(`Transcription started — job ${jobId.slice(0, 8)}…`);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
      setUrlPhase("idle");
    }
  }

  const busy = submitting || uploadOverlay;
  const isPdf = fileKind === "pdf";

  return (
    <>
      <UploadOverlay
        open={uploadOverlay}
        filename={file?.name ?? ""}
        progress={uploadProgress}
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>New Transcript</DialogTitle>
            <DialogDescription>
              Upload audio or PDF, or fetch audio from a URL.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="upload" className="gap-4">
            <TabsList className="w-full">
              <TabsTrigger value="upload" className="flex-1 gap-1.5" disabled={busy}>
                <IconUpload className="size-3.5" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="url" className="flex-1 gap-1.5" disabled={busy}>
                <IconLink className="size-3.5" />
                From URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload">
              <form onSubmit={submitUpload} className="space-y-4">
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors",
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:border-primary/50 hover:bg-muted/30",
                  )}
                >
                  <IconCloudUpload className="size-8 text-muted-foreground" />
                  {file ? (
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)} MB · {isPdf ? "PDF" : "Audio"}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-foreground">Drop audio or PDF here</p>
                      <p className="text-xs text-muted-foreground">or click to browse</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <FormFields
                  unit={unit}
                  setUnit={setUnit}
                  size={size}
                  setSize={setSize}
                  model={model}
                  setModel={setModel}
                  models={models}
                  presets={presets}
                  promptSelection={promptSelection}
                  setPromptSelection={setPromptSelection}
                  customPrompt={customPrompt}
                  setCustomPrompt={setCustomPrompt}
                  folderId={folderId}
                  setFolderId={setFolderId}
                  folders={folders}
                  hideChunking={isPdf}
                  fileKind={fileKind}
                  disabled={busy}
                />

                <Button type="submit" disabled={!file || busy} className="w-full" size="lg">
                  {submitting ? (
                    <Spinner className="size-4" />
                  ) : isPdf ? (
                    "Start document extraction"
                  ) : (
                    "Start transcription"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="url">
              <form onSubmit={submitFromUrl} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Media URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={busy}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Download format</Label>
                  <div className="flex gap-2">
                    {URL_PRESETS.map((p) => (
                      <Button
                        key={p}
                        type="button"
                        variant={preset === p ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPreset(p)}
                        disabled={busy}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>

                <FormFields
                  unit={unit}
                  setUnit={setUnit}
                  size={size}
                  setSize={setSize}
                  model={model}
                  setModel={setModel}
                  models={models}
                  presets={presets}
                  promptSelection={promptSelection}
                  setPromptSelection={setPromptSelection}
                  customPrompt={customPrompt}
                  setCustomPrompt={setCustomPrompt}
                  folderId={folderId}
                  setFolderId={setFolderId}
                  folders={folders}
                  hideChunking={false}
                  fileKind="audio"
                  disabled={busy}
                />

                <Button type="submit" disabled={!url || busy} className="w-full" size="lg">
                  {urlPhase === "fetching" && (
                    <>
                      <Spinner className="size-4" />
                      Fetching media…
                    </>
                  )}
                  {urlPhase === "idle" && "Fetch & transcribe"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

type FormFieldsProps = {
  unit: string;
  setUnit: (v: string) => void;
  size: string;
  setSize: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  models: Model[];
  presets: SystemPromptPreset[];
  promptSelection: string;
  setPromptSelection: (v: string) => void;
  customPrompt: string;
  setCustomPrompt: (v: string) => void;
  folderId: string;
  setFolderId: (v: string) => void;
  folders: TranscribeFolder[];
  hideChunking?: boolean;
  fileKind: FileKind;
  disabled?: boolean;
};

const FormFields = memo(function FormFields({
  unit,
  setUnit,
  size,
  setSize,
  model,
  setModel,
  models,
  presets,
  promptSelection,
  setPromptSelection,
  customPrompt,
  setCustomPrompt,
  folderId,
  setFolderId,
  folders,
  hideChunking,
  fileKind,
  disabled,
}: FormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>Folder</Label>
        <Select value={folderId} onValueChange={setFolderId} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Uncategorized" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None (uncategorized)</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hideChunking && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Chunk by</Label>
            <Select value={unit} onValueChange={setUnit} disabled={disabled}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Seconds</SelectItem>
                <SelectItem value="mb">Megabytes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chunk-size">Chunk size</Label>
            <Input
              id="chunk-size"
              type="number"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {hideChunking && (
        <p className="text-xs text-muted-foreground">
          Each PDF page is processed separately with your selected vision model.
        </p>
      )}

      <div className="space-y-2">
        <Label>Model</Label>
        <ModelSelect
          models={models}
          value={model}
          onValueChange={setModel}
          disabled={disabled}
        />
      </div>

      <SystemPromptFields
        presets={presets}
        selection={promptSelection}
        onSelectionChange={setPromptSelection}
        customPrompt={customPrompt}
        onCustomPromptChange={setCustomPrompt}
        disabled={disabled}
        hint={
          fileKind === "pdf"
            ? "Applied to every page during vision extraction."
            : "Applied to every chunk during transcription."
        }
      />
    </>
  );
});
