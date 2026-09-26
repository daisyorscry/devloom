export const formatMemory = (bytes?: number) =>
  bytes === undefined
    ? '—'
    : bytes >= 1024 ** 3
      ? `${(bytes / 1024 ** 3).toFixed(2)} GiB`
      : `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
