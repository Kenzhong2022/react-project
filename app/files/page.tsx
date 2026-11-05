"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { App as AntApp, Tabs, Typography } from "antd";
import AudioManager from "@/components/AudioManager";
import FileExplorer from "@/components/FileExplorer";

// 待开发功能的占位标签页
function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 py-20">
      <Typography.Title level={4} type="secondary" style={{ marginBottom: 0 }}>
        {title}
      </Typography.Title>
      <Typography.Text type="secondary">此功能正在规划中，敬请期待。</Typography.Text>
    </div>
  );
}

function ManageTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // tab 参数与标签页一一对应：files=文件资源管理，audio=音频资源管理，placeholder=占位
  const tabParam = searchParams.get("tab");
  const tab = tabParam === "audio" || tabParam === "placeholder" ? tabParam : "files";

  return (
    <Tabs
      activeKey={tab}
      onChange={(k) => router.push(`/files?tab=${k}`)}
      items={[
        {
          key: "files",
          label: "文件资源管理",
          children: <FileExplorer />,
        },
        {
          key: "audio",
          label: "音频资源管理",
          children: <AudioManager />,
        },
        {
          key: "placeholder",
          label: "占位符",
          children: <Placeholder title="占位符" />,
        },
      ]}
    />
  );
}

export default function FilesPage() {
  return (
    <AntApp>
      <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 py-10">
          <header className="mb-6">
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              文件管理
            </Typography.Title>
            <Typography.Text type="secondary">
              大文件分片上传至 Supabase Storage，切换标签页使用不同功能。
            </Typography.Text>
          </header>
          <Suspense fallback={null}>
            <ManageTabs />
          </Suspense>
        </main>
      </div>
    </AntApp>
  );
}
