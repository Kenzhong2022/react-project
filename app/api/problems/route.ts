import { NextResponse } from "next/server";

/**
 * @description Python 服务端（CodeBenchAgent FastAPI）地址：本地开发默认 8000 端口，部署时通过环境变量覆盖
 */
const API_BASE = process.env.CODEBENCH_API_URL ?? "http://127.0.0.1:8000";

/**
 * @description 难度可选值：与 problems 表的 difficulty 文本列一致
 */
const DIFFICULTY_VALUES = new Set(["简单", "中等", "困难"]);

/**
 * @description 校验并转换请求体，只保留白名单列后转发给 Python 端；test_cases 支持 JSON 字符串入参，统一转为数组
 * @param body 前端传入的原始请求体
 * @returns row 转换后的数据（供转发），或 error 校验错误信息
 */
function sanitize(body: unknown): { row?: Record<string, unknown>; error?: string } {
  if (!body || typeof body !== "object") return { error: "请求数据不合法" };
  const source = body as Record<string, unknown>;
  const row: Record<string, unknown> = {};

  if ("dataset_name" in source) {
    const value = source.dataset_name;
    if (value === null || String(value).trim() === "") {
      return { error: "数据集名称不能为空" };
    }
    row.dataset_name = String(value).trim();
  }
  if ("subset" in source) {
    const value = source.subset;
    row.subset = value === null || String(value).trim() === "" ? null : String(value).trim();
  }
  if ("title" in source) {
    const value = source.title;
    row.title = value === null || String(value).trim() === "" ? null : String(value).trim();
  }
  if ("difficulty" in source) {
    const value = source.difficulty;
    if (value === null || value === "") {
      row.difficulty = null;
    } else {
      const text = String(value);
      if (!DIFFICULTY_VALUES.has(text)) {
        return { error: "难度必须为 简单 / 中等 / 困难" };
      }
      row.difficulty = text;
    }
  }
  if ("prompt" in source) {
    const value = String(source.prompt ?? "");
    if (!value.trim()) return { error: "题目描述不能为空" };
    row.prompt = value;
  }
  if ("test_cases" in source) {
    let parsed = source.test_cases;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return { error: "测试用例必须是合法的 JSON 数组" };
      }
    }
    if (!Array.isArray(parsed)) return { error: "测试用例必须是 JSON 数组" };
    row.test_cases = parsed.map(String);
  }
  if ("reference_solution" in source) {
    const value = source.reference_solution;
    row.reference_solution = value === null ? null : String(value);
  }
  return { row };
}

/**
 * @description 调用 Python 服务端接口（服务器对服务器请求，不涉及浏览器 CORS）
 * @param path Python 端路径（以 / 开头）
 * @param init fetch 配置（method / body 等）
 * @returns ok 是否成功、status HTTP 状态码、body 解析后的 JSON
 */
async function callPython(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store", ...init });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

/**
 * @description 把 Python 端的 FastAPI 错误结构（{detail: ...}）转成前端统一的 {error: ...} 响应
 * @param status Python 端返回的 HTTP 状态码
 * @param body Python 端返回的响应体
 * @returns 统一错误格式的 NextResponse
 */
function errorResponse(status: number, body: unknown): NextResponse {
  const detail = (body as { detail?: string } | null)?.detail;
  return NextResponse.json({ error: detail ?? "Python 服务端请求失败" }, { status });
}

/**
 * @description 获取题目：带 id 时转发单条查询（预览页使用），否则转发列表查询并解包 {count, data} 为数组
 * @param req 前端请求（可带 id / dataset_name / limit / offset 查询参数）
 * @returns 单条题目对象或题目数组
 */
export async function GET(req: Request): Promise<NextResponse> {
  const params = new URL(req.url).searchParams;
  const id = params.get("id");

  if (id) {
    const { ok, status, body } = await callPython(`/api/problems/${id}`);
    return ok ? NextResponse.json(body) : errorResponse(status, body);
  }

  const search = new URLSearchParams();
  const datasetName = params.get("dataset_name");
  if (datasetName) search.set("dataset_name", datasetName);
  // 题库管理页需要全量数据做本地筛选，默认拉取 1000 条
  search.set("limit", params.get("limit") ?? "1000");
  search.set("offset", params.get("offset") ?? "0");

  const { ok, status, body } = await callPython(`/api/problems?${search.toString()}`);
  if (!ok) return errorResponse(status, body);
  const data = (body as { data?: unknown[] } | null)?.data ?? [];
  return NextResponse.json(data);
}

/**
 * @description 新建题目：校验后转发 POST /api/problems，未指定数据集时归入 custom
 * @param req 前端请求，body 为题目字段
 * @returns 创建成功的题目行
 */
export async function POST(req: Request): Promise<NextResponse> {
  const { row, error } = sanitize(await req.json().catch(() => null));
  if (error || !row) {
    return NextResponse.json({ error: error ?? "请求数据不合法" }, { status: 400 });
  }
  if (!("dataset_name" in row)) {
    row.dataset_name = "custom";
  }
  const missing = (["prompt", "test_cases"] as const).filter((field) => !(field in row));
  if (missing.length > 0) {
    return NextResponse.json({ error: `缺少必填字段：${missing.join("、")}` }, { status: 400 });
  }

  const { ok, status, body } = await callPython("/api/problems", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!ok) return errorResponse(status, body);
  return NextResponse.json((body as { data?: unknown } | null)?.data ?? body);
}

/**
 * @description 更新题目：前端走 PATCH，转发为 Python 端的 PUT 局部更新
 * @param req 前端请求，URL 带 id 查询参数，body 为要更新的字段
 * @returns 更新后的题目行
 */
export async function PATCH(req: Request): Promise<NextResponse> {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const { row, error } = sanitize(await req.json().catch(() => null));
  if (error || !row) {
    return NextResponse.json({ error: error ?? "请求数据不合法" }, { status: 400 });
  }
  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  const { ok, status, body } = await callPython(`/api/problems/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!ok) return errorResponse(status, body);
  return NextResponse.json((body as { data?: unknown } | null)?.data ?? body);
}

/**
 * @description 删除题目：转发 DELETE /api/problems/{id}
 * @param req 前端请求，URL 带 id 查询参数
 * @returns 删除成功标记
 */
export async function DELETE(req: Request): Promise<NextResponse> {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const { ok, status, body } = await callPython(`/api/problems/${id}`, { method: "DELETE" });
  if (!ok) return errorResponse(status, body);
  return NextResponse.json({ ok: true });
}
