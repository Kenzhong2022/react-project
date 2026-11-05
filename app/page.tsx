import { redirect } from "next/navigation";

// 音频资源管理已并入 /files 的标签页，根路径重定向过去
export default function Home() {
  redirect("/files?tab=audio");
}
