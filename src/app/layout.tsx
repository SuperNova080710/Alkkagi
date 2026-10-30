import type { Metadata } from "next";
import { isSearchProduction, SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN, SITE_TITLE } from "@/lib/seo/site";
import "./globals.css";
import "./arena.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: SITE_TITLE,
    template: "%s | 알까기 아레나",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_ORIGIN,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: isSearchProduction()
    ? { index: true, follow: true }
    : { index: false, follow: false },
  // User provides this token after verifying the Search Console URL-prefix.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
