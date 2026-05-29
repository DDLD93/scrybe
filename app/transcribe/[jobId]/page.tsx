"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import {
  IconArrowLeft,
  IconDownload,
  IconPlayerPause,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Word = { word: string; start: number; end: number };
type Segment = { id: number; start: number; end: number; text: string };

export default function PlayerPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [filename, setFilename] = useState("");
  const [words, setWords] = useState<Word[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const jobRes = await fetch(`/api/transcribe/jobs/${jobId}`);
        const jobData = await jobRes.json();
        if (jobData.job) setFilename(jobData.job.filename);

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
    const audio = audioRef.current;
    if (!audio) return;

    function onTimeUpdate() {
      const t = audio!.currentTime;
      setCurrentTime(t);
      const idx = findWordIndex(words, t);
      if (idx !== activeIdx) {
        setActiveIdx(idx);
        if (idx >= 0 && transcriptRef.current) {
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
  }, [words, activeIdx]);

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

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/transcribe">
              <IconArrowLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div className="min-w-0">
            {loading ? (
              <Skeleton className="h-5 w-48" />
            ) : (
              <h1 className="truncate text-base font-semibold text-foreground">
                {filename || jobId}
              </h1>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <IconDownload className="size-3.5" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={`/api/transcribe/jobs/${jobId}/transcript`} download>
                Download JSON
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`/api/transcribe/jobs/${jobId}/result`}>
                Download Markdown
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card className="glass-card ring-1 ring-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Audio Player</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <audio
            ref={audioRef}
            src={`/api/transcribe/jobs/${jobId}/audio`}
            preload="metadata"
          />

          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={togglePlay} disabled={loading}>
              {playing ? (
                <IconPlayerPause className="size-4" />
              ) : (
                <IconPlayerPlay className="size-4" />
              )}
            </Button>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {fmt(currentTime)} / {fmt(duration)}
            </span>
            <select
              value={rate}
              onChange={(e) => {
                const r = parseFloat(e.target.value);
                setRate(r);
                if (audioRef.current) audioRef.current.playbackRate = r;
              }}
              className="ml-auto rounded-md border border-input bg-input/20 px-2 py-1 text-xs text-foreground"
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                <option key={r} value={r}>
                  {r}x
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.01}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="relative z-10 w-full accent-primary"
            />
            {segments.length > 0 && duration > 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-muted">
                {segments.map((s) => (
                  <div
                    key={s.id}
                    className="absolute top-0 w-px h-full bg-border"
                    style={{ left: `${(s.start / duration) * 100}%` }}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card ring-1 ring-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <div
              ref={transcriptRef}
              className="transcript-scroll max-h-[28rem] overflow-y-auto text-sm leading-relaxed text-muted-foreground"
            >
              {words.length === 0 ? (
                <p>No word-level transcript available.</p>
              ) : (
                words.map((w, i) => (
                  <span
                    key={`${i}-${w.start}`}
                    data-idx={i}
                    onClick={() => seekTo(w.start)}
                    className={cn(
                      "mr-1 cursor-pointer rounded px-0.5 transition-colors",
                      i === activeIdx
                        ? "bg-primary/30 text-foreground ring-1 ring-primary/50 shadow-[0_0_12px_-2px] shadow-primary/40"
                        : "hover:text-foreground",
                    )}
                  >
                    {w.word}
                  </span>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function findWordIndex(words: Word[], t: number): number {
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

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return "00:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
