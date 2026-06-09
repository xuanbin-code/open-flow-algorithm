# Open Flow Algorithm

一个基于 **Vue 3 + VueFlow + Tauri v2** 的流程图桌面应用。支持解析 Flowgorithm `.fprg` 格式的 XML 文件，渲染为可交互的 SVG 流程图。

## ✨ 功能

- 📂 **解析 .fprg 文件** — 读取 Flowgorithm XML 格式的流程图文件
- 🎨 **可视化渲染** — 使用 VueFlow 渲染交互式流程图（拖拽、缩放、平移）
- ✏️ **节点插入** — 点击连线弹出分类节点面板，支持在连线间插入新节点
- 🔧 **实时调参** — 布局参数调试面板，所见即所得
- 🖥️ **桌面应用** — Tauri v2 构建原生桌面窗口，支持文件系统和原生 API

## 🚀 快速开始

### 前提条件

- **Node.js** ≥ 18
- **pnpm** — 包管理器
- **Rust** — 用于 Tauri 桌面应用（仅桌面端需要）

```bash
# 安装 Rust (Windows)
winget install Rustlang.Rustup
```

### 开发

```bash
cd app
pnpm install

# 浏览器模式
pnpm dev

# 桌面应用模式
pnpm tauri dev
```

### 构建

```bash
cd app
pnpm build          # 构建前端
pnpm tauri build    # 构建可分发的桌面安装包 (.msi/.exe)
```

## 📁 项目结构

```
open-flow-algorithm/
├── app/                  # 主应用 (Vue 3 + Tauri)
│   ├── src/              # Vue 前端源码
│   │   └── sandbox/      # 流程图沙箱
│   └── src-tauri/        # Rust 后端
├── examples/             # 示例 .fprg 文件
├── docs/                 # 流程图元素文档 (中文)
└── legacy/               # 原始 flowgorithm.js 库 (归档)
```

## 🛠️ 技术栈

| 层 | 技术 |
|---|------|
| 前端框架 | Vue 3.5 + TypeScript |
| 流程图渲染 | VueFlow 1.x |
| 构建工具 | Vite 8 |
| 桌面框架 | Tauri v2 (Rust) |
| 包管理器 | pnpm |

## 📄 许可证

MIT
