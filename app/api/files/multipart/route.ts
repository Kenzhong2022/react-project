import { NextResponse } from "next/server";
import { s3Client } from "@/lib/s3";
import {
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { FILE_EXT, guessContentType, makeFileKey } from "@/lib/files";

// 大文件分片上传控制面：create / complete / abort（分片数据走 /api/files/part）
const BUCKET = "music-audio";
const CORS = { "Access-Control-Allow-Origin": "*" };

type Body = {
  action: "create" | "complete" | "abort";
  name?: string;
  clientId?: string;
  key?: string;
  uploadId?: string;
  parts?: { partNumber: number; etag: string }[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    // 创建分片上传任务
    if (body.action === "create") {
      const name = body.name ?? "";
      if (!FILE_EXT.test(name)) {
        return NextResponse.json(
          { error: "不支持的文件类型（pdf/office/图片/压缩包/音视频等）" },
          { status: 400, headers: CORS }
        );
      }
      const key = makeFileKey(name);
      const clientId = String(body.clientId ?? "").slice(0, 80) || "anonymous";
      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      console.log(`[files:create] client=${clientId} ip=${ip} key=${key}`);

      const res = await s3Client.send(
        new CreateMultipartUploadCommand({
          Bucket: BUCKET,
          Key: key,
          ContentType: guessContentType(name),
          Metadata: {
            originalname: encodeURIComponent(name),
            clientid: encodeURIComponent(clientId),
            ip,
            uploadedat: new Date().toISOString(),
          },
        })
      );
      return NextResponse.json(
        { key, uploadId: res.UploadId },
        { headers: CORS }
      );
    }

    // 完成合并
    if (body.action === "complete") {
      const key = body.key ?? "";
      const uploadId = body.uploadId ?? "";
      if (!key.startsWith("files/") || !uploadId) {
        return NextResponse.json(
          { error: "缺少 key 或 uploadId" },
          { status: 400, headers: CORS }
        );
      }
      const parts = (body.parts ?? [])
        .filter((p) => Number.isInteger(p.partNumber) && p.partNumber >= 1 && typeof p.etag === "string")
        .sort((a, b) => a.partNumber - b.partNumber);
      if (!parts.length || parts.length > 10000) {
        return NextResponse.json(
          { error: "分片列表非法" },
          { status: 400, headers: CORS }
        );
      }
      await s3Client.send(
        new CompleteMultipartUploadCommand({
          Bucket: BUCKET,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
          },
        })
      );
      console.log(`[files:complete] key=${key} parts=${parts.length}`);
      return NextResponse.json({ success: true, key }, { headers: CORS });
    }

    // 放弃上传（清理已传分片）
    if (body.action === "abort") {
      const key = body.key ?? "";
      const uploadId = body.uploadId ?? "";
      if (!key.startsWith("files/") || !uploadId) {
        return NextResponse.json(
          { error: "缺少 key 或 uploadId" },
          { status: 400, headers: CORS }
        );
      }
      await s3Client.send(
        new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId })
      );
      return NextResponse.json({ success: true }, { headers: CORS });
    }

    return NextResponse.json({ error: "未知 action" }, { status: 400, headers: CORS });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { error: err.name, message: err.message },
      { status: 500, headers: CORS }
    );
  }
}
