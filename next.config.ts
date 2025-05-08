import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  logging: {
    // Suppress the specific ResponseAborted error
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
