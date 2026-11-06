"use client";

import { Button, DatePicker, Form, Input, InputNumber, Select, Space } from "antd";

export type FilterField = {
  name: string;
  label: string;
  // 表单项类型，默认 text
  type?: "text" | "number" | "select" | "dateRange";
  // type=select 时的枚举选项
  options?: { label: string; value: string }[];
  placeholder?: string;
  // 透传给具体 antd 表单组件的属性（如 allowClear、mode、showSearch、onChange 等）
  componentProps?: Record<string, any>;
};

// 筛选值：键为字段名，值为表单项当前值（dateRange 为 dayjs 数组）
export type FilterValues = Record<string, unknown>;

// 按字段配置渲染对应的表单控件
function renderControl(field: FilterField) {
  const { type = "text", placeholder, options, componentProps } = field;
  if (type === "number") {
    return (
      <InputNumber
        style={{ width: "100%" }}
        placeholder={placeholder}
        {...componentProps}
      />
    );
  }
  if (type === "select") {
    return (
      <Select
        style={{ width: "100%" }}
        options={options}
        placeholder={placeholder ?? `请选择${field.label}`}
        allowClear
        {...componentProps}
      />
    );
  }
  if (type === "dateRange") {
    return <DatePicker.RangePicker style={{ width: "100%" }} {...componentProps} />;
  }
  return (
    <Input
      placeholder={placeholder ?? `请输入${field.label}`}
      allowClear
      {...componentProps}
    />
  );
}

// 通用筛选栏：由外部传入字段配置，组件负责渲染表单项；查询/重置时回调
export default function FilterForm({
  fields,
  onSearch,
  loading,
  searchButtonText = "查询",
  resetButtonText = "重置",
}: {
  fields: FilterField[];
  // 点击查询（或表单内回车）时触发；undefined/空串/空数组的条件已剔除
  onSearch: (values: FilterValues) => void;
  loading?: boolean;
  searchButtonText?: string;
  resetButtonText?: string;
}) {
  const [form] = Form.useForm();

  function submit() {
    const raw = form.getFieldsValue() as FilterValues;
    const values: FilterValues = {};
    for (const [key, value] of Object.entries(raw)) {
      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);
      if (!isEmpty) values[key] = value;
    }
    onSearch(values);
  }

  function reset() {
    form.resetFields();
    onSearch({});
  }

  return (
    <Form form={form} onFinish={submit}>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        {fields.map((field) => (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            style={{ marginBottom: 8, minWidth: 200 }}
          >
            {renderControl(field)}
          </Form.Item>
        ))}
        {/* items-end 让按钮与输入框底对齐，空间不足时随表单项一起换行 */}
        <Form.Item style={{ marginBottom: 8 }}>
          <Space>
            <Button onClick={reset}>{resetButtonText}</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {searchButtonText}
            </Button>
          </Space>
        </Form.Item>
      </div>
    </Form>
  );
}
