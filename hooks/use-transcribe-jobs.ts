"use client";

import { useCallback, useEffect, useState } from "react";

export type TranscribeJob = {
  id: string;
  filename: string;
  model: string;
  status: string;
  totalChunks: number;
  completedChunks: number;
  hasWordTimings: boolean;
  jobKind?: string;
  createdAt?: string;
  folderId?: string | null;
  folderName?: string | null;
  error?: string | null;
};

export function useTranscribeJobs(pollMs = 2000, paused = false) {
  const [jobs, setJobs] = useState<TranscribeJob[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/transcribe");
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
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

  const hasActiveJobs = jobs.some((j) =>
    ["fetching", "pending", "chunking", "processing"].includes(j.status),
  );

  return { jobs, loading, refresh, hasActiveJobs };
}
