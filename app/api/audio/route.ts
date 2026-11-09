import { NextResponse } from "next/server";
import { getS3Client } from "@/lib/s3";
import {
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { guessContentType } from "@/lib/files";

const BUCKET = "music-audio";

// 音频后缀白名单（与 /api/upload 保持一致）
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/i;

// 允许本地 HTML 播放器跨域调用
const CORS = { "Access-Control-Allow-Origin": "*" };

// 从 key 兜底推导展示名（key 形如 audio/1793781419068-____.m4a）
function fallbackName(key: string): string {
  return key.replace(/^audio\//, "").replace(/^\d+-/, "");
}

// PATCH /api/audio —— 重命名（复制到新 Key 并更新元数据，再删旧对象）
export async function PATCH(request: Request) {
  try {
    const { key, name } = (await request.json()) as {
      key?: string;
      name?: string;
    };
    if (!key || !key.startsWith("audio/") || key.includes("..")) {
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
    if (!AUDIO_EXT.test(newName)) {
      return NextResponse.json(
        { error: "仅支持 mp3/wav/m4a/aac/ogg/flac/opus 音频格式" },
        { status: 400, headers: CORS }
      );
    }

    const prefixMatch = key.match(/^audio\/(\d+-)/);
    const newKey = prefixMatch
      ? `audio/${prefixMatch[1]}${newName.replace(/[^\w.-]/g, "_")}`
      : `audio/${Date.now()}-${newName.replace(/[^\w.-]/g, "_")}`;
    if (newKey === key) {
      return NextResponse.json({ success: true }, { headers: CORS });
    }

    const s3Client = await getS3Client();
    const head = await s3Client.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key })
    );
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${key}`,
        Key: newKey,
        MetadataDirective: "REPLACE",
        ContentType: head.ContentType ?? guessContentType(newName),
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

// DELETE /api/audio?key=audio/xxx —— 删除单个音频
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key") ?? "";
    if (!key.startsWith("audio/") || key.includes("..")) {
      return NextResponse.json(
        { error: "非法的 key" },
        { status: 400, headers: CORS }
      );
    }
    const s3Client = await getS3Client();
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


export async function GET() {
  try {
    const s3Client = await getS3Client();
    const res = await s3Client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "audio/" })
    );

    const objects = (res.Contents ?? []).filter(
      (o) => o.Key && !o.Key.endsWith("/")
    );

    const items = await Promise.all(
      objects.map(async (o) => {
        // 原始文件名存在对象 Metadata 里（Key 被清洗过，无法还原中文名）
        const head = await s3Client.send(
          new HeadObjectCommand({ Bucket: BUCKET, Key: o.Key! })
        );
        let name = fallbackName(o.Key!);
        const orig = head.Metadata?.originalname;
        if (orig) {
          try {
            name = decodeURIComponent(orig);
          } catch {
            name = orig;
          }
        }
        // 上传者设备 ID（公开安全；IP/UA 仅存于 Metadata 不对外返回）
        // 旧客户端不带 clientId，服务端记为 anonymous，展示时不显示标签
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

        return {
          key: o.Key!,
          name,
          uploader,
          size: o.Size ?? 0,
          lastModified: o.LastModified?.toISOString() ?? null,
          url: await getSignedUrl(
            s3Client,
            new GetObjectCommand({ Bucket: BUCKET, Key: o.Key! }),
            { expiresIn: 3600 }
          ),
        };
      })
    );

    // 按上传时间倒序（key 内含时间戳）
    items.sort((a, b) => b.key.localeCompare(a.key));

    return NextResponse.json({ items }, { headers: CORS });
  } catch (e) {
    const err = e as Error & { $metadata?: { httpStatusCode?: number } };
    return NextResponse.json(
      {
        error: err.name,
        status: err.$metadata?.httpStatusCode,
        message: err.message,
      },
      { status: 500, headers: CORS }
    );
  }
}
