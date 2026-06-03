import type { NextConfig } from "next";

// Allow next/image to optimize photos served from Supabase Storage. Without
// this, images must use `unoptimized`, which ships full-resolution multi-MB
// originals to the browser on every view (slow + high egress cost). Optimizing
// them server-side produces right-sized, modern-format images instead.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
