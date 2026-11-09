# Supabase 数据库连接指南

> 适用项目：react-project（Next.js + Supabase）。阅读本文后，你可以用项目提供的两个环境变量连接团队数据库并进行增删改查。

## 1. 你会拿到两个变量

```bash
SUPABASE_URL=https://krgaimtoeuorzifkahsk.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxx
```

| 变量 | 含义 | 能不能放前端 |
|---|---|---|
| `SUPABASE_URL` | Supabase 项目的 REST API 入口地址 | ✅ 可以（本身公开） |
| `SUPABASE_ANON_KEY` | 匿名（publishable）密钥，标识"哪个项目"，不是个人账号密码 | ✅ 可以（受 RLS 行级安全约束） |

两点说明：

- 这两个值**不是机密**，即使被看到也无法直接登录 Supabase 控制台；真正决定"谁能读写哪些数据"的是数据库的 **RLS（Row Level Security）策略**。
- **不要**把 `service_role` 密钥提交进仓库或放前端，那个是绕过一切安全策略的超级密钥。

## 2. 环境准备

1. 安装 Node.js 18+ 和依赖：

```bash
npm install
```

2. 在项目根目录创建 `.env.local`（此文件已被 gitignore，不会提交），写入上面两个变量：

```bash
# .env.local
SUPABASE_URL=https://krgaimtoeuorzifkahsk.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxx
```

3. 安装 Supabase 客户端库（如未安装）：

```bash
npm install @supabase/supabase-js
```

## 3. 创建客户端

项目里已有封装好的客户端 [lib/supabase.ts](../lib/supabase.ts)，直接复用即可：

```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export default supabase;
```

> ⚠️ `process.env.*` 只能在**服务端**代码（API Route、Server Component）中使用。浏览器代码请通过调用本项目 API（如 `/api/problems`）访问数据，不要自己建客户端直连。

## 4. 常用操作示例

数据库现有 5 张表：`roles`、`users`、`products`、`problems`（题库）、`submissions`（提交记录）。

**查询列表**

```ts
// 查询题库前 20 条
const { data, error } = await supabase
  .from("problems")
  .select("*")
  .order("id", { ascending: false })
  .limit(20);

if (error) throw error;
console.log(data);
```

**按条件查询**

```ts
// 等值过滤 + 模糊搜索
const { data } = await supabase
  .from("problems")
  .select("id, dataset_name, title, difficulty")
  .eq("dataset_name", "mbpp")
  .ilike("title", "%回文%");   // 不区分大小写的模糊匹配
```

**插入**

```ts
const { data, error } = await supabase
  .from("problems")
  .insert({ title: "新题目", prompt: "题面……", test_cases: ["assert f(1) == 1"] })
  .select()      // 返回插入后的行（含数据库生成的 id）
  .single();
```

**更新**

```ts
await supabase
  .from("problems")
  .update({ difficulty: "简单" })
  .eq("id", 42);
```

**删除**

```ts
await supabase.from("problems").delete().eq("id", 42);
```

**通用错误处理约定**

```ts
const { data, error } = await supabase.from("problems").select("*");
if (error) {
  // error.message: 错误描述；error.code: 如 42P10、PGRST116 等
  throw new Error(`查询失败: ${error.message}`);
}
```

## 5. 自测连通性

启动项目后请求一个现有接口，返回 JSON 即代表连接成功：

```bash
npm run dev
curl http://localhost:3000/api/problems
```

或用 Node 快速验证（在项目根目录执行）：

```bash
node -e "import('dotenv').then(d=>{d.config({path:'.env.local'});return import('@supabase/supabase-js')}).then(({createClient})=>{const s=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY);s.from('problems').select('id').limit(1).then(r=>console.log(r.error?'失败:'+r.error.message:'✅ 连接成功'))})"
```

## 6. 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| 请求返回空数组但库里明明有数据 | RLS 策略限制了当前身份的可见行 | 找管理员确认表策略，或用带身份的请求 |
| `Error: supabaseUrl is required` | `.env.local` 没创建 / 变量名拼写错误 | 检查文件名必须是 `.env.local`，变量名大小写一致 |
| 改了 `.env.local` 不生效 | dev server 缓存了旧环境变量 | 重启 `npm run dev` |
| `relation "xxx" does not exist` | 表名拼错 | 表名单复数敏感：`problems` 不是 `problem` |

## 7. 安全提醒

- 所有表当前由管理员统一管理权限策略；**不要**在代码里硬编码密钥，一律走 `.env.local` / 环境变量。
- 若需要新表或修改表结构，请联系管理员在 Supabase 控制台操作，并同步更新本文件。
