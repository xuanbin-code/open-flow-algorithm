---
name: tauri
description: Use when working with tauri
---

# Tauri Skill

Use when working with tauri

## When to Use This Skill

Use this skill when you need to:
- understand tauri features, APIs, and workflows
- find concrete code examples before implementing or debugging
- navigate the official documentation quickly through categorized references

## Quick Reference

### High-Signal Examples

**Example 1** (json):
```json
{  "build": {    "beforeDevCommand": "trunk serve",    "devUrl": "http://localhost:1420",    "beforeBuildCommand": "trunk build",    "frontendDist": "../dist"  },  "app": {    "withGlobalTauri": true  }}
```

**Example 2** (json):
```json
[build]target = "./index.html"
[watch]ignore = ["./src-tauri"]
[serve]port = 1420open = falsews_protocol = "ws"
```

**Example 3** (json):
```json
{  "build": {    "beforeDevCommand": "npm run dev",    "beforeBuildCommand": "npm run build",    "devUrl": "http://localhost:3000",    "frontendDist": "../out"  }}
```

**Example 4** (json):
```json
{  "build": {    "beforeDevCommand": "yarn dev",    "beforeBuildCommand": "yarn build",    "devUrl": "http://localhost:3000",    "frontendDist": "../out"  }}
```

**Example 5** (json):
```json
{  "build": {    "beforeDevCommand": "pnpm dev",    "beforeBuildCommand": "pnpm build",    "devUrl": "http://localhost:3000",    "frontendDist": "../out"  }}
```

## Reference Files

This skill includes comprehensive documentation in `references/`:

- **start.md** - Start documentation

Use `view` to read specific reference files when detailed information is needed.

## Working with This Skill

### Start Here
Start with the getting_started or tutorials reference files for foundational concepts.

### For Specific Features
Use the appropriate category reference file (api, guides, etc.) for detailed information.

### For Code Examples
Use the high-signal examples above first, then open the matching reference file for full context.

## Notes

- This skill was automatically generated from official documentation
- Reference files preserve the structure and examples from source docs
- Code examples include language detection for better syntax highlighting
- Quick reference entries are filtered to avoid low-signal placeholders and inline tokens

## Updating

To refresh this skill with updated documentation:
1. Re-run the scraper with the same configuration
2. The skill will be rebuilt with the latest information
