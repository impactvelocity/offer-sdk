import type { AnalyticsInterval } from "@/lib/api/types";

// Time buckets matching the analytics timeseries endpoint: UTC days for 7d/30d/60d,
// UTC weeks starting Monday for longer periods.

export type Granularity = "day" | "week";

const DAY = 86_400_000;
const INTERVAL_DAYS: Record<AnalyticsInterval, number> = { "7d": 7, "30d": 30, "60d": 60, "6m": 180, year: 365, alltime: 0 };

export function granularityOf(interval: AnalyticsInterval): Granularity {
  return interval === "7d" || interval === "30d" || interval === "60d" ? "day" : "week";
}

export function bucketOf(time: number, granularity: Granularity) {
  const d = new Date(time);
  d.setUTCHours(0, 0, 0, 0);
  if (granularity === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Every bucket in the period, oldest first, so days without events plot as zero. The bucket
 * the period starts in is only partly covered and would read as a dip, so it's skipped (the
 * current, in-progress bucket is kept). "All time" starts at the earliest bucket with data.
 */
export function bucketRange(interval: AnalyticsInterval, dataDates: string[], now = Date.now()) {
  const granularity = granularityOf(interval);
  const step = granularity === "week" ? 7 * DAY : DAY;
  const days = INTERVAL_DAYS[interval];
  let first: number;
  if (days) {
    const start = now - days * DAY;
    first = Date.parse(bucketOf(start, granularity));
    if (first < start) first += step;
  } else {
    const earliest = dataDates.reduce<string | null>((min, d) => (min === null || d < min ? d : min), null);
    if (!earliest) return [];
    first = Date.parse(earliest);
  }
  const dates: string[] = [];
  for (let t = first, end = Date.parse(bucketOf(now, granularity)); t <= end; t += step) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

const short = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const long = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Axis label: "Sep 3". Weekly buckets are labelled by their Monday. */
export function formatBucket(date: string) {
  return short.format(new Date(`${date}T00:00:00Z`));
}

/** Tooltip label: "Sep 3, 2026" or "Week of Sep 1, 2026", flagged when still in progress. */
export function formatBucketLong(date: string, granularity: Granularity) {
  const label = long.format(new Date(`${date}T00:00:00Z`));
  const current = date === bucketOf(Date.now(), granularity) ? " · so far" : "";
  return `${granularity === "week" ? `Week of ${label}` : label}${current}`;
}
