"use client";

import { cn } from "@/lib/utils";
import { useBrand } from "@/components/brand/brand-provider";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  nameClassName?: string;
  className?: string;
};

const MARK_SIZES = {
  sm: "size-7 rounded-lg text-xs",
  md: "size-10 rounded-xl text-sm",
  lg: "size-14 rounded-2xl text-lg",
} as const;

const LOGO_SIZES = {
  sm: "size-7 rounded-lg",
  md: "size-10 rounded-xl",
  lg: "size-14 rounded-2xl",
} as const;

const NAME_SIZES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
} as const;

export function BrandLogo({
  size = "sm",
  showName = true,
  nameClassName,
  className,
}: BrandLogoProps) {
  const { name, logoUrl } = useBrand();
  const initial = name.charAt(0).toUpperCase() || "?";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className={cn(LOGO_SIZES[size], "shrink-0 object-contain")}
        />
      ) : (
        <div
          className={cn(
            MARK_SIZES[size],
            "flex shrink-0 items-center justify-center bg-primary/20 font-bold text-primary ring-1 ring-primary/30",
          )}
        >
          {initial}
        </div>
      )}
      {showName && (
        <span
          className={cn(
            "font-semibold tracking-tight text-foreground",
            NAME_SIZES[size],
            nameClassName,
          )}
        >
          {name}
        </span>
      )}
    </div>
  );
}
