import { NextResponse } from "next/server";
import { s3Client } from "@/lib/s3";
import {
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FILE_EXT } from "@/lib/files";

// 文件资源管理：通用文件存储（与音频共用一个桶，前缀 files/）
const BUCKET = "music-audio";
const CORS = { "Access-Control-Allow-Origin": "*" };

// GET /api/files —— 列出 files/ 下所有对象并生成 1 小时下载链接
export async function GET() {
  try {
    const res = await s3Client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "files/" })
    );
    const objects = (res.Contents ?? []).filter(
      (o) => o.Key && !o.Key.endsWith("/")
    );

    const items = await Promise.all(
      objects.map(async (o) => {
        const head = await s3Client.send(
          new HeadObjectCommand({ Bucket: BUCKET, Key: o.Key! })
        );
        let name = o.Key!.replace(/^files\//, "").replace(/^\d+-/, "");
        const orig = head.Metadata?.originalname;
        if (orig) {
          try {
            name = decodeURIComponent(orig);
          } catch {
            name = orig;
          }
        }
        let uploader = "";
        const cid = head.Metadata?.clientid;
        if (cid) {
          try {
            uploader = decodeURIComponent(cid);
          } catch {
            uploader = cid;
          }
        }
        if (uploader === "anonymous") uploader = "";

        const contentType = head.ContentType ?? "application/octet-stream";
        // 下载链接单独签名，并覆盖响应头让浏览器按原名保存
        // （对象 Key 带时间戳前缀且中文被替换成下划线，直接用会得到乱码文件名）
        const safeName = name.replace(/["\\\r\n]/g, "_");
        const downloadUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: BUCKET,
            Key: o.Key!,
            ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(
              safeName
            )}`,
            ResponseContentType: contentType,
          }),
          { expiresIn: 3600 }
        );

        return {
          key: o.Key!,
          name,
          uploader,
          contentType,
          size: o.Size ?? 0,
          lastModified: o.LastModified?.toISOString() ?? null,
          url: await getSignedUrl(
            s3Client,
            new GetObjectCommand({ Bucket: BUCKET, Key: o.Key! }),
            { expiresIn: 3600 }
          ),
          downloadUrl,
        };
      })
    );

    items.sort((a, b) => b.key.localeCompare(a.key));
    return NextResponse.json({ items }, { headers: CORS });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { error: err.name, message: err.message },
      { status: 500, headers: CORS }
    );
  }
}

// PATCH /api/files —— 重命名（S3 无原生 rename：复制到新 Key 并更新元数据，再删旧对象）
export async function PATCH(request: Request) {
  try {
    const { key, name } = (await request.json()) as {
      key?: string;
      name?: string;
    };
    if (!key || !key.startsWith("files/") || key.includes("..")) {
      return NextResponse.json(
        { error: "非法的 key" },
        { status: 400, headers: CORS }
      );
    }
    const newName = (name ?? "").trim();
    if (!newName || newName.includes("/") || newName.includes("\\")) {
      return NextResponse.json(
        { error: "文件名不能为空或包含路径分隔符" },
        { status: 400, headers: CORS }
      );
    }
    if (!FILE_EXT.test(newName)) {
      return NextResponse.json(
        { error: "仅支持 pdf / Office / 图片 / 压缩包 / 音视频等常见格式" },
        { status: 400, headers: CORS }
      );
    }

    // 保留原时间戳前缀，替换文件名部分
    const prefixMatch = key.match(/^files\/(\d+-)/);
    const newKey = prefixMatch
      ? `files/${prefixMatch[1]}${newName.replace(/[^\w.-]/g, "_")}`
      : `files/${Date.now()}-${newName.replace(/[^\w.-]/g, "_")}`;
    if (newKey === key) {
      return NextResponse.json({ success: true }, { headers: CORS });
    }

    // 复制并合并元数据（REPLACE 会清空旧元数据，需重新带上）
    const head = await s3Client.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key })
    );
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${key}`,
        Key: newKey,
        MetadataDirective: "REPLACE",
        ContentType: head.ContentType ?? "application/octet-stream",
        Metadata: {
          originalname: encodeURIComponent(newName),
          ...(head.Metadata?.clientid
            ? { clientid: head.Metadata.clientid }
            : {}),
        },
      })
    );
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

    return NextResponse.json({ success: true, key: newKey }, { headers: CORS });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { error: err.name, message: err.message },
      { status: 500, headers: CORS }
    );
  }
}

// DELETE /api/files?key=files/xxx —— 删除单个文件
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key") ?? "";
    if (!key.startsWith("files/") || key.includes("..")) {
      return NextResponse.json(
        { error: "非法的 key" },
        { status: 400, headers: CORS }
      );
    }
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return NextResponse.json({ success: true }, { headers: CORS });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { error: err.name, message: err.message },
      { status: 500, headers: CORS }
    );
  }
}
