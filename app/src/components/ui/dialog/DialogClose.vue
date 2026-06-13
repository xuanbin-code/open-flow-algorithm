<script setup lang="ts">
import type { DialogCloseProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { DialogClose } from "reka-ui"

const props = defineProps<DialogCloseProps & { class?: HTMLAttributes["class"] }>()
</script>

<template>
  <DialogClose v-bind="props">
    <slot />
  </DialogClose>
</template>
