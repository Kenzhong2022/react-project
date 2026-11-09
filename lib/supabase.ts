import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 仅服务端使用：凭据从环境变量读取，不会打包到浏览器。
// 用惰性单例而不是模块顶层创建——CI 构建环境没有 .env.local，
// 顶层 createClient 会在 next build 收集页面数据时因缺少 SUPABASE_URL 直接抛错。
let client: SupabaseClient | null = null;

/**
 * @description 获取全局唯一的 Supabase 客户端：首次调用时读取环境变量并创建，后续复用同一实例
 * @returns SupabaseClient 实例
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量（服务端）");
    }
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
