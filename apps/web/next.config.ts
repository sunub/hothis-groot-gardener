import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // `next dev` does not add generated files to the project root.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // Repo root: `data/content` and the hoisted node_modules live above apps/web.
    root: path.join(__dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
