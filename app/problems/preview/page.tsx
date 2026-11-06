"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Spin, Typography } from "antd";
import ProblemPreview, { type PreviewProblem } from "@/components/ProblemPreview";

// 从 localStorage 读取题库行数据（由题库管理页「预览」按钮写入）
function PreviewSection() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  // undefined 表示仍在读取本地暂存数据；null 表示未找到
  const [problem, setProblem] = useState<PreviewProblem | null | undefined>(undefined);

  useEffect(() => {
    if (!id) {
      setProblem(null);
      return;
    }
    try {
      const raw = window.localStorage.getItem(`problem-preview:${id}`);
      if (!raw) {
        setProblem(null);
        return;
      }
      const row = JSON.parse(raw) as PreviewProblem;
      // 题库列表里 test_cases 以 JSON 字符串暂存，预览时还原为数组
      if (typeof row.test_cases === "string") {
        row.test_cases = JSON.parse(row.test_cases);
      }
      setProblem(row);
    } catch {
      setProblem(null);
    }
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
          未找到题目数据
        </Typography.Title>
        <Typography.Text type="secondary">
          请从题库管理页点击「预览」打开本页面。
        </Typography.Text>
      </div>
    );
  }
  return <ProblemPreview problem={problem} />;
}

// 题目预览页：数据来自题库管理页写入的 localStorage，避免 URL 传大段题面
export default function ProblemPreviewPage() {
  return (
    <Suspense fallback={null}>
      <PreviewSection />
    </Suspense>
  );
}
