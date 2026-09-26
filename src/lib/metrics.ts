import type { MetricSeries } from '../types';
export const formatNumber = (value: number) =>
  new Intl.NumberFormat('en', {
    maximumFractionDigits: 2,
  }).format(value);
export const clock = (time: number) =>
  new Date(time).toLocaleTimeString('en-GB', {
    hour12: false,
  });
export const colors = Array.from(
  {
    length: 6,
  },
  (_, index) => `var(--chart-series-${index + 1})`,
);
export const unitLabel = (unit: string) =>
  unit === 'By' ? 'MiB' : unit.startsWith('{') ? unit.slice(1, -1) : unit;
export const convert = (value: number, unit: string) => (unit === 'By' ? value / 1024 ** 2 : value);
export function explanation(metric: MetricSeries) {
  if (metric.kind === 'gauge') return 'Current measurement at each export.';
  if (metric.kind === 'sum')
    return metric.temporality === 'Cumulative'
      ? 'Running total recorded by this service.'
      : 'Total recorded during each export interval.';
  return metric.temporality === 'Cumulative'
    ? 'Average of all recorded observations at each export.'
    : 'Average of observations within each export interval.';
}
