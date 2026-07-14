import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options go here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai", "*.chatglm.cn", "*.z.ai"],
};

export default nextConfig;
