"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Typography } from "antd";
import PageLayout from "@/components/PageLayout";
import AudioManager from "@/components/AudioManager";
import FileExplorer from "@/components/FileExplorer";
import QuestionBank from "@/components/QuestionBank";
import SubmissionManager from "@/components/SubmissionManager";

// 待开发功能的占位内容
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

// 由侧边栏子菜单的 tab 参数决定显示哪块资源管理功能
function ResourceSection() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  if (tab === "audio") return <AudioManager />;
  if (tab === "questions") return <QuestionBank />;
  if (tab === "submissions") return <SubmissionManager />;
  if (tab === "placeholder") return <Placeholder title="占位符" />;
  return <FileExplorer />;
}

export default function FilesPage() {
  return (
    <PageLayout
      title="资源中心"
      description="上传、预览、下载与管理文件、音频资源，维护题库与提交记录；通过左侧子菜单切换具体功能。"
    >
      <Suspense fallback={null}>
        <ResourceSection />
      </Suspense>
    </PageLayout>
  );
}
