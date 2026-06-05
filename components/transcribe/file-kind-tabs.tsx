"use client";

import { IconFileTypePdf, IconMusic } from "@tabler/icons-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FileKind } from "@/lib/detect-file-kind";

type FileKindTabsProps = {
  value: FileKind;
  onChange: (kind: FileKind) => void;
  disabled?: boolean;
};

export function FileKindTabs({ value, onChange, disabled }: FileKindTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as FileKind)}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="audio" disabled={disabled}>
          <IconMusic className="size-3.5" />
          Audio
        </TabsTrigger>
        <TabsTrigger value="pdf" disabled={disabled}>
          <IconFileTypePdf className="size-3.5" />
          PDF
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
