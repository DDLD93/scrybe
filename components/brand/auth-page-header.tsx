"use client";

import { BrandLogo } from "@/components/brand/brand-logo";
import { useBrand } from "@/components/brand/brand-provider";

export function AuthPageHeader() {
  const { tagline } = useBrand();

  return (
    <div className="mb-8 flex flex-col items-center gap-3 text-center">
      <BrandLogo size="lg" />
      <p className="max-w-sm text-sm text-muted-foreground">{tagline}</p>
    </div>
  );
}
