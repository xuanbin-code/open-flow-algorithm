<p align="center">
  <img src="app/public/app-icon.svg" alt="Open Flow Algorithm" width="120" />
  <h1 align="center">Open Flow Algorithm</h1>
  <p align="center">
    开源流程图编辑器 — 解析、编辑、运行 Flowgorithm 流程图
  </p>
</p>

<p align="center">
  <a href="https://github.com/xuanbin-code/open-flow-algorithm/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="License: GPL-3.0" /></a>
  <a href="https://xuanbin-code.github.io/open-flow-algorithm/"><img src="https://img.shields.io/badge/demo-GitHub%20Pages-brightgreen.svg" alt="Demo" /></a>
  <a href="README.md">📖 English Docs</a>
</p>

---

## 📖 简介

**Open Flow Algorithm** 是一个基于 Vue 3 + VueFlow + Tauri v2 的桌面流程图应用。支持解析 Flowgorithm `.fprg` 格式的 XML 文件，渲染为可交互的流程图，并提供完整的执行引擎和调试工具。

---

## 🖥️ 在线演示

👉 **[xuanbin-code.github.io/open-flow-algorithm](https://xuanbin-code.github.io/open-flow-algorithm/)**

---

## ✨ 功能

- 📂 **解析 .fprg 文件** — 读取 Flowgorithm XML 格式的流程图文件
- 🎨 **交互式渲染** — 基于 VueFlow 的拖拽、缩放、平移
- ✏️ **可视化编辑** — 连线间插入节点、右键上下文菜单、属性编辑器
- ▶️ **执行引擎** — 逐步/全速运行流程图，支持变量监控
- 🔧 **表达式解释器** — 算术、比较、逻辑、数组索引运算，含边界检查
- 🔗 **子函数可视化** — 函数调用树形图（dagre 布局）+ 浮动窗口显示子流程图
- 📝 **代码编辑器** — CodeMirror 6 集成，Flowgorithm 语法高亮 + 作用域感知自动补全
- ⌨️ **自定义快捷键** — 9 个可配置操作，物理键位匹配，免疫键盘布局差异
- 🌓 **主题切换** — 明/暗主题 + 14 种强调色预设
- 🌍 **国际化** — 中文 / English
- 🔊 **提示音** — 运行、结束、出错、输入提示时播放音效
- 🔔 **Toast 通知** — 全局消息提示，带动画进度条
- ↩️ **撤销/重做** — 基于 useRefHistory 的完整操作历史
- 📊 **变量监控** — 可拖拽浮动面板实时查看变量值
- 🖥️ **桌面应用** — Tauri v2 原生窗口 + 文件系统访问 |

---

## 🚀 快速开始

### 前提条件

- **Node.js** ≥ 22
- **pnpm** — 包管理器
- **Rust** — Tauri 桌面应用需要（仅桌面端）

```bash
# 安装 Rust (Windows)
winget install Rustlang.Rustup
```

### 开发

```bash
cd app
pnpm install

# 浏览器模式
pnpm dev:web

# 桌面应用模式
pnpm tauri dev
```

### 构建

```bash
cd app

# Web 构建
pnpm build:web

# GitHub Pages 构建（自动设置 /open-flow-algorithm/ 基础路径）
pnpm build:gh-pages

# 桌面安装包 (.msi / .exe)
pnpm tauri build
```

---

## 📁 项目结构

```
open-flow-algorithm/
├── app/                      # 主应用 (Vue 3 + Tauri)
│   ├── src/
│   │   ├── App.vue           # 根组件
│   │   ├── main.ts           # 入口
│   │   ├── components/       # Vue 组件
│   │   │   ├── nodes/        #   12 个流程图节点组件
│   │   │   ├── panels/       #   10 个面板组件
│   │   │   └── ui/           #   23 组 shadcn-vue UI 组件
│   │   ├── composables/      # 9 个组合式函数
│   │   ├── engine/           # 核心引擎 (AST、解释器、表达式求值、布局)
│   │   ├── stores/           # 3 个 Pinia Store (settings、recentFiles、shortcuts)
│   │   ├── lib/              # 工具库 (图标、调色板、CodeMirror 语言、作用域解析)
│   │   ├── types/            # TypeScript 类型定义
│   │   ├── i18n/             # 国际化 (zh-CN、en)
│   │   ├── platform/         # 平台适配 (Tauri / Web)
│   │   ├── styles/           # 全局样式
│   │   └── fprg/             # 15 个示例 .fprg 文件
│   └── src-tauri/            # Tauri Rust 后端
├── examples/                 # 示例 .fprg 文件
├── docs/                     # 流程图元素文档
└── legacy/                   # 原始 flowgorithm.js 库 (归档)
```

---

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | Vue 3.5 + TypeScript + Pinia |
| 流程图 | VueFlow 1.48 + @dagrejs/dagre |
| UI 组件 | shadcn-vue (Reka-UI) + Tailwind CSS 3 |
| 代码编辑器 | CodeMirror 6 |
| 构建工具 | Vite 8 |
| 桌面框架 | Tauri v2 (Rust) |
| 国际化 | vue-i18n 10 |
| 表单验证 | vee-validate + zod |
| 包管理器 | pnpm |

---

## 📄 许可证

[GPL-3.0](LICENSE) © xuanbin-code
