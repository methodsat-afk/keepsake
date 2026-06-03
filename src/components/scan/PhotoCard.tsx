'use client';

import { Photo } from '@/types';
import Image from 'next/image';

interface PhotoCardProps {
  photo: Photo;
}

export function PhotoCard({ photo }: PhotoCardProps) {
  const year = photo.email_date
    ? new Date(photo.email_date).getUTCFullYear()
    : null;

  return (
    <div
      className="animate-fade-in group relative aspect-square overflow-hidden bg-[#f5f5f5]"
      style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}
    >
      <Image
        src={photo.r2_url}
        alt={photo.email_subject ?? 'Rescued photo'}
        fill
        sizes="(max-width: 640px) 50vw, 25vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="absolute bottom-0 left-0 right-0 translate-y-full p-3 transition-transform duration-200 group-hover:translate-y-0">
        {photo.sender_name && (
          <p className="truncate text-xs font-medium text-white">
            {photo.sender_name}
          </p>
        )}
        {year && (
          <p className="text-xs text-white/70">{year}</p>
        )}
      </div>
    </div>
  );
}
