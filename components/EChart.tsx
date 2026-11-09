"use client";

import { useEffect, useRef } from "react";
import type { ECharts, EChartsOption } from "echarts";

/**
 * @description EChart 组件属性：option 为 ECharts 配置；style/className 控制容器尺寸；notMerge 为 true 时全量替换配置
 */
type EChartProps = {
  option: EChartsOption;
  style?: React.CSSProperties;
  className?: string;
  notMerge?: boolean;
};

/**
 * @description ECharts 的本地 React 封装：客户端挂载后异步加载 echarts 并初始化实例，
 * 通过 ResizeObserver 自适应容器尺寸，option 变化时增量更新，卸载时销毁实例
 */
export default function EChart({ option, style, className, notMerge = false }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  // 始终持有最新 option：异步 init 完成时能拿到当前值，避免首次渲染丢失
  const optionRef = useRef(option);
  optionRef.current = option;

  // 挂载后初始化实例（仅一次），并监听容器尺寸变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    (async () => {
      const echarts = await import("echarts");
      if (disposed) return;
      const chart = echarts.init(container);
      chart.setOption(optionRef.current);
      chartRef.current = chart;
    })();

    const observer = new ResizeObserver(() => chartRef.current?.resize());
    observer.observe(container);

    return () => {
      disposed = true;
      observer.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  // option 更新：增量合并；notMerge 为 true 时全量替换
  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge });
  }, [option, notMerge]);

  return <div ref={containerRef} style={style} className={className} />;
}
