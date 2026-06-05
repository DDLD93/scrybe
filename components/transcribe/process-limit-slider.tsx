"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type ProcessLimitSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export function ProcessLimitSlider({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: ProcessLimitSliderProps) {
  if (max < 1) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-medium text-foreground tabular-nums">
          {value}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled || max <= min}
        onValueChange={(vals) => {
          const next = vals[0];
          if (next !== undefined) onChange(next);
        }}
      />
    </div>
  );
}
