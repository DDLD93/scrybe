"use client";

import { createContext, useContext } from "react";
import type { Branding } from "@/lib/branding";

const BrandContext = createContext<Branding | null>(null);

export function BrandProvider({
  brand,
  children,
}: {
  brand: Branding;
  children: React.ReactNode;
}) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand(): Branding {
  const brand = useContext(BrandContext);
  if (!brand) {
    throw new Error("useBrand must be used within BrandProvider");
  }
  return brand;
}
