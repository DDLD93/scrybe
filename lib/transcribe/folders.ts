import type { TranscribeJob } from "@/hooks/use-transcribe-jobs";

export type TranscriptFolder = {
  id: string;
  label: string;
  count: number;
};

const FOLDER_ORDER = [
  "today",
  "yesterday",
  "this-week",
  "this-month",
  "older",
] as const;

export type TranscriptFolderId = (typeof FOLDER_ORDER)[number];

const FOLDER_LABELS: Record<TranscriptFolderId, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "This week",
  "this-month": "This month",
  older: "Older",
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getFolderIdForDate(date: Date, now = new Date()): TranscriptFolderId {
  const day = startOfDay(date).getTime();
  const today = startOfDay(now).getTime();
  const diffDays = Math.floor((today - day) / 86_400_000);

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "this-week";
  if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
    return "this-month";
  }
  return "older";
}

export function groupJobsByFolder(jobs: TranscribeJob[]): Map<TranscriptFolderId, TranscribeJob[]> {
  const groups = new Map<TranscriptFolderId, TranscribeJob[]>();
  for (const id of FOLDER_ORDER) groups.set(id, []);

  for (const job of jobs) {
    const created = job.createdAt ? new Date(job.createdAt) : new Date();
    const folderId = getFolderIdForDate(created);
    groups.get(folderId)!.push(job);
  }

  return groups;
}

export function listTranscriptFolders(jobs: TranscribeJob[]): TranscriptFolder[] {
  const groups = groupJobsByFolder(jobs);
  return FOLDER_ORDER.map((id) => ({
    id,
    label: FOLDER_LABELS[id],
    count: groups.get(id)!.length,
  })).filter((f) => f.count > 0);
}

export function jobsInFolder(jobs: TranscribeJob[], folderId: string): TranscribeJob[] {
  return jobs.filter((job) => {
    const created = job.createdAt ? new Date(job.createdAt) : new Date();
    return getFolderIdForDate(created) === folderId;
  });
}

export function folderLabel(folderId: string): string {
  return FOLDER_LABELS[folderId as TranscriptFolderId] ?? folderId;
}

export type TranscriptFilters = {
  query: string;
  status: string;
  wordTiming: string;
};

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

    return true;
  });
}
