"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function useThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, systemTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return {
      theme: "light",
      systemTheme: "light",
      setTheme: () => {},
      isDark: false,
    };
  }

  const isDark = theme === "dark" || (theme === "system" && systemTheme === "dark");

  return {
    theme,
    systemTheme,
    setTheme,
    isDark,
  };
} 