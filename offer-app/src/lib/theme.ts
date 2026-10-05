"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

// Theme preference (per browser). The resolved theme is written to <html data-theme>,
// which the tokens in globals.css key off. `themeScript` (theme-script.ts) does the same
// before first paint so there's no flash; keep the two in sync.

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return media().matches ? "dark" : "light";
}

function apply(preference: ThemePreference) {
  document.documentElement.dataset.theme = resolve(preference);
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onSystem = () => {
    if (readPreference() === "system") apply("system");
    emit();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    apply(readPreference());
    emit();
  };
  const mq = media();
  mq.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

export function setTheme(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* storage unavailable: still apply for this page */
  }
  apply(preference);
  emit();
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
  const resolved = useSyncExternalStore(subscribe, () => resolve(readPreference()), () => "light" as const);
  const toggle = useCallback(() => setTheme(resolved === "dark" ? "light" : "dark"), [resolved]);
  return { preference, resolved, setTheme, toggle };
}
