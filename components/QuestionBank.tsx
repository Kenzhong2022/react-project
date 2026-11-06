"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Button, Tag } from "antd";
import CrudManager from "@/components/CrudManager";
import FilterForm from "@/components/FilterForm";
import type { CrudField } from "@/components/CrudManager";
import type { FilterField, FilterValues } from "@/components/FilterForm";
import {
  fetchRows,
  matchRow,
  persistTable,
  reconcileRows,
  type TableRow,
} from "@/lib/tableClient";

type Row = TableRow;

const DIFFICULTY_LABELS = ["简单", "中等", "困难"];
const DIFFICULTY_COLORS = ["green", "orange", "red"];

// 表单字段：difficulty 用数字 0/1/2 存储，与数据库难度列一致
const FORM_FIELDS: CrudField[] = [
  { name: "title", label: "题目标题" },
  {
    name: "difficulty",
    label: "难度",
    type: "select",
    options: DIFFICULTY_LABELS.map((label, value) => ({ label, value })),
    render: (value) => {
      const level = Number(value);
      const index = level >= 0 && level < DIFFICULTY_LABELS.length ? level : 0;
      return <Tag color={DIFFICULTY_COLORS[index]}>{DIFFICULTY_LABELS[index]}</Tag>;
    },
  },
  { name: "description", label: "题目描述（Markdown）", type: "textarea" },
  { name: "test_cases", label: "测试用例（JSON 数组）", type: "textarea" },
  { name: "reference_code", label: "参考题解", type: "textarea", required: false },
  { name: "tags", label: "知识点标签（逗号分隔）", required: false },
  {
    name: "created_at",
    label: "创建时间",
    editable: false,
    render: (value) => dayjs(String(value)).format("YYYY-MM-DD HH:mm"),
  },
];

const FILTER_FIELDS: FilterField[] = [
  { name: "title", label: "题目标题" },
  {
    name: "difficulty",
    label: "难度",
    type: "select",
    options: DIFFICULTY_LABELS.map((label, value) => ({ label, value: String(value) })),
  },
  { name: "tags", label: "标签" },
  { name: "createdAt", label: "创建时间", type: "dateRange" },
];

// test_cases 服务端返回 JSON 数组，统一转成字符串便于表格展示与表单回填
function normalizeRow(row: Row): Row {
  return { ...row, test_cases: JSON.stringify(row.test_cases ?? []) };
}

// 把当前行数据暂存到 localStorage，供预览页在新标签页读取
function openPreview(row: Row) {
  window.localStorage.setItem(`problem-preview:${row.id}`, JSON.stringify(row));
  window.open(`/problems/preview?id=${row.id}`, "_blank");
}

// 题库管理：problems 表的增删改查；题目描述、测试用例与参考题解为长文本
export default function QuestionBank() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filters, setFilters] = useState<FilterValues>({});

  async function reload() {
    const data = await fetchRows("problems");
    setRows(data.map(normalizeRow));
  }

  useEffect(() => {
    reload().catch((err) => console.error("[problems] 加载失败", err));
  }, []);

  // 点击查询后的可见行（matchRow 里为空的条件恒通过）
  const visibleRows = useMemo(
    () => rows.filter((row) => matchRow(row, filters)),
    [rows, filters]
  );

  // 先更新界面，再把差异写回数据库；无论成败都重新拉取，保证拿到服务端规范后的数据（自增 id、JSON 列）
  function persist(previous: Row[], next: Row[]) {
    persistTable("problems", previous, next)
      .catch((err) => console.error("[problems] 保存失败", err))
      .finally(() => reload().catch(() => {}));
  }

  function handleRowsChange(nextVisible: Row[]) {
    const previous = rows;
    const next = reconcileRows(previous, visibleRows, nextVisible);
    setRows(next);
    persist(previous, next);
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterForm
        fields={FILTER_FIELDS}
        onSearch={(values) => setFilters(values)}
      />
      <CrudManager
        title="题目"
        fields={FORM_FIELDS}
        rows={visibleRows}
        onChange={handleRowsChange}
        rowActions={(row) => (
          <Button type="link" size="small" onClick={() => openPreview(row)}>
            预览
          </Button>
        )}
      />
    </div>
  );
}
