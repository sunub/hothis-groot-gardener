import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // `next dev` does not add generated files to the project root.
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
