"use client";
import { Children, isValidElement, Suspense, useState } from "react";
import type { ReactNode } from "react";

import {
  Avatar,
  Button,
  Col,
  Flex,
  Input,
  Layout,
  Menu,
  Row,
  Space,
  Typography,
  theme,
} from "antd";
import type { MenuProps } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NAV_GROUPS, getActiveGroup } from "./navConfig";

// 弹出面板里的菜单项：标题 + 描述，整体可点击；active 时用主色浅背景高亮
function NavMenuItem({
  title,
  description,
  active,
}: {
  title: string;
  description?: string;
  active?: boolean;
}) {
  return (
    <div className={`nav-popup-item${active ? " active" : ""}`}>
      <Space vertical size={4} style={{ padding: "8px 12px" }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {description && (
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            {description}
          </Typography.Paragraph>
        )}
      </Space>
    </div>
  );
}

// 顶部导航：收缩按钮 + logo + 一级导航（首页 / 资源中心）+ 右侧操作
export default function TopNav({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeGroup = getActiveGroup(pathname);
  // 与 SideNav 同一算法：当前 URL 对应的二级菜单 key，用于弹出面板高亮当前项
  const tab = searchParams.get("tab");
  const currentKey = tab
    ? `${activeGroup.key}?tab=${tab}`
    : activeGroup.children[0]?.key;
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const { token } = theme.useToken();

  // 弹出面板样式：参考 antd mega-menu 示例，用主题 token 保持与整体风格一致
  const popupStyle: React.CSSProperties = {
    padding: token.padding,
    minWidth: 480,
    background: token.colorBgElevated,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
  };

  // 一级菜单：children 换成带描述的大块菜单项，触发 mega-menu 弹出面板
  const navItems: MenuProps["items"] = NAV_GROUPS.map((group) => ({
    key: group.key,
    icon: group.icon,
    label: group.label,
    children: group.children.map((child) => ({
      key: child.key,
      label: (
        <NavMenuItem
          title={child.label}
          description={child.description}
          active={child.key === currentKey}
        />
      ),
    })),
  }));

  // 自定义弹出面板：分组标题 + 两列网格展示子菜单项
  const popupRender: MenuProps["popupRender"] = (_, { item }) => (
    <Flex vertical gap={12} style={popupStyle}>
      <Typography.Title
        level={3}
        style={{
          margin: 0,
          paddingBottom: token.paddingXS,
          borderBottom: `${token.lineWidth}px ${token.lineType} ${token.colorSplit}`,
        }}
      >
        {item.title}
      </Typography.Title>
      <Row gutter={16}>
        {Children.map(item.children as ReactNode, (child) =>
          isValidElement(child) ? (
            <Col span={12} key={child.key}>
              {child}
            </Col>
          ) : null
        )}
      </Row>
    </Flex>
  );

  return (
    <Layout.Header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 24px",
        background: token.colorBgContainer,
      }}
    >
      <Button
        type="text"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={onToggle}
        aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
        style={{ fontSize: 16, width: 40, paddingInline: 8 }}
      />
      <Menu
        mode="horizontal"
        className="top-nav-menu"
        selectedKeys={[activeGroup.key]}
        style={{ flex: 1, minWidth: 0, borderBottom: "none" }}
        items={navItems}
        popupRender={popupRender}
        // 点击一级菜单跳到该分组第一项；点击弹出面板里的子菜单直接跳对应路由
        onClick={({ key }) => {
          if (key.startsWith("/")) {
            router.push(key);
            return;
          }
          const group = NAV_GROUPS.find((item) => item.key === key);
          if (group) router.push(group.children[0].key);
        }}
      />
      <style jsx global>{`
        .nav-popup-item {
          border-radius: ${token.borderRadius}px;
          transition: all ${token.motionDurationMid};
          cursor: pointer;
        }
        .nav-popup-item:hover {
          background: ${token.colorFillTertiary};
        }
        .nav-popup-item.active {
          background: ${token.colorPrimaryBg};
        }
        .nav-popup-item.active:hover {
          background: ${token.colorPrimaryBgHover};
        }
      `}</style>
      {/* 右侧操作区：图标按钮统一用 shape="circle" 的 Button */}
      <Space size={8}>
        {searchOpen ? (
          <Input
            autoFocus
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            // 没输入内容时失焦即收起，避免输入框一直占着位置
            onBlur={() => {
              if (!keyword) setSearchOpen(false);
            }}
          />
        ) : (
          <Button
            type="text"
            shape="circle"
            icon={<SearchOutlined />}
            aria-label="搜索"
            onClick={() => setSearchOpen(true)}
          />
        )}
        <Button
          type="text"
          shape="circle"
          icon={<SettingOutlined />}
          aria-label="设置"
        />
        <Avatar size="small" icon={<UserOutlined />} aria-label="用户头像" />
      </Space>
    </Layout.Header>
  );
}
