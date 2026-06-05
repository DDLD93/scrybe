"use client";

import { useCallback, useEffect, useState } from "react";

export type TranscribeFolder = {
  id: string;
  name: string;
  jobCount: number;
  createdAt: string;
};

export function useTranscribeFolders(pollMs = 2000, paused = false) {
  const [folders, setFolders] = useState<TranscribeFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/transcribe/folders");
      const data = await res.json();
      if (data.folders) setFolders(data.folders);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = () => {
      void refresh();
    };
    const initial = window.setTimeout(run, 0);
    if (paused) {
      return () => window.clearTimeout(initial);
    }
    const t = window.setInterval(run, pollMs);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(t);
    };
  }, [refresh, pollMs, paused]);

  const createFolder = useCallback(async (name: string) => {
    const res = await fetch("/api/transcribe/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to create folder");
    await refresh();
    return data.folder as TranscribeFolder;
  }, [refresh]);

  const renameFolder = useCallback(async (id: string, name: string) => {
    const res = await fetch(`/api/transcribe/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to rename folder");
    await refresh();
    return data.folder as { id: string; name: string };
  }, [refresh]);

  const deleteFolder = useCallback(async (id: string) => {
    const res = await fetch(`/api/transcribe/folders/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to delete folder");
    await refresh();
    return true;
  }, [refresh]);

  return { folders, loading, refresh, createFolder, renameFolder, deleteFolder };
}
