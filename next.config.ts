import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: `next build` emits a fully static site to `out/` (no Node
  // server) so it can be hosted on plain file hosting like DreamHost via SFTP.
  // The app is 100% client-side, so this is a clean fit. See README "Deploy".
  output: "export",
  // Static hosts don't rewrite extensionless URLs, so emit `path/index.html`
  // directories instead of `path.html`. Lets DreamHost serve routes directly.
  trailingSlash: true,
  // next/image optimization needs a server; this app uses no <Image>, but set
  // it unoptimized so any future image still works under static export.
  images: { unoptimized: true },
  // Hide the floating Next.js dev indicator (bottom-left build/Turbopack badge).
  devIndicators: false,
};

export default nextConfig;
