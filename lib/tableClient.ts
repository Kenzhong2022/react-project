import dayjs, { type Dayjs } from "dayjs";
import type { FilterValues } from "@/components/FilterForm";

/**
 * @description 自增主键表的数据行：id 由数据库生成，可能是数字；其余字段值类型不限（如 jsonb 返回数组）
 */
export type TableRow = Record<string, unknown> & { id: string | number };

/**
 * @description 数据源端点：题库与提交记录使用独立路由（app/api/problems、app/api/submissions），其余仍走通用 CRUD API
 */
const ENDPOINTS: Record<string, string> = {
  problems: "/api/problems",
  submissions: "/api/submissions",
};

/**
 * @description 获取指定表的数据源端点路径
 * @param table 表名（problems / submissions / 其他走通用 CRUD 的表）
 * @returns 对应的 API 端点路径
 */
function endpointOf(table: string): string {
  return ENDPOINTS[table] ?? `/api/crud/${table}`;
}

/**
 * @description 从服务端拉取指定表的全部数据行
 * @param table 表名
 * @returns 数据行数组
 */
export async function fetchRows(table: string): Promise<TableRow[]> {
  const res = await fetch(endpointOf(table), { cache: "no-store" });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `加载 ${table} 失败`);
  }
  return res.json();
}

/**
 * @description 向服务端发送单行的写入请求（新增 / 更新 / 删除）
 * @param table 表名
 * @param method HTTP 方法：POST 新增、PATCH 更新、DELETE 删除
 * @param row 写入的行数据（DELETE 时省略）
 * @param id 目标行 id（PATCH / DELETE 时必传）
 * @returns 成功时无返回值；失败时抛出带错误信息的异常
 */
async function sendRow(
  table: string,
  method: "POST" | "PATCH" | "DELETE",
  row?: TableRow,
  id?: string | number
): Promise<void> {
  const url =
    id !== undefined
      ? `${endpointOf(table)}?id=${encodeURIComponent(String(id))}`
      : endpointOf(table);
  const res = await fetch(url, {
    method,
    headers: row ? { "Content-Type": "application/json" } : undefined,
    body: row ? JSON.stringify(row) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `${method} ${table} 失败`);
  }
}

/**
 * @description 对比前后两份数据，得出需要新增、更新、删除的行
 * @param prev 变更前的全量行
 * @param next 变更后的全量行
 * @returns added 需新增、updated 需更新、removed 需删除的行集合
 */
function diffRows(prev: TableRow[], next: TableRow[]): {
  added: TableRow[];
  updated: TableRow[];
  removed: TableRow[];
} {
  const prevById = new Map(prev.map((row) => [String(row.id), row]));
  const nextIds = new Set(next.map((row) => String(row.id)));
  const added: TableRow[] = [];
  const updated: TableRow[] = [];
  const removed: TableRow[] = [];

  for (const row of next) {
    const before = prevById.get(String(row.id));
    if (!before) added.push(row);
    else if (JSON.stringify(before) !== JSON.stringify(row)) updated.push(row);
  }
  for (const row of prev) {
    if (!nextIds.has(String(row.id))) removed.push(row);
  }
  return { added, updated, removed };
}

/**
 * @description 把一次完整的表格变更同步到服务端
 * @param table 表名
 * @param prev 变更前的全量行
 * @param next 变更后的全量行
 * @returns 全部请求完成后 resolve；任一请求失败时 reject
 */
export async function persistTable(
  table: string,
  prev: TableRow[],
  next: TableRow[]
): Promise<void> {
  const { added, updated, removed } = diffRows(prev, next);
  await Promise.all([
    ...added.map((row) => sendRow(table, "POST", row)),
    ...updated.map((row) => sendRow(table, "PATCH", row, row.id)),
    ...removed.map((row) => sendRow(table, "DELETE", undefined, row.id)),
  ]);
}

/**
 * @description 筛选逻辑：matchRow 判断行是否匹配筛选条件，reconcileRows 负责筛选态下的行变更合并
 */

/**
 * @description 通用匹配：createdAt 日期区间单独处理，其余键对行字段做包含匹配
 * @param row 待判断的数据行
 * @param filters 筛选条件（空条件恒通过）
 * @returns 行是否满足全部筛选条件
 */
export function matchRow(row: TableRow, filters: FilterValues): boolean {
  return Object.entries(filters).every(([key, value]) => {
    if (value === undefined || value === null || value === "") return true;
    if (key === "createdAt" && Array.isArray(value)) {
      const [start, end] = value as (Dayjs | null)[];
      if (!start && !end) return true;
      const time = dayjs(String(row.created_at));
      if (start && time.isBefore(start.startOf("day"))) return false;
      if (end && time.isAfter(end.endOf("day"))) return false;
      return true;
    }
    return String(row[key] ?? "")
      .toLowerCase()
      .includes(String(value).toLowerCase());
  });
}

/**
 * @description 筛选激活时 CrudManager 只持有可见行：把可见子集的变更合并回全量数据——被筛选隐藏的行原样保留；之前可见、现在消失的行视为被删除
 * @param full 全量行
 * @param prevVisible 变更前的可见行
 * @param nextVisible 变更后的可见行
 * @returns 合并后的全量行
 */
export function reconcileRows(
  full: TableRow[],
  prevVisible: TableRow[],
  nextVisible: TableRow[]
): TableRow[] {
  const nextById = new Map(nextVisible.map((row) => [String(row.id), row]));
  const prevVisibleIds = new Set(prevVisible.map((row) => String(row.id)));
  return full
    .filter((row) => !prevVisibleIds.has(String(row.id)) || nextById.has(String(row.id)))
    .map((row) => nextById.get(String(row.id)) ?? row);
}
