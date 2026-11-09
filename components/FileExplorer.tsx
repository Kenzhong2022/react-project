"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Upload,
  Table,
  Button,
  App as AntApp,
  Typography,
  Space,
  Tag,
  Input,
  Modal,
} from "antd";
import type { UploadProps } from "antd/es/upload/interface";
import { InboxOutlined, ReloadOutlined, EditOutlined } from "@ant-design/icons";
import { guessContentType } from "@/lib/files";

// antd customRequest 参数（跨版本稳定的最小子集）
type UploadRequestOption = {
  file: unknown;
  onSuccess?: (body: unknown, xhr?: unknown) => void;
  onError?: (err: Error) => void;
  onProgress?: (event: { percent: number }) => void;
};

const PART_SIZE = 8 * 1024 * 1024; // 8MB 分片

type FileItem = {
  key: string;
  name: string;
  uploader: string;
  contentType: string;
  size: number;
  lastModified: string | null;
  url: string;
  downloadUrl: string;
};

// 设备唯一标志：与音频上传同一套标识体系
function getClientId(): string {
  let id = localStorage.getItem("react-project-client-id");
  if (!id) {
    id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("react-project-client-id", id);
  }
  return id;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// 分片上传单个文件：create → 逐片 part → complete，失败时 abort
async function multipartUpload(
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  const createRes = await fetch("/api/files/multipart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", name: file.name, clientId: getClientId() }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) throw new Error(createData.error ?? "创建上传任务失败");
  const { key, uploadId } = createData as { key: string; uploadId: string };

  const parts: { partNumber: number; etag: string }[] = [];
  try {
    const totalParts = Math.ceil(file.size / PART_SIZE);
    for (let i = 0; i < totalParts; i++) {
      const chunk = file.slice(i * PART_SIZE, (i + 1) * PART_SIZE);
      const fd = new FormData();
      fd.append("key", key);
      fd.append("uploadId", uploadId);
      fd.append("partNumber", String(i + 1));
      fd.append("file", chunk);
      const partRes = await fetch("/api/files/part", { method: "POST", body: fd });
      const partData = await partRes.json();
      if (!partRes.ok) throw new Error(partData.error ?? `第 ${i + 1} 片上传失败`);
      parts.push({ partNumber: i + 1, etag: partData.etag });
      onProgress(Math.round(((i + 1) / totalParts) * 100));
    }
    const completeRes = await fetch("/api/files/multipart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", key, uploadId, parts }),
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok) throw new Error(completeData.error ?? "合并分片失败");
  } catch (e) {
    // 失败时尽力清理已上传分片
    fetch("/api/files/multipart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "abort", key, uploadId }),
    }).catch(() => {});
    throw e;
  }
}

// Office 系列交给微软 Office Online Viewer 渲染（要求文件链接公网可访问）
const OFFICE_MIME = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

