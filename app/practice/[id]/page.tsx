"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, App, Button, Select, Spin, Splitter, Tabs, Tag } from "antd";
import {
  CheckSquareOutlined,
  CodeOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import PageLayout from "@/components/PageLayout";
import type { PreviewProblem } from "@/components/ProblemStatement";
import ProblemStatement from "@/components/ProblemStatement";
import CodeEditor, { type EditorLanguage } from "@/components/CodeEditor";
import { getPyodide } from "@/lib/pyodide";

// 练习页默认代码模板：作答入口，占位 TODO 引导用户书写
const DEFAULT_CODE =
  "def solution():\n    # TODO: 在这里编写你的解答\n    pass\n";

// 单个测试用例的运行结果：passed 为通过与否，error 为失败时的报错摘要
type CaseResult = { passed: boolean; error: string | null };

// 逐用例执行脚本：先跑用户代码，再依次 exec 每条断言，结果以 JSON 返回
const RUN_HARNESS = `
import io, json, contextlib, traceback

_results = []
_console = io.StringIO()
_compile_error = None
_g = {}
with contextlib.redirect_stdout(_console), contextlib.redirect_stderr(_console):
    try:
        for _imp in _imports:
            exec(_imp, _g)
        exec(_user_code, _g)
        for _case in _cases:
            try:
                exec(_case, _g)
                _results.append({"passed": True, "error": None})
            except Exception as _exc:
                _results.append({
                    "passed": False,
                    "error": "".join(traceback.format_exception_only(type(_exc), _exc)).strip(),
                })
    except Exception as _exc:
        _compile_error = "".join(
            traceback.format_exception(type(_exc), _exc, _exc.__traceback__)
        ).strip()

json.dumps({"results": _results, "console": _console.getvalue(), "compile_error": _compile_error})
`;

// CodeAgent 练习页：按路由中的题目 id 拉取题库，展示与预览页一致的题面布局
export default function PracticeDetailPage() {
  const { message } = App.useApp();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  // undefined 表示仍在请求中；null 表示未找到
  const [problem, setProblem] = useState<PreviewProblem | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // 作答代码：切换题目时重置为默认模板
  const [code, setCode] = useState(DEFAULT_CODE);
  // 浏览器端运行状态与输出（Pyodide）；ref 同步保存输出以避免闭包读到旧值
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const outputRef = useRef<string | null>(null);
  // 逐用例结果：与 problem.test_cases 下标对应；null 表示本轮没有可执行结果（如代码本身报错）
  const [caseResults, setCaseResults] = useState<CaseResult[] | null>(null);
  // 右下结果面板：测试用例 / 测试结果 两个 Tab；运行时自动切到「测试结果」
  const [panelTab, setPanelTab] = useState("cases");
  // 作答语言（参考 LeetCode：编辑器上方下拉切换）
  const [language, setLanguage] = useState<EditorLanguage>("python");

  /**
   * @description 覆写输出内容（同步 ref 与 state）
   */
  function writeOutput(text: string | null) {
    outputRef.current = text;
    setOutput(text);
  }

  /**
   * @description 追加一行输出（同步 ref 与 state）
   */
  function appendOutput(text: string) {
    writeOutput((outputRef.current ?? "") + text + "\n");
  }

  useEffect(() => {
    if (!id) {
      setProblem(null);
      return;
    }
    setProblem(undefined);
    setError(null);
    setCode(DEFAULT_CODE);
    fetch(`/api/problems?id=${encodeURIComponent(String(id))}`)
      .then(async (res) => {
        const detail = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(detail?.error ?? "加载题目失败");
        }
        setProblem(detail as PreviewProblem);
      })
      .catch((err: Error) => {
        setError(err.message);
        setProblem(null);
      });
  }, [id, reloadTick]);

  if (problem === undefined) {
    return (
      <PageLayout title="在线练习" description="正在加载题目…">
        <div className="flex justify-center py-24">
          <Spin />
        </div>
      </PageLayout>
    );
  }
  if (!problem) {
    return (
      <PageLayout title="在线练习" description="加载失败或题目不存在。">
        <Alert
          type="error"
          showIcon
          message={error ?? "未找到题目数据"}
          description="请从 CodeAgent 题库列表重新进入。"
          action={
            <Button size="small" onClick={() => setReloadTick((t) => t + 1)}>
              重试
            </Button>
          }
        />
      </PageLayout>
    );
  }
  /**
   * @description 在浏览器端用 Pyodide 运行当前代码：逐个执行测试用例并收集每条断言的通过情况
   */
  async function handleRun() {
    if (isRunning || !problem) return;
    setIsRunning(true);
    setPanelTab("result");
    setCaseResults(null);
    writeOutput("正在加载 Python 环境并执行…");
    try {
      const pyodide = await getPyodide();
      pyodide.setStdout({ batched: appendOutput });
      pyodide.setStderr({ batched: appendOutput });

      // 把用户代码与用例注入全局变量，交给 Python 侧脚本逐条执行
      pyodide.globals.set("_user_code", code);
      pyodide.globals.set("_cases", problem.test_cases ?? []);
      pyodide.globals.set("_imports", problem.test_imports ?? []);
      writeOutput("");
      const raw = await pyodide.runPythonAsync(RUN_HARNESS);
      const report = JSON.parse(String(raw)) as {
        results: CaseResult[];
        console: string;
        compile_error: string | null;
      };

      if (report.compile_error) {
        writeOutput(`运行报错:\n${report.compile_error}`);
      } else {
        setCaseResults(report.results);
        writeOutput(report.console || "(无输出)");
      }
    } catch (error) {
      writeOutput(`运行报错:\n${(error as Error).message ?? String(error)}`);
    } finally {
      setIsRunning(false);
    }
  }

  /**
   * @description 提交当前代码进行评测；评测服务尚未上线，先提示占位反馈
   */
  function handleSubmit() {
    if (!code.trim()) {
      message.warning("代码为空，请先编写解答");
      return;
    }
    message.info("评测服务即将上线，代码已记录");
  }

  // LeetCode 式工作台布局：外层左右 Splitter（题面 | 工作台），右侧内部上下 Splitter（编辑器 | 用例面板）
  return (
    <PageLayout
      title={problem.title || `题目 #${problem.id}`}
      description="在线练习：阅读题面与测试用例，完成编码后提交评测。"
      backHref="/practice?tab=problems"
    >
      <div className="h-[calc(100vh-230px)] min-h-[480px]">
        <Splitter>
          {/* 左侧：题面，独立滚动，可拖拽调宽 */}
          <Splitter.Panel defaultSize="42%" min="28%" max="60%">
            <div className="h-full overflow-y-auto pr-3">
              <ProblemStatement problem={problem} />
            </div>
          </Splitter.Panel>

          {/* 右侧：上下 Splitter（编辑器 | 测试用例/结果面板） */}
          <Splitter.Panel min="40%" max="72%">
            <Splitter layout="vertical">
              {/* 上：语言栏 + 代码编辑器 */}
              <Splitter.Panel defaultSize="58%" min="30%" max="80%">
                <div className="flex h-full flex-col gap-2 pl-3 pb-3">
                  <div className="flex items-center justify-between">
                    <Select
                      size="small"
                      style={{ width: 110 }}
                      value={language}
                      onChange={setLanguage}
                      options={[
                        { value: "python", label: "Python" },
                        { value: "java", label: "Java" },
                      ]}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="small"
                        icon={<PlayCircleOutlined />}
                        loading={isRunning}
                        onClick={handleRun}
                      >
                        运行
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        onClick={handleSubmit}
                      >
                        提交评测
                      </Button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1">
                    <CodeEditor
                      value={code}
                      onChange={setCode}
                      language={language}
                      height="100%"
                    />
                  </div>
                </div>
              </Splitter.Panel>

              {/* 下：测试用例 / 测试结果 双 Tab 面板 */}
              <Splitter.Panel min="20%" max="70%">
                <div className="h-full overflow-y-auto pl-3">
                  <Tabs
                    activeKey={panelTab}
                    onChange={setPanelTab}
                    size="small"
                    items={[
                      {
                        key: "cases",
                        label: (
                          <span>
                            <CheckSquareOutlined /> 测试用例
                          </span>
                        ),
                        children: (
                          <Tabs
                            size="small"
                            items={(problem.test_cases ?? []).map(
                              (testCase, index) => ({
                                key: String(index),
                                label: `Case ${index + 1}`,
                                children: (
                                  <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 font-mono text-[13px] leading-6 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                                    {String(testCase)}
                                  </pre>
                                ),
                              }),
                            )}
                          />
                        ),
                      },
                      {
                        key: "result",
                        label: (
                          <span>
                            <CodeOutlined /> 测试结果
                          </span>
                        ),
                        children:
                          caseResults !== null ? (
                            <div className="flex flex-col gap-2">
                              {/* 逐用例结果：与「测试用例」Tab 中 Case N 一一对应 */}
                              {caseResults.map((result, index) => (
                                <div
                                  key={index}
                                  className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700"
                                >
                                  <div className="flex items-center gap-2 text-[13px]">
                                    <Tag
                                      color={result.passed ? "success" : "error"}
                                      style={{ marginInlineEnd: 0 }}
                                    >
                                      {result.passed ? "通过" : "失败"}
                                    </Tag>
                                    <span className="font-medium">Case {index + 1}</span>
                                  </div>
                                  {!result.passed && result.error && (
                                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-zinc-100 p-2 font-mono text-[12px] leading-5 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                                      {result.error}
                                    </pre>
                                  )}
                                </div>
                              ))}
                              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                控制台输出
                              </div>
                              <pre className="max-h-40 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[13px] leading-6 text-zinc-100">
                                {output ?? "(无输出)"}
                              </pre>
                            </div>
                          ) : output !== null ? (
                            <pre className="max-h-56 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[13px] leading-6 text-zinc-100">
                              {output}
                            </pre>
                          ) : (
                            <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                              点击「运行」逐个执行测试用例，这里展示每个用例的通过情况与输出
                            </div>
                          ),
                      },
                    ]}
                  />
                </div>
              </Splitter.Panel>
            </Splitter>
          </Splitter.Panel>
        </Splitter>
      </div>
    </PageLayout>
  );
}
