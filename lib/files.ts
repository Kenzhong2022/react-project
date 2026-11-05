// 文件资源管理共享常量与工具（route.ts 只能导出 HTTP 方法，工具函数放这里）
export const FILE_EXT =
  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|csv|zip|rar|7z|png|jpg|jpeg|gif|webp|mp4|mov|mp3|wav|m4a|flac|json)$/i;

export function makeFileKey(name: string): string {
  const safeName = name.replace(/[^\w.-]/g, "_");
  return `files/${Date.now()}-${safeName}`;
}

// 按扩展名推断 Content-Type（S3 分片上传的 ContentType 在创建任务时一次性确定）
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  flac: "audio/flac",
};

export function guessContentType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
