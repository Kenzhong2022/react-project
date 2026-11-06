"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { Tag } from "antd";
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

// 题目摘要：仅 id 与标题，用于下拉选项和单元格展示
type ProblemBrief = { id: string | number; title: string };

// 评测状态：沙箱返回的枚举值及展示颜色
const STATUS_META: Record<string, { color: string; label: string }> = {
  AC: { color: "green", label: "通过" },
  WA: { color: "red", label: "答案错误" },
  CE: { color: "orange", label: "编译错误" },
  RE: { color: "volcano", label: "运行错误" },
  TLE: { color: "purple", label: "超时" },
};

const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, meta]) => ({
  value,
  label: `${value}（${meta.label}）`,
}));

const FILTER_FIELDS: FilterField[] = [
  { name: "status", label: "评测状态", type: "select", options: STATUS_OPTIONS },
  { name: "problemTitle", label: "题目标题" },
  { name: "createdAt", label: "提交时间", type: "dateRange" },
];

// 提交管理：submissions 表的增删改查；题目字段关联 problems 表做下拉选择与展示
export default function SubmissionManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [problems, setProblems] = useState<ProblemBrief[]>([]);
  const [filters, setFilters] = useState<FilterValues>({});
  // 组件卸载后不再回写拉取结果
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let cancelled = false;
    (async () => {
      try {
        const [submissions, problems] = await Promise.all([
          fetchRows("submissions"),
          fetchRows("problems"),
        ]);
        if (cancelled) return;
        setRows(submissions);
        setProblems(
          problems.map((p) => ({ id: p.id, title: String(p.title ?? "") }))
        );
      } catch (err) {
        console.error("[submissions] 加载失败", err);
      }
    })();
    return () => {
      cancelled = true;
      cancelledRef.current = true;
    };
  }, []);

  const problemTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of problems) map.set(String(p.id), p.title);
    return map;
  }, [problems]);

  // 题目下拉的选项跟题库数据联动，新增提交时只能选择已有题目
  const fields = useMemo<CrudField[]>(() => {
    const problemOptions = problems.map((p) => ({
      label: `#${p.id} ${p.title}`,
      value: p.id,
    }));
    return [
      {
        name: "problem_id",
        label: "题目",
        type: "select",
        options: problemOptions,
        render: (value) => {
          const title = problemTitleById.get(String(value));
          const idText = String(value);
          return title ? `#${idText} ${title}` : `#${idText}`;
        },
      },
      { name: "user_code", label: "用户代码", type: "textarea" },
      {
        name: "status",
        label: "评测状态",
        type: "select",
        options: STATUS_OPTIONS,
        render: (value) => {
          const meta = STATUS_META[String(value)];
          return meta ? (
            <Tag color={meta.color}>
              {String(value)} · {meta.label}
            </Tag>
          ) : (
            <Tag>{String(value)}</Tag>
          );
        },
      },
      { name: "agent_report", label: "Agent 分析报告", type: "textarea", required: false },
      {
        name: "created_at",
        label: "提交时间",
        editable: false,
        render: (value) => dayjs(String(value)).format("YYYY-MM-DD HH:mm"),
      },
    ];
  }, [problems, problemTitleById]);

  // 点击查询后的可见行；problemTitle 是展示用计算字段，按题目标题过滤
  const visibleRows = useMemo(
    () =>
      rows
        .map((row) => ({
          ...row,
          problemTitle: problemTitleById.get(String(row.problem_id)) ?? "",
        }))
        .filter((row) => matchRow(row, filters)),
    [rows, filters, problemTitleById]
  );

  // 先更新界面，再把差异写回数据库；无论成败都重新拉取，保证拿到服务端规范后的数据（自增 id）
  function persist(previous: Row[], next: Row[]) {
    persistTable("submissions", previous, next)
      .catch((err) => console.error("[submissions] 保存失败", err))
      .finally(() => {
        fetchRows("submissions")
          .then((data) => {
            if (!cancelledRef.current) setRows(data);
          })
          .catch(() => {});
      });
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
        title="提交"
        fields={fields}
        rows={visibleRows}
        onChange={handleRowsChange}
      />
    </div>
  );
}
