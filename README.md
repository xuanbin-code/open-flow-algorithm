<p align="center">
  <h1 align="center">Open Flow Algorithm</h1>
  <p align="center">
    开源流程图编辑器 — 解析、编辑、运行 Flowgorithm 流程图
    <br/>
    An open-source Flowgorithm flowchart editor, executor, and debugger
  </p>
</p>

<p align="center">
  <a href="https://github.com/xuanbin-code/open-flow-algorithm/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="License: GPL-3.0" /></a>
  <a href="https://xuanbin-code.github.io/open-flow-algorithm/"><img src="https://img.shields.io/badge/demo-GitHub%20Pages-brightgreen.svg" alt="Demo" /></a>
</p>

---

## 📖 简介 | Introduction

**Open Flow Algorithm** 是一个基于 Vue 3 + VueFlow + Tauri v2 的桌面流程图应用。支持解析 Flowgorithm `.fprg` 格式的 XML 文件，渲染为可交互的流程图，并提供完整的执行引擎和调试工具。

**Open Flow Algorithm** is a desktop flowchart application built with Vue 3, VueFlow, and Tauri v2. It parses Flowgorithm `.fprg` XML files, renders them as interactive flowcharts, and provides a full execution engine with debugging tools.

---

## 🖥️ 在线演示 | Live Demo

