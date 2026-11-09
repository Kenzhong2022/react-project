import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Tag, Typography } from "antd";

// 题库数据结构：与 CodeBenchAgent 服务端 problems 表字段一一对应
// MBPP 等数据集的 test_cases 为断言字符串数组（如 "assert add(2,3)==5"）
export type PreviewProblem = {
  id: string | number;
  dataset_name?: string | null;
  subset?: string | null;
  title?: string | null;
  prompt?: string | null;
  difficulty?: string | null;
  test_cases?: string[];
  test_imports?: string[] | null;
  reference_solution?: string | null;
};

// 难度文本 -> 展示样式；未设置的题目降级为灰色标签
const DIFFICULTY_META: Record<string, { label: string; color: string }> = {
  简单: { label: "简单", color: "green" },
  中等: { label: "中等", color: "orange" },
  困难: { label: "困难", color: "red" },
  easy: { label: "简单", color: "green" },
  medium: { label: "中等", color: "orange" },
  hard: { label: "困难", color: "red" },
};

// 行内代码样式
function InlineCode({ children }: { children?: ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.88em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </code>
  );
}

// react-markdown 元素样式映射：段落间距 + 行内/块级代码芯片
const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p style={{ margin: "12px 0" }}>{children}</p>
  ),
  pre: ({ children }: { children?: ReactNode }) => (
    <pre
      className="overflow-x-auto rounded bg-zinc-100 p-3 font-mono text-[13px] leading-6 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
      style={{ margin: "12px 0" }}
    >
      {children}
    </pre>
  ),
  code: ({ className, children }: { className?: string; children?: ReactNode }) =>
    typeof className === "string" && className.includes("language-") ? (
      <>{children}</>
    ) : (
      <InlineCode>{children}</InlineCode>
    ),
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline dark:text-blue-400">
      {children}
    </a>
  ),
};

// 输入/输出值的代码样式展示
function CodeChip({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </code>
  );
}

// 题目预览：LeetCode 风格的左右布局——左侧题面（标题、难度、数据集、描述、测试用例），右侧参考题解
export default function ProblemPreview({ problem }: { problem: PreviewProblem }) {
  const difficulty = DIFFICULTY_META[String(problem.difficulty ?? "").trim().toLowerCase()];
  const dataset = [problem.dataset_name, problem.subset].filter(Boolean).join(" / ");
  const testCases = problem.test_cases ?? [];
  const referenceCode = String(problem.reference_solution ?? "");

  return (
    // 左右布局：左侧题面，右侧题解；窄屏时上下堆叠
    <div className="flex min-h-screen flex-col bg-white dark:bg-zinc-950 lg:flex-row">
      {/* 左侧：题面 */}
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 16 }}>
          {problem.title || `题目 #${problem.id}`}
        </Typography.Title>

        {/* 难度与数据集标签 */}
        <div className="flex flex-wrap items-center gap-2">
          {difficulty ? (
            <Tag color={difficulty.color} style={{ marginInlineEnd: 0 }}>
              {difficulty.label}
            </Tag>
          ) : (
            <Tag style={{ marginInlineEnd: 0 }}>未设置难度</Tag>
          )}
          {dataset && (
            <Tag style={{ marginInlineEnd: 0 }}>{dataset}</Tag>
          )}
        </div>

        {/* 题目描述（Markdown） */}
        <div className="mt-6 text-[15px] leading-7 text-zinc-900 dark:text-zinc-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {problem.prompt ?? ""}
          </ReactMarkdown>
        </div>

        {/* 测试用例（断言形式） */}
        {testCases.length > 0 && (
          <div className="mt-8">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">测试用例：</div>
            <div className="mt-3 flex flex-col gap-2 border-l-2 border-zinc-200 pl-4 dark:border-zinc-700">
              {testCases.map((testCase, index) => (
                <div key={index}>
                  <CodeChip>{String(testCase)}</CodeChip>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 右侧：参考题解（Agent 生成），固定宽度、独立滚动 */}
      <aside className="w-full shrink-0 border-t border-zinc-200 px-6 py-10 dark:border-zinc-800 lg:sticky lg:top-0 lg:h-screen lg:w-[400px] lg:overflow-y-auto lg:border-l lg:border-t-0">
        <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>
          题解
        </Typography.Title>
        {referenceCode.trim() ? (
          <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-4 font-mono text-[13px] leading-6 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
            {referenceCode}
          </pre>
        ) : (
          <Typography.Text type="secondary">暂无参考题解。</Typography.Text>
        )}
      </aside>
    </div>
  );
}
