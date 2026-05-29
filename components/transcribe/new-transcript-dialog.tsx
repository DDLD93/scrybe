"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UploadOverlay } from "@/components/transcribe/upload-overlay";
import { uploadTranscribeFile, type UploadProgress } from "@/lib/upload-with-progress";
import { cn } from "@/lib/utils";

type Model = { id: string; name: string };

type NewTranscriptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

const URL_PRESETS = ["mp3", "aac", "best"] as const;

export function NewTranscriptDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewTranscriptDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [unit, setUnit] = useState("seconds");
  const [size, setSize] = useState("30");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [url, setUrl] = useState("");
  const [preset, setPreset] = useState<string>("mp3");
  const [submitting, setSubmitting] = useState(false);
  const [urlPhase, setUrlPhase] = useState<"idle" | "downloading" | "transcribing">("idle");
  const [uploadOverlay, setUploadOverlay] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    phase: "uploading",
    percent: 0,
  });

  useEffect(() => {
    if (!open) return;
    async function init() {
      try {
        const [mRes, sRes] = await Promise.all([
          fetch("/api/transcribe/models"),
          fetch("/api/transcribe/settings"),
        ]);
        const mData = await mRes.json();
        const sData = await sRes.json();
        const list: Model[] = mData.models ?? [{ id: "openai/whisper-1", name: "Whisper 1" }];
        setModels(list);
        const settings = sData.settings;
        if (settings) {
          if (settings.chunkUnit) setUnit(settings.chunkUnit);
          if (settings.chunkSize) setSize(String(settings.chunkSize));
          if (settings.systemPrompt) setPrompt(settings.systemPrompt);
          if (settings.model && list.some((m) => m.id === settings.model)) {
            setModel(settings.model);
          } else if (list[0]) setModel(list[0].id);
        } else if (list[0]) {
          setModel(list[0].id);
        }
      } catch {
        setModels([{ id: "openai/whisper-1", name: "Whisper 1" }]);
        setModel("openai/whisper-1");
      }
    }
    init();
  }, [open]);

  const grouped = models.reduce<Record<string, Model[]>>((acc, m) => {
    const provider = m.id.split("/")[0] ?? "other";
    (acc[provider] ??= []).push(m);
    return acc;
  }, {});

  const handleFile = useCallback((f: File | null) => {
    setFile(f);
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

    try {
      const data = await uploadTranscribeFile(
        file,
        { unit, size, model, prompt },
        setUploadProgress,
      );
      toast.success(`Transcription started — job ${data.jobId.slice(0, 8)}…`);
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
    setUrlPhase("downloading");

    try {
      const dlRes = await fetch("/api/download/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, preset }),
      });
      const dlData = await dlRes.json();
      if (!dlRes.ok) throw new Error(dlData.error ?? "Download failed");

      const jobId = dlData.jobId;
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await fetch(`/api/download/jobs/${jobId}`);
        const job = await st.json();
        if (job.status === "completed") break;
        if (job.status === "failed") throw new Error(job.error ?? "Download failed");
      }

      setUrlPhase("transcribing");
      const q = new URLSearchParams({ model, size, unit, prompt });
      const txRes = await fetch(
        `/api/download/jobs/${jobId}/transcribe?${q}`,
        { method: "POST" },
      );
      const txData = await txRes.json();
      if (!txRes.ok) throw new Error(txData.error ?? "Transcribe failed");

      toast.success(`Transcription started — job ${txData.jobId.slice(0, 8)}…`);
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
              Upload audio or fetch from a URL, then transcribe with your chosen model.
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
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-foreground">Drop audio file here</p>
                      <p className="text-xs text-muted-foreground">or click to browse</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
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
                  prompt={prompt}
                  setPrompt={setPrompt}
                  grouped={grouped}
                  disabled={busy}
                />

                <Button type="submit" disabled={!file || busy} className="w-full" size="lg">
                  {submitting ? <Spinner className="size-4" /> : "Start transcription"}
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
                  prompt={prompt}
                  setPrompt={setPrompt}
                  grouped={grouped}
                  disabled={busy}
                />

                <Button type="submit" disabled={!url || busy} className="w-full" size="lg">
                  {urlPhase === "downloading" && (
                    <>
                      <Spinner className="size-4" />
                      Downloading…
                    </>
                  )}
                  {urlPhase === "transcribing" && (
                    <>
                      <Spinner className="size-4" />
                      Starting transcription…
                    </>
                  )}
                  {urlPhase === "idle" && "Download & transcribe"}
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
  prompt: string;
  setPrompt: (v: string) => void;
  grouped: Record<string, Model[]>;
  disabled?: boolean;
};

function FormFields({
  unit,
  setUnit,
  size,
  setSize,
  model,
  setModel,
  prompt,
  setPrompt,
  grouped,
  disabled,
}: FormFieldsProps) {
  return (
    <>
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

      <div className="space-y-2">
        <Label>Model</Label>
        <Select value={model} onValueChange={setModel} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([provider, items]) => (
                <SelectGroup key={provider}>
                  <SelectLabel>{provider}</SelectLabel>
                  {items.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="system-prompt">System prompt</Label>
        <Textarea
          id="system-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Guide transcription style, terminology, speaker names…"
          disabled={disabled}
        />
        <p className="text-[0.65rem] text-muted-foreground">
          Optional. Applied to every chunk during transcription.
        </p>
      </div>
    </>
  );
}
