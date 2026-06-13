<script setup lang="ts">
import { computed } from 'vue'
import { useSettings } from '../composables/useSettings'
import { ACCENT_PRESETS } from '../utils/color-palette'
import { Sun, Moon, Settings, Check } from './icons'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// ============================================================
// Settings state
// ============================================================

const { settings } = useSettings()

// ============================================================
// Accent color state
// ============================================================

const activePresetId = computed(() => {
  const val = settings.value.accentColor
  if (val.startsWith('#')) return null
  return val
})

const customColorHex = computed({
  get: () => {
    const val = settings.value.accentColor
    return val.startsWith('#') ? val : '#4fc3f7'
  },
  set: (hex: string) => {
    settings.value.accentColor = hex
  },
})

function selectPreset(presetId: string) {
  settings.value.accentColor = presetId
}

function onCustomColorChange(e: Event) {
  const input = e.target as HTMLInputElement
  settings.value.accentColor = input.value
}

// ============================================================
// Theme toggle
// ============================================================

function toggleTheme() {
  settings.value.theme = settings.value.theme === 'dark' ? 'light' : 'dark'
}

// ============================================================
// Language (bidirectional binding)
// ============================================================

const languageValue = computed({
  get: () => settings.value.language,
  set: (val: string) => { settings.value.language = val },
})
</script>

<template>
  <Dialog :open="props.visible" @update:open="(open) => !open && emit('close')">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Settings :size="20" />
          <span>{{ $t('settings.title') }}</span>
        </DialogTitle>
        <DialogDescription>
          {{ $t('settings.themeColorDesc') }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-6 py-2">
        <!-- 1. Language -->
        <div class="flex items-center justify-between">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-medium leading-none">{{ $t('settings.languageLabel') }}</span>
            <span class="text-xs text-muted-foreground">{{ $t('settings.languageDesc') }}</span>
          </div>
          <Select v-model="languageValue">
            <SelectTrigger class="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh-CN">{{ $t('settings.zhCN') }}</SelectItem>
              <SelectItem value="en">{{ $t('settings.enUS') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- 2. Theme color -->
        <div class="flex flex-col gap-2">
          <div>
            <span class="text-sm font-medium leading-none">{{ $t('settings.themeColor') }}</span>
          </div>
          <!-- Preset swatches -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in ACCENT_PRESETS"
              :key="preset.id"
              class="flex flex-col items-center gap-1 rounded-lg p-2 transition-colors hover:bg-accent/10"
              :class="{ 'bg-accent/15': activePresetId === preset.id }"
              :title="preset.name"
              @click="selectPreset(preset.id)"
            >
              <span
                class="flex size-7 items-center justify-center rounded-full border-2 transition-all"
                :class="activePresetId === preset.id ? 'border-foreground scale-110' : 'border-transparent'"
                :style="{ background: preset.dark }"
              >
                <Check v-if="activePresetId === preset.id" class="size-3.5 text-white drop-shadow" />
              </span>
              <span
                class="text-[10px]"
                :class="activePresetId === preset.id ? 'text-foreground' : 'text-muted-foreground'"
              >
                {{ preset.name }}
              </span>
            </button>
          </div>
          <!-- Custom color -->
          <div class="flex items-center gap-3">
            <span class="text-xs text-muted-foreground">{{ $t('settings.customColor') }}</span>
            <input
              type="color"
              class="size-7 cursor-pointer rounded border border-input bg-transparent p-0.5"
              :value="customColorHex"
              @input="onCustomColorChange"
            />
            <span class="text-xs font-mono text-muted-foreground">{{ customColorHex }}</span>
          </div>
        </div>

        <Separator />

        <!-- 3. Dark/Light toggle -->
        <div class="flex items-center justify-between">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-medium leading-none">{{ $t('settings.darkLightMode') }}</span>
            <span class="text-xs text-muted-foreground">{{ $t('settings.darkLightDesc') }}</span>
          </div>
          <Button variant="outline" @click="toggleTheme">
            <Moon v-if="settings.theme === 'dark'" :size="16" />
            <Sun v-else :size="16" />
            <span>{{ settings.theme === 'dark' ? $t('settings.dark') : $t('settings.light') }}</span>
          </Button>
        </div>

        <Separator />

        <!-- 4. Sound effects -->
        <div class="flex items-center justify-between">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-medium leading-none">{{ $t('settings.soundEffects') }}</span>
            <span class="text-xs text-muted-foreground">{{ $t('settings.soundEffectsDesc') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <Checkbox
              :checked="settings.soundEffects"
              @update:checked="(v: boolean) => settings.soundEffects = v"
            />
            <span class="text-xs text-muted-foreground">
              {{ settings.soundEffects ? $t('common.on') : $t('common.off') }}
            </span>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button @click="emit('close')">
          {{ $t('common.close') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
