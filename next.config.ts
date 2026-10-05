import type {NextConfig} from "next";
const config: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {cpus: 2},
  poweredByHeader: false,
  compress: true,
  async headers() {
    // Only public visual assets. Never cache sessions, private data, or live APIs.
    return ["/backgrounds/:path*", "/yj-logo.png", "/line-contact.png", "/yj-app-icon.png", "/apple-touch-icon.png", "/0912-bg.mp4"].map(source => ({
      source,
      headers: [{key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400"}],
    }));
  },
};
export default config;
