import type { DownloadProgress } from "@/lib/db/schema";

export type StreamProgressState = DownloadProgress & {
  done?: boolean;
  error?: string;
};

type SessionEntry = StreamProgressState & {
  expiresAt: number;
};

const sessions = new Map<string, SessionEntry>();

const TTL_MS = 5 * 60 * 1000;

function scheduleCleanup(sessionId: string) {
  setTimeout(() => {
    sessions.delete(sessionId);
  }, TTL_MS);
}

export function setStreamProgress(sessionId: string, progress: DownloadProgress): void {
  sessions.set(sessionId, {
    ...progress,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function getStreamProgress(sessionId: string): StreamProgressState | null {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  const { expiresAt: _, ...progress } = entry;
  return progress;
}

export function completeStreamProgress(sessionId: string): void {
  const existing = sessions.get(sessionId);
  sessions.set(sessionId, {
    ...existing,
    percent: 100,
    done: true,
    expiresAt: Date.now() + TTL_MS,
  });
  scheduleCleanup(sessionId);
}

export function failStreamProgress(sessionId: string, error: string): void {
  sessions.set(sessionId, {
    done: true,
    error,
    expiresAt: Date.now() + TTL_MS,
  });
  scheduleCleanup(sessionId);
}

export function initStreamProgress(sessionId: string): void {
  sessions.set(sessionId, {
    expiresAt: Date.now() + TTL_MS,
  });
}
