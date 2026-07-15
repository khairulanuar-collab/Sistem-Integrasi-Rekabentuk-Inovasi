import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel provides native Next.js deployment — no special output config needed.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow preview iframes from sandbox and Vercel preview domains.
  allowedDevOrigins: ["*.space-z.ai", "*.chatglm.cn", "*.z.ai", "*.vercel.app"],
};

export default nextConfig;
