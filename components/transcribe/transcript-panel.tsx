"use client";

import type { RefObject } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type TranscriptWord = { word: string; start: number; end: number };
export type TranscriptSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
};

type TranscriptPanelProps = {
  transcriptRef: RefObject<HTMLDivElement | null>;
  loading: boolean;
  words: TranscriptWord[];
  segments: TranscriptSegment[];
  activeIdx: number;
  onSeek: (time: number) => void;
  className?: string;
};

export function TranscriptPanel({
  transcriptRef,
  loading,
  words,
  segments,
  activeIdx,
  onSeek,
  className,
}: TranscriptPanelProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {loading ? (
        <div className="space-y-3 px-5 py-8 md:px-8 md:py-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full max-w-2xl" />
          ))}
        </div>
      ) : (
        <div
          ref={transcriptRef}
          className={cn(
            "transcript-scroll transcript-scroll-fade flex-1 min-h-0 overflow-y-auto",
            "pb-28 md:pb-16",
          )}
        >
          <div
            className={cn(
              "mx-auto max-w-3xl px-5 pt-8 pb-4 md:px-8 md:pt-10",
              "text-base leading-relaxed text-muted-foreground md:text-lg md:leading-loose",
            )}
          >
            {words.length > 0 ? (
              words.map((w, i) => (
                <span
                  key={`${i}-${w.start}`}
                  data-idx={i}
                  onClick={() => onSeek(w.start)}
                  className={cn(
                    "mr-1 cursor-pointer rounded-sm px-0.5 transition-colors duration-150",
                    i === activeIdx
                      ? "bg-primary/35 text-foreground ring-1 ring-primary/50 shadow-[0_0_14px_-3px] shadow-primary/50"
                      : "hover:text-foreground/90",
                  )}
                >
                  {w.word}
                </span>
              ))
            ) : segments.length > 0 ? (
              segments.map((s) => (
                <p
                  key={s.id}
                  onClick={() => onSeek(s.start)}
                  className="mb-4 cursor-pointer rounded-sm px-1 transition-colors last:mb-0 hover:text-foreground"
                >
                  <span className="mr-3 inline-block min-w-[2.5rem] font-mono text-xs tabular-nums text-muted-foreground/60 md:text-sm">
                    {fmtTime(s.start)}
                  </span>
                  {s.text}
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">No transcript available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec)) return "00:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
