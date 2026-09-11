import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "競技場｜美職棒數據中心",
  description: "自動同步美職棒官方球員數據與即時比分。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
