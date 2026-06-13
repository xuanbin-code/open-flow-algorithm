# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Open Flow Algorithm** is a desktop application for rendering, editing, and executing flowcharts. It uses Vue 3 + VueFlow for the frontend and Tauri v2 (Rust) for the desktop shell, enabling native system capabilities (file system access, code execution, etc.).

The repository also contains the original `flowgorithm.js` library (archived in `legacy/`) — a third-party tool that reads `.fprg` files (Flowgorithm's XML flowchart format) and renders them as SVG in a browser.

## Key Commands

### Main App (`app/`)
```bash
cd app
pnpm install       # Install dependencies (uses pnpm)
pnpm dev           # Start dev server (Vite) — browser only
pnpm build         # Build for production (vue-tsc + vite)
pnpm preview       # Preview production build

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
│   │   ├── App.vue           # Root component
│   │   ├── main.ts           # Vue entry point
│   │   └── sandbox/          # Flowchart sandbox
│   │       ├── index.vue     # Main flowchart UI
│   │       ├── flowchart-engine.ts  # Core engine: AST → VueFlow
│   │       ├── fprg-ast.ts   # FPRG XML parser → AST
│   │       ├── fprg/         # Sample .fprg files
│   │       └── components/       # Vue components (nodes/, panels/, MenuBar)
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

**Key files:**
- `App.vue` — Root component (orchestrates all sub-components, VueFlow, interpreter)
- `components/nodes/` — 11 VueFlow node components (Start, End, Declare, Assign, Input, Output, If, Merge, For, While, Call)
- `components/MenuBar.vue` — Top menu bar (文件/编辑/程序) + execution toolbar (Run/Step/Pause/Stop/Speed/VarMonitor)
- `components/FunctionTabBar.vue` — Collapsible left sidebar for function list with context menu
- `components/SettingsDialog.vue` — Settings dialog (language, theme, accent color, sound)
- `components/FunctionDialog.vue` — Function editor dialog (name, return type, parameter table)
- `components/panels/ExecutionConsole.vue` — Right-side chat console (program/user dialogue + input bar)
- `components/panels/VariableMonitor.vue` — Floating draggable variable monitor panel
- `components/panels/InsertNodePanel.vue` — Floating node insertion/editing panel
- `components/panels/LayoutDebugPanel.vue` — Collapsible layout parameter debug panel
- `engine/flowchart-engine.ts` — Core engine: AST → VueFlow nodes/edges with layout algorithm
- `engine/fprg-ast.ts` — FPRG XML parser → AST, with Chinese-localized labels
- `engine/interpreter.ts` — Flowchart execution engine (step-through interpreter)
- `engine/expression-evaluator.ts` — Expression evaluation (math, comparisons, functions)
- `composables/useSettings.ts` — Singleton settings manager (theme, accent, language, localStorage)

### UI Framework: shadcn-vue + Tailwind CSS v3
- **shadcn-vue** (Reka-UI based) — Component library installed via `pnpm dlx shadcn-vue@latest add`. Components are source code in `src/components/ui/`. Configured in `components.json`.
- **Tailwind CSS v3** — Configured via `tailwind.config.js` + `postcss.config.js`. Global styles in `src/tailwind.css` (includes shadcn CSS variables + project-specific variables + global animations). `corePlugins.preflight: false` to avoid conflicts with VueFlow.
- **Icons:** `@lucide/vue` (barrel file at `components/icons.ts`, 22 icons)
- **Utils:** `class-variance-authority` (CVA) + `clsx` + `tailwind-merge` → `cn()` at `lib/utils.ts`
- **Path alias:** `@/` → `./src/` (configured in both `tsconfig.json` and `vite.config.ts`)
- **Adding components:** `pnpm dlx shadcn-vue@latest add <name>`
- **Installed components:** button, input, select, checkbox, badge, separator, tooltip, menubar, context-menu, collapsible, toggle-group, dialog, sheet, alert-dialog, card, table, scroll-area, skeleton, form, radio-group, textarea

### Tauri Backend (`app/src-tauri/`)
```
src-tauri/
├── Cargo.toml              # Rust deps (tauri 2, serde)
├── tauri.conf.json         # Window 1280×800, devUrl, build hooks
├── build.rs                # tauri-build script
├── src/
│   ├── lib.rs              # Tauri Builder entry point
│   └── main.rs             # Windows entry (no console in release)
├── capabilities/
│   └── default.json        # Permissions: core:default
└── icons/                  # App icons (generated by `tauri icon`)
```

**Tauri v2 key concepts:**
- **Capabilities-based permissions:** `capabilities/default.json` controls which Rust commands each window can call.
- **IPC:** Frontend → Rust via `@tauri-apps/api/core` (`invoke`); Rust → frontend via `app_handle.emit()`.
- **CLI and API are separate:** `@tauri-apps/cli` (dev/build) ≠ `@tauri-apps/api` (runtime).
- **Plugins:** Non-core features (dialog, fs, shell, http) are separate `@tauri-apps/plugin-<name>` packages.
- **Vite config:** Must bind to `127.0.0.1:1420` (not `localhost` which is IPv6 `::1`).

### Legacy Library (`legacy/flowgorithm.js`)
Archived original library. Parses Flowgorithm's XML format and renders SVG flowcharts using jQuery. Key entry points:
- `drawFlowchartFromUrl(url, selector, options)`
- `drawFlowchartFromSource(xmlString, selector, options)`
- `drawFlowchart($xml, selector, options)`

**Supported XML elements:** `declare`, `output`, `input`, `assign`, `call`, `if`, `for`, `while`, `do`, `more`

## Dependencies

- **Vue app (runtime)**: Vue 3.5, VueFlow 1.x, shadcn-vue (Reka-UI 2.x), CVA 0.7, clsx, tailwind-merge, @lucide/vue, vue-i18n 10, @vueuse/core 14
- **Vue app (dev)**: Vite 8, TypeScript 6, vue-tsc 3, Tailwind CSS 3.4, PostCSS 8, Autoprefixer 10
- **Tauri**: `@tauri-apps/cli` 2.x, `@tauri-apps/api` 2.x, Rust (tauri 2.x, serde)
- **Package manager**: pnpm

## Notes

- Edge hover CSS uses `stroke` color change only (no `filter`) to avoid Chromium GPU compositing layer flicker
- FlowEdge type uses `EdgeMarkerType` from `@vue-flow/core` and `markerEnd: { type: 'arrowclosed', color: 'context-stroke' }` for SVG2 dynamic arrow coloring
- Tauri dev uses `beforeDevCommand: "pnpm dev"` — the Vite server must be running before the Rust backend starts
- For new terminal sessions, ensure `%USERPROFILE%\.cargo\bin` is in PATH for Rust toolchain access
- Tailwind `preflight` is disabled to avoid CSS reset conflicts with VueFlow
- shadcn-vue components live in `src/components/ui/` — do not modify them directly; customize via `tailwind.config.js` theme extension
- Global animations (`exec-pulse`, `exec-pulse-filter`, `flash-pulse`, `flash-pulse-filter`) are defined in `src/tailwind.css`
- Use `pnpm dlx shadcn-vue@latest` (not the React `shadcn@latest`) for component management
