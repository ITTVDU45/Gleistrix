"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // Nonce an das Inline-Theme-Skript von next-themes durchreichen,
      // damit es unter der Nonce-CSP (Prod) nicht blockiert wird.
      nonce={nonce}
    >
      {children}
    </NextThemesProvider>
  );
} 