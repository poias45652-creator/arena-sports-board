import type { Metadata } from "next";
import Script from "next/script";
import ViewOnlyBoundary from "./view-only-boundary";
import "./globals.css";
import "./xingzhun-theme.css";
import "../public/ui/button-feedback.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN || "https://arena-sports-board.onrender.com"),
  title: "星準",
  applicationName: "星準",
  description: "星準體育分析，整合 MLB、NPB、NBA、WNBA 與足球五大聯賽、歐冠、歐霸、歐國聯的即時賽事、比分及賽前分析。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {title: "星準", capable: false},
  icons: {
    icon: [
      {url: "/brand/xingzhun-icon-32-v1.png", sizes: "32x32", type: "image/png"},
      {url: "/brand/xingzhun-icon-192-v1.png", sizes: "192x192", type: "image/png"},
    ],
    shortcut: "/brand/xingzhun-icon-32-v1.png",
    apple: {url: "/brand/xingzhun-icon-180-v1.png", sizes: "180x180", type: "image/png"},
  },
  openGraph: {
    title: "星準",
    description: "即時比分、賽事資訊與賽前分析。",
    siteName: "星準",
    locale: "zh_TW",
    type: "website",
    images: [{url: "/brand/xingzhun-cover-v1.jpg", width: 1200, height: 1200, alt: "星準體育分析"}],
  },
  twitter: {card: "summary_large_image", title: "星準", images: ["/brand/xingzhun-cover-v1.jpg"]},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased"><ViewOnlyBoundary>{children}</ViewOnlyBoundary><Script src="/ui/button-feedback.js?v=20261023-1" strategy="afterInteractive"/></body>
    </html>
  );
}
