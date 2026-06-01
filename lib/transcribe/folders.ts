import type { TranscribeJob } from "@/hooks/use-transcribe-jobs";

export type TranscriptFolder = {
  id: string;
  label: string;
  count: number;
};

export type TranscriptFilters = {
  query: string;
  status: string;
  wordTiming: string;
  folder: string;
};

export const UNCATEGORIZED_FOLDER = "__uncategorized__";

export function filterTranscriptJobs(
  jobs: TranscribeJob[],
  filters: TranscriptFilters,
): TranscribeJob[] {
  const q = filters.query.trim().toLowerCase();

  return jobs.filter((job) => {
    if (q && !job.filename.toLowerCase().includes(q)) return false;

    if (filters.status !== "all") {
      if (filters.status === "active") {
        if (!["pending", "chunking", "processing"].includes(job.status)) return false;
      } else if (job.status !== filters.status) {
        return false;
      }
    }

    if (filters.wordTiming === "yes" && !job.hasWordTimings) return false;
    if (filters.wordTiming === "no" && job.hasWordTimings) return false;

    if (filters.folder !== "all") {
      if (filters.folder === UNCATEGORIZED_FOLDER) {
        if (job.folderId) return false;
      } else if (job.folderId !== filters.folder) {
        return false;
      }
    }

    return true;
  });
}

export function jobsForFolder(jobs: TranscribeJob[], folderId: string | null): TranscribeJob[] {
  if (folderId === null) {
    return jobs.filter((job) => !job.folderId);
  }
  return jobs.filter((job) => job.folderId === folderId);
}

export function uncategorizedJobs(jobs: TranscribeJob[]): TranscribeJob[] {
  return jobsForFolder(jobs, null);
}

export function folderLabel(
  folderId: string,
  folders: Array<{ id: string; name: string }>,
): string {
  if (folderId === UNCATEGORIZED_FOLDER) return "Uncategorized";
  return folders.find((f) => f.id === folderId)?.name ?? folderId;
}

export function toFolderCards(
  folders: Array<{ id: string; name: string; jobCount: number }>,
  jobs: TranscribeJob[],
): TranscriptFolder[] {
  const cards: TranscriptFolder[] = folders.map((f) => ({
    id: f.id,
    label: f.name,
    count: f.jobCount,
  }));

  const uncategorizedCount = uncategorizedJobs(jobs).length;
  if (uncategorizedCount > 0) {
    cards.unshift({
      id: UNCATEGORIZED_FOLDER,
      label: "Uncategorized",
      count: uncategorizedCount,
    });
  }

  return cards;
}
