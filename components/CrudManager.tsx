"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  App as AntApp,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from "antd";

export type CrudField = {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea";
  // type=select 时的枚举选项，限制只能从固定值中选择
  options?: { label: string; value: string | number }[];
  // 表格单元格自定义渲染（状态标签、时间格式化、关联数据展示等）
  render?: (value: unknown, row: Row) => ReactNode;
  // 是否出现在新增/编辑表单里，默认 true；created_at 等仅展示字段设为 false
  editable?: boolean;
  // 是否必填，默认 true
  required?: boolean;
};

// 行数据：自增主键表的 id 是数字，其余字段值类型不限
type Row = Record<string, unknown> & { id: string | number };

// 增删改查动作文案：可按需覆盖，未提供的字段使用默认值
export type CrudActionLabels = {
  create?: string; // 新增按钮 / 弹窗标题
  edit?: string; // 编辑按钮 / 弹窗标题
  remove?: string; // 删除按钮 / 确认框
  save?: string; // 弹窗保存按钮
  cancel?: string; // 弹窗/确认框取消按钮
  actionColumn?: string; // 操作列标题
  export?: string; // 导出按钮
};

const DEFAULT_ACTION_LABELS: Required<CrudActionLabels> = {
  create: "新增",
  edit: "编辑",
  remove: "删除",
  save: "保存",
  cancel: "取消",
  actionColumn: "操作",
  export: "导出",
};