👉 **[xuanbin-code.github.io/open-flow-algorithm](https://xuanbin-code.github.io/open-flow-algorithm/)**

---

## ✨ 功能 | Features

| | |
|---|---|
| 📂 **解析 .fprg 文件** — 读取 Flowgorithm XML 格式的流程图文件 | **Parse .fprg files** — Read Flowgorithm XML flowchart files |
| 🎨 **交互式渲染** — 基于 VueFlow 的拖拽、缩放、平移 | **Interactive rendering** — Drag, zoom, and pan with VueFlow |
| ✏️ **可视化编辑** — 在连线间插入节点、右键菜单编辑 | **Visual editing** — Insert nodes between edges, right-click context menu |
| ▶️ **执行引擎** — 逐步/全速运行流程图，支持变量监控 | **Execution engine** — Step-through or full-speed execution with variable monitoring |
| 🔧 **表达式解释器** — 算术、比较、逻辑、数组索引运算 | **Expression evaluator** — Arithmetic, comparison, logic, array indexing |
| 🔗 **子函数可视化** — 函数调用树形图 + 浮动窗口显示 | **Sub-function visualization** — Call tree diagram + floating sub-flowchart window |
| 📝 **代码编辑器** — CodeMirror 6 集成，Flowgorithm 语法高亮 + 自动补全 | **Code editor** — CodeMirror 6 with Flowgorithm syntax highlighting and autocomplete |
| ⌨️ **自定义快捷键** — 9 个可配置操作，物理键位匹配 | **Customizable shortcuts** — 9 configurable actions, layout-immune key matching |
| 🌓 **主题切换** — 明/暗主题 + 14 种强调色 | **Theme switching** — Light/dark themes + 14 accent color presets |
| 🌍 **国际化** — 中文 / English | **i18n** — Chinese / English |
| 🔊 **提示音** — 运行、结束、出错、输入提示 | **Sound effects** — Run, stop, error, and input prompt audio cues |
| 🔔 **Toast 通知** — 全局消息提示带进度条 | **Toast notifications** — Global messages with animated progress bar |
| ↩️ **撤销/重做** — 完整的操作历史 | **Undo/Redo** — Full operation history |
| 📊 **变量监控** — 可拖拽浮动面板实时查看变量 | **Variable monitor** — Draggable floating panel for real-time variable inspection |
| 🖥️ **桌面应用** — Tauri v2 原生窗口 + 文件系统访问 | **Desktop app** — Tauri v2 native window with filesystem access |

---

## 🚀 快速开始 | Quick Start

### 前提条件 | Prerequisites

- **Node.js** ≥ 22
- **pnpm** — 包管理器 | Package manager
- **Rust** — Tauri 桌面应用需要（仅桌面端） | Required for Tauri desktop app only

```bash
# 安装 Rust (Windows) | Install Rust
winget install Rustlang.Rustup
```

### 开发 | Development

```bash
cd app
pnpm install

# 浏览器模式 | Browser mode
pnpm dev:web

# 桌面应用模式 | Desktop app mode
pnpm tauri dev
```

### 构建 | Build

```bash
cd app

# Web 构建 | Web build
pnpm build:web

# GitHub Pages 构建 | GitHub Pages build
pnpm build:gh-pages

# 桌面安装包 (.msi/.exe) | Desktop installer
pnpm tauri build
```

---

## 📁 项目结构 | Project Structure

```
open-flow-algorithm/
├── app/                      # 主应用 Main application (Vue 3 + Tauri)
│   ├── src/
│   │   ├── App.vue           # 根组件 Root component
│   │   ├── main.ts           # 入口 Entry point
│   │   ├── components/       # Vue 组件
│   │   │   ├── nodes/        #   12 个流程图节点组件 (12 node components)
│   │   │   ├── panels/       #   10 个面板组件 (10 panel components)
│   │   │   └── ui/           #   23 组 shadcn-vue UI 组件 (23 UI component groups)
│   │   ├── composables/      # 9 个组合式函数 (9 composables)
│   │   ├── engine/           # 核心引擎 Core engine (AST, interpreter, expression evaluator)
│   │   ├── stores/           # 3 个 Pinia stores (settings, recentFiles, shortcuts)
│   │   ├── lib/              # 工具库 Utilities (icons, color palette, CodeMirror language)
│   │   ├── types/            # TypeScript 类型定义 Type definitions
│   │   ├── i18n/             # 国际化 Internationalization (zh-CN, en)
│   │   ├── platform/         # 平台适配 Platform adapters (Tauri / Web)
│   │   ├── styles/           # 全局样式 Global styles
│   │   └── fprg/             # 15 个示例 .fprg 文件 (15 sample .fprg files)
│   └── src-tauri/            # Tauri Rust 后端 Backend
├── examples/                 # 示例 .fprg 文件 Sample .fprg files
├── docs/                     # 流程图元素文档 (中文) Flowchart element docs (Chinese)
└── legacy/                   # 原始 flowgorithm.js 库 (归档) Archived original library
```

---

## 🛠️ 技术栈 | Tech Stack

| 层 Layer | 技术 Technology |
|-----------|----------------|
| 前端框架 Frontend | Vue 3.5 + TypeScript + Pinia |
| 流程图渲染 Flowchart | VueFlow 1.48 + @dagrejs/dagre |
| UI 组件 UI Components | shadcn-vue (Reka-UI) + Tailwind CSS 3 |
| 代码编辑器 Code Editor | CodeMirror 6 |
| 构建工具 Bundler | Vite 8 |
| 桌面框架 Desktop | Tauri v2 (Rust) |
| 国际化 i18n | vue-i18n 10 |
| 表单验证 Validation | vee-validate + zod |
| 包管理器 Package Manager | pnpm |

---

## ⌨️ 键盘快捷键 | Keyboard Shortcuts

| 操作 Action | 默认快捷键 Default |
|-------------|-------------------|
| 保存 Save | `Ctrl + S` |
| 撤销 Undo | `Ctrl + Z` |
| 重做 Redo | `Ctrl + Y` / `Ctrl + Shift + Z` |
| 删除 Delete | `Delete` |
| 新建 New | `Ctrl + N` |
| 打开 Open | `Ctrl + O` |
| 运行 Run | `F5` |
| 单步执行 Step | `F6` |
| 停止 Stop | `F7` |

> 💡 所有快捷键均可在 **设置 → 快捷键** 面板中自定义。All shortcuts can be customized in **Settings → Shortcuts**.

---

## 📄 许可证 | License

[GPL-3.0](LICENSE) © xuanbin-code
