import type { Metadata } from "next";
import "./globals.css";
import "./arena.css";

export const metadata: Metadata = {
  title: "Alkkagi Arena | 알까기 아레나",
  description: "친구와 즐기는 1:1 알까기. 알 다섯 개로 시작하는 한 판의 승부.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
