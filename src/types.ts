export type Workspace = { id: string; name: string };
export type Status = 'stopped' | 'starting' | 'running' | 'stopping' | 'failed';
export type Health = 'none' | 'pending' | 'healthy' | 'unhealthy';
export type ServiceConfig = {
  id: string;
  name: string;
  directory: string;
  command: string;
  args: string[];
  port?: number;
  healthUrl?: string;
  kind: 'api' | 'worker' | 'frontend' | 'scheduler' | 'service';
};
export type Service = ServiceConfig & {
  status: Status;
  health: Health;
  pid?: number;
  startedAt?: number;
  exitCode?: number | null;
  error?: string;
  memoryBytes?: number;
  memorySampledAt?: number;
};
export type LogEntry = {
  id: number;
  serviceId: string;
  time: number;
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
};
export type Snapshot = {
  services: Service[];
  logs: LogEntry[];
  workspace: string;
};

export type TelemetrySpan = {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  name: string;
  service: string;
  scope: string;
  startTime: number;
  duration: number;
  status: 'ok' | 'error' | 'unset';
  statusMessage: string;
  kind: string;
  attributes: Record<string, string>;
  events: { name: string; time: number; attributes: Record<string, string> }[];
};
export type TraceSummary = {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  services: string[];
  spanCount: number;
  error: boolean;
};
export type MetricPoint = {
  time: number;
  value: number;
  count?: number;
  sum?: number;
  min?: number;
  max?: number;
  buckets?: number[];
  bounds?: number[];
};
export type MetricSeries = {
  id: string;
  name: string;
  service: string;
  description: string;
  unit: string;
  kind: 'gauge' | 'sum' | 'histogram' | 'exponentialHistogram' | 'summary';
  temporality: string;
  attributes: Record<string, string>;
  points: MetricPoint[];
};
export type TelemetrySnapshot = {
  endpoint: string;
  receiver: 'starting' | 'listening' | 'error';
  receiverError?: string;
  services: string[];
  traces: TraceSummary[];
  metrics: MetricSeries[];
  spanCount: number;
  lastReceived?: number;
};

export type MemoryPoint = { time: number; bytes: number };
export type MemorySnapshot = {
  sampledAt?: number;
  totalBytes: number;
  freeBytes: number;
  managedBytes: number;
  peakBytes: number;
  error?: string;
  history: MemoryPoint[];
  services: {
    id: string;
    name: string;
    status: Status;
    pid?: number;
    memoryBytes?: number;
    peakBytes: number;
    history: MemoryPoint[];
  }[];
};

export type DirectoryListing = {
  path: string;
  parent: string | null;
  entries: { name: string; path: string; symlink: boolean }[];
  total: number;
  offset: number;
  hasMore: boolean;
  container: boolean;
  shortcuts: { name: string; path: string }[];
};
