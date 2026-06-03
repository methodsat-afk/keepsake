'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = deep blue · convert = electric green (conversion CTAs) · secondary/ghost = subtle */
  variant?: 'primary' | 'convert' | 'ghost' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  /** Fully rounded pill (100px) instead of the 12px button radius. */
  pill?: boolean;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  pill = false,
  loading = false,
  disabled,
  children,
  className = '',
  style,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]';

  const sizes = {
    sm: 'px-4 py-2 text-[13px]',
    md: 'px-6 py-3 text-[15px]',
    lg: 'px-8 py-4 text-[18px]',
  };

  // OpenServ palette. Largely achromatic with deep-blue + electric-green accents.
  const variantStyle: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--deep-blue)', color: '#ffffff' },
    convert: { background: 'var(--electric-green)', color: 'var(--ink-black)' },
    secondary: {
      background: 'var(--fog-gray)',
      color: 'var(--ink-black)',
      border: '1px solid var(--glass-border)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink-black)',
      border: '1px solid var(--border)',
    },
  };

  const variantClass: Record<string, string> = {
    primary: 'hover:brightness-95 focus-visible:ring-[var(--deep-blue)]',
    convert: 'hover:brightness-95 focus-visible:ring-[var(--deep-blue)]',
    secondary: 'hover:bg-black/[0.04] focus-visible:ring-[var(--deep-blue)]',
    ghost: 'hover:bg-black/[0.03] focus-visible:ring-[var(--deep-blue)]',
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={{
        ...variantStyle[variant],
        borderRadius: pill ? 'var(--radius-pill)' : 'var(--radius-buttons)',
        ...style,
      }}
      className={`${base} ${sizes[size]} ${variantClass[variant]} ${className}`}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
