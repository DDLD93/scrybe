"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { SystemPromptFileType } from "@/lib/db/schema";

type PromptRow = {
  id: string;
  name: string;
  fileTypes: SystemPromptFileType[];
  prompt: string;
};

const FILE_TYPE_OPTIONS: { value: SystemPromptFileType; label: string }[] = [
  { value: "audio", label: "Audio" },
  { value: "pdf", label: "PDF" },
];

export default function SystemPromptsSettingsPage() {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromptRow | null>(null);
  const [name, setName] = useState("");
  const [fileTypes, setFileTypes] = useState<SystemPromptFileType[]>(["audio"]);
  const [promptText, setPromptText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system-prompts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setPrompts(data.prompts ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load prompts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setFileTypes(["audio"]);
    setPromptText("");
    setDialogOpen(true);
  }

  function openEdit(row: PromptRow) {
    setEditing(row);
    setName(row.name);
    setFileTypes([...row.fileTypes]);
    setPromptText(row.prompt);
    setDialogOpen(true);
  }

  function toggleFileType(ft: SystemPromptFileType) {
    setFileTypes((prev) =>
      prev.includes(ft) ? prev.filter((x) => x !== ft) : [...prev, ft],
    );
  }

  async function save() {
    if (!name.trim() || !promptText.trim() || fileTypes.length === 0) {
      toast.error("Name, file types, and prompt are required");
      return;
    }
    setSaving(true);
    try {
      const body = { name: name.trim(), fileTypes, prompt: promptText.trim() };
      const res = editing
        ? await fetch(`/api/system-prompts/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/system-prompts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success(editing ? "Prompt updated" : "Prompt created");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this system prompt?")) return;
    try {
      const res = await fetch(`/api/system-prompts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast.success("Prompt deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/transcribe"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <IconArrowLeft className="size-3.5" />
            Back to transcripts
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">System prompts</h1>
          <p className="text-sm text-muted-foreground">
            Presets for audio transcription and PDF page extraction.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <IconPlus className="size-4" />
          New prompt
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6" />
        </div>
      ) : (
        <div className="rounded-lg border border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>File types</TableHead>
                <TableHead className="max-w-md">Prompt</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prompts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No prompts yet. Create one or run npm run db:seed-prompts.
                  </TableCell>
                </TableRow>
              ) : (
                prompts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.fileTypes.map((ft) => (
                          <Badge key={ft} variant="secondary" className="text-[0.65rem]">
                            {ft}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                      {row.prompt}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(row)}
                        aria-label="Edit"
                      >
                        <IconPencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(row.id)}
                        aria-label="Delete"
                      >
                        <IconTrash className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit prompt" : "New prompt"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-name">Name</Label>
              <Input
                id="prompt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>File types</Label>
              <div className="flex gap-2">
                {FILE_TYPE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={fileTypes.includes(opt.value) ? "default" : "outline"}
                    onClick={() => toggleFileType(opt.value)}
                    disabled={saving}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt-text">Prompt</Label>
              <Textarea
                id="prompt-text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                rows={6}
                disabled={saving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Spinner className="size-4" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
