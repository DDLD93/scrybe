"use client";

import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TranscriptSegment } from "@/components/transcribe/transcript-panel";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

type AudioPlayerCompactProps = {
  playing: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  segments: TranscriptSegment[];
  loading: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onRateChange: (rate: number) => void;
  variant: "sidebar" | "dock";
  className?: string;
};

export function AudioPlayerCompact({
  playing,
  currentTime,
  duration,
  rate,
  segments,
  loading,
  onTogglePlay,
  onSeek,
  onRateChange,
  variant,
  className,
}: AudioPlayerCompactProps) {
  const progress = (
    <ProgressBar
      currentTime={currentTime}
      duration={duration}
      segments={segments}
      onSeek={onSeek}
      className={variant === "dock" ? "flex-1" : "w-full"}
    />
  );

  const speedSelect = (
    <Select
      value={String(rate)}
      onValueChange={(v) => onRateChange(parseFloat(v))}
      disabled={loading}
    >
      <SelectTrigger size="sm" className="w-[4.25rem] shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {RATES.map((r) => (
          <SelectItem key={r} value={String(r)}>
            {r}x
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const playButton = (
    <Button
      size="icon"
      onClick={onTogglePlay}
      disabled={loading}
      className={cn(
        "shrink-0 rounded-full shadow-sm",
        variant === "sidebar" ? "size-10" : "size-9",
      )}
    >
      {playing ? (
        <IconPlayerPause className={variant === "sidebar" ? "size-5" : "size-4"} />
      ) : (
        <IconPlayerPlay
          className={cn(
            variant === "sidebar" ? "size-5" : "size-4",
            !playing && "ml-0.5",
          )}
        />
      )}
    </Button>
  );

  if (variant === "dock") {
    return (
      <div
        className={cn(
          "fixed inset-x-0 bottom-16 z-30 border-t border-border/40 bg-card/85 px-4 py-3 backdrop-blur-xl",
          className,
        )}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {playButton}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {progress}
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[0.65rem] tabular-nums text-muted-foreground">
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </span>
              {speedSelect}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "glass-card sticky top-0 flex w-64 shrink-0 flex-col gap-4 rounded-xl p-4 ring-1 ring-border/50",
        className,
      )}
    >
      <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
        Playback
      </p>
      <div className="flex flex-col items-center gap-3">
        {playButton}
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {fmtTime(currentTime)} / {fmtTime(duration)}
        </span>
      </div>
      {progress}
      <div className="flex justify-center">{speedSelect}</div>
    </div>
  );
}

function ProgressBar({
  currentTime,
  duration,
  segments,
  onSeek,
  className,
}: {
  currentTime: number;
  duration: number;
  segments: TranscriptSegment[];
  onSeek: (time: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.01}
        value={currentTime}
        onChange={(e) => onSeek(parseFloat(e.target.value))}
        className="relative z-10 h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
      />
      {segments.length > 0 && duration > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-muted/80">
          {segments.map((s) => (
            <div
              key={s.id}
              className="absolute top-0 h-full w-px bg-border/80"
              style={{ left: `${(s.start / duration) * 100}%` }}
            />
          ))}
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
