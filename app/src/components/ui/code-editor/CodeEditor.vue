<script setup lang="ts">
import { watch, onMounted, onUnmounted, ref, shallowRef, nextTick } from 'vue'
import { EditorState, type Extension, Compartment } from '@codemirror/state'
import {
  EditorView,
  keymap,
  placeholder as placeholderExt,
  drawSelection,
  highlightActiveLine,
} from '@codemirror/view'
import { autocompletion, acceptCompletion } from '@codemirror/autocomplete'
import { syntaxHighlighting, indentOnInput, bracketMatching, defaultHighlightStyle } from '@codemirror/language'
import { history, historyKeymap } from '@codemirror/commands'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'

import {
  flowgorithmLanguage,
  flowgorithmTheme,
  flowgorithmHighlightStyle,
  createFlowgorithmCompletions,
  type CompletionContextData,
} from '../../../lib/flowgorithmLanguage'

// ============================================================
// Props & Emits
// ============================================================

const props = withDefaults(defineProps<{
  modelValue: string
  singleLine?: boolean
  readonly?: boolean
  placeholder?: string
  completionContext?: CompletionContextData | null
}>(), {
  singleLine: true,
  readonly: false,
  placeholder: '',
  completionContext: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// ============================================================
// Template refs & state
// ============================================================

const editorHost = ref<HTMLDivElement>()
const editorView = shallowRef<EditorView | null>(null)

/** Guard flag to prevent update loops when syncing external modelValue changes */
let syncingFromProp = false

// ============================================================
// Compartment for dynamic autocomplete reconfiguration
// ============================================================

const autocompleteCompartment = new Compartment()

// ============================================================
// Build extensions
// ============================================================

function buildExtensions(): Extension[] {
  const extensions: Extension[] = [
    // Core
    flowgorithmLanguage,
    flowgorithmTheme,
    syntaxHighlighting(flowgorithmHighlightStyle),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    drawSelection(),
    highlightActiveLine(),

    // Editing features
    history(),
    bracketMatching(),
    closeBrackets(),
    indentOnInput(),
    keymap.of([...closeBracketsKeymap, ...historyKeymap]),

    // Editor view
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      spellcheck: 'false',
      autocomplete: 'off',
      autocapitalize: 'off',
    }),

    // Update listener for v-model sync
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !syncingFromProp) {
        const value = update.state.doc.toString()
        emit('update:modelValue', value)
      }
    }),
  ]

  // Readonly mode
  if (props.readonly) {
    extensions.push(EditorState.readOnly.of(true))
    extensions.push(EditorView.editable.of(false))
  }

  // Placeholder
  if (props.placeholder) {
    extensions.push(placeholderExt(props.placeholder))
  }

  // Single-line mode: block newline transactions, map Enter to accept completion
  if (props.singleLine) {
    extensions.push(
      EditorState.transactionFilter.of((tr) => {
        if (!tr.docChanged) return tr
        let hasNewline = false
        tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
          if (inserted.toString().includes('\n')) {
            hasNewline = true
          }
        })
        if (hasNewline) return []
        return tr
      }),
      keymap.of([
        { key: 'Enter', run: acceptCompletion },
      ]),
    )
  }

  // Autocomplete (dynamic via compartment)
  const completionSource = createFlowgorithmCompletions(props.completionContext ?? null)
  extensions.push(
    autocompleteCompartment.of(
      autocompletion({
        override: [completionSource],
        activateOnTyping: true,
        defaultKeymap: true,
      }),
    ),
  )

  return extensions
}

// ============================================================
// Lifecycle
// ============================================================

onMounted(() => {
  if (!editorHost.value) return

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: buildExtensions(),
  })

  const view = new EditorView({
    state,
    parent: editorHost.value,
  })

  editorView.value = view
})

onUnmounted(() => {
  editorView.value?.destroy()
  editorView.value = null
})

// ============================================================
// Watch external modelValue changes → update editor
// ============================================================

watch(
  () => props.modelValue,
  (newVal) => {
    const view = editorView.value
    if (!view) return
    if (syncingFromProp) return

    const currentVal = view.state.doc.toString()
    if (newVal === currentVal) return

    // Prevent the update listener from emitting back
    syncingFromProp = true
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: newVal,
      },
    })
    nextTick(() => {
      syncingFromProp = false
    })
  },
)

// ============================================================
// Watch completionContext → reconfigure autocomplete
// ============================================================

watch(
  () => props.completionContext,
  (newCtx) => {
    const view = editorView.value
    if (!view) return

    const source = createFlowgorithmCompletions(newCtx ?? null)
    view.dispatch({
      effects: autocompleteCompartment.reconfigure(
        autocompletion({
          override: [source],
          activateOnTyping: true,
          defaultKeymap: true,
        }),
      ),
    })
  },
)

// ============================================================
// Watch readonly
// ============================================================

watch(
  () => props.readonly,
  (_val) => {
    const view = editorView.value
    if (!view) return
    // Recreating editor is the simplest way to toggle readonly
    // since EditorState.readOnly is a facet set at state creation
    if (!editorHost.value) return

    const currentDoc = view.state.doc.toString()
    view.destroy()

    const state = EditorState.create({
      doc: currentDoc,
      extensions: buildExtensions(),
    })

    const newView = new EditorView({
      state,
      parent: editorHost.value,
    })

    editorView.value = newView
  },
)
</script>

<template>
  <div ref="editorHost" class="code-editor-host" />
</template>

<style scoped>
.code-editor-host {
  width: 100%;
}

/* Ensure CM6 editor fills the host */
.code-editor-host :deep(.cm-editor) {
  height: 100%;
  min-height: 28px;
}

/* For single-line mode, make the editor behave like an input */
.code-editor-host :deep(.cm-scroller) {
  overflow-x: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.code-editor-host :deep(.cm-scroller::-webkit-scrollbar) {
  display: none;
}

/* Hide the CM6 content attributes outline (we handle focus in theme) */
.code-editor-host :deep(.cm-content) {
  padding: 4px 8px;
  caret-color: var(--accent);
}
</style>
