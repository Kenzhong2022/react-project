import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 题库独立 API：字段与建表.md 的 problems 表一一对应；id / created_at 由数据库维护，不接受写入
// 难度级别：0=简单 1=中等 2=困难
const DIFFICULTY_VALUES = new Set([0, 1, 2]);

// 必填字段：与表结构 NOT NULL 约束一致
const REQUIRED_FIELDS = ["title", "difficulty", "description", "test_cases"] as const;

// 校验并转换请求体，只保留白名单列；返回首个校验错误信息
function sanitize(body: unknown): { row?: Record<string, unknown>; error?: string } {
  if (!body || typeof body !== "object") return { error: "请求数据不合法" };
  const source = body as Record<string, unknown>;
  const row: Record<string, unknown> = {};

  if (source.title !== undefined) {
    const title = String(source.title).trim();
    if (!title) return { error: "题目标题不能为空" };
    row.title = title;
  }
  if (source.difficulty !== undefined) {
    const difficulty = Number(source.difficulty);
    if (!DIFFICULTY_VALUES.has(difficulty)) {
      return { error: "难度必须为 0（简单）/ 1（中等）/ 2（困难）" };
    }
    row.difficulty = difficulty;
  }
  if (source.description !== undefined) {
    const description = String(source.description);
    if (!description.trim()) return { error: "题目描述不能为空" };
    row.description = description;
  }
  if (source.test_cases !== undefined) {
    let parsed = source.test_cases;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return { error: "测试用例必须是合法的 JSON 数组" };
      }
    }
    if (!Array.isArray(parsed)) return { error: "测试用例必须是 JSON 数组" };
    row.test_cases = parsed;
  }
  if (source.reference_code !== undefined) {
    row.reference_code = String(source.reference_code);
  }
  if (source.tags !== undefined) {
    row.tags = String(source.tags);
  }
  return { row };
}

export async function GET() {
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { row, error } = sanitize(await req.json().catch(() => null));
  if (error || !row) {
    return NextResponse.json({ error: error ?? "请求数据不合法" }, { status: 400 });
  }
  const missing = REQUIRED_FIELDS.filter((field) => !(field in row));
  if (missing.length > 0) {
    return NextResponse.json({ error: `缺少必填字段：${missing.join("、")}` }, { status: 400 });
  }

  const { data, error: dbError } = await supabase
    .from("problems")
    .insert(row)
    .select()
    .single();
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const { row, error } = sanitize(await req.json().catch(() => null));
  if (error || !row) {
    return NextResponse.json({ error: error ?? "请求数据不合法" }, { status: 400 });
  }
  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  const { data, error: dbError } = await supabase
    .from("problems")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const { error } = await supabase.from("problems").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
