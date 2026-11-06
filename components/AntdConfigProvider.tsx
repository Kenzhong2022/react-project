"use client";

import type { ReactNode } from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

// DatePicker 等日期组件的月/星期文案与周起始日来自 dayjs，需与 ConfigProvider 一并设为中文
dayjs.locale("zh-cn");

// 全局 antd 中文文案 + 布局配置
export default function AntdConfigProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        components: {
          Layout: {
            // 顶栏高度显式声明为 64，不依赖组件默认值；TopNav 与 Suspense fallback 共用
            headerHeight: 64,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
