"use client";

import { createContext, useContext } from "react";

type BrandingContextValue = { showProductImages: boolean };

const BrandingContext = createContext<BrandingContextValue>({ showProductImages: false });

export function BrandingProvider({
  showProductImages,
  children,
}: {
  showProductImages: boolean;
  children: React.ReactNode;
}) {
  return <BrandingContext.Provider value={{ showProductImages }}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}
