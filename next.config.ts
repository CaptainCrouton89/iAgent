import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  logging: {
    // Suppress the specific ResponseAborted error
    fetches: {
      fullUrl: true,
    },
  },
  onError: (err: Error) => {
    // Filter out ResponseAborted errors from the console
    if (err.message?.includes("ResponseAborted")) {
      return;
    }
    console.error(err);
  },
};

export default nextConfig;
