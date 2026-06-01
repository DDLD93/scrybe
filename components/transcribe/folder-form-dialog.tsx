"use client";

import { useState } from "react";
import { IconFolder } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { TranscribeFolder } from "@/hooks/use-transcribe-folders";

type FolderFormDialogProps = {
  mode: "create" | "rename";
  folder: TranscribeFolder | null;
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
};

function FolderFormDialogContent({
  mode,
  folder,
  saving,
  onOpenChange,
  onSubmit,
}: Omit<FolderFormDialogProps, "open">) {
  const [name, setName] = useState(
    mode === "rename" && folder ? folder.name : "",
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <IconFolder className="size-4" />
          {mode === "create" ? "New folder" : "Rename folder"}
        </DialogTitle>
        <DialogDescription>
          {mode === "create"
            ? "Create a folder to organize your transcripts."
            : "Update the folder name."}
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        <Label htmlFor="folder-name">Name</Label>
        <Input
          id="folder-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Folder name"
          maxLength={100}
          disabled={saving}
          autoFocus
          className="mt-2"
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? (
            <>
              <Spinner className="size-3.5" />
              Saving…
            </>
          ) : mode === "create" ? (
            "Create"
          ) : (
            "Save"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function FolderFormDialog({
  mode,
  folder,
  open,
  saving,
  onOpenChange,
  onSubmit,
}: FolderFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        {open ? (
          <FolderFormDialogContent
            key={`${mode}-${folder?.id ?? "create"}`}
            mode={mode}
            folder={folder}
            saving={saving}
            onOpenChange={onOpenChange}
            onSubmit={onSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
