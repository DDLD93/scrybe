"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { IconArrowLeft, IconDownload } from "@tabler/icons-react";
import { AudioPlayerCompact } from "@/components/transcribe/audio-player-compact";
import {
  TranscriptPanel,
  type TranscriptSegment,
  type TranscriptWord,
} from "@/components/transcribe/transcript-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlayerPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [filename, setFilename] = useState("");
  const [words, setWords] = useState<TranscriptWord[]>([]);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
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

  function handleRateChange(r: number) {
    setRate(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }

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

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col overflow-hidden animate-in fade-in duration-500 md:h-[calc(100dvh-4rem)]">
      <audio
        ref={audioRef}
        src={`/api/transcribe/jobs/${jobId}/audio`}
        preload="metadata"
        className="hidden"
      />

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
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
      </header>

      {error && (
        <Card className="mt-3 shrink-0 border-destructive/30 bg-destructive/5">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="mt-4 flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[1fr_16rem] md:gap-6">
        <div className="glass-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-border/50">
          <TranscriptPanel
            transcriptRef={transcriptRef}
            loading={loading}
            words={words}
            segments={segments}
            activeIdx={activeIdx}
            onSeek={seekTo}
            className="flex-1"
          />
        </div>

        <aside className="hidden min-h-0 md:block">
          <AudioPlayerCompact variant="sidebar" {...playerProps} />
        </aside>
      </div>

      <AudioPlayerCompact variant="dock" className="md:hidden" {...playerProps} />
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
