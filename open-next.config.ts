import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext 默认用 `npm run build` 构建 Next 应用，而 build 脚本本身就是 opennextjs-cloudflare build，
// 会无限递归；这里显式指定为 next-build（next build --webpack）打断循环
export default {
  ...defineCloudflareConfig({}),
  buildCommand: "npm run next-build",
};
