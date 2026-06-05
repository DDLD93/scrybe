"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
import { toast } from "sonner";
import { AudioPlayerCompact } from "@/components/transcribe/audio-player-compact";
import {
  TranscriptPanel,
  type TranscriptSegment,
  type TranscriptWord,
} from "@/components/transcribe/transcript-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSavedAgo } from "@/lib/format-relative-time";
import { cn } from "@/lib/utils";

const AUTO_SAVE_STORAGE_KEY = "scrybe:transcript-autosave";
const AUTO_SAVE_DEBOUNCE_MS = 1500;

function serializeDraftBaseline(segs: TranscriptSegment[]): string {
  return JSON.stringify(segs.map(({ id, text }) => ({ id, text })));
}

function readAutoSavePreference(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(AUTO_SAVE_STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export default function PlayerPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const draftSegmentsRef = useRef<TranscriptSegment[]>([]);
  const saveBaselineRef = useRef("");
  const savingRef = useRef(false);
  const pendingResaveRef = useRef(false);
  const saveTranscriptRef = useRef<
    (opts?: { close?: boolean; silent?: boolean }) => Promise<boolean>
  >(async () => false);

  const [filename, setFilename] = useState("");
  const [jobKind, setJobKind] = useState("audio");
  const [words, setWords] = useState<TranscriptWord[]>([]);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [draftSegments, setDraftSegments] = useState<TranscriptSegment[]>([]);
  const [focusSegmentId, setFocusSegmentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(readAutoSavePreference);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    draftSegmentsRef.current = draftSegments;
  }, [draftSegments]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const jobRes = await fetch(`/api/transcribe/jobs/${jobId}`);
        const jobData = await jobRes.json();
        if (jobData.job) {
          setFilename(jobData.job.filename);
          setJobKind(jobData.job.jobKind ?? "audio");
        }

        const txRes = await fetch(`/api/transcribe/jobs/${jobId}/transcript`);
        if (!txRes.ok) {
          setError("Transcript not ready");
          return;
        }
        const tx = await txRes.json();
        setWords(tx.words ?? []);
        setSegments(tx.segments ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId]);

  useEffect(() => {
    if (jobKind === "pdf") return;
    const audio = audioRef.current;
    if (!audio) return;

    function onTimeUpdate() {
      const t = audio!.currentTime;
      setCurrentTime(t);
      const idx = findWordIndex(words, t);
      if (idx !== activeIdx) {
        setActiveIdx(idx);
        if (!editMode && idx >= 0 && transcriptRef.current) {
          const el = transcriptRef.current.querySelector(`[data-idx="${idx}"]`);
          el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
    }

    function onLoaded() {
      setDuration(audio!.duration);
    }

    function onPlay() {
      setPlaying(true);
    }

    function onPause() {
      setPlaying(false);
    }

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [words, activeIdx, editMode, jobKind]);

  useEffect(() => {
    if (!editMode || !lastSavedAt) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [editMode, lastSavedAt]);

  useEffect(() => {
    saveTranscriptRef.current = async (opts?: { close?: boolean; silent?: boolean }) => {
      if (savingRef.current) {
        pendingResaveRef.current = true;
        return false;
      }

      savingRef.current = true;
      setSaving(true);

      const segmentsToSave = draftSegmentsRef.current;

      try {
        const res = await fetch(`/api/transcribe/jobs/${jobId}/transcript`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segments: segmentsToSave.map(({ id, text }) => ({ id, text })),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Failed to save transcript");
          return false;
        }

        const newSegments: TranscriptSegment[] = (data.segments ?? []).map(
          (s: TranscriptSegment) => ({ ...s }),
        );
        setWords(data.words ?? []);
        setSegments(newSegments);

        if (opts?.close) {
          setEditMode(false);
          setDraftSegments([]);
          setFocusSegmentId(null);
          setLastSavedAt(null);
          saveBaselineRef.current = serializeDraftBaseline(newSegments);
        } else {
          setDraftSegments(newSegments);
          saveBaselineRef.current = serializeDraftBaseline(newSegments);
          setLastSavedAt(new Date());
        }

        if (!opts?.silent) toast.success("Transcript saved");
        return true;
      } catch {
        toast.error("Failed to save transcript");
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);

        if (pendingResaveRef.current) {
          pendingResaveRef.current = false;
          const stillDirty =
            serializeDraftBaseline(draftSegmentsRef.current) !== saveBaselineRef.current;
          if (stillDirty) {
            void saveTranscriptRef.current({ silent: true });
          }
        }
      }
    };
  }, [jobId]);

  useEffect(() => {
    if (!editMode || !autoSaveEnabled || saving) return;

    const dirty =
      serializeDraftBaseline(draftSegments) !== saveBaselineRef.current;
    if (!dirty) return;

    const timer = window.setTimeout(() => {
      void saveTranscriptRef.current({ silent: true });
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [draftSegments, editMode, autoSaveEnabled, saving]);

  function seekTo(time: number) {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, time);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }

  function handleRateChange(r: number) {
    setRate(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }

  function enterEditMode(segmentId?: number) {
    const draft = segments.map((s) => ({ ...s }));
    saveBaselineRef.current = serializeDraftBaseline(draft);
    setDraftSegments(draft);
    setLastSavedAt(null);
    setFocusSegmentId(segmentId ?? null);
    setEditMode(true);
  }

  function cancelEdit() {
    setDraftSegments([]);
    setFocusSegmentId(null);
    setLastSavedAt(null);
    setEditMode(false);
  }

  function handleSegmentChange(id: number, text: string) {
    setDraftSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text } : s)),
    );
  }

  function handleAutoSaveChange(enabled: boolean) {
    setAutoSaveEnabled(enabled);
    localStorage.setItem(AUTO_SAVE_STORAGE_KEY, String(enabled));
  }

  function saveEdit() {
    void saveTranscriptRef.current({ close: true, silent: false });
  }

  function exitEditMode() {
    void saveTranscriptRef.current({ close: true, silent: autoSaveEnabled });
  }

  const isPdf = jobKind === "pdf";
  const playerProps = {
    playing,
    currentTime,
    duration,
    rate,
    segments,
    loading,
    onTogglePlay: togglePlay,
    onSeek: seekTo,
    onRateChange: handleRateChange,
  };

  const canEdit = !loading && !error && segments.length > 0;
  const handleFocusSegmentHandled = useCallback(() => setFocusSegmentId(null), []);
  const lastSavedLabel = lastSavedAt ? formatSavedAgo(lastSavedAt) : null;

  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden px-4 pt-4 animate-in fade-in duration-500 md:h-[calc(100dvh-2rem)] md:px-6 md:pt-6",
        isPdf ? "pb-6" : "pb-24 md:pb-28",
      )}
    >
      {!isPdf && (
        <audio
          ref={audioRef}
          src={`/api/transcribe/jobs/${jobId}/audio`}
          preload="metadata"
          className="hidden"
        />
      )}

      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/40 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/transcribe">
              <IconArrowLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div className="min-w-0">
            {loading ? (
              <Skeleton className="h-6 w-48" />
            ) : (
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
                {filename || jobId}
              </h1>
            )}
          </div>
        </div>
      </header>

      {error && (
        <Card className="mt-3 shrink-0 border-destructive/30 bg-destructive/5">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="glass-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-border/50">
          <TranscriptPanel
            transcriptRef={transcriptRef}
            jobId={jobId}
            loading={loading}
            mode={editMode ? "edit" : "view"}
            saving={saving}
            canEdit={canEdit}
            autoSaveEnabled={autoSaveEnabled}
            onAutoSaveChange={handleAutoSaveChange}
            lastSavedLabel={lastSavedLabel}
            focusSegmentId={focusSegmentId}
            words={words}
            segments={segments}
            draftSegments={draftSegments}
            activeIdx={isPdf ? -1 : activeIdx}
            onSeek={isPdf ? () => {} : seekTo}
            onEnterEdit={enterEditMode}
            onFocusSegmentHandled={handleFocusSegmentHandled}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onExitEdit={exitEditMode}
            onSegmentChange={handleSegmentChange}
            className="flex-1"
          />
        </div>
      </div>

      {!isPdf && <AudioPlayerCompact variant="dock" {...playerProps} />}
    </div>
  );
}

function findWordIndex(words: TranscriptWord[], t: number): number {
  let lo = 0;
  let hi = words.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start <= t) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (result >= 0 && t < words[result].end) return result;
  return -1;
}
