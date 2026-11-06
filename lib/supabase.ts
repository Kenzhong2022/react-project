import { createClient } from "@supabase/supabase-js";

// 仅服务端使用：凭据从环境变量读取，不会打包到浏览器
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);
