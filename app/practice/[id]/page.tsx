"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, App, Button, Spin } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import PageLayout from "@/components/PageLayout";
import type { PreviewProblem } from "@/components/ProblemStatement";
import ProblemStatement from "@/components/ProblemStatement";
import CodeEditor from "@/components/CodeEditor";

// 练习页默认代码模板：作答入口，占位 TODO 引导用户书写
const DEFAULT_CODE =
  "def solution():\n    # TODO: 在这里编写你的解答\n    pass\n";

// CodeAgent 练习页：按路由中的题目 id 拉取题库，展示与预览页一致的题面布局
export default function PracticeDetailPage() {
  const { message } = App.useApp();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  // undefined 表示仍在请求中；null 表示未找到
  const [problem, setProblem] = useState<PreviewProblem | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // 作答代码：切换题目时重置为默认模板
  const [code, setCode] = useState(DEFAULT_CODE);

  useEffect(() => {
    if (!id) {
      setProblem(null);
      return;
    }
    setProblem(undefined);
    setError(null);
    setCode(DEFAULT_CODE);
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
  /**
   * @description 提交当前代码进行评测；评测服务尚未上线，先提示占位反馈
   */
  function handleSubmit() {
    if (!code.trim()) {
      message.warning("代码为空，请先编写解答");
      return;
    }
    message.info("评测服务即将上线，代码已记录");
  }

  // 左右布局：左侧题面与测试用例，右侧代码编辑区；窄屏时上下堆叠
  return (
    <PageLayout
      title={problem.title || `题目 #${problem.id}`}
      description="在线练习：阅读题面与测试用例，完成编码后提交评测。"
      backHref="/practice?tab=problems"
    >
      <div className="flex flex-col lg:flex-row">
        {/* 左侧：题面 */}
        <ProblemStatement problem={problem} />

        {/* 右侧：代码编辑区，独立滚动 */}
        <aside className="w-full shrink-0 border-t border-zinc-200 px-6 py-10 dark:border-zinc-800 lg:sticky lg:top-0 lg:h-screen lg:w-[520px] lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="mt-3 relative">
            <CodeEditor value={code} onChange={setCode} language="python" />
            <div className="mt-4 flex items-center justify-between absolute bottom-4 right-4 left-4">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Python
              </span>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleSubmit}
              >
                提交评测
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </PageLayout>
  );
}
