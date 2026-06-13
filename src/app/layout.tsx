import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Keepsake — Rescue your family photos from email",
    template: "%s · Keepsake",
  },
  description:
    "Keepsake scans your inbox, rescues every real family photo buried in old emails, and hands them back organized by year. Free scan, $19 to download forever.",
  keywords: [
    "rescue email photos",
    "find photos in email",
    "family photos from Gmail",
    "download email attachments",
    "photo backup",
  ],
  applicationName: "Keepsake",
  authors: [{ name: "Keepsake" }],
  openGraph: {
    type: "website",
    siteName: "Keepsake",
    url: APP_URL,
    title: "Keepsake — Rescue your family photos from email",
    description:
      "The photos you love are buried in email. Keepsake finds them, filters the junk, and hands them back organized by year.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Keepsake — Rescue your family photos from email",
    description:
      "The photos you love are buried in email. Keepsake finds them, filters the junk, and hands them back organized by year.",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#f5ede3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
