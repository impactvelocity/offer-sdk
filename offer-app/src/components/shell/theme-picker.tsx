"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Monitor, Moon, Sun } from "lucide-react";
import { useId, type ReactNode } from "react";
import { useTheme, type ThemePreference } from "@/lib/theme";

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: "system", label: "System", icon: <Monitor /> },
  { value: "light", label: "Light", icon: <Sun /> },
  { value: "dark", label: "Dark", icon: <Moon /> },
];

/** Miniature of the shell in a given palette, for the appearance picker. */
function Preview({ mode }: { mode: "light" | "dark" }) {
  const id = `tp${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const c =
    mode === "dark"
      ? { canvas: "#0f0f11", surface: "#18181b", line: "#2a2a2f", text: "#ececee", accent: "#8f6bff" }
      : { canvas: "#efeff1", surface: "#ffffff", line: "#e4e4e7", text: "#1b1c1e", accent: "#7c4dff" };
  return (
    <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
      <rect width="120" height="72" fill={c.canvas} />
      <rect x="4" y="6" width="8" height="8" rx="2.5" fill={c.text} />
      <rect x="4" y="20" width="8" height="8" rx="2.5" fill="#7c4dff" />
      <rect x="4" y="32" width="8" height="8" rx="2.5" fill="#2563eb" />
      <rect x="16" y="4" width="30" height="64" rx="4" fill={c.surface} />
      <rect x="20" y="10" width="18" height="3" rx="1.5" fill={c.text} />
      <rect x="20" y="19" width="22" height="5" rx="2" fill={c.accent} opacity="0.22" />
      <rect x="20" y="28" width="16" height="3" rx="1.5" fill={c.line} />
      <rect x="20" y="35" width="19" height="3" rx="1.5" fill={c.line} />
      <rect x="50" y="4" width="66" height="64" rx="4" fill={c.surface} />
      <rect x="56" y="10" width="26" height="3" rx="1.5" fill={c.text} />
      <rect x="56" y="20" width="54" height="1" fill={c.line} />
      <rect x="56" y="27" width="54" height="1" fill={c.line} />
      <rect x="56" y="34" width="54" height="1" fill={c.line} />
      <path d="M56 58 C66 50 72 54 80 47 S98 44 110 38" fill="none" stroke={`url(#${id})`} strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor="#7c4dff" />
          <stop offset="1" stopColor="#e0457b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Appearance picker with previews (used on the Profile page). */
export function ThemePicker() {
  const { preference, setTheme } = useTheme();
  return (
    <RadioGroup
      value={preference}
      onValueChange={(v) => setTheme(v as ThemePreference)}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {THEME_OPTIONS.map((o) => (
        <Radio.Root
          key={o.value}
          value={o.value}
          nativeButton
          render={<button type="button" />}
          className="group flex flex-col overflow-hidden rounded-xl border border-border bg-bg text-left outline-none transition-[border-color,box-shadow] hover:border-border-strong focus-visible:shadow-[0_0_0_3px_var(--ring)] data-checked:border-accent data-checked:shadow-[0_0_0_1px_var(--accent)]"
        >
          <span className="relative block aspect-[5/3] w-full border-b border-border">
            {o.value === "system" ? (
              <>
                <span className="absolute inset-0 [clip-path:inset(0_50%_0_0)]">
                  <Preview mode="light" />
                </span>
                <span className="absolute inset-0 [clip-path:inset(0_0_0_50%)]">
                  <Preview mode="dark" />
                </span>
              </>
            ) : (
              <Preview mode={o.value} />
            )}
          </span>
          <span className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-fg [&_svg]:size-4 [&_svg]:text-fg-icon">
            {o.icon}
            {o.label}
            <span className="ml-auto flex size-4 items-center justify-center rounded-full border border-border-strong group-data-checked:border-accent">
              <Radio.Indicator className="size-2 rounded-full bg-accent" />
            </span>
          </span>
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
