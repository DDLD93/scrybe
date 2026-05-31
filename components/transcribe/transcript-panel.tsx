"use client";

import type { RefObject } from "react";
import { IconDownload, IconPencil } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  jobId: string;
  loading: boolean;
  mode?: "view" | "edit";
  saving?: boolean;
  canEdit?: boolean;
  words: TranscriptWord[];
  segments: TranscriptSegment[];
  draftSegments?: TranscriptSegment[];
  activeIdx: number;
  onSeek: (time: number) => void;
  onEnterEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
  onSegmentChange?: (id: number, text: string) => void;
  className?: string;
};

export function TranscriptPanel({
  transcriptRef,
  jobId,
  loading,
  mode = "view",
  saving = false,
  canEdit = false,
  words,
  segments,
  draftSegments,
  activeIdx,
  onSeek,
  onEnterEdit,
  onCancelEdit,
  onSaveEdit,
  onSegmentChange,
  className,
}: TranscriptPanelProps) {
  const editSegments = draftSegments ?? segments;
  const isEditMode = mode === "edit";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {!loading && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-border/40 px-5 py-2 md:px-6">
          {isEditMode ? (
            <>
              <Button variant="ghost" size="sm" onClick={onCancelEdit} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={onSaveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={onEnterEdit} disabled={!canEdit}>
              <IconPencil className="size-3.5" />
              Edit
            </Button>
          )}

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
        </div>
      )}

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
              mode === "view" &&
                "text-base leading-relaxed text-muted-foreground md:text-lg md:leading-loose",
            )}
          >
            {mode === "edit" ? (
              editSegments.length > 0 ? (
                <div className="space-y-4">
                  {editSegments.map((s) => (
                    <div key={s.id} className="space-y-2">
                      <span className="inline-block font-mono text-xs tabular-nums text-muted-foreground/60 md:text-sm">
                        {fmtTime(s.start)}
                      </span>
                      <Textarea
                        value={s.text}
                        onChange={(e) => onSegmentChange?.(s.id, e.target.value)}
                        className="min-h-20 text-base leading-relaxed md:text-lg md:leading-loose"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No transcript available.</p>
              )
            ) : words.length > 0 ? (
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
