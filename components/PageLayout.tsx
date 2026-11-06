"use client";

import { Suspense, useState } from "react";
import type { ReactNode } from "react";
import { App as AntApp, Layout, Typography, theme } from "antd";
import { usePathname } from "next/navigation";
import TopNav from "./TopNav";
import SideNav from "./SideNav";
import { getActiveGroup } from "./navConfig";

const { Content, Footer } = Layout;

// 页面骨架：外层左右布局（侧边栏 | 右侧），右侧上下布局（顶栏 / 核心内容 / 页脚）
export default function PageLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const activeGroup = getActiveGroup(pathname);
  // 收缩状态放在最外层，顶部按钮控制、侧边栏消费
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <AntApp>
      {/* 外层：左右布局 */}
      <Layout style={{ minHeight: "100vh" }}>
        <Suspense fallback={<Layout.Sider width={200} theme="light" />}>
          <SideNav
            groupKey={activeGroup.key}
            items={activeGroup.children}
            collapsed={collapsed}
          />
        </Suspense>

        {/* 右侧：上下布局（顶栏 / 内容区 / 页脚） */}
        <Layout>
          {/* TopNav 读取 ?tab= 计算弹出面板高亮，需要 Suspense 边界；fallback 用同尺寸 Header 防止布局跳动 */}
          <Suspense fallback={<Layout.Header style={{ background: colorBgContainer }} />}>
            <TopNav collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
          </Suspense>

          <Content
            style={{
              margin: 24,
              padding: 24,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>
              {title}
            </Typography.Title>
            <Typography.Text type="secondary">{description}</Typography.Text>
            <div style={{ marginTop: 16 }}>{children}</div>
          </Content>

          <Footer style={{ textAlign: "center", background: "transparent" }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              基于 Next.js 16 · React 19 · Ant Design 6 · Cloudflare Workers（OpenNext）
              · Supabase Storage（S3 分片上传）· Neon Postgres 构建
            </Typography.Text>
          </Footer>
        </Layout>
      </Layout>
    </AntApp>
  );
}
