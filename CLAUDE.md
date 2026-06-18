# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Open Flow Algorithm** is a desktop application for rendering, editing, and executing flowcharts. It uses Vue 3 + VueFlow for the frontend and Tauri v2 (Rust) for the desktop shell, enabling native system capabilities (file system access, code execution, etc.).

The repository also contains the original `flowgorithm.js` library (archived in `legacy/`) — a third-party tool that reads `.fprg` files (Flowgorithm's XML flowchart format) and renders them as SVG in a browser.

## Key Commands

### Main App (`app/`)
```bash
cd app
pnpm install       # Install dependencies (uses pnpm)
pnpm dev           # Start dev server (Vite) — Tauri mode (port 1420)
pnpm dev:web       # Start dev server — Web mode (port 5173)
pnpm build         # Build for production (vue-tsc + vite) — Tauri mode
pnpm build:web     # Build for production — Web mode
pnpm preview       # Preview production build — Tauri mode
pnpm preview:web   # Preview production build — Web mode

# Tauri desktop app
pnpm tauri dev     # Start desktop app (Vite + Rust backend)
pnpm tauri build   # Build distributable installer (.msi/.exe on Windows)
```

> **Windows prerequisite:** Rust toolchain required (`rustup`). WebView2 is built into Windows 11.

## Architecture

### Directory Structure
```
open-flow-algorithm/
├── app/                      # Main application (Vue 3 + Tauri)
│   ├── src/
│   │   ├── App.vue           # Root component (thin orchestrator delegating to 9 composables)
│   │   ├── main.ts           # Vue entry point
│   │   ├── components/       # Vue components
│   │   │   ├── nodes/        # 12 VueFlow node components
│   │   │   ├── panels/       # 10 panel components (console, monitor, editor, debug, settings, etc.)
│   │   │   └── ui/           # 23 shadcn-vue component groups (auto-generated)
│   │   ├── composables/      # 9 Vue composables (App.vue logic decomposed into focused modules)
│   │   ├── engine/           # Core engine (AST parser, interpreter, expression evaluator, layout)
│   │   ├── i18n/             # i18n config (index.ts) + locale JSON files (locales/)
│   │   ├── lib/              # Shared utilities (cn, icons, color-palette, CodeMirror language, scope resolver)
│   │   ├── platform/         # Platform adapters (Tauri / Web)
│   │   ├── stores/           # 3 Pinia stores (settings, recentFiles, shortcuts)
│   │   ├── styles/           # Global styles (tailwind.css, variables.css)
│   │   ├── types/            # Shared TypeScript type definitions (app, platform, nodes, shortcuts)
│   │   └── fprg/             # 15 sample .fprg flowchart files
│   └── src-tauri/            # Tauri Rust backend
│       ├── Cargo.toml
│       ├── tauri.conf.json
│       └── src/
├── examples/                 # Sample .fprg flowchart files
├── docs/                     # Chinese docs for flowchart elements
└── legacy/                   # Archived flowgorithm.js library
```

### Vue App (`app/src/`)
A Vue 3 + TypeScript app that parses `.fprg` XML and renders an interactive flowchart using VueFlow.

**Entry:** `main.ts` → `App.vue`

**Composables (9 files — App.vue logic decomposed into focused modules):**
- `composables/useProgram.ts` — Program state management: AST, flowchart engine, layout parameters, file I/O, undo/redo (via `useRefHistory`). Foundational dependency for all other composables.
- `composables/useExecution.ts` — Execution engine: run/step/stop, variable monitoring, sub-function call tree visualization (`@dagrejs/dagre`), console dialogue, execution highlighting
- `composables/useFunctionManagement.ts` — Function CRUD, tab switching, execution demo toggle
- `composables/useNodeInteraction.ts` — Node/edge click, select, edit, delete, context menu, insert node panel
- `composables/useKeyboardShortcuts.ts` — Dynamic keyboard shortcut matching from shortcutStore (replaces hardcoded if-chains)
- `composables/useShortcutCapture.ts` — Shortcut recording state machine (used by SettingsDialog → Shortcuts panel)
- `composables/useSound.ts` — Sound effects composable (wraps `@rexa-developer/tiks`)
- `composables/useToast.ts` — Toast notification system (global message display with close button and progress bar)
- `composables/useViewportFit.ts` — Viewport positioning composable (centers Start node, smooth transitions)

**Stores (3 Pinia stores):**
- `stores/settings.ts` — App settings (theme, accent, language, sound, defaultZoom, yOffset; persisted to localStorage)
- `stores/recentFiles.ts` — Recent files list (via platform adapter)
- `stores/shortcuts.ts` — Customizable keyboard shortcut bindings (persisted to localStorage, merged with defaults, per-action reset + reset-all)

**Types (5 files):**
- `types/index.ts` — Barrel re-exports for all shared type modules
- `types/app.ts` — App-level shared types (ChatMessage, VariableEntry)
- `types/platform.ts` — Platform adapter types (PlatformFileSystem, FileDialogFilter, FileOpenResult, RecentEntry)
- `types/nodes.ts` — VueFlow node data types (FlowNodeData, BaseNodeProps)
- `types/shortcuts.ts` — Keyboard shortcut data model (ShortcutActionId, ShortcutCombo, ShortcutMap), default bindings (DEFAULT_SHORTCUTS), and utility functions (comboToString, comboFromKeyEvent, comboMatch, comboEquals, isEditableTarget, isModifierKey). Uses `e.code` (physical key position) for layout-immune matching.

**Lib (5 files):**
- `lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `lib/icons.ts` — Lucide icon barrel exports (38 icons in 5 categories: navigation/UI, action buttons, execution toolbar, node type icons, debug/var monitor)
- `lib/color-palette.ts` — 14 accent color presets and HSL conversion utilities
- `lib/flowgorithmLanguage.ts` — CodeMirror 6 language definition: Flowgorithm syntax highlighting + autocomplete keywords
- `lib/scopeResolver.ts` — Scope variable resolution for CodeMirror autocomplete context

**Components — nodes/ (12 VueFlow node components):**
Start, End, Declare, Assign, Input, Output, If, Merge, For, While, Call, InvocationFlow
- `InvocationFlowNode.vue` is used in the sub-function call tree visualization (not the main flowchart)

**Components — root-level (4 files):**
- `components/MenuBar.vue` — Top menu bar (文件/编辑/程序) + execution toolbar (Run/Step/Pause/Stop/Speed/VarMonitor)
- `components/FunctionTabBar.vue` — Collapsible left sidebar for function list with context menu
- `components/FunctionDialog.vue` — Function editor dialog (name, return type, parameter table) with vee-validate/zod validation
- `components/SubFunctionFlowWindow.vue` — Floating window displaying sub-function flowchart during execution (uses unique VueFlow id to avoid store conflicts with main instance)
- `components/ExecutionCallCanvas.vue` — Sub-function call tree visualization canvas (dagre layout via `@dagrejs/dagre`)
- `components/InvocationFlowNode.vue` — Individual invocation node rendered in the call tree

**Components — panels/ (10 files):**
- `panels/ExecutionConsole.vue` — Right-side chat console (program/user dialogue + input bar)
- `panels/VariableMonitor.vue` — Floating draggable variable monitor panel
- `panels/InsertNodePanel.vue` — Floating node insertion/editing panel
- `panels/LayoutDebugPanel.vue` — Collapsible layout parameter debug panel
- `panels/SettingsDialog.vue` — Settings dialog (language, theme, accent color, sound, keyboard shortcuts, defaultZoom, yOffset)
- `panels/InputDialog.vue` — Execution input prompt dialog
- `panels/NodeContextMenu.vue` — Right-click context menu for nodes/edges
- `panels/NodePropertyEditor.vue` — Node property editing panel
- `panels/QuickActionsBar.vue` — Floating quick actions toolbar (undo, redo, delete, save, etc.)
- `panels/index.ts` — Panel barrel exports

**Engine (5 files):**
- `engine/flowchart-engine.ts` — Core engine: AST → VueFlow nodes/edges with configurable layout algorithm
- `engine/fprg-ast.ts` — FPRG XML parser → AST, with Chinese-localized labels
- `engine/interpreter.ts` — Flowchart execution engine (async generator step-through interpreter). Supports: array access, bounds checking, size limits, variable declaration checking (enforces declare-before-use), recursion depth protection
- `engine/expression-evaluator.ts` — Expression evaluation (math, comparisons, functions, array indexing)
- `engine/text-measure.ts` — Canvas-based text width measurement for node sizing

**Platform (3 files):**
- `platform/index.ts` — Platform adapter unified entry (detects Tauri vs Web)
- `platform/web-adapter.ts` — Web platform adapter (File System Access API + localStorage)
- `platform/tauri-adapter.ts` — Tauri platform adapter (native dialog + fs plugins)

**I18n (3 files):**
- `i18n/index.ts` — vue-i18n instance config, locale switching
- `i18n/locales/zh-CN.json`, `i18n/locales/en.json` — Full translation files (~392 lines each, covering: common, menu, quickActions, settings, shortcuts, execution, functions, nodes, editor, panels, engine, toasts, fileDialog, sidebar, colorPresets)

**Styles (2 files):**
- `styles/tailwind.css` — Tailwind directives + CSS custom properties (theme, accent colors) + global animations (`exec-pulse`, `exec-pulse-filter`, `flash-pulse`, `flash-pulse-filter`)
- `styles/variables.css` — Legacy CSS custom properties for dark/light theme

### UI Framework: shadcn-vue + Tailwind CSS v3
- **shadcn-vue** (Reka-UI based) — Component library installed via `pnpm dlx shadcn-vue@latest add`. Components are source code in `src/components/ui/`. Configured in `components.json` (new-york style, slate base).
- **Tailwind CSS v3** — Configured via `tailwind.config.js` + `postcss.config.js`. `corePlugins.preflight: false` to avoid conflicts with VueFlow.
- **Icons:** `@lucide/vue` (barrel file at `lib/icons.ts`, 38 icons in 5 categories)
- **Utils:** `class-variance-authority` (CVA) + `clsx` + `tailwind-merge` → `cn()` at `lib/utils.ts`
- **Path alias:** `@/` → `./src/` (configured in both `tsconfig.json` and `vite.config.ts`)
- **Adding components:** `pnpm dlx shadcn-vue@latest add <name>`
- **Installed component groups (23):** alert-dialog, badge, button, card, checkbox, code-editor (CodeMirror 6 wrapper), collapsible, context-menu, dialog, form, input, label, menubar, radio-group, scroll-area, select, separator, sheet, skeleton, table, textarea, toggle, toggle-group, tooltip

> The `code-editor` group is a custom shadcn-vue wrapper around CodeMirror 6, providing Flowgorithm syntax highlighting and context-aware autocomplete.

### Tauri Backend (`app/src-tauri/`)
```
src-tauri/
├── Cargo.toml              # Rust deps (tauri 2, serde, tauri-plugin-dialog, tauri-plugin-fs)
├── tauri.conf.json         # Window 1280×800, identifier com.openflowalgorithm.app, devUrl, build hooks
├── build.rs                # tauri-build script
├── src/
│   ├── lib.rs              # Tauri Builder entry point (registers dialog + fs plugins)
│   └── main.rs             # Windows entry (no console in release)
├── capabilities/
│   └── default.json        # Permissions: core:default + dialog:default + fs:allow-write/read-text-file (*)
└── icons/                  # App icons (generated by `tauri icon`)
```

**Tauri v2 key concepts:**
- **Capabilities-based permissions:** `capabilities/default.json` controls which Rust commands each window can call.
- **IPC:** Frontend → Rust via `@tauri-apps/api/core` (`invoke`); Rust → frontend via `app_handle.emit()`.
- **CLI and API are separate:** `@tauri-apps/cli` (dev/build) ≠ `@tauri-apps/api` (runtime).
- **Plugins:** Non-core features (dialog, fs, shell, http) are separate `@tauri-apps/plugin-<name>` packages.
- **Vite config:** Dual-mode builds — Tauri mode binds to `127.0.0.1:1420` (not `localhost` which is IPv6 `::1`); Web mode uses port 5173. Controlled via `--mode` flag.

### Legacy Library (`legacy/flowgorithm.js`)
Archived original library. Parses Flowgorithm's XML format and renders SVG flowcharts using jQuery. Key entry points:
- `drawFlowchartFromUrl(url, selector, options)`
- `drawFlowchartFromSource(xmlString, selector, options)`
- `drawFlowchart($xml, selector, options)`

**Supported XML elements:** `declare`, `output`, `input`, `assign`, `call`, `if`, `for`, `while`, `do`, `more`

## Dependencies

### Runtime (27 packages)

| Category | Packages |
|----------|----------|
| **Framework** | vue 3.5, pinia 3, vue-i18n 10, @vueuse/core 14 |
| **Flowchart** | @vue-flow/core 1.48, @vue-flow/background, @vue-flow/controls, @dagrejs/dagre 3 (call tree layout) |
| **UI** | reka-ui 2, class-variance-authority 0.7, clsx, tailwind-merge, @lucide/vue, animate.css |
| **Code Editor** | @codemirror/autocomplete, @codemirror/commands, @codemirror/language, @codemirror/state, @codemirror/view, @lezer/highlight, @chenglou/pretext |
| **Validation** | vee-validate 4, zod 3, @vee-validate/zod 4 |
| **Tauri** | @tauri-apps/api 2, @tauri-apps/plugin-dialog 2, @tauri-apps/plugin-fs 2 |
| **Sound** | @rexa-developer/tiks 0.3 |

### DevDependencies
@tauri-apps/cli 2, @types/node 24, @vitejs/plugin-vue 6, @vue/tsconfig 0.9, autoprefixer 10, postcss 8, tailwindcss 3, typescript ~6.0, vite 8, vue-tsc 3

- **Package manager**: pnpm

## Key Features

### Keyboard Shortcuts
Full customizable keyboard shortcut system using physical key codes (`e.code`) for keyboard-layout-immune matching:
- **9 configurable actions:** save, undo, redo, deleteSelected, new, open, run, step, stop
- **Default bindings:** Ctrl+S (save), Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+Shift+Z (redo alt), Delete (delete), Ctrl+N (new), Ctrl+O (open), F5 (run), F6 (step), F7 (stop)
- Configured via **Settings → Shortcuts panel** with a recording state machine (`useShortcutCapture`)
- Globally paused when editing text inputs or when Settings dialog is open

### Code Editor (CodeMirror 6)
A custom CodeMirror 6 editor wrapped as a shadcn-vue component (`components/ui/code-editor/`):
- Flowgorithm-specific syntax highlighting (`lib/flowgorithmLanguage.ts`)
- Context-aware autocomplete using scope variable resolution (`lib/scopeResolver.ts`)
- Used for inline expression/code editing within flowchart nodes

### Sub-Function Execution Visualization
During program execution, function calls are visualized as an interactive call tree:
- `ExecutionCallCanvas.vue` — renders the call tree using `@dagrejs/dagre` for layout
- `InvocationFlowNode.vue` — renders individual invocation nodes in the tree
- `SubFunctionFlowWindow.vue` — displays the sub-function's flowchart in a floating window (uses unique VueFlow id)

### Toast Notifications
Global toast notification system (`useToast`) with:
- Auto-dismiss with animated progress bar
- Manual close button
- Used for execution status, errors, and file operation feedback

### Expression Interpreter
Full async generator interpreter with:
- Arithmetic, comparison, and logical expressions
- Array indexing with bounds checking and size limits
- Variable declaration checking (enforces declare-before-use)
- Recursion depth protection

## Notes

- Edge hover CSS uses `stroke` color change only (no `filter`) to avoid Chromium GPU compositing layer flicker
- FlowEdge type uses `EdgeMarkerType` from `@vue-flow/core` and `markerEnd: { type: 'arrowclosed', color: 'context-stroke' }` for SVG2 dynamic arrow coloring
- Tauri dev uses `beforeDevCommand: "pnpm dev"` — the Vite server must be running before the Rust backend starts
- For new terminal sessions, ensure `%USERPROFILE%\.cargo\bin` is in PATH for Rust toolchain access
- Tailwind `preflight` is disabled to avoid CSS reset conflicts with VueFlow
- shadcn-vue components live in `src/components/ui/` — do not modify them directly; customize via `tailwind.config.js` theme extension
- Global animations (`exec-pulse`, `exec-pulse-filter`, `flash-pulse`, `flash-pulse-filter`) are defined in `src/tailwind.css`
- Use `pnpm dlx shadcn-vue@latest` (not the React `shadcn@latest`) for component management
- Vite config supports dual-mode builds: Tauri mode (port 1420, `--mode tauri`) and Web mode (port 5173, `--mode web`)
- Decision node edges are color-coded: true/then branch = green, false/else branch = red
- Node handles display localized labels: "真" (true), "假" (false), "下一个" (next), "结束" (end)
- Sub-function flows use unique VueFlow ids to avoid sharing store with the main VueFlow instance
- App.vue is intentionally thin — all logic lives in composables; App.vue wires them together
