<p align="center">
  <img src="app/public/app-icon.svg" alt="Open Flow Algorithm" width="120" />
  <h1 align="center">Open Flow Algorithm</h1>
  <p align="center">
    An open-source Flowgorithm flowchart editor, executor, and debugger
  </p>
</p>

<p align="center">
  <a href="https://github.com/xuanbin-code/open-flow-algorithm/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="License: GPL-3.0" /></a>
  <a href="https://xuanbin-code.github.io/open-flow-algorithm/"><img src="https://img.shields.io/badge/demo-GitHub%20Pages-brightgreen.svg" alt="Demo" /></a>
  <a href="README_zh.md">📖 中文文档</a>
</p>

---

## 📖 Introduction

**Open Flow Algorithm** is a desktop flowchart application built with Vue 3, VueFlow, and Tauri v2. It parses Flowgorithm `.fprg` XML files, renders them as interactive flowcharts, and provides a full execution engine with debugging tools.

---

## 🖥️ Live Demo

👉 **[xuanbin-code.github.io/open-flow-algorithm](https://xuanbin-code.github.io/open-flow-algorithm/)**

---

## ✨ Features

- 📂 **Parse .fprg files** — Read Flowgorithm XML flowchart files
- 🎨 **Interactive rendering** — Drag, zoom, and pan powered by VueFlow
- ✏️ **Visual editing** — Insert nodes between edges, right-click context menu, property editor
- ▶️ **Execution engine** — Step-through or full-speed execution with variable monitoring
- 🔧 **Expression evaluator** — Arithmetic, comparison, logic, array indexing with bounds checking
- 🔗 **Sub-function visualization** — Call tree diagram (dagre layout) + floating sub-flowchart window
- 📝 **Code editor** — CodeMirror 6 integration with Flowgorithm syntax highlighting and scope-aware autocomplete
- ⌨️ **Customizable shortcuts** — 9 configurable actions with layout-immune physical key matching
- 🌓 **Theme switching** — Light / dark themes + 14 accent color presets
- 🌍 **Internationalization** — English / 中文
- 🔊 **Sound effects** — Audio cues for run, stop, error, and input prompts
- 🔔 **Toast notifications** — Global messages with animated progress bar
- ↩️ **Undo / Redo** — Full operation history via useRefHistory
- 📊 **Variable monitor** — Draggable floating panel for real-time variable inspection
- 🖥️ **Desktop app** — Tauri v2 native window with filesystem access

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 22
- **pnpm** — Package manager
- **Rust** — Required for Tauri desktop app only

```bash
# Install Rust (Windows)
winget install Rustlang.Rustup
```

### Development

```bash
cd app
pnpm install

# Browser mode
pnpm dev:web

# Desktop app mode
pnpm tauri dev
```

### Build

```bash
cd app

# Web build
pnpm build:web

# GitHub Pages build (with /open-flow-algorithm/ base path)
pnpm build:gh-pages

# Desktop installer (.msi / .exe)
pnpm tauri build
```

---

## 📁 Project Structure

```
open-flow-algorithm/
├── app/                      # Main application (Vue 3 + Tauri)
│   ├── src/
│   │   ├── App.vue           # Root component
│   │   ├── main.ts           # Entry point
│   │   ├── components/       # Vue components
│   │   │   ├── nodes/        #   12 flowchart node components
│   │   │   ├── panels/       #   10 panel components
│   │   │   └── ui/           #   23 shadcn-vue UI component groups
│   │   ├── composables/      # 9 Vue composables
│   │   ├── engine/           # Core engine (AST, interpreter, expression evaluator, layout)
│   │   ├── stores/           # 3 Pinia stores (settings, recentFiles, shortcuts)
│   │   ├── lib/              # Utilities (icons, color palette, CodeMirror language, scope resolver)
│   │   ├── types/            # TypeScript type definitions
│   │   ├── i18n/             # Internationalization (zh-CN, en)
│   │   ├── platform/         # Platform adapters (Tauri / Web)
│   │   ├── styles/           # Global styles
│   │   └── fprg/             # 15 sample .fprg files
│   └── src-tauri/            # Tauri Rust backend
├── examples/                 # Sample .fprg files
├── docs/                     # Flowchart element docs (Chinese)
└── legacy/                   # Archived flowgorithm.js library
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | Vue 3.5 + TypeScript + Pinia |
| Flowchart | VueFlow 1.48 + @dagrejs/dagre |
| UI Components | shadcn-vue (Reka-UI) + Tailwind CSS 3 |
| Code Editor | CodeMirror 6 |
| Bundler | Vite 8 |
| Desktop Framework | Tauri v2 (Rust) |
| i18n | vue-i18n 10 |
| Validation | vee-validate + zod |
| Package Manager | pnpm |

---

## 📄 License

[GPL-3.0](LICENSE) © xuanbin-code
