"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  ArrowRightOutlined,
  BookOutlined,
  CodeOutlined,
  RocketOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import PageLayout from "@/components/PageLayout";
import ProblemList from "@/components/ProblemList";

// 首页中间区展示的最近题目（与 ProblemList 的列表项字段一致）
type ProblemListItem = {
  id: string | number;
  dataset_name?: string | null;
  title?: string | null;
  difficulty?: string | null;
};

const DIFFICULTY_COLORS: Record<string, string> = {
  简单: "green",
  中等: "orange",
  困难: "red",
};

// CodeAgent 首页：上（横幅）中（快捷入口 + 最近题目）下（页脚说明）
function PracticeHome() {
  const [recent, setRecent] = useState<ProblemListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // 拉取最新一批题目，展示在首页中部
  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch("/api/problems/cursor?limit=6")
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "加载题目失败");
        return body as { items: ProblemListItem[] };
      })
      .then((body) => {
        if (!cancelled) setRecent(body.items);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setRecent([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return (
    <div className="flex flex-col gap-6">
      {/* 上：欢迎横幅 */}
      <div
        className="rounded-xl px-10 py-14 text-white"
        style={{
          background:
            "linear-gradient(135deg, #1d39c4 0%, #1677ff 60%, #36cfc9 100%)",
        }}
      >
        <Typography.Title level={2} style={{ color: "#fff", marginTop: 0 }}>
          CodeAgent 在线练习
        </Typography.Title>
        <Typography.Paragraph
          style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, maxWidth: 560 }}
        >
          浏览题库、在线编码、提交评测——从一道题开始构建你的代码能力。
        </Typography.Paragraph>
        <Space size={12}>
          <Link href="/practice?tab=problems">
            <Button type="primary" ghost icon={<RocketOutlined />}>
              进入题库
            </Button>
          </Link>
          <Button icon={<ThunderboltOutlined />} disabled>
            提交评测（即将上线）
          </Button>
        </Space>
      </div>

      {/* 中：快捷入口卡片 + 最近题目 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card hoverable onClick={() => (window.location.href = "/practice?tab=problems")}>
            <Card.Meta
              avatar={<BookOutlined style={{ fontSize: 28, color: "#1677ff" }} />}
              title="题库浏览"
              description="按数据集筛选，游标分页逐页加载"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card hoverable>
            <Card.Meta
              avatar={<CodeOutlined style={{ fontSize: 28, color: "#52c41a" }} />}
              title="在线编码"
              description="阅读题面与测试用例，完成编码后提交"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card hoverable>
            <Card.Meta
              avatar={<ThunderboltOutlined style={{ fontSize: 28, color: "#faad14" }} />}
              title="自动评测"
              description="服务端运行测试用例并反馈结果（开发中）"
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="最近题目"
        extra={
          <Link href="/practice?tab=problems">
            全部题目 <ArrowRightOutlined />
          </Link>
        }
      >
        {recent === null && !error ? (
          <div className="flex justify-center py-8">
            <Spin />
          </div>
        ) : error ? (
          <Alert
            type="error"
            showIcon
            message="加载失败"
            description={error}
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={() => setReloadTick((t) => t + 1)}>
                重试
              </Button>
            }
          />
        ) : recent!.length === 0 ? (
          <Typography.Text type="secondary">题库暂无题目</Typography.Text>
        ) : (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            {recent!.map((item) => (
              <Link
                key={item.id}
                href={`/practice/${item.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-blue-950"
              >
                <Space wrap size={8}>
                  <span className="font-medium">
                    {item.title || `题目 #${item.id}`}
                  </span>
                  {item.difficulty && DIFFICULTY_COLORS[item.difficulty] ? (
                    <Tag color={DIFFICULTY_COLORS[item.difficulty]} style={{ marginInlineEnd: 0 }}>
                      {item.difficulty}
                    </Tag>
                  ) : null}
                </Space>
                <Typography.Text type="secondary">{item.dataset_name ?? ""}</Typography.Text>
              </Link>
            ))}
          </Space>
        )}
      </Card>

      {/* 下：页脚说明 */}
      <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-5 text-center dark:border-zinc-700">
        <Typography.Text type="secondary">
          CodeAgent · 基于 MBPP 数据集的在线练习平台 · 评测服务由 CodeBenchAgent 提供
        </Typography.Text>
      </div>
    </div>
  );
}

// 由侧边栏子菜单的 tab 参数决定显示首页还是题库列表
function PracticeSection() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  if (tab === "problems") {
    return (
      <ProblemList
        itemHref={(item) => `/practice/${item.id}`}
        actionLabel="开始练习"
      />
    );
  }
  return <PracticeHome />;
}

export default function PracticePage() {
  return (
    <PageLayout
      title="CodeAgent"
      description="在线练习平台：题库浏览、在线编码与自动评测。"
    >
      <Suspense fallback={null}>
        <PracticeSection />
      </Suspense>
    </PageLayout>
  );
}
