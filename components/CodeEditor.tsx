"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";

// 编辑器支持的作答语言（Java 语言包安装 @codemirror/lang-java 后在此扩展）
export type EditorLanguage = "python" | "java";

// 语言 -> CodeMirror 语法扩展；未安装对应语言包时回退到纯文本
function languageExtensionOf(language: EditorLanguage) {
  if (language === "python") return [python()];
  return [];
}

/**
 * @description 代码编辑器组件：基于 CodeMirror 的受控组件，深色主题，支持语言切换
 * @param value 受控代码内容
 * @param onChange 代码变化回调
 * @param language 作答语言，默认 python
 * @param height 编辑器高度，默认 420px
 */
export default function CodeEditor({
  value,
  onChange,
  language = "python",
  height = "420px",
}: {
  value: string;
  onChange: (value: string) => void;
  language?: EditorLanguage;
  height?: string;
}) {
  const extensions = useMemo(() => languageExtensionOf(language), [language]);

  return (
    <div
      className="overflow-hidden rounded-lg border border-zinc-700 h-full"
      style={{ backgroundColor: "#282c34" }}
    >
      <CodeMirror
        value={value}
        height={height}
        theme={oneDark}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          autocompletion: true,
        }}
      />
    </div>
  );
}
