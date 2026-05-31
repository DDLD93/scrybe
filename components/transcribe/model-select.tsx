"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconSearch, IconSelector } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ModelOption = { id: string; name: string };

type ModelSelectProps = {
  models: ModelOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
};

function modelLabel(model: ModelOption) {
  return model.name === model.id ? model.id : `${model.name} (${model.id})`;
}

/** Keep wheel/touch scroll inside the list when nested in a modal dialog. */
function stopScrollPropagation(e: React.WheelEvent | React.TouchEvent) {
  e.stopPropagation();
}

export const ModelSelect = memo(function ModelSelect({
  models,
  value,
  onValueChange,
  disabled,
}: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedRef = useRef<HTMLButtonElement>(null);

  const selected = useMemo(
    () => models.find((m) => m.id === value),
    [models, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? models.filter(
          (m) =>
            m.id.toLowerCase().includes(q) ||
            m.name.toLowerCase().includes(q),
        )
      : models;

    return list.reduce<Record<string, ModelOption[]>>((acc, m) => {
      const provider = m.id.split("/")[0] ?? "other";
      (acc[provider] ??= []).push(m);
      return acc;
    }, {});
  }, [models, query]);

  const providerCount = Object.keys(filtered).length;
  const resultCount = Object.values(filtered).reduce((n, items) => n + items.length, 0);

  const scrollToSelected = useCallback(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  useEffect(() => {
    if (!open || query.trim()) return;
    const frame = requestAnimationFrame(scrollToSelected);
    return () => cancelAnimationFrame(frame);
  }, [open, query, value, filtered, scrollToSelected]);

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-7 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-input/20 px-2 py-1.5 text-xs/relaxed transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate text-left">
            {selected ? modelLabel(selected) : "Select model"}
          </span>
          <IconSelector className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
        onWheel={stopScrollPropagation}
        onTouchMove={stopScrollPropagation}
      >
        <div className="border-b border-border/50 p-2">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models…"
              className="h-7 pl-7 text-xs"
              autoFocus
            />
          </div>
        </div>
        <div
          className="max-h-64 overflow-y-auto overscroll-contain touch-pan-y p-1"
          onWheel={stopScrollPropagation}
          onTouchMove={stopScrollPropagation}
        >
          {resultCount === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No models match &ldquo;{query.trim()}&rdquo;
            </p>
          ) : (
            Object.entries(filtered)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([provider, items]) => (
                <div key={provider} className="mb-1 last:mb-0">
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">{provider}</p>
                  {items.map((m) => {
                    const active = m.id === value;
                    return (
                      <button
                        key={m.id}
                        ref={active ? selectedRef : undefined}
                        type="button"
                        className={cn(
                          "relative flex w-full cursor-default items-center rounded-md px-2 py-1.5 pr-7 text-left text-xs/relaxed outline-hidden select-none hover:bg-accent hover:text-accent-foreground",
                          active && "bg-accent text-accent-foreground",
                        )}
                        onClick={() => {
                          onValueChange(m.id);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <span className="truncate">{modelLabel(m)}</span>
                        {active && (
                          <IconCheck className="absolute right-2 size-3.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
          )}
        </div>
        {providerCount > 0 && (
          <p className="border-t border-border/50 px-2 py-1.5 text-[0.65rem] text-muted-foreground">
            {resultCount} model{resultCount === 1 ? "" : "s"}
            {query.trim() ? " found" : ""}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
});
