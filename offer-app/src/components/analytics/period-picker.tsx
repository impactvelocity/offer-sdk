"use client";

import { Segmented } from "@/components/ui/segmented";
import type { AnalyticsInterval } from "@/lib/api/types";

export const INTERVALS: { value: AnalyticsInterval; label: string; long: string }[] = [
  { value: "7d", label: "7D", long: "Last 7 days" },
  { value: "30d", label: "30D", long: "Last 30 days" },
  { value: "60d", label: "60D", long: "Last 60 days" },
  { value: "6m", label: "6M", long: "Last 6 months" },
  { value: "year", label: "1Y", long: "Last 12 months" },
  { value: "alltime", label: "All", long: "All time" },
];

export const intervalLabel = (i: AnalyticsInterval) => INTERVALS.find((x) => x.value === i)?.long ?? i;

export function PeriodPicker({
  value,
  onValueChange,
  size,
}: {
  value: AnalyticsInterval;
  onValueChange: (v: AnalyticsInterval) => void;
  size?: "xs" | "sm";
}) {
  return (
    <Segmented
      size={size}
      value={value}
      onValueChange={onValueChange}
      options={INTERVALS.map((i) => ({ value: i.value, label: i.label }))}
    />
  );
}
