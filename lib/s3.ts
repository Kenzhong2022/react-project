import { S3Client } from "@aws-sdk/client-s3";

// 对象存储统一走 Supabase Storage 的 S3 兼容端点（凭证见 .env.local 的 SUPABASE_S3_*）。
// 本地开发（国内网络）被 supabase.co 拦截时，设置 S3_PROXY=http://127.0.0.1:7890 走本地代理。
// 生产部署在海外（含 CF Workers）时无需设置，自动直连。
// 代理模块为 Node 专用，必须动态 import，否则 Cloudflare Workers 构建会失败。
async function createClient(): Promise<S3Client> {
  return new S3Client({
    region: process.env.SUPABASE_S3_REGION!,
    endpoint: process.env.SUPABASE_S3_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true, // Supabase 也要求开启，否则请求会失败
    requestChecksumCalculation: "WHEN_REQUIRED",// 开启校验，否则会报错
  });
}

export const s3Client = await createClient();