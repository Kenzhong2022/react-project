import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 提交记录独立 API：字段与建表.md 的 submissions 表一一对应
// problem_id 与 problems.id 为逻辑关联（不建物理外键）；id / created_at 由数据库维护，不接受写入

// 沙箱评测结果状态：AC(通过) / WA(答案错误) / CE(编译错误) / RE(运行错误) / TLE(超时)
const STATUS_VALUES = new Set(["AC", "WA", "CE", "RE", "TLE"]);

// 必填字段：与表结构 NOT NULL 约束一致
const REQUIRED_FIELDS = ["problem_id", "user_code", "status"] as const;

// 校验并转换请求体，只保留白名单列；返回首个校验错误信息
function sanitize(body: unknown): { row?: Record<string, unknown>; error?: string } {
  if (!body || typeof body !== "object") return { error: "请求数据不合法" };
  const source = body as Record<string, unknown>;
  const row: Record<string, unknown> = {};

  if (source.problem_id !== undefined) {
    const problemId = Number(source.problem_id);
    if (!Number.isInteger(problemId) || problemId <= 0) {
      return { error: "problem_id 必须是正整数" };
    }
    row.problem_id = problemId;
  }
  if (source.user_code !== undefined) {
    const userCode = String(source.user_code);
    if (!userCode.trim()) return { error: "用户代码不能为空" };
    row.user_code = userCode;
  }
  if (source.status !== undefined) {
    const status = String(source.status).toUpperCase();
    if (!STATUS_VALUES.has(status)) {
      return { error: "状态必须为 AC / WA / CE / RE / TLE" };
    }
    row.status = status;
  }
  if (source.agent_report !== undefined) {
    row.agent_report = String(source.agent_report);
  }
  return { row };
}

export async function GET() {
  const { data, error } = await supabase
    .from("submissions")
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
    .from("submissions")
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
    .from("submissions")
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

  const { error } = await supabase.from("submissions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
