import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// 允许访问的表及其列，列定义与 app/home/page.tsx 中的 Row 类型保持一致
// 题库（problems）与提交记录（submissions）已拆分到独立路由 app/api/problems、app/api/submissions
const COLUMNS = {
  roles: ["id", "name", "description"],
  users: ["id", "name", "email", "role"],
  products: ["id", "name", "price", "stock"],
} as const;

type TableKey = keyof typeof COLUMNS;

// 数值列：其余列统一按字符串处理
const NUMBER_COLUMNS = new Set(["price", "stock"]);

function isTableKey(value: string): value is TableKey {
  return value in COLUMNS;
}

// 只保留白名单列并按列类型转换，避免外部传入非法字段
function sanitize(table: TableKey, body: unknown) {
  if (!body || typeof body !== "object") return null;
  const source = body as Record<string, unknown>;
  const row: Record<string, string | number> = {};
  for (const column of COLUMNS[table]) {
    const value = source[column];
    if (value === undefined || value === null) continue;
    if (NUMBER_COLUMNS.has(column)) {
      const num = Number(value);
      if (Number.isNaN(num)) return null;
      row[column] = num;
    } else {
      row[column] = String(value);
    }
  }
  return row;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!isTableKey(table)) {
    return NextResponse.json({ error: "未知数据表" }, { status: 404 });
  }
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!isTableKey(table)) {
    return NextResponse.json({ error: "未知数据表" }, { status: 404 });
  }

  const row = sanitize(table, await req.json().catch(() => null));
  if (!row) return NextResponse.json({ error: "请求数据不合法" }, { status: 400 });

  const { data, error } = await getSupabase().from(table).insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!isTableKey(table)) {
    return NextResponse.json({ error: "未知数据表" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const row = sanitize(table, body);
  const id = (body as Record<string, unknown> | null)?.id;
  if (!row || typeof id !== "string") {
    return NextResponse.json({ error: "请求数据不合法" }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from(table)
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!isTableKey(table)) {
    return NextResponse.json({ error: "未知数据表" }, { status: 404 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const { error } = await getSupabase().from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
