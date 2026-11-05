import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents 的运行时依赖 setTimeout 语义，在 Cloudflare Workers (workerd) 上会崩溃/挂起，故关闭
  cacheComponents: false,
};

export default nextConfig;
