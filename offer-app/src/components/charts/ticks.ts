/**
 * Clean value-axis ticks (0 / 100 / 200 …) covering [min, max], stepping by 1, 2, 2.5 or 5
 * times a power of ten. Integer steps only, since usage is counted.
 */
export function niceTicks(min: number, max: number, count = 4) {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  if (hi === lo) return [0, 1];
  const rough = (hi - lo) / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const multipliers = pow >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10];
  const step = Math.max(1, multipliers.map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow);
  const ticks: number[] = [];
  for (let t = Math.floor(lo / step) * step; t < hi + step; t += step) {
    ticks.push(t);
    if (t >= hi) break;
  }
  return ticks;
}