// CSV 单元格转义：含逗号/引号/换行时加引号，内部引号双写
function toCsvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// 通用增删改查表格：支持受控（父组件传入 rows/onChange）或非受控（内部用 initialRows）
export default function CrudManager({
  title,
  fields,
  initialRows,
  rows: controlledRows,
  onChange,
  actionLabels,
  rowActions,
}: {
  title: string;
  fields: CrudField[];
  initialRows?: Row[];
  rows?: Row[];
  onChange?: (rows: Row[]) => void;
  actionLabels?: CrudActionLabels;
  // 操作列的扩展按钮（如「预览」），渲染在编辑/删除之前
  rowActions?: (row: Row) => ReactNode;
}) {
  const labels = { ...DEFAULT_ACTION_LABELS, ...actionLabels };
  const { message, modal } = AntApp.useApp();
  const isControlled = controlledRows !== undefined;

  // 开发告警：同时传 rows 和 initialRows 语义冲突，以受控 rows 为准
  useEffect(() => {
    if (controlledRows !== undefined && initialRows !== undefined) {
      console.warn(
        "[CrudManager] 同时传入了 rows 和 initialRows；组件将以受控的 rows 为准，initialRows 会被忽略。"
      );
    }
  }, [controlledRows, initialRows]);

  // 受控模式：父组件管状态；非受控：自己维护
  const [localRows, setLocalRows] = useState<Row[]>(controlledRows ?? initialRows ?? []);
  const rows = controlledRows ?? localRows;

  // 受控模式下，父组件数据变化同步到本地副本（保证一致性）
  useEffect(() => {
    if (isControlled) setLocalRows(controlledRows as Row[]);
  }, [controlledRows, isControlled]);

  // 非受控模式下，initialRows 变化时同步到本地（解决 tab 切换复用实例、或异步数据后到时 initialRows 不生效的问题）
  useEffect(() => {
    if (!isControlled && initialRows) setLocalRows(initialRows);
  }, [initialRows, isControlled]);
  const setRows = (updater: (prev: Row[]) => Row[]) => {
    const next = updater(rows);
    if (onChange) onChange(next);
    else setLocalRows(next);
  };

  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    setOpen(true);
  }

  // 弹窗打开后再回填/清空表单；此时 Form 已挂载，避免 useForm 未连接告警
  useEffect(() => {
    if (!open) return;
    if (editing) form.setFieldsValue(editing);
    else form.resetFields();
  }, [open, editing, form]);

  async function submit() {
    let values: Record<string, string | number>;
    try {
      values = await form.validateFields();
    } catch {
      // 校验失败：Form.Item 已展示错误提示，无需额外处理
      return;
    }
    if (editing) {
      setRows((prev) =>
        prev.map((row) => (row.id === editing.id ? { ...row, ...values } : row))
      );
      message.success(`已${labels.edit}${title}`);
    } else {
      setRows((prev) => [{ id: `row-${Date.now()}`, ...values }, ...prev]);
      message.success(`已${labels.create}${title}`);
    }
    setOpen(false);
  }

  function remove(row: Row) {
    modal.confirm({
      title: `${labels.remove}${title}`,
      content: fields[0]
        ? `确定${labels.remove}「${row[fields[0].name]}」吗？`
        : `确定${labels.remove}该条${title}吗？`,
      okButtonProps: { danger: true },
      okText: labels.remove,
      cancelText: labels.cancel,
      onOk() {
        setRows((prev) => prev.filter((item) => item.id !== row.id));
        message.success(`已${labels.remove}`);
      },
    });
  }

  // 导出当前数据为 CSV（带 BOM，保证 Excel 打开中文不乱码）
  function exportCsv() {
    const header = fields.map((field) => toCsvCell(field.label)).join(",");
    const body = rows.map((row) =>
      fields.map((field) => toCsvCell(row[field.name])).join(",")
    );
    const csv = [header, ...body].join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.success(`已${labels.export}${title}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Typography.Text strong>
          {title}列表（{rows.length}）
        </Typography.Text>
        <Space>
          <Button onClick={exportCsv}>{labels.export}</Button>
          <Button type="primary" onClick={openCreate}>
            {labels.create}
          </Button>
        </Space>
      </div>

      <Table<Row>
        rowKey="id"
        dataSource={rows}
        tableLayout="auto"
        // 宽度按内容撑开（min-width 100%），列总宽超出容器时出现横向滚动条
        scroll={{ x: "max-content" }}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        columns={[
          ...fields.map((field) => ({
            title: field.label,
            dataIndex: field.name,
            key: field.name,
            render: field.render
              ? (value: unknown, record: Row) => field.render!(value, record)
              : // 长文本字段：单行省略展示，悬停浮层查看全文
                field.type === "textarea"
                ? (value: unknown) => (
                    <Typography.Text ellipsis={{ tooltip: true }} style={{ maxWidth: 240 }}>
                      {String(value ?? "")}
                    </Typography.Text>
                  )
                : undefined,
          })),
          {
            title: labels.actionColumn,
            key: "action",
            // 横向滚动时操作列吸附在右侧
            fixed: "right",
            render: (_, row) => (
              <Space size={4} wrap={false}>
                {rowActions?.(row)}
                <Button type="link" size="small" onClick={() => openEdit(row)}>
                  {labels.edit}
                </Button>
                <Button type="link" size="small" danger onClick={() => remove(row)}>
                  {labels.remove}
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? `${labels.edit}${title}` : `${labels.create}${title}`}
        open={open}
        okText={labels.save}
        cancelText={labels.cancel}
        onOk={submit}
        onCancel={() => setOpen(false)}
        destroyOnHidden
        styles={{ body: { maxHeight: "70vh", overflow: "auto" } }}
      >
        <Form form={form} layout="vertical">
          {fields
            .filter((field) => field.editable !== false)
            .map((field) => (
              <Form.Item
                key={field.name}
                name={field.name}
                label={field.label}
                rules={[
                  {
                    required: field.required ?? true,
                    message: `请输入${field.label}`,
                  },
                ]}
              >
                {field.type === "number" ? (
                  <InputNumber style={{ width: "100%" }} />
                ) : field.type === "select" ? (
                  <Select options={field.options} placeholder={`请选择${field.label}`} />
                ) : field.type === "textarea" ? (
                  <Input.TextArea rows={4} />
                ) : (
                  <Input />
                )}
              </Form.Item>
            ))}
        </Form>
      </Modal>
    </div>
  );
}
