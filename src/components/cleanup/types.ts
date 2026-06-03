import type { CleanupItem, CleanupRun } from '@/types';

/** A sender-grouped bucket of candidate messages, as returned by GET /api/cleanup/run. */
export interface CleanupGroup {
  sender: string;
  senderName: string | null;
  count: number;
  bytes: number;
  /** 'auto' only if every item in the group is auto-tier; otherwise 'review'. */
  tier: 'auto' | 'review';
  items: CleanupItem[];
}

export interface CleanupRunResponse {
  run: CleanupRun | null;
  groups: CleanupGroup[];
  protectedCount?: number;
}

/** Human-readable bytes (e.g. 1536 → "1.5 KB", 2_400_000_000 → "2.4 GB"). */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
