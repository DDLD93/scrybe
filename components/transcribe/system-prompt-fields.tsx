"use client";

import { memo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type SystemPromptPreset = {
  id: string;
  name: string;
  prompt: string;
};

type SystemPromptFieldsProps = {
  presets: SystemPromptPreset[];
  selection: string;
  onSelectionChange: (v: string) => void;
  customPrompt: string;
  onCustomPromptChange: (v: string) => void;
  disabled?: boolean;
  hint?: string;
};

export const SystemPromptFields = memo(function SystemPromptFields({
  presets,
  selection,
  onSelectionChange,
  customPrompt,
  onCustomPromptChange,
  disabled,
  hint,
}: SystemPromptFieldsProps) {
  const isCustom = selection === "__custom__";
  const selectedPreset = presets.find((p) => p.id === selection);

  return (
    <div className="space-y-2">
      <Label>System prompt</Label>
      <Select value={selection} onValueChange={onSelectionChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a preset…" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
          <SelectItem value="__custom__">Custom…</SelectItem>
          <SelectItem value="__none__">None</SelectItem>
        </SelectContent>
      </Select>

      {!isCustom && selectedPreset && (
        <p className="rounded-md border border-border/50 bg-muted/30 px-2 py-1.5 text-[0.7rem] text-muted-foreground line-clamp-3">
          {selectedPreset.prompt}
        </p>
      )}

      {isCustom && (
        <Textarea
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          rows={3}
          placeholder="Enter custom instructions for this job…"
          disabled={disabled}
          className="max-h-28 resize-none overflow-y-auto"
        />
      )}

      <p className="text-[0.65rem] text-muted-foreground">
        {hint ?? "Optional. Applied to every chunk or page during processing."}
      </p>
    </div>
  );
});

export function buildPromptPayload(
  selection: string,
  customPrompt: string,
): { systemPromptId?: string; prompt?: string } {
  if (selection === "__custom__") {
    const text = customPrompt.trim();
    return text ? { prompt: text } : {};
  }
  if (selection === "__none__" || !selection) return {};
  return { systemPromptId: selection };
}
