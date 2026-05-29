"use client";

import { useCallback, useEffect, useState } from "react";

export type TranscribeJob = {
  id: string;
  filename: string;
  model: string;
  status: string;
  totalChunks: number;
  completedChunks: number;
  error?: string | null;
};

export function useTranscribeJobs(pollMs = 2000) {
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
    refresh();
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  const hasActiveJobs = jobs.some((j) =>
    ["pending", "chunking", "processing"].includes(j.status),
  );

  return { jobs, loading, refresh, hasActiveJobs };
}
