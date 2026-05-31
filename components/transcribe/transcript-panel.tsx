"use client";

import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
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
import { applyHausaOrthographyKey } from "@/lib/transcribe/hausa-orthography";
import { cn } from "@/lib/utils";

export type TranscriptWord = { word: string; start: number; end: number };
export type TranscriptSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
  wordStartIdx?: number;
  wordEndIdx?: number;
};

type TranscriptPanelProps = {
  transcriptRef: RefObject<HTMLDivElement | null>;
  jobId: string;
  loading: boolean;
  mode?: "view" | "edit";
  saving?: boolean;
  canEdit?: boolean;
  focusSegmentId?: number | null;
  words: TranscriptWord[];
  segments: TranscriptSegment[];
  draftSegments?: TranscriptSegment[];
  activeIdx: number;
  onSeek: (time: number) => void;
  onEnterEdit?: (segmentId?: number) => void;
  onFocusSegmentHandled?: () => void;
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
  focusSegmentId = null,
  words,
  segments,
  draftSegments,
  activeIdx,
  onSeek,
  onEnterEdit,
  onFocusSegmentHandled,
  onCancelEdit,
  onSaveEdit,
  onSegmentChange,
  className,
}: TranscriptPanelProps) {
  const editSegments = draftSegments ?? segments;
  const isEditMode = mode === "edit";
  const segmentTextareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());
  const seekTimeoutRef = useRef<number | null>(null);
  const pendingCursorRef = useRef<{ id: number; cursor: number } | null>(null);

  useEffect(() => {
    const pending = pendingCursorRef.current;
    if (!pending) return;
    const el = segmentTextareaRefs.current.get(pending.id);
    if (el) {
      el.selectionStart = pending.cursor;
      el.selectionEnd = pending.cursor;
    }
    pendingCursorRef.current = null;
  }, [draftSegments]);

  useEffect(() => {
    if (!isEditMode || focusSegmentId == null) return;
    const el = segmentTextareaRefs.current.get(focusSegmentId);
    el?.focus();
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    onFocusSegmentHandled?.();
  }, [isEditMode, focusSegmentId, onFocusSegmentHandled]);

  function handleSegmentViewClick(
    e: MouseEvent,
    segmentId: number,
    seekTime: number,
  ) {
    if (e.detail >= 2) {
      if (seekTimeoutRef.current != null) {
        window.clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
      if (e.detail === 3 && canEdit) {
        e.preventDefault();
        onEnterEdit?.(segmentId);
      }
      return;
    }

    seekTimeoutRef.current = window.setTimeout(() => {
      seekTimeoutRef.current = null;
      onSeek(seekTime);
    }, 250);
  }

  function wordsForSegment(
    segment: TranscriptSegment,
  ): Array<{ word: TranscriptWord; idx: number }> {
    if (
      segment.wordStartIdx != null &&
      segment.wordEndIdx != null &&
      words.length > 0
    ) {
      const start = segment.wordStartIdx;
      const end = segment.wordEndIdx;
      return Array.from({ length: end - start + 1 }, (_, offset) => ({
        word: words[start + offset],
        idx: start + offset,
      }));
    }
    return words
      .map((word, idx) => ({ word, idx }))
      .filter(({ word }) => word.start >= segment.start && word.start < segment.end);
  }

  function handleEditKeyDown(
    e: KeyboardEvent<HTMLTextAreaElement>,
    segmentId: number,
    text: string,
  ) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent.isComposing) return;

    const el = e.currentTarget;
    const result = applyHausaOrthographyKey(
      e.key,
      text,
      el.selectionStart ?? 0,
      el.selectionEnd ?? 0,
    );
    if (!result) return;

    e.preventDefault();
    pendingCursorRef.current = { id: segmentId, cursor: result.cursor };
    onSegmentChange?.(segmentId, result.value);
  }

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
            <Button variant="ghost" size="sm" onClick={() => onEnterEdit?.()} disabled={!canEdit}>
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
                        ref={(el) => {
                          if (el) segmentTextareaRefs.current.set(s.id, el);
                          else segmentTextareaRefs.current.delete(s.id);
                        }}
                        value={s.text}
                        onChange={(e) => onSegmentChange?.(s.id, e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, s.id, s.text)}
                        className="min-h-20 text-base leading-relaxed md:text-lg md:leading-loose"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No transcript available.</p>
              )
            ) : words.length > 0 && segments.length > 0 ? (
              segments.map((s) => {
                const segmentWords = wordsForSegment(s);
                return (
                  <div
                    key={s.id}
                    data-segment-id={s.id}
                    onClick={(e) => handleSegmentViewClick(e, s.id, s.start)}
                    className="mb-4 cursor-pointer rounded-sm px-1 transition-colors last:mb-0"
                  >
                    <span className="mr-3 inline-block min-w-[2.5rem] font-mono text-xs tabular-nums text-muted-foreground/60 md:text-sm">
                      {fmtTime(s.start)}
                    </span>
                    {segmentWords.map(({ word: w, idx: i }) => (
                      <span
                        key={`${i}-${w.start}`}
                        data-idx={i}
                        className={cn(
                          "mr-1 rounded-sm px-0.5 transition-colors duration-150",
                          i === activeIdx
                            ? "bg-primary/35 text-foreground ring-1 ring-primary/50 shadow-[0_0_14px_-3px] shadow-primary/50"
                            : "hover:text-foreground/90",
                        )}
                      >
                        {w.word}
                      </span>
                    ))}
                  </div>
                );
              })
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
                  data-segment-id={s.id}
                  onClick={(e) => handleSegmentViewClick(e, s.id, s.start)}
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
