export interface MemSample {
  time: number;   // Date.now()
  used: number;   // bytes
  total: number;  // bytes
}

export const MAX_SAMPLES = 300;
export const SAMPLE_INTERVAL = 1000;

/* 전역 히스토리 (컴포넌트 언마운트 후에도 유지) */
export const memHistory: MemSample[] = [];
let samplerInterval: ReturnType<typeof setInterval> | null = null;

export function startSampler() {
  if (samplerInterval) return;
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } };
  if (!perf.memory) return;
  const sample = () => {
    memHistory.push({
      time: Date.now(),
      used: perf.memory!.usedJSHeapSize,
      total: perf.memory!.totalJSHeapSize,
    });
    if (memHistory.length > MAX_SAMPLES) memHistory.shift();
  };
  sample();
  samplerInterval = setInterval(sample, SAMPLE_INTERVAL);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export function formatBytesDelta(bytes: number): string {
  const sign = bytes >= 0 ? '+' : '';
  if (Math.abs(bytes) < 1024) return sign + bytes + ' B';
  if (Math.abs(bytes) < 1024 * 1024) return sign + (bytes / 1024).toFixed(1) + ' KB';
  return sign + (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
