'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  formatBytes,
  type CleanupGroup,
  type CleanupRunResponse,
} from './types';

/**
 * Inbox cleanup review UI. Read-only / dry-run for now: it shows exactly what
 * WOULD be moved to Trash. The actual apply action is gated until the
 * gmail.modify scope + CASA assessment land (docs/inbox-cleanup-design.md §9),
 * so the confirm button is disabled with a clear "coming soon" state.
 */

const TERMINAL_STATUSES = new Set(['review', 'complete', 'error']);

export function CleanupReview() {
  const [data, setData] = useState<CleanupRunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  // Selected sender keys (groups). Auto groups are always implicitly selected.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/cleanup/run');
    if (!res.ok) {
      setError('Could not load cleanup results.');
      setLoading(false);
      return null;
    }
    const body = (await res.json()) as CleanupRunResponse;
    setData(body);
    setLoading(false);
    return body;
  }, []);

  // Poll the run on a fixed interval (subscribing to an external system). The
  // fetch + setState happen inside the interval callback, not synchronously in
  // the effect body. Once a run reaches a terminal state we stop fetching, so
  // the idle page makes no further network calls.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (!active) return;
      const body = await load();
      if (body?.run && TERMINAL_STATUSES.has(body.run.status) && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, 2500);
    pollRef.current = id;
    return () => {
      active = false;
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, [load]);

  // When the user kicks off a new scan, resume polling if it had stopped.
  const ensurePolling = useCallback(() => {
    if (pollRef.current) return;
    const id = setInterval(() => {
      load().then((body) => {
        if (body?.run && TERMINAL_STATUSES.has(body.run.status) && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      });
    }, 2500);
    pollRef.current = id;
  }, [load]);

  const startScan = async () => {
    setStarting(true);
    setError('');
    try {
      const res = await fetch('/api/cleanup/scan', { method: 'POST' });
      const body = (await res.json()) as { runId?: string; error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Could not start cleanup.');
        setStarting(false);
        return;
      }
      // Resume polling (in case it had stopped) to pick up the new run.
      setStarting(false);
      setLoading(true);
      ensurePolling();
    } catch {
      setError('Network error. Please try again.');
      setStarting(false);
    }
  };

  const cancelScan = async () => {
    try {
      await fetch('/api/cleanup/cancel', { method: 'POST' });
      await load();
    } catch {
      // best-effort; the next poll will reflect the cancelled state
    }
  };

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const autoGroups = useMemo(() => groups.filter((g) => g.tier === 'auto'), [groups]);
  const reviewGroups = useMemo(() => groups.filter((g) => g.tier === 'review'), [groups]);

  // Selected bytes = all auto groups (always on) + checked review groups.
  const selectedBytes = useMemo(() => {
    let bytes = 0;
    for (const g of autoGroups) bytes += g.bytes;
    for (const g of reviewGroups) if (selected.has(g.sender)) bytes += g.bytes;
    return bytes;
  }, [autoGroups, reviewGroups, selected]);

  const selectedCount = useMemo(() => {
    let n = 0;
    for (const g of autoGroups) n += g.count;
    for (const g of reviewGroups) if (selected.has(g.sender)) n += g.count;
    return n;
  }, [autoGroups, reviewGroups, selected]);

  const toggle = (sender: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sender)) next.delete(sender);
      else next.add(sender);
      return next;
    });

  const toggleExpand = (sender: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sender)) next.delete(sender);
      else next.add(sender);
      return next;
    });

  // ── Render states ──────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-black/10"
          style={{ borderTopColor: 'var(--deep-blue)' }}
        />
      </div>
    );
  }

  const run = data?.run ?? null;
  const isScanning = run ? !TERMINAL_STATUSES.has(run.status) : false;

  // No run yet, or user wants a fresh scan.
  if (!run) {
    return (
      <EmptyState
        onStart={startScan}
        starting={starting}
        error={error}
      />
    );
  }

  return (
    <div className="pb-28">
      {/* Scan status */}
      {isScanning && (
        <div
          className="mb-8 flex items-center gap-3 rounded-2xl p-4"
          style={{ border: '1px solid var(--border)', background: 'var(--fog-gray)' }}
        >
          <div
            className="h-4 w-4 animate-spin rounded-full border-2 border-black/10"
            style={{ borderTopColor: 'var(--deep-blue)' }}
          />
          <p className="flex-1 text-sm" style={{ color: 'var(--graphite)' }}>
            Scanning your inbox… {run.emails_scanned} checked, {run.junk_found} junk found so far.
          </p>
          <button
            onClick={cancelScan}
            className="shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition hover:bg-black/[0.04]"
            style={{ border: '1px solid var(--border)', color: 'var(--graphite)' }}
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <p className="mb-6 text-sm" style={{ color: '#dc2626' }}>{error}</p>
      )}

      {/* Auto-clean section */}
      {autoGroups.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-1 font-display text-2xl">Will be cleaned automatically</h2>
          <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
            Obvious bulk mail with an unsubscribe link. Recoverable from Trash for ~30 days.
          </p>
          <div className="space-y-2">
            {autoGroups.map((g) => (
              <GroupRow
                key={g.sender}
                group={g}
                checked
                locked
                expanded={expanded.has(g.sender)}
                onToggle={() => {}}
                onExpand={() => toggleExpand(g.sender)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Review section */}
      {reviewGroups.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-1 font-display text-2xl">Review these</h2>
          <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
            Less certain — pick what to clear. Nothing here is touched unless you check it.
          </p>
          <div className="space-y-2">
            {reviewGroups.map((g) => (
              <GroupRow
                key={g.sender}
                group={g}
                checked={selected.has(g.sender)}
                expanded={expanded.has(g.sender)}
                onToggle={() => toggle(g.sender)}
                onExpand={() => toggleExpand(g.sender)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Protected reassurance */}
      {(data?.protectedCount ?? 0) > 0 && (
        <section
          className="mb-10 rounded-2xl p-5"
          style={{ border: '1px solid var(--border)', background: 'var(--fog-gray)' }}
        >
          <p className="text-sm" style={{ color: 'var(--graphite)' }}>
            🔒 We&apos;re leaving <strong>{data?.protectedCount}</strong>{' '}
            protected {data?.protectedCount === 1 ? 'message' : 'messages'} completely
            untouched — starred, important, personal, or tied to a rescued photo.
          </p>
        </section>
      )}

      {!isScanning && autoGroups.length === 0 && reviewGroups.length === 0 && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ border: '1px solid var(--border)', background: 'var(--fog-gray)' }}
        >
          <p style={{ color: 'var(--graphite)' }}>
            No junk candidates found in this pass. Your inbox is already tidy. ✨
          </p>
        </div>
      )}

      {/* Sticky confirm footer */}
      {(autoGroups.length > 0 || reviewGroups.length > 0) && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-4 py-4"
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-medium" style={{ color: 'var(--foreground)' }}>
                {selectedCount} {selectedCount === 1 ? 'email' : 'emails'} · frees ~{formatBytes(selectedBytes)}
              </p>
              <p className="text-[12px]" style={{ color: 'var(--steel-gray)' }}>
                Everything goes to Trash — recoverable for ~30 days, one-click undo.
              </p>
            </div>
            {/* Apply is gated until gmail.modify + CASA land (design §9). */}
            <div className="text-right">
              <Button variant="convert" size="md" disabled title="Available once inbox cleanup launches">
                Move to Trash
              </Button>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--steel-gray)' }}>
                Coming soon
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  onStart,
  starting,
  error,
}: {
  onStart: () => void;
  starting: boolean;
  error: string;
}) {
  return (
    <div
      className="rounded-3xl p-10 text-center"
      style={{ border: '1px solid var(--border)', background: 'var(--fog-gray)' }}
    >
      <div className="mb-4 text-5xl">🧹</div>
      <h2 className="mb-2 font-display text-3xl">Find the junk in your inbox</h2>
      <p className="mx-auto mb-8 max-w-md" style={{ color: 'var(--graphite)' }}>
        We&apos;ll scan for old newsletters, promotions, and clutter eating your
        storage — and show you exactly what we&apos;d clear. Nothing is removed
        without your say-so.
      </p>
      <Button size="lg" loading={starting} onClick={onStart}>
        {starting ? 'Starting…' : 'Scan for junk'}
      </Button>
      {error && <p className="mt-4 text-sm" style={{ color: '#dc2626' }}>{error}</p>}
    </div>
  );
}

function GroupRow({
  group,
  checked,
  locked = false,
  expanded,
  onToggle,
  onExpand,
}: {
  group: CleanupGroup;
  checked: boolean;
  locked?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  return (
    <div
      className="overflow-hidden bg-white"
      style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}
    >
      <div className="flex items-center gap-4 p-4">
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={onToggle}
          className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--deep-blue)] disabled:cursor-not-allowed"
          aria-label={`Select ${group.sender}`}
        />
        <button onClick={onExpand} className="flex-1 text-left">
          <p className="truncate text-[15px] font-medium" style={{ color: 'var(--foreground)' }}>
            {group.senderName || group.sender}
          </p>
          <p className="text-[13px]" style={{ color: 'var(--steel-gray)' }}>
            {group.count} {group.count === 1 ? 'email' : 'emails'} · {formatBytes(group.bytes)}
            {group.items[0]?.confidence != null && (
              <> · {group.items[0].reason ?? 'bulk mail'}</>
            )}
          </p>
        </button>
        <span className="text-[12px]" style={{ color: 'var(--steel-gray)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <ul className="space-y-2">
            {group.items.slice(0, 25).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate" style={{ color: 'var(--graphite)' }}>
                  {item.subject || '(no subject)'}
                </span>
                <span className="shrink-0" style={{ color: 'var(--steel-gray)' }}>
                  {item.internal_date
                    ? new Date(item.internal_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                      })
                    : ''}
                </span>
              </li>
            ))}
            {group.count > 25 && (
              <li className="text-[12px]" style={{ color: 'var(--steel-gray)' }}>
                + {group.count - 25} more…
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
