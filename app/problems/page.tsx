"use client";

import PageLayout from "@/components/PageLayout";
import ProblemList from "@/components/ProblemList";

// 题目列表页：通过游标分页接口逐页浏览题库
export default function ProblemsPage() {
  return (
    <PageLayout
      title="题目列表"
      description="游标分页浏览题库：按数据集筛选，逐页加载，点击条目查看题目详情。"
    >
      <ProblemList />
    </PageLayout>
  );
}
