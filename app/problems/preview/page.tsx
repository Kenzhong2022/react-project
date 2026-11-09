"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Spin, Typography } from "antd";
import ProblemPreview, { type PreviewProblem } from "@/components/ProblemPreview";

// 通过 /api/problems?id=xxx 按需拉取题库数据
function PreviewSection() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  // undefined 表示仍在请求中；null 表示未找到
  const [problem, setProblem] = useState<PreviewProblem | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setProblem(null);
      return;
    }
    setProblem(undefined);
    setError(null);
    fetch(`/api/problems?id=${encodeURIComponent(id)}`)
      .then(async (res) => {
        const detail = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(detail?.error ?? "加载题目失败");
        }
        setProblem(detail as PreviewProblem);
      })
      .catch((err: Error) => {
        setError(err.message);
        setProblem(null);
      });
  }, [id]);

  if (problem === undefined) {
    return (
      <div className="flex justify-center py-24">
        <Spin />
      </div>
    );
  }
  if (!problem) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24">
        <Typography.Title level={4} type="secondary" style={{ marginBottom: 0 }}>
          {error ?? "未找到题目数据"}
        </Typography.Title>
        <Typography.Text type="secondary">
          请从题库管理页点击「预览」打开本页面。
        </Typography.Text>
      </div>
    );
  }
  return <ProblemPreview problem={problem} />;
}

// 题目预览页：按 URL 中的 id 从服务端题库接口拉取数据
export default function ProblemPreviewPage() {
  return (
    <Suspense fallback={null}>
      <PreviewSection />
    </Suspense>
  );
}
