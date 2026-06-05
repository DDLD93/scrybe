"use client";

import { useCallback, useEffect, useState } from "react";
import { IconLayoutGrid, IconList } from "@tabler/icons-react";
import { toast } from "sonner";
import { ModelSelect } from "@/components/transcribe/model-select";
import {
  SystemPromptFields,
  type SystemPromptPreset,
} from "@/components/transcribe/system-prompt-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { LibraryViewMode } from "@/lib/db/schema";

type Model = { id: string; name: string };

type SettingsData = {
  chunkUnit: string;
  chunkSize: string;
  model: string;
  pdfModel: string;
  defaultView: LibraryViewMode;
  lastSystemPromptId: string | null;
  lastPdfSystemPromptId: string | null;
  systemPrompt: string | null;
};

export function SystemSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audioModels, setAudioModels] = useState<Model[]>([]);
  const [pdfModels, setPdfModels] = useState<Model[]>([]);
  const [audioPresets, setAudioPresets] = useState<SystemPromptPreset[]>([]);
  const [pdfPresets, setPdfPresets] = useState<SystemPromptPreset[]>([]);

  const [chunkUnit, setChunkUnit] = useState("seconds");
  const [chunkSize, setChunkSize] = useState("30");
  const [audioModel, setAudioModel] = useState("");
  const [pdfModel, setPdfModel] = useState("");
  const [defaultView, setDefaultView] = useState<LibraryViewMode>("list");
  const [audioPromptSelection, setAudioPromptSelection] = useState("__none__");
  const [audioCustomPrompt, setAudioCustomPrompt] = useState("");
  const [pdfPromptSelection, setPdfPromptSelection] = useState("__none__");
  const [pdfCustomPrompt, setPdfCustomPrompt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, audioModelsRes, pdfModelsRes, audioPromptsRes, pdfPromptsRes] =
        await Promise.all([
          fetch("/api/transcribe/settings"),
          fetch("/api/transcribe/models?kind=audio"),
          fetch("/api/transcribe/models?kind=pdf"),
          fetch("/api/system-prompts?fileType=audio"),
          fetch("/api/system-prompts?fileType=pdf"),
        ]);

      const [settingsData, audioModelsData, pdfModelsData, audioPromptsData, pdfPromptsData] =
        await Promise.all([
          settingsRes.json(),
          audioModelsRes.json(),
          pdfModelsRes.json(),
          audioPromptsRes.json(),
          pdfPromptsRes.json(),
        ]);

      if (!settingsRes.ok) throw new Error(settingsData.error ?? "Failed to load settings");

      const s: SettingsData = settingsData.settings;
      setChunkUnit(s.chunkUnit);
      setChunkSize(String(s.chunkSize));
      setAudioModel(s.model);
      setPdfModel(s.pdfModel);
      setDefaultView(s.defaultView === "grid" ? "grid" : "list");

      if (s.lastSystemPromptId) {
        setAudioPromptSelection(s.lastSystemPromptId);
      } else if (s.systemPrompt) {
        setAudioPromptSelection("__custom__");
        setAudioCustomPrompt(s.systemPrompt);
      } else {
        setAudioPromptSelection("__none__");
      }

      if (s.lastPdfSystemPromptId) {
        setPdfPromptSelection(s.lastPdfSystemPromptId);
      } else {
        setPdfPromptSelection("__none__");
      }

      setAudioModels(audioModelsData.models ?? []);
      setPdfModels(pdfModelsData.models ?? []);
      setAudioPresets(
        (audioPromptsData.prompts ?? []).map(
          (p: { id: string; name: string; prompt: string }) => ({
            id: p.id,
            name: p.name,
            prompt: p.prompt,
          }),
        ),
      );
      setPdfPresets(
        (pdfPromptsData.prompts ?? []).map((p: { id: string; name: string; prompt: string }) => ({
          id: p.id,
          name: p.name,
          prompt: p.prompt,
        })),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resolvePromptPayload(
    selection: string,
    customPrompt: string,
  ): { lastSystemPromptId: string | null; systemPrompt: string | null } {
    if (selection === "__custom__") {
      const text = customPrompt.trim();
      return { lastSystemPromptId: null, systemPrompt: text || null };
    }
    if (selection === "__none__" || !selection) {
      return { lastSystemPromptId: null, systemPrompt: null };
    }
    return { lastSystemPromptId: selection, systemPrompt: null };
  }

  async function save() {
    if (!audioModel) {
      toast.error("Select a default audio model");
      return;
    }
    setSaving(true);
    try {
      const audioPrompt = resolvePromptPayload(audioPromptSelection, audioCustomPrompt);
      const pdfPrompt = resolvePromptPayload(pdfPromptSelection, pdfCustomPrompt);

      const res = await fetch("/api/transcribe/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chunkUnit,
          chunkSize,
          model: audioModel,
          pdfModel: pdfModel || null,
          defaultView,
          lastSystemPromptId: audioPrompt.lastSystemPromptId,
          lastPdfSystemPromptId: pdfPrompt.lastSystemPromptId,
          systemPrompt: audioPrompt.systemPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="text-base">Library</CardTitle>
          <CardDescription>How transcripts are displayed in the library view.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Default view</Label>
            <div className="flex w-fit items-center rounded-lg border border-border/50 p-0.5">
              <Button
                type="button"
                variant={defaultView === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 gap-1.5 px-3"
                onClick={() => setDefaultView("grid")}
                disabled={saving}
              >
                <IconLayoutGrid className="size-3.5" />
                Grid
              </Button>
              <Button
                type="button"
                variant={defaultView === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 gap-1.5 px-3"
                onClick={() => setDefaultView("list")}
                disabled={saving}
              >
                <IconList className="size-3.5" />
                List
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="text-base">Audio processing</CardTitle>
          <CardDescription>
            Defaults applied when uploading audio files. Override per job is not available from the
            upload dialog — change these before starting a new file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Chunk by</Label>
              <Select value={chunkUnit} onValueChange={setChunkUnit} disabled={saving}>
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
              <Label htmlFor="settings-chunk-size">Chunk size</Label>
              <Input
                id="settings-chunk-size"
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Default model</Label>
            <ModelSelect
              models={audioModels}
              value={audioModel}
              onValueChange={setAudioModel}
              disabled={saving}
            />
          </div>

          <SystemPromptFields
            presets={audioPresets}
            selection={audioPromptSelection}
            onSelectionChange={setAudioPromptSelection}
            customPrompt={audioCustomPrompt}
            onCustomPromptChange={setAudioCustomPrompt}
            disabled={saving}
            hint="Applied to every audio chunk during processing."
          />
        </CardContent>
      </Card>

      <Card className="glass-card ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="text-base">PDF processing</CardTitle>
          <CardDescription>
            Defaults for PDF uploads. Each page is processed separately with the vision model.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default model</Label>
            <ModelSelect
              models={pdfModels}
              value={pdfModel}
              onValueChange={setPdfModel}
              disabled={saving}
            />
            {!pdfModel && (
              <p className="text-xs text-muted-foreground">
                No PDF model selected — audio model will be used as fallback.
              </p>
            )}
          </div>

          <SystemPromptFields
            presets={pdfPresets}
            selection={pdfPromptSelection}
            onSelectionChange={setPdfPromptSelection}
            customPrompt={pdfCustomPrompt}
            onCustomPromptChange={setPdfCustomPrompt}
            disabled={saving}
            hint="Applied to every page during vision extraction."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="min-w-28">
          {saving ? <Spinner className="size-4" /> : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
