import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YJ體育分析",
  description: "自動同步美職棒官方球員數據與即時比分。",
  icons: {
    icon: "/yj-logo.png",
    shortcut: "/yj-logo.png",
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
