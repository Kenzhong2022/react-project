import { NextResponse } from "next/server";
import { s3Client } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";

// 允许本地 HTML 播放器跨域调用
const CORS = { "Access-Control-Allow-Origin": "*" };

// 只接受音频后缀 + 50MB 上限，防止垃圾/恶意文件进桶
const ALLOWED_EXT = /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/i;
const MAX_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400, headers: CORS });
  }
  if (!ALLOWED_EXT.test(file.name)) {
    return NextResponse.json(
      { error: "仅支持音频文件（mp3/wav/m4a/aac/ogg/flac/opus）" },
      { status: 400, headers: CORS }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "文件超过 50MB 上限" },
      { status: 400, headers: CORS }
    );
  }

  // Supabase S3 端点的 Key 仅允许 ASCII 安全字符（字母/数字/./-/_），
  // 中文等字符替换为 _；原始文件名存入对象 Metadata，供列表展示
  const safeName = file.name.replace(/[^\w.-]/g, "_");
  const key = `audio/${Date.now()}-${safeName}`;
  // 强制 audio/* Content-Type，防止攻击者借 curl 塞 text/html 之类
  const contentType = file.type.startsWith("audio/") ? file.type : "audio/mpeg";

  // 上传者标识：客户端 localStorage 生成的设备 ID（FormData 附带），
  // 服务端补充来源 IP 与 UA 一并存入对象 Metadata，用于追溯文件来源
  const clientId = String(formData.get("clientId") ?? "").slice(0, 80) || "anonymous";
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ua = (request.headers.get("user-agent") ?? "unknown").slice(0, 200);
  console.log(`[upload] client=${clientId} ip=${ip} key=${key} size=${file.size}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  await s3Client.send(
    new PutObjectCommand({
      Bucket: "music-audio", // Supabase Storage 桶名
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        originalname: encodeURIComponent(file.name),
        clientid: encodeURIComponent(clientId),
        ip,
        ua: encodeURIComponent(ua),
        uploadedat: new Date().toISOString(),
      },
    })
  );

  return NextResponse.json({ success: true, key }, { headers: CORS });
}
