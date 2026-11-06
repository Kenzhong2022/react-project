import { redirect } from "next/navigation";

// 根路径重定向到首页（用户管理标签页）
export default function Home() {
  redirect("/home?tab=users");
}
