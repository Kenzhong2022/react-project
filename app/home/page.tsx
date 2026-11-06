"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import CrudManager from "@/components/CrudManager";
import FilterForm from "@/components/FilterForm";
import type { CrudField, CrudActionLabels } from "@/components/CrudManager";
import type { FilterField, FilterValues } from "@/components/FilterForm";

type Row = Record<string, unknown> & { id: string | number };

// 与 app/api/crud/[table]/route.ts 的 COLUMNS 一一对应
type TableKey = "roles" | "users" | "products";

const PRODUCT_FIELDS: CrudField[] = [
  { name: "name", label: "商品名称" },
  { name: "price", label: "价格", type: "number" },
  { name: "stock", label: "库存", type: "number" },
];

const ROLE_FIELDS: CrudField[] = [
  { name: "name", label: "角色名称" },
  { name: "description", label: "角色描述" },
];

// 用户表单的角色字段是动态的：角色管理增删改查完后下拉列表跟着变
function getUserFields(roles: Row[]): CrudField[] {
  const roleOptions = roles.map((r) => ({
    label: String(r.name),
    value: String(r.name),
  }));
  return [
    { name: "name", label: "姓名" },
    { name: "email", label: "邮箱" },
    { name: "role", label: "角色", type: "select", options: roleOptions },
  ];
}

async function fetchRows(table: TableKey): Promise<Row[]> {
  const res = await fetch(`/api/crud/${table}`, { cache: "no-store" });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `加载 ${table} 失败`);
  }
  return res.json();
}

async function sendRow(
  table: TableKey,
  method: "POST" | "PATCH" | "DELETE",
  row?: Row,
  id?: string | number
) {
  const url = id !== undefined
    ? `/api/crud/${table}?id=${encodeURIComponent(String(id))}`
    : `/api/crud/${table}`;
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

// 对比前后两份数据，得出需要新增、更新、删除的行
function diffRows(prev: Row[], next: Row[]) {
  const prevById = new Map(prev.map((row) => [row.id, row]));
  const nextIds = new Set(next.map((row) => row.id));
  const added: Row[] = [];
  const updated: Row[] = [];
  const removed: Row[] = [];

  for (const row of next) {
    const before = prevById.get(row.id);
    if (!before) added.push(row);
    else if (JSON.stringify(before) !== JSON.stringify(row)) updated.push(row);
  }
  for (const row of prev) {
    if (!nextIds.has(row.id)) removed.push(row);
  }
  return { added, updated, removed };
}

// 把一次完整的表格变更同步到服务端
async function persistTable(table: TableKey, prev: Row[], next: Row[]) {
  const { added, updated, removed } = diffRows(prev, next);
  await Promise.all([
    ...added.map((row) => sendRow(table, "POST", row)),
    ...updated.map((row) => sendRow(table, "PATCH", row)),
    ...removed.map((row) => sendRow(table, "DELETE", undefined, row.id)),
  ]);
}

// ===== 筛选逻辑 =====

// 通用匹配：特殊键（createdAt/minPrice/maxPrice）单独处理，其余键对行字段做包含匹配
function matchRow(row: Row, filters: FilterValues): boolean {
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
    if (key === "minPrice") return Number(row.price) >= Number(value);
    if (key === "maxPrice") return Number(row.price) <= Number(value);
    return String(row[key] ?? "")
      .toLowerCase()
      .includes(String(value).toLowerCase());
  });
}

// 筛选激活时 CrudManager 只持有可见行：把可见子集的变更合并回全量数据——
// 被筛选隐藏的行原样保留；之前可见、现在消失的行视为被删除
function reconcileRows(full: Row[], prevVisible: Row[], nextVisible: Row[]): Row[] {
  const nextById = new Map(nextVisible.map((row) => [row.id, row]));
  const prevVisibleIds = new Set(prevVisible.map((row) => row.id));
  return full
    .filter((row) => !prevVisibleIds.has(row.id) || nextById.has(row.id))
    .map((row) => nextById.get(row.id) ?? row);
}

// 单个 tab 对应的表格配置，字段与 CrudManager props 对齐
type TabConfig = {
  title: string;
  fields: CrudField[];
  rows: Row[];
  filterFields?: FilterField[];
  onChange?: (next: Row[]) => void;
  actionLabels?: CrudActionLabels;
};
type TabKey = "roles" | "products" | "users";

