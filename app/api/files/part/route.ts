import { NextResponse } from "next/server";
import { getS3Client } from "@/lib/s3";
import { UploadPartCommand } from "@aws-sdk/client-s3";

// 上传单个分片（每片 ≤ 16MB，前端按 8MB 切）
const BUCKET = "music-audio";
const CORS = { "Access-Control-Allow-Origin": "*" };
const MAX_PART = 16 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const key = String(formData.get("key") ?? "");
    const uploadId = String(formData.get("uploadId") ?? "");
    const partNumber = Number(formData.get("partNumber"));
    const file = formData.get("file") as File | null;

    if (!key.startsWith("files/") || key.includes("..") || !uploadId) {
      return NextResponse.json(
        { error: "非法的 key 或 uploadId" },
        { status: 400, headers: CORS }
      );
    }
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
      return NextResponse.json(
        { error: "partNumber 非法" },
        { status: 400, headers: CORS }
      );
    }
    if (!file || file.size === 0 || file.size > MAX_PART) {
      return NextResponse.json(
        { error: "分片大小非法（0 < size ≤ 16MB）" },
        { status: 400, headers: CORS }
      );
    }

    const s3Client = await getS3Client();
    const res = await s3Client.send(
      new UploadPartCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: Buffer.from(await file.arrayBuffer()),
      })
    );
    return NextResponse.json({ etag: res.ETag }, { headers: CORS });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { error: err.name, message: err.message },
      { status: 500, headers: CORS }
    );
  }
}
