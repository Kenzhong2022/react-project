"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AudioItem = {
  key: string;
  name: string;
  uploader: string;
  size: number;
  lastModified: string | null;
  url: string;
};

// 设备唯一标志：首次访问生成并存 localStorage，用于标识上传者
function getClientId(): string {
  if (typeof window === "undefined") return "anonymous";
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
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function displayName(key: string): string {
  // key 形如 audio/1793781419068-____.m4a，去掉前缀和时间戳（原名在列表接口返回）
  const name = key.replace(/^audio\//, "").replace(/^\d+-/, "");
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export default function AudioManager() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [items, setItems] = useState<AudioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<AudioItem | null>(null);
  const [editing, setEditing] = useState<AudioItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audio");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function handleUpload() {
    if (!file || uploading) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("clientId", getClientId());
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      let data: { success?: boolean; error?: string; key?: string } = {};
      try {
        data = await res.json();
      } catch {
        // 服务端返回非 JSON（如空响应的 500）
      }
      if (!res.ok || !data.success) {
        setUploadMsg(`上传失败：HTTP ${res.status}${data.error ? ` - ${data.error}` : ""}`);
        return;
      }
      setUploadMsg(`上传成功：${displayName(data.key ?? "")}`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await loadList();
    } catch (e) {
      setUploadMsg(`上传失败：${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item: AudioItem) {
    if (busy || !window.confirm(`确定删除「${item.name}」吗？此操作不可恢复。`))
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/audio?key=${encodeURIComponent(item.key)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (current?.key === item.key) setCurrent(null);
        await loadList();
      } else {
        const data = await res.json().catch(() => ({}));
        setUploadMsg(
          `删除失败：${(data as { error?: string }).error ?? res.status}`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!editing || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/audio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: editing.key, name: editValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditing(null);
        await loadList();
      } else {
        setUploadMsg(
          `重命名失败：${(data as { error?: string }).error ?? res.status}`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 py-2">
      {/* 上传区 */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col gap-4">
        <h2 className="font-medium">上传音频</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setUploadMsg(null);
            }}
            className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-zinc-900 dark:file:bg-zinc-100 file:px-4 file:py-2 file:text-sm file:text-white dark:file:text-black file:cursor-pointer"
          />
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="h-10 rounded-full bg-zinc-900 dark:bg-zinc-100 px-5 text-sm font-medium text-white dark:text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            {uploading ? "上传中…" : "上传"}
          </button>
        </div>
        {file && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            已选择：{file.name}（{formatSize(file.size)}）
          </p>
        )}
        {uploadMsg && (
          <p
            className={`text-sm ${
              uploadMsg.startsWith("上传成功")
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {uploadMsg}
          </p>
        )}
      </section>

      {/* 列表区 */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">音频列表（{items.length}）</h2>
          <button
            onClick={loadList}
            disabled={loading}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-40 cursor-pointer"
          >
            {loading ? "加载中…" : "刷新"}
          </button>
        </div>

        {!loading && items.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            还没有音频，先上传一个吧。
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.key}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-5 py-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {editing?.key === item.key ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename();
                          if (e.key === "Escape") setEditing(null);
                        }}
                        autoFocus
                        className="h-8 flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm"
                        placeholder="新文件名（需保留扩展名）"
                      />
                      <button
                        onClick={handleRename}
                        disabled={busy}
                        className="h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 px-3 text-xs text-white dark:text-black disabled:opacity-40 cursor-pointer"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="h-8 rounded-full border border-zinc-300 dark:border-zinc-700 px-3 text-xs cursor-pointer"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="truncate text-sm font-medium">
                        {item.name}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatSize(item.size)}
                        {item.lastModified &&
                          ` · ${new Date(item.lastModified).toLocaleString()}`}
                        {item.uploader &&
                          ` · 上传者 ${item.uploader.slice(0, 8)}`}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {editing?.key !== item.key && (
                    <>
                      <button
                        onClick={() => {
                          setEditing(item);
                          setEditValue(item.name);
                        }}
                        disabled={busy}
                        className="h-9 rounded-full border border-zinc-300 dark:border-zinc-700 px-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40 cursor-pointer"
                      >
                        重命名
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={busy}
                        className="h-9 rounded-full border border-red-300 dark:border-red-900 px-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-40 cursor-pointer"
                      >
                        删除
                      </button>
                      <button
                        onClick={() =>
                          setCurrent(current?.key === item.key ? null : item)
                        }
                        className="h-9 rounded-full border border-zinc-300 dark:border-zinc-700 px-4 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
                      >
                        {current?.key === item.key ? "收起" : "播放"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {current?.key === item.key && (
                <audio
                  controls
                  autoPlay
                  src={item.url}
                  className="w-full mt-1"
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
