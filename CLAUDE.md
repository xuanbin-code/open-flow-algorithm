# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlowgorithmJS is a third-party tool that reads `.fprg` files (Flowgorithm's XML flowchart format) and renders them as SVG in a browser. The repository contains both the core `flowgorithm.js` library and a Vue 3 demo app in `demo-f-g/`.

## Key Commands

### Core Library (root directory)
- No build step required — `flowgorithm.js` is a vanilla JS library
- Open `drawLocal.html` or `drawWeb.html` directly in a browser to test

### Vue Demo App (`demo-f-g/`)
```bash
cd demo-f-g
npm install        # Install dependencies
npm run dev        # Start dev server (Vite)
npm run build      # Build for production
npm run preview    # Preview production build
```

## Architecture

### Core Library (`flowgorithm.js`)
The library parses Flowgorithm's XML format and renders SVG flowcharts. Key entry points:
- `drawFlowchartFromUrl(url, selector, options)` — fetch and render a .fprg file
- `drawFlowchartFromSource(xmlString, selector, options)` — render from XML string
- `drawFlowchart($xml, selector, options)` — core rendering function

**Supported XML elements:** `declare`, `output`, `input`, `assign`, `call`, `if`, `for`, `while`, `do`, `more`

**Options:** `aH` (arrow length), `aT` (arrow tip size), `groupInput`, `viewDesc`, `itMode`, `labelTrue`, `labelFalse`

### Vue Demo (`demo-f-g/src/`)
A Vue 3 + TypeScript app demonstrating the flowchart renderer. Currently minimal — `App.vue` just renders `HelloWorld.vue`.

### Documentation (`docs/`)
Chinese documentation for each flowchart element type (if, while, for, do, declare, assign, call, input, output, more). Each file describes the XML schema and visual rendering behavior.

### Sample Files (`fprg/`)
Contains `.fprg` example files including `_elements.fprg` which demonstrates all supported elements.

## Dependencies

- **Core library**: jQuery (in `lib/`)
- **Vue demo**: Vue 3.5, Vite 8, TypeScript 6, vue-tsc

## Notes

- The library fires `flowgorithmjs:preload` and `flowgorithmjs:postload` jQuery events on the output element for extensibility
- SVG download functionality is built into the rendered output
- Functions (subroutines) beyond `Main` are supported with proper START/RETURN endpoints