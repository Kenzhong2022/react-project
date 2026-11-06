import type { ReactNode } from "react";
import {
  AudioOutlined,
  BookOutlined,
  FileDoneOutlined,
  FilePdfOutlined,
  ShoppingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";

export type NavGroup = {
  key: string;
  label: string;
  icon?: ReactNode;
  // 二级菜单项，key 即带 tab 参数的目标路由；description 用于顶部导航弹出面板
  children: { key: string; label: string; description?: string; icon?: ReactNode }[];
};

/**
 * 一级导航配置
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "/home",
    label: "首页",
    children: [
      {
        key: "/home?tab=users",
        label: "用户管理",
        description: "用户信息维护，可关联角色",
        icon: <UserOutlined />,
      },
      {
        key: "/home?tab=roles",
        label: "角色管理",
        description: "角色定义与权限划分",
        icon: <TeamOutlined />,
      },
      {
        key: "/home?tab=products",
        label: "商品管理",
        description: "商品价格与库存维护",
        icon: <ShoppingOutlined />,
      },
    ],
  },
  {
    key: "/files",
    label: "资源中心",
    children: [
      {
        key: "/files?tab=files",
        label: "文件资源管理",
        description: "浏览与管理对象存储文件",
        icon: <FilePdfOutlined />,
      },
      {
        key: "/files?tab=audio",
        label: "音频资源管理",
        description: "音频上传与播放列表",
        icon: <AudioOutlined />,
      },
      {
        key: "/files?tab=questions",
        label: "题库管理",
        description: "题目、测试用例与参考题解的增删改查",
        icon: <BookOutlined />,
      },
      {
        key: "/files?tab=submissions",
        label: "提交管理",
        description: "用户提交代码、评测状态与 Agent 反馈",
        icon: <FileDoneOutlined />,
      },
      {
        key: "/files?tab=placeholder",
        label: "占位符",
        description: "预留的扩展入口",
      },
    ],
  },
];

// 按当前路径找到所属的一级导航，找不到时默认第一个
export function getActiveGroup(pathname: string): NavGroup {
  return (
    NAV_GROUPS.find((group) => pathname.startsWith(group.key)) ?? NAV_GROUPS[0]
  );
}
