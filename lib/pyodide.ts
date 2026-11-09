"use client";

// Pyodide 运行时加载器：从 CDN 动态引入 pyodide.js 并单例缓存实例
// 不通过 npm 依赖引入完整 Pyodide 包，避免把几十 MB 的 wasm 文件打进构建产物

const PYODIDE_VERSION = "0.25.0";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// 本项目用到的最小 Pyodide API 面貌
export type PyodideAPI = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (options: { batched: (text: string) => void }) => void;
  setStderr: (options: { batched: (text: string) => void }) => void;
  // 全局命名空间代理，用于向 Python 侧注入变量（globals.set）
  globals: { set: (name: string, value: unknown) => void };
};

declare global {
  interface Window {
    loadPyodide?: (options: { indexURL: string }) => Promise<PyodideAPI>;
  }
}

// 模块级单例：浏览器端整个生命周期只加载一次运行时
let pyodidePromise: Promise<PyodideAPI> | null = null;

/**
 * @description 动态插入 script 标签加载外部 JS
 * @param src 脚本地址
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Pyodide 运行时脚本加载失败"));
    document.head.appendChild(script);
  });
}

/**
 * @description 获取（并按需初始化）全局共享的 Pyodide 实例；首次调用会下载运行时，之后复用
 */
export function getPyodide(): Promise<PyodideAPI> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      if (!window.loadPyodide) {
        await loadScript(`${INDEX_URL}pyodide.js`);
      }
      if (!window.loadPyodide) {
        throw new Error("Pyodide 加载器不可用");
      }
      return window.loadPyodide({ indexURL: INDEX_URL });
    })();
  }
  return pyodidePromise;
}
