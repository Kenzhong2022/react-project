import { Typography } from "antd";

/**
 * @description 题解面板组件：展示参考题解代码（Agent 生成），无题解时给出占位提示
 */
export default function ProblemSolution({
  referenceSolution,
}: {
  referenceSolution?: string | null;
}) {
  const referenceCode = String(referenceSolution ?? "");
  return (
    <>
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
    </>
  );
}
