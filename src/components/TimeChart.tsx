import { formatNumber, clock } from '../lib/metrics';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
export function TimeChart({
  data,
  unit,
  label,
}: {
  data: {
    time: number;
    value: number;
  }[];
  unit: string;
  label: string;
}) {
  if (data.length < 2)
    return (
      <div
        className="chart-waiting relative flex h-full min-h-40 flex-col items-center justify-center
          gap-3 text-small text-secondary"
      >
        <div
          className="waiting-grid pointer-events-none absolute inset-0 flex flex-col justify-between
            opacity-50"
        >
          <i className="block border-t border-dashed border-line" />
          <i className="block border-t border-dashed border-line" />
          <i className="block border-t border-dashed border-line" />
        </div>
        <div>
          <strong>{data.length ? 'Collecting history' : 'Waiting for measurements'}</strong>
          <p>
            {data.length
              ? `First sample: ${formatNumber(data[0].value)} ${unit} at ${clock(data[0].time)}. The next sample will start the graph.`
              : 'A time series will appear as measurements arrive.'}
          </p>
        </div>
      </div>
    );
  return (
    <div
      className="time-chart relative h-full min-h-0 w-full"
      role="img"
      aria-label={`${label} over time in ${unit}, ${data.length} samples`}
    >
      <span className="chart-unit absolute top-0 left-4.5 text-small text-secondary">{unit}</span>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={data}
          margin={{
            top: 20,
            right: 16,
            left: 0,
            bottom: 8,
          }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 4" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(value) => clock(Number(value))}
            tick={{
              fontFamily: 'Satoshi',
              fontSize: 14,
              fill: 'var(--chart-axis)',
            }}
            tickLine={false}
            axisLine={false}
            tickCount={5}
            minTickGap={35}
          />
          <YAxis
            width={76}
            domain={[0, 'auto']}
            tickFormatter={(value) => formatNumber(Number(value))}
            tick={{
              fontFamily: 'Satoshi',
              fontSize: 14,
              fill: 'var(--chart-axis)',
            }}
            tickLine={false}
            axisLine={false}
            tickCount={5}
          />
          <Tooltip
            itemStyle={{
              color: 'var(--chart-tooltip-text)',
            }}
            labelStyle={{
              color: 'var(--chart-tooltip-text)',
            }}
            isAnimationActive={false}
            labelFormatter={(value) => clock(Number(value))}
            formatter={(value) => [`${formatNumber(Number(value))} ${unit}`, label]}
            contentStyle={{
              fontFamily: 'Satoshi',
              fontSize: 14,
              border: '1px solid var(--chart-tooltip-border)',
              backgroundColor: 'var(--chart-tooltip)',
              borderRadius: 9,
              color: 'var(--chart-tooltip-text)',
              boxShadow: '0 4px 20px #20304012',
            }}
            cursor={{
              stroke: 'var(--chart-axis)',
              strokeDasharray: '3 3',
            }}
          />
          <Area
            type="linear"
            dataKey="value"
            stroke="var(--chart-line)"
            strokeWidth={2.2}
            fill="var(--chart-fill)"
            fillOpacity={0.8}
            isAnimationActive={false}
            dot={false}
            activeDot={{
              r: 4,
              fill: 'var(--chart-line)',
              stroke: 'var(--chart-tooltip)',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
