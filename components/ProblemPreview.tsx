import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Tag, Typography } from "antd";

// 预览数据结构：test_cases 与建表.md 中定义的 JSON 数组一致
export type PreviewTestCase = {
  input?: string;
  output?: string;
  is_example?: boolean;
  explanation?: string;
};

export type PreviewProblem = {
  id: string | number;
  title?: string;
  difficulty?: number;
  description?: string;
  test_cases?: PreviewTestCase[];
  reference_code?: string;
  tags?: string;
};

const DIFFICULTY_META = [
  { label: "简单", color: "green" },
  { label: "中等", color: "orange" },
  { label: "困难", color: "red" },
];

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

// 题目预览：LeetCode 风格的左右布局——左侧题面（标题、难度、标签、描述、示例），右侧参考题解
// 仅展示 is_example=true 的示例；隐藏评测点不在预览中呈现
export default function ProblemPreview({ problem }: { problem: PreviewProblem }) {
  const difficultyIndex =
    Number(problem.difficulty) >= 0 && Number(problem.difficulty) < DIFFICULTY_META.length
      ? Number(problem.difficulty)
      : 0;
  const difficulty = DIFFICULTY_META[difficultyIndex];
  const tags = String(problem.tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
  const examples = (problem.test_cases ?? []).filter((caseItem) => caseItem.is_example);
  const referenceCode = String(problem.reference_code ?? "");

  return (
    // 左右布局：左侧题面，右侧题解；窄屏时上下堆叠
    <div className="flex min-h-screen flex-col bg-white dark:bg-zinc-950 lg:flex-row">
      {/* 左侧：题面 */}
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 16 }}>
          {problem.title}
        </Typography.Title>

        {/* 难度与知识点标签 */}
        <div className="flex flex-wrap items-center gap-2">
          <Tag color={difficulty.color} style={{ marginInlineEnd: 0 }}>
            {difficulty.label}
          </Tag>
          {tags.map((tag) => (
            <Tag key={tag} style={{ marginInlineEnd: 0 }}>
              {tag}
            </Tag>
          ))}
        </div>

        {/* 题目描述（Markdown） */}
        <div className="mt-6 text-[15px] leading-7 text-zinc-900 dark:text-zinc-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {problem.description ?? ""}
          </ReactMarkdown>
        </div>

        {/* 示例 */}
        {examples.map((example, index) => (
          <div key={index} className="mt-8">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              示例 {index + 1}：
            </div>
            <div className="mt-3 flex flex-col gap-1.5 border-l-2 border-zinc-200 pl-4 text-[14px] leading-6 dark:border-zinc-700">
              <div>
                <span className="font-semibold">输入：</span>
                <CodeChip>{example.input}</CodeChip>
              </div>
              <div>
                <span className="font-semibold">输出：</span>
                <CodeChip>{example.output}</CodeChip>
              </div>
              {example.explanation && (
                <div className="whitespace-pre-wrap [&>p]:m-0">
                  <span className="font-semibold">解释：</span>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {example.explanation}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
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