// 由侧边栏子菜单的 tab 参数决定显示哪张数据表
function DataSection({
  roles,
  users,
  products,
  onRolesChange,
  onUsersChange,
  onProductsChange,
}: {
  roles: Row[];
  users: Row[];
  products: Row[];
  onRolesChange: (next: Row[]) => void;
  onUsersChange: (next: Row[]) => void;
  onProductsChange: (next: Row[]) => void;
}) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const userFields = useMemo(() => getUserFields(roles), [roles]);

  // 每个 tab 独立保存筛选条件，互不影响
  const [filters, setFilters] = useState<Record<TabKey, FilterValues>>({
    users: {},
    roles: {},
    products: {},
  });

  // 筛选字段配置：type 决定渲染 input / select / number / daterange
  const roleFilterOptions = useMemo(
    () => roles.map((r) => ({ label: String(r.name), value: String(r.name) })),
    [roles]
  );
  const filterFields: Record<TabKey, FilterField[]> = {
    roles: [
      { name: "name", label: "角色名称" },
      { name: "description", label: "描述" },
      { name: "createdAt", label: "创建时间", type: "dateRange" },
    ],
    users: [
      { name: "name", label: "姓名" },
      { name: "role", label: "角色", type: "select", options: roleFilterOptions },
      { name: "createdAt", label: "创建时间", type: "dateRange" },
    ],
    products: [
      { name: "name", label: "商品名称" },
      { name: "minPrice", label: "最低价", type: "number" },
      { name: "maxPrice", label: "最高价", type: "number" },
    ],
  };

  // 点击查询后的可见行（matchRow 里为空的条件恒通过）
  const visibleRoles = useMemo(
    () => roles.filter((row) => matchRow(row, filters.roles)),
    [roles, filters.roles]
  );
  const visibleUsers = useMemo(
    () => users.filter((row) => matchRow(row, filters.users)),
    [users, filters.users]
  );
  const visibleProducts = useMemo(
    () => products.filter((row) => matchRow(row, filters.products)),
    [products, filters.products]
  );

  // 用 tab 作 key 的配置表：新增 tab 只需加一条，无需改分支
  const tabConfig: Record<TabKey, TabConfig> = {
    roles: {
      title: "角色",
      fields: ROLE_FIELDS,
      rows: visibleRoles,
      filterFields: filterFields.roles,
      // 筛选激活时 CrudManager 只看到可见行，先合并回全量再交给持久化
      onChange: (next) => onRolesChange(reconcileRows(roles, visibleRoles, next)),
    },
    products: {
      title: "商品",
      fields: PRODUCT_FIELDS,
      rows: visibleProducts,
      filterFields: filterFields.products,
      onChange: (next) =>
        onProductsChange(reconcileRows(products, visibleProducts, next)),
      // 演示动作文案定制：商品场景用“上架/下架”替代“新增/删除”
      actionLabels: { create: "上架", remove: "下架" },
    },
    users: {
      title: "用户",
      fields: userFields,
      rows: visibleUsers,
      filterFields: filterFields.users,
      onChange: (next) => onUsersChange(reconcileRows(users, visibleUsers, next)),
    },
  };

  // tab 非法或为空时回退到用户页
  const key: TabKey = tab && tab in tabConfig ? (tab as TabKey) : "users";
  const config = tabConfig[key];

  return (
    <div className="flex flex-col gap-4">
      <FilterForm
        fields={config.filterFields ?? []}
        onSearch={(values) => setFilters((prev) => ({ ...prev, [key]: values }))}
      />
      <CrudManager {...config} />
    </div>
  );
}

export default function DataPage() {
  const [roles, setRoles] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [products, setProducts] = useState<Row[]>([]);

  // 记录最新的本地状态，避免连续操作时 diff 基于过期快照
  const rolesRef = useRef(roles);
  const usersRef = useRef(users);
  const productsRef = useRef(products);
  useEffect(() => {
    rolesRef.current = roles;
  }, [roles]);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  function applyTable(table: TabKey, rows: Row[]) {
    if (table === "roles") setRoles(rows);
    else if (table === "users") setUsers(rows);
    else setProducts(rows);
  }

  async function reload(table: TabKey) {
    applyTable(table, await fetchRows(table));
  }

  // 首次加载：三张表一次性拉取
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, u, p] = await Promise.all([
          fetchRows("roles"),
          fetchRows("users"),
          fetchRows("products"),
        ]);
        if (cancelled) return;
        setRoles(r);
        setUsers(u);
        setProducts(p);
      } catch (err) {
        console.error("[data] 加载失败", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 先更新界面，再把差异写回数据库；失败时重新拉取以对齐真实数据
  function persist(table: TabKey, prev: Row[], next: Row[]) {
    persistTable(table, prev, next).catch(async (err) => {
      console.error(`[${table}] 保存失败`, err);
      await reload(table).catch(() => {});
    });
  }

  // 删除角色时，把引用该角色的用户记录的角色字段清空，避免悬空引用
  function handleRolesChange(next: Row[]) {
    const previous = rolesRef.current;
    const removedNames = previous
      .filter((r) => !next.find((n) => n.id === r.id))
      .map((r) => String(r.name));

    setRoles(next);
    persist("roles", previous, next);

    if (removedNames.length > 0) {
      const previousUsers = usersRef.current;
      const nextUsers = previousUsers.map((u) =>
        removedNames.includes(String(u.role)) ? { ...u, role: "" } : u
      );
      setUsers(nextUsers);
      persist("users", previousUsers, nextUsers);
    }
  }

  function handleUsersChange(next: Row[]) {
    const previous = usersRef.current;
    setUsers(next);
    persist("users", previous, next);
  }

  function handleProductsChange(next: Row[]) {
    const previous = productsRef.current;
    setProducts(next);
    persist("products", previous, next);
  }

  return (
    <PageLayout
      title="首页"
      description="用户、角色与商品的基础增删改查；数据持久化在 Supabase，角色管理的改动会实时反映到用户管理的角色下拉列表。"
    >
      <Suspense fallback={null}>
        <DataSection
          roles={roles}
          users={users}
          products={products}
          onRolesChange={handleRolesChange}
          onUsersChange={handleUsersChange}
          onProductsChange={handleProductsChange}
        />
      </Suspense>
    </PageLayout>
  );
}
