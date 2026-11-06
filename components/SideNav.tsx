"use client";

import type { ReactNode } from "react";
import { Layout, Menu, theme } from "antd";
import { useRouter, useSearchParams } from "next/navigation";

type SideItem = { key: string; label: string; icon?: ReactNode };

// 侧边栏：只负责渲染传入的二级菜单项；收缩状态由顶部传入
export default function SideNav({
  groupKey,
  items,
  collapsed,
}: {
  groupKey: string;
  items: SideItem[];
  collapsed: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const selectedKey = tab ? `${groupKey}?tab=${tab}` : items[0]?.key ?? groupKey;
  const { token } = theme.useToken();

  return (
    <Layout.Sider
      theme="light"
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={200}
    >
      <div style={{ height: "100vh" }}>
        {/* 侧边栏顶部占位条：与顶栏同高，底部分割线对齐 TopNav 的底边 */}
        <div
          style={{
            height: 64,
            borderRight: `${0.1}px ${token.lineType} ${token.colorBorder}`,
          }}
        />
        <Menu
        // key 变化时重建菜单，避免上一组菜单的选中态残留
        key={groupKey}
        theme="light"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={items}
        onClick={({ key }) => router.push(key)}
        />
      </div>
    </Layout.Sider>
  );
}
