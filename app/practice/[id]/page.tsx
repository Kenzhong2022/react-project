"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Spin } from "antd";
import PageLayout from "@/components/PageLayout";
import type { PreviewProblem } from "@/components/ProblemStatement";
import ProblemStatement from "@/components/ProblemStatement";

// CodeAgent 练习页：按路由中的题目 id 拉取题库，展示与预览页一致的题面布局
export default function PracticeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  // undefined 表示仍在请求中；null 表示未找到
  const [problem, setProblem] = useState<PreviewProblem | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!id) {
      setProblem(null);
      return;
    }
    setProblem(undefined);
    setError(null);
    fetch(`/api/problems?id=${encodeURIComponent(String(id))}`)
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
  }, [id, reloadTick]);

  if (problem === undefined) {
    return (
      <PageLayout title="在线练习" description="正在加载题目…">
        <div className="flex justify-center py-24">
          <Spin />
        </div>
      </PageLayout>
    );
  }
  if (!problem) {
    return (
      <PageLayout title="在线练习" description="加载失败或题目不存在。">
        <Alert
          type="error"
          showIcon
          message={error ?? "未找到题目数据"}
          description="请从 CodeAgent 题库列表重新进入。"
          action={
            <Button size="small" onClick={() => setReloadTick((t) => t + 1)}>
              重试
            </Button>
          }
        />
      </PageLayout>
    );
  }
  // 练习页只展示题面与测试用例；参考题解只在预览页提供，避免练习时直接看到答案
  return (
    <PageLayout
      title={problem.title || `题目 #${problem.id}`}
      description="在线练习：阅读题面与测试用例，完成编码后提交评测。"
      backHref="/practice?tab=problems"
    >
      <ProblemStatement problem={problem} />
    </PageLayout>
  );
}
