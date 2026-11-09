"use client";

import { Suspense, useState } from "react";
import type { ReactNode } from "react";
import { App as AntApp, Button, Layout, Typography, theme } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
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
  backHref,
}: {
  title: string;
  description: string;
  children: ReactNode;
  // 可选返回地址：传入后标题区渲染为「返回列表」链接，点击跳回该地址
  backHref?: string;
}) {
  const router = useRouter();
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
        <Layout style={{ maxHeight: "calc(100vh)" }}>
          {/* TopNav 读取 ?tab= 计算弹出面板高亮，需要 Suspense 边界；fallback 用同尺寸 Header 防止布局跳动 */}
          <Suspense
            fallback={
              <Layout.Header style={{ background: colorBgContainer }} />
            }
          >
            <TopNav
              collapsed={collapsed}
              onToggle={() => setCollapsed(!collapsed)}
            />
          </Suspense>

          <Content
            style={{
              margin: 24,
              padding: 24,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              flex: 1,
              overflow: "auto",
            }}
          >
            {backHref ? (
              // 返回模式：标题区是一个「返回列表」按钮，替代纯文本标题
              <Button
                type="link"
                icon={<ArrowLeftOutlined />}
                onClick={() => router.push(backHref)}
                style={{ paddingInline: 0, fontWeight: 600, fontSize: 18 }}
              >
                返回列表
              </Button>
            ) : (
              <Typography.Title
                level={4}
                style={{ marginTop: 0, marginBottom: 4 }}
              >
                {title}
              </Typography.Title>
            )}
            <Typography.Text type="secondary"> {description}</Typography.Text>
            <div style={{ marginTop: 16 }}>{children}</div>
          </Content>
        </Layout>
      </Layout>
    </AntApp>
  );
}
