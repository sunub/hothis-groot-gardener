import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // `next dev` does not add generated files to the project root.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  // 맨 앞 주소(/)에서 public/play의 프론트엔드(v0.8.1)를 연다.
  // 그 페이지는 assets/... 상대 경로를 쓰므로 /assets도 public/play/assets로 넘긴다.
  // 팀 시작 화면은 /start로 옮겼다(src/app/start/page.tsx).
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/play/index.html" },
        { source: "/assets/:path*", destination: "/play/assets/:path*" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
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
