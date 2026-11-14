import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Keeps `next dev` from writing an AGENTS.md file into the project.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