// 预览器：按内容类型选择渲染方式；文本类抓取内容展示
function PreviewContent({ item }: { item: FileItem }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 服务端类型缺失（octet-stream）时按扩展名兜底
  const ct =
    item.contentType === "application/octet-stream"
      ? guessContentType(item.name)
      : item.contentType;
  const isText =
    ct.startsWith("text/") ||
    ct === "application/json" ||
    /\.(txt|md|csv|json)$/i.test(item.name);

  useEffect(() => {
    if (!isText) return;
    let alive = true;
    fetch(item.url)
      .then((r) => r.text())
      .then((t) => alive && setText(t))
      .catch(() => alive && setError("内容加载失败"));
    return () => {
      alive = false;
    };
  }, [item, isText]);

  if (ct.startsWith("image/"))
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.url} alt={item.name} style={{ maxWidth: "100%", maxHeight: "60vh",margin:"0 auto" }} />
    );
  if (ct === "application/pdf")
    return <iframe src={item.url} style={{ width: "100%", height: "60vh", border: "none" }} />;
  if (ct.startsWith("video/"))
    return <video src={item.url} controls style={{ width: "100%", maxHeight: "60vh" }} />;
  if (ct.startsWith("audio/"))
    return <audio src={item.url} controls style={{ width: "100%" }} />;
  if (OFFICE_MIME.has(ct)) {
    // 预签名 URL 带查询参数，必须整体编码后作为 src 传给微软查看器
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
      item.url
    )}`;
    return (
      <div>
        <iframe
          src={viewerUrl}
          style={{ width: "100%", height: "60vh", border: "none" }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          由微软 Office Online 提供预览；若显示空白，通常是网络无法访问微软服务或文件过大，请点「下载」查看。
        </Typography.Text>
      </div>
    );
  }
  if (isText)
    return error ? (
      <Typography.Text type="danger">{error}</Typography.Text>
    ) : (
      <pre
        style={{
          maxHeight: "60vh",
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          fontSize: 12,
          background: "rgba(0,0,0,.04)",
          padding: 12,
          borderRadius: 8,
        }}
      >
        {text ?? "加载中…"}
      </pre>
    );

  return (
    <Typography.Text type="secondary">
      该类型（{ct}）不支持在线预览，请下载后查看。
    </Typography.Text>
  );
}

// 文件资源管理：分片上传 / 列表 / 预览 / 下载 / 重命名 / 删除
export default function FileExplorer() {
  const { message, modal } = AntApp.useApp();
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      message.error("加载文件列表失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const customRequest = async (options: UploadRequestOption) => {
    const { file, onSuccess, onError, onProgress } = options;
    const f = file as File;
    try {
      await multipartUpload(f, (percent) =>
        onProgress?.({ percent } as never)
      );
      onSuccess?.({}, f);
      message.success(`上传成功：${f.name}`);
      loadList();
    } catch (e) {
      onError?.(e as Error);
      message.error(`上传失败：${(e as Error).message}`);
    }
  };

  const uploadProps: UploadProps = {
    multiple: true,
    customRequest: customRequest as never,
    showUploadList: false,
  };

  async function handleDelete(item: FileItem) {
    modal.confirm({
      title: "删除文件",
      content: `确定删除「${item.name}」吗？此操作不可恢复。`,
      okButtonProps: { danger: true },
      okText: "删除",
      cancelText: "取消",
      async onOk() {
        const res = await fetch(`/api/files?key=${encodeURIComponent(item.key)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          message.success("已删除");
          loadList();
        } else {
          message.error("删除失败");
        }
      },
    });
  }

  async function handleRename() {
    if (!renameTarget || renaming) return;
    setRenaming(true);
    try {
      const res = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: renameTarget.key, name: renameValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        message.success("已重命名");
        setRenameTarget(null);
        loadList();
      } else {
        message.error((data as { error?: string }).error ?? "重命名失败");
      }
    } catch {
      message.error("重命名失败");
    } finally {
      setRenaming(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Upload.Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
        <p className="ant-upload-hint">
          支持 pdf / Office / 图片 / 压缩包 / 音视频等，自动按 8MB 分片上传，支持大文件
        </p>
      </Upload.Dragger>

      <div className="flex items-center justify-between">
        <Typography.Text strong>云端文件（{items.length}）</Typography.Text>
        <Button icon={<ReloadOutlined />} onClick={loadList} loading={loading}>
          刷新
        </Button>
      </div>

      <Table<FileItem>
        rowKey="key"
        loading={loading}
        dataSource={items}
        // auto：列宽按内容自适应；操作列不给 width，按钮排多宽列就多宽
        tableLayout="auto"
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        columns={[
          {
            title: "文件名",
            dataIndex: "name",
            render: (name: string) => (
              <Typography.Text ellipsis={{ tooltip: name }} style={{ maxWidth: 150 }}>
                {name}
              </Typography.Text>
            ),
          },
          { title: "大小", dataIndex: "size", width: 100, render: formatSize },
          {
            title: "上传者",
            dataIndex: "uploader",
            width: 130,
            render: (u: string) =>
              u ? <Tag color="blue">{u.slice(0, 8)}</Tag> : <Tag>匿名</Tag>,
          },
          {
            title: "上传时间",
            dataIndex: "lastModified",
            render: (t: string | null) => (t ? new Date(t).toLocaleString() : "-"),
          },
          {
            title: "操作",
            key: "action",
            // 不写 width：交给 table-layout: auto 按内容自适应
            render: (_, record) => (
              <Space size={4} wrap={false}>
                <Button
                  type="link"
                  size="small"
                  onClick={() => setPreviewItem(record)}
                >
                  预览
                </Button>
                <Button type="link" size="small" href={record.downloadUrl} target="_blank">
                  下载
                </Button>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setRenameTarget(record);
                    setRenameValue(record.name);
                  }}
                >
                  重命名
                </Button>
                <Button type="link" size="small" danger onClick={() => handleDelete(record)}>
                  删除
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="重命名文件"
        open={renameTarget !== null}
        onOk={handleRename}
        confirmLoading={renaming}
        okText="确定"
        cancelText="取消"
        onCancel={() => setRenameTarget(null)}
        destroyOnHidden
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={handleRename}
          placeholder="输入新文件名（需保留扩展名）"
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          仅改显示名；扩展名需与原文件一致或同为受支持格式。
        </Typography.Text>
      </Modal>

      <Modal
        title={previewItem?.name}
        open={previewItem !== null}
        footer={null}
        width={860}
        centered
        // 预览内容限高，超出部分在弹窗内部滚动，避免撑出视口
        styles={{ body: { maxHeight: "70vh", overflow: "auto" } }}
        onCancel={() => setPreviewItem(null)}
        destroyOnHidden
      >
        {previewItem && <PreviewContent item={previewItem} />}
      </Modal>
    </div>
  );
}
