import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify @netlify/plugin-nextjs handles deployment optimization.
  // No "output: standalone" needed — Netlify adapter builds its own runtime.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow preview iframes from the Z.ai sandbox and Netlify preview domains.
  allowedDevOrigins: ["*.space-z.ai", "*.chatglm.cn", "*.z.ai", "*.netlify.app"],
};

export default nextConfig;
