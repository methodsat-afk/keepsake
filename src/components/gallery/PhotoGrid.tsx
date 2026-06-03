'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Photo } from '@/types';
import { normalizeCategory, categoryLabel } from '@/lib/photo-categories';

interface PhotoGridProps {
  photos: Photo[];
  hasPaid: boolean;
}

type SortKey = 'newest' | 'oldest' | 'sender';

const FREE_PREVIEW_COUNT = 2;

function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-8 w-8"
    >
      <path
        fillRule="evenodd"
        d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Filter/sort pill. Declared at module scope (not inside PhotoGrid) so React
// keeps a stable component identity across renders.
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
      style={
        active
          ? {
              background: 'var(--or)',
              color: '#fff',
              border: '1px solid var(--or)',
            }
          : {
              background: 'var(--glass)',
              color: 'var(--muted)',
              border: '1px solid var(--glass-border)',
            }
      }
    >
      {children}
    </button>
  );
}

export function PhotoGrid({ photos, hasPaid }: PhotoGridProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  // Derive filter options
  const categories = useMemo(
    () =>
      Array.from(new Set(photos.map((p) => normalizeCategory(p.category)))).sort(),
    [photos]
  );

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          photos
            .filter((p) => p.email_date)
            .map((p) => new Date(p.email_date!).getUTCFullYear())
        )
      ).sort((a, b) => b - a),
    [photos]
  );

  const senders = useMemo(
    () =>
      Array.from(
        new Set(photos.filter((p) => p.sender_name).map((p) => p.sender_name!))
      ).sort(),
    [photos]
  );

  // Filter then sort
  const sorted = useMemo(() => {
    const filtered = photos.filter((p) => {
      if (selectedYear && p.email_date) {
        if (new Date(p.email_date).getUTCFullYear() !== selectedYear) return false;
      }
      if (selectedSender && p.sender_name !== selectedSender) return false;
      if (selectedCategory && normalizeCategory(p.category) !== selectedCategory) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortKey === 'newest') {
        return (
          new Date(b.email_date ?? 0).getTime() -
          new Date(a.email_date ?? 0).getTime()
        );
      }
      if (sortKey === 'oldest') {
        return (
          new Date(a.email_date ?? 0).getTime() -
          new Date(b.email_date ?? 0).getTime()
        );
      }
      // by sender
      return (a.sender_name ?? '').localeCompare(b.sender_name ?? '');
    });
  }, [photos, selectedYear, selectedSender, selectedCategory, sortKey]);

  const totalLocked = hasPaid ? 0 : Math.max(0, sorted.length - FREE_PREVIEW_COUNT);

  return (
    <>
      {/* ── Filter / Sort bar ────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {/* Category chips */}
        {categories.length > 1 && (
          <>
            <Chip active={selectedCategory === null} onClick={() => setSelectedCategory(null)}>
              All
            </Chip>
            {categories.map((c) => (
              <Chip
                key={c}
                active={selectedCategory === c}
                onClick={() => setSelectedCategory(selectedCategory === c ? null : c)}
              >
                {categoryLabel(c)}
              </Chip>
            ))}
            <span
              className="mx-1 h-4 w-px self-center"
              style={{ background: 'var(--glass-border)' }}
            />
          </>
        )}

        {/* Year chips */}
        {years.length > 1 && (
          <>
            <Chip active={selectedYear === null} onClick={() => setSelectedYear(null)}>
              All years
            </Chip>
            {years.map((y) => (
              <Chip
                key={y}
                active={selectedYear === y}
                onClick={() => setSelectedYear(selectedYear === y ? null : y)}
              >
                {y}
              </Chip>
            ))}
            <span
              className="mx-1 h-4 w-px self-center"
              style={{ background: 'var(--glass-border)' }}
            />
          </>
        )}

        {/* Sender chips */}
        {senders.length > 1 && (
          <>
            <Chip
              active={selectedSender === null}
              onClick={() => setSelectedSender(null)}
            >
              All people
            </Chip>
            {senders.map((s) => (
              <Chip
                key={s}
                active={selectedSender === s}
                onClick={() =>
                  setSelectedSender(selectedSender === s ? null : s)
                }
              >
                {s}
              </Chip>
            ))}
            <span
              className="mx-1 h-4 w-px self-center"
              style={{ background: 'var(--glass-border)' }}
            />
          </>
        )}

        {/* Sort select — pushed to the right */}
        <div className="ml-auto">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-full px-4 py-1.5 text-sm font-medium cursor-pointer"
            style={{
              background: 'var(--glass)',
              color: 'var(--muted)',
              border: '1px solid var(--glass-border)',
              outline: 'none',
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="sender">By sender</option>
          </select>
        </div>
      </div>

      {/* ── Photo grid ───────────────────────────────────── */}
      {sorted.length === 0 ? (
        <div
          className="flex h-64 items-center justify-center rounded-2xl border border-dashed"
          style={{ borderColor: 'var(--border)' }}
        >
          <p style={{ color: 'var(--muted)' }}>No photos match this filter.</p>
        </div>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 md:columns-4">
          {sorted.map((photo, idx) => {
            const isLocked = !hasPaid && idx >= FREE_PREVIEW_COUNT;

            return (
              <div
                key={photo.id}
                className="animate-tile mb-3 break-inside-avoid overflow-hidden rounded-xl transition"
                style={{ border: '1px solid var(--border)', animationDelay: `${Math.min(idx, 12) * 0.05}s` }}
              >
                {isLocked ? (
                  /* ── Locked tile ── */
                  <a
                    href="/download"
                    className="relative block"
                    title="Unlock to view"
                  >
                    <Image
                      src={photo.r2_url}
                      alt="Locked photo"
                      width={400}
                      height={300}
                      className="w-full object-cover blur-xl scale-105"
                    />
                    {/* Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                      <span style={{ color: 'var(--or-light)' }}>
                        <LockIcon />
                      </span>
                      <span
                        className="text-xs font-semibold text-center px-2"
                        style={{ color: 'rgba(245,237,228,0.85)' }}
                      >
                        Unlock to view
                      </span>
                    </div>
                  </a>
                ) : (
                  /* ── Unlocked tile ── */
                  <div
                    className="relative cursor-pointer hover:scale-[1.02] hover:shadow-2xl transition"
                    onClick={() => setLightbox(photo)}
                  >
                    <Image
                      src={photo.r2_url}
                      alt={photo.email_subject ?? 'Photo'}
                      width={400}
                      height={300}
                      className="w-full object-cover"
                    />
                    {/* Caption hover */}
                    <div
                      className="absolute bottom-0 left-0 right-0 px-3 py-2 opacity-0 hover:opacity-100 transition-opacity"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}
                    >
                      {photo.sender_name && (
                        <p className="text-xs font-medium text-white truncate">
                          {photo.sender_name}
                        </p>
                      )}
                      {photo.email_date && (
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                          {new Date(photo.email_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Inline paywall card (after free previews) ── */}
          {!hasPaid && totalLocked > 0 && (
            <div
              className="mb-3 break-inside-avoid overflow-hidden rounded-xl p-6 flex flex-col items-center justify-center gap-4 text-center"
              style={{
                border: '1px solid var(--or)',
                background: 'var(--background-2)',
                minHeight: '220px',
              }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'var(--or-glow)', color: 'var(--or-light)' }}
              >
                <LockIcon />
              </div>
              <div>
                <p
                  className="text-lg font-bold"
                  style={{
                    fontFamily: 'var(--font-space-grotesk), ui-sans-serif, sans-serif',
                    fontWeight: 300,
                    letterSpacing: '-0.02em',
                    color: 'var(--foreground)',
                  }}
                >
                  {totalLocked} more {totalLocked === 1 ? 'photo' : 'photos'} waiting
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                  Pay once, keep forever.
                </p>
              </div>
              <a
                href="/download"
                className="px-6 py-2.5 text-sm font-medium transition hover:brightness-95"
                style={{ background: 'var(--electric-green)', color: 'var(--ink-black)', borderRadius: 'var(--radius-pill)' }}
              >
                Unlock all for $19
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Lightbox ─────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl"
            style={{ border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightbox.r2_url}
              alt={lightbox.email_subject ?? 'Photo'}
              width={1200}
              height={900}
              className="max-h-[80vh] w-auto object-contain"
            />
            <div
              className="absolute bottom-0 left-0 right-0 p-4 backdrop-blur-sm"
              style={{ background: 'rgba(0,0,0,0.7)' }}
            >
              {lightbox.sender_name && (
                <p
                  className="font-semibold"
                  style={{
                    fontFamily: 'var(--font-space-grotesk), ui-sans-serif, sans-serif',
                    color: '#ffffff',
                  }}
                >
                  {lightbox.sender_name}
                </p>
              )}
              {lightbox.email_date && (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {new Date(lightbox.email_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
              {lightbox.email_subject && (
                <p className="mt-1 text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {lightbox.email_subject}
                </p>
              )}
            </div>
            <button
              onClick={() => setLightbox(null)}
              className="absolute right-3 top-3 rounded-full p-2 transition hover:opacity-80"
              style={{ background: 'rgba(0,0,0,0.6)', color: '#ffffff' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
