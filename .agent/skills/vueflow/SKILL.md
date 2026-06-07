---
name: vueflow
description: Use when working with vueflow
---

# Vueflow Skill

Use when working with vueflow

## When to Use This Skill

Use this skill when you need to:
- understand vueflow features, APIs, and workflows
- find concrete code examples before implementing or debugging
- navigate the official documentation quickly through categorized references

## Quick Reference

### High-Signal Examples

**Example 1** (typescript):
```typescript
import { useVueFlow } from '@vue-flow/core'

const { onInit } = useVueFlow({ id: 'my-flow-instance' })

onInit((instance) => {
  // `instance` is the same type as the return of `useVueFlow` (VueFlowStore)
})
```

**Example 2** (typescript):
```typescript
<template>
  <VueFlow :nodes="nodes" :edges="edges" :apply-default="false" />
</template>
```

**Example 3** (jsx):
```jsx
<script setup>
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
</script>

<template>
  <VueFlow>
    <Background />
  </VueFlow>
</template>
```

**Example 4** (jsx):
```jsx
<script setup>
const { nodesDraggable } = useVueFlow()

const toggleNodesDraggable = () => {
  nodesDraggable.value = !nodesDraggable.value
}
</script>
```

**Example 5** (elixir):
```elixir
yarn add @vue-flow/background

# or
npm install @vue-flow/background
```

### Key Usage Notes

**Pattern 1:** Configuration ​This page covers the configuration options available for Vue Flow and how to use and set them.Options / Props ​Vue Flow allows you t...

```
<!-- Pass configuration as props -->
<template>
  <VueFlow :default-viewport="{ zoom: 0.5 }" :max-zoom="4" :min-zoom="0.1" />
</template>
```

**Pattern 2:** Viewport Functions ​Viewport Functions can be accessed via the useVueFlow utility or with the VueFlowStore instance provided by onPaneReady.Using E...

```
<script setup>
import { VueFlow, useVueFlow } from '@vue-flow/core'

const { onPaneReady } = useVueFlow()

// event handler
onPaneReady((instance) => instance.fitView())
</script>
```

## Reference Files

This skill includes comprehensive documentation in `references/`:

- **guide.md** - Guide documentation

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
