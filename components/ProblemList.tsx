"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Alert, Button, Empty, List, Select, Space, Spin, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

/**
 * @description 游标分页接口返回的题目列表项：轻量字段，不含题面与题解长文本
 */
type ProblemListItem = {
  id: string | number;
  dataset_name?: string | null;
  subset?: string | null;
  title?: string | null;
  difficulty?: string | null;
  created_at?: string | null;
};

/**
 * @description 题目列表接口返回结构：items 当前页数据；has_more 是否还有下一页；next_cursor 下一页游标
 */
type ProblemPage = {
  items: ProblemListItem[];
  has_more: boolean;
  next_cursor: string | number | null;
};

const DIFFICULTY_COLORS: Record<string, string> = {
  简单: "green",
  中等: "orange",
  困难: "red",
};

const PAGE_SIZE = 20;

const DATASET_OPTIONS = [
  { label: "mbpp", value: "mbpp" },
  { label: "custom", value: "custom" },
];

/**
 * @description 按游标拉取一页题目列表
 * @param nextCursor 下一页游标（首页传 null）
 * @param datasetName 数据集筛选（可选）
 * @returns 当前页题目、has_more 与 next_cursor
 */
async function fetchPage(
  nextCursor: string | number | null,
  datasetName?: string
): Promise<ProblemPage> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (nextCursor !== null) params.set("cursor", String(nextCursor));
  if (datasetName) params.set("dataset_name", datasetName);
  const res = await fetch(`/api/problems/cursor?${params.toString()}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body as { error?: string } | null)?.error ?? "加载题目失败");
  }
  return body as ProblemPage;
}

/**
 * @description 题目列表页内容：游标分页逐页加载，支持按数据集筛选，点击条目跳转预览页
 */
export default function ProblemList() {
  const [items, setItems] = useState<ProblemListItem[]>([]);
  const [cursor, setCursor] = useState<string | number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dataset, setDataset] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 手动重试计数：值变化触发重新拉取首页
  const [reloadTick, setReloadTick] = useState(0);

  // 首次加载与切换数据集时重置列表，重新从第一页拉取
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage(null, dataset)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.next_cursor);
        setHasMore(page.has_more);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataset, reloadTick]);

  /**
   * @description 加载下一页并追加到列表尾部
   */
  async function loadMore() {
    if (cursor === null || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchPage(cursor, dataset);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.next_cursor);
      setHasMore(page.has_more);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spin />
      </div>
    );
  }

  if (error) {
    return (
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
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 筛选区：按数据集筛选，切换后从第一页重新加载 */}
      <Space wrap>
        <Select
          style={{ width: 160 }}
          placeholder="全部数据集"
          allowClear
          options={DATASET_OPTIONS}
          value={dataset}
          onChange={(value) => setDataset(value)}
        />
        <Typography.Text type="secondary">已加载 {items.length} 题</Typography.Text>
      </Space>

      {items.length === 0 ? (
        <Empty description="暂无题目" />
      ) : (
        <List
          dataSource={items}
          renderItem={(item) => (
            <List.Item
              actions={[
                <a key="preview" href={`/problems/preview?id=${item.id}`} target="_blank" rel="noreferrer">
                  预览
                </a>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space wrap size={8}>
                    <span>#{item.id}</span>
                    <span>{item.title || `题目 #${item.id}`}</span>
                    {item.difficulty && DIFFICULTY_COLORS[item.difficulty] ? (
                      <Tag color={DIFFICULTY_COLORS[item.difficulty]} style={{ marginInlineEnd: 0 }}>
                        {item.difficulty}
                      </Tag>
                    ) : null}
                    {[item.dataset_name, item.subset].filter(Boolean).join(" / ") && (
                      <Tag style={{ marginInlineEnd: 0 }}>
                        {[item.dataset_name, item.subset].filter(Boolean).join(" / ")}
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  item.created_at
                    ? `创建于 ${dayjs(item.created_at).format("YYYY-MM-DD HH:mm")}`
                    : undefined
                }
              />
            </List.Item>
          )}
        />
      )}

      {/* 加载更多：游标分页由服务端控制是否有下一页 */}
      {hasMore && (
        <Button loading={loadingMore} onClick={loadMore}>
          加载更多
        </Button>
      )}
    </div>
  );
}
