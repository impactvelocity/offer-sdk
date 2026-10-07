/**
 * Categorical series colors, assigned in this fixed order and never cycled (past 8, fold into
 * "Other"). Slot 1 is the brand green and slot 5 its cyan partner; the order is the
 * colorblind-safety mechanism. Validated on the white surface: worst adjacent CVD ΔE 9.0,
 * normal-vision ΔE 27.8. Slots 1 and 4 sit under 3:1 contrast, so charts using them also ship a
 * legend with values or a table.
 */
// CSS variables so each theme gets its validated variant (dark: worst CVD ΔE 9.1, all ≥3:1).
export const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
] as const;

/** De-emphasis gray for the folded "Other" series. */
export const OTHER_COLOR = "var(--series-other)";
export const OTHER_KEY = "__other";

/** Quiet chart chrome shared by every chart. */
export const chart = {
  grid: "var(--border)",
  baseline: "var(--border-strong)",
  tick: { fill: "var(--fg-icon)", fontSize: 12 },
  cursorFill: "var(--bg-hover)",
  cursorStroke: "var(--border-strong)",
} as const;
