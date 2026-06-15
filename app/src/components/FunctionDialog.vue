<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FunctionDef, Parameter } from '../engine/fprg-ast'
import { Plus, Trash2, SquareFunction } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'

const { t } = useI18n()

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  visible: boolean
  function: FunctionDef | null   // null = 新建模式
  existingNames: string[]
}>()

const emit = defineEmits<{
  close: []
  save: [func: FunctionDef]
}>()

// ============================================================
// Local state
// ============================================================

const isNew = computed(() => props.function === null)

const name = ref('')
const returnType = ref('None')
const returnVariable = ref('')
const params = reactive<Parameter[]>([])

const nameError = ref('')

const RETURN_TYPES = ['None', 'Integer', 'Real', 'String', 'Boolean']

// ============================================================
// Watch: sync props → local state
// ============================================================

watch(
  () => [props.visible, props.function] as const,
  ([visible, func]) => {
    if (visible) {
      if (func) {
        name.value = func.name
        returnType.value = func.type || 'None'
        returnVariable.value = func.variable || ''
        params.splice(0, params.length, ...func.parameters.map(p => ({ ...p })))
      } else {
        name.value = ''
        returnType.value = 'None'
        returnVariable.value = ''
        params.length = 0
      }
      nameError.value = ''
    }
  },
  { immediate: true },
)

// ============================================================
// Computed
// ============================================================

const showReturnVar = computed(() => returnType.value !== 'None' && returnType.value !== '')

const canSave = computed(() => name.value.trim().length > 0 && !nameError.value)

// ============================================================
// Validation
// ============================================================

function validateName() {
  const n = name.value.trim()
  if (!n) {
    nameError.value = t('functions.nameRequired')
    return
  }
  if (props.existingNames.some(existing => {
    if (isNew.value) return existing === n
    return existing === n && existing !== props.function!.name
  })) {
    nameError.value = t('functions.nameDuplicate', { name: n })
    return
  }
  if (/\s/.test(n)) {
    nameError.value = t('functions.nameNoSpaces')
    return
  }
  nameError.value = ''
}

// ============================================================
// Parameter CRUD
// ============================================================

function addParam() {
  params.push({ name: '', type: 'Integer', array: false })
}

function removeParam(index: number) {
  params.splice(index, 1)
}

// ============================================================
// Save
// ============================================================

function onSave() {
  validateName()
  if (nameError.value) return

  const funcDef: FunctionDef = {
    kind: 'function',
    name: name.value.trim(),
    type: returnType.value,
    variable: showReturnVar.value ? returnVariable.value.trim() : '',
    parameters: params.filter(p => p.name.trim()).map(p => ({
      name: p.name.trim(),
      type: p.type,
      array: p.array,
    })),
    body: props.function?.body ?? [],
  }

  emit('save', funcDef)
}
</script>

<template>
  <Dialog :open="props.visible" @update:open="(open) => !open && emit('close')">
    <DialogContent class="sm:max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <SquareFunction :size="18" class="text-accent" />
          <span>
            {{ isNew ? $t('functions.newFunction') : $t('functions.editFunction', { name: props.function?.name }) }}
          </span>
        </DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <!-- Function Name -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {{ $t('functions.functionName') }}
          </label>
          <Input
            v-model="name"
            :class="{ 'border-destructive': nameError }"
            :placeholder="$t('functions.namePlaceholder')"
            :readonly="!isNew && props.function?.name === 'Main'"
            @update:model-value="validateName"
            @keydown.enter="onSave"
          />
          <span v-if="nameError" class="text-xs text-destructive">{{ nameError }}</span>
        </div>

        <!-- Return Type -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {{ $t('functions.returnType') }}
          </label>
          <Select v-model="returnType">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="rt in RETURN_TYPES" :key="rt" :value="rt">
                {{ rt === 'None' ? $t('functions.noReturn') : rt }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Return Variable -->
        <div v-if="showReturnVar" class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {{ $t('functions.returnVariable') }}
          </label>
          <Input v-model="returnVariable" :placeholder="$t('functions.returnVarPlaceholder')" />
        </div>

        <!-- Parameters -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {{ $t('functions.parameters') }}
            </span>
            <Button variant="outline" size="xs" @click="addParam">
              <Plus :size="13" />
              {{ $t('functions.addParameter') }}
            </Button>
          </div>

          <Table v-if="params.length > 0">
            <TableHeader>
              <TableRow>
                <TableHead>{{ $t('functions.paramName') }}</TableHead>
                <TableHead>{{ $t('functions.paramType') }}</TableHead>
                <TableHead class="text-center">{{ $t('functions.paramArray') }}</TableHead>
                <TableHead class="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(p, i) in params" :key="i">
                <TableCell class="py-1">
                  <Input v-model="p.name" class="h-7 text-xs" :placeholder="$t('functions.paramNamePlaceholder')" />
                </TableCell>
                <TableCell class="py-1">
                  <Select v-model="p.type">
                    <SelectTrigger class="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Integer">Integer</SelectItem>
                      <SelectItem value="Real">Real</SelectItem>
                      <SelectItem value="String">String</SelectItem>
                      <SelectItem value="Boolean">Boolean</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell class="py-1 text-center">
                  <Checkbox :checked="p.array" @update:checked="p.array = $event" />
                </TableCell>
                <TableCell class="py-1">
                  <Button variant="ghost" size="icon-sm" :title="$t('common.delete')" @click="removeParam(i)">
                    <Trash2 :size="13" class="text-muted-foreground hover:text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div v-else class="rounded-md border border-dashed px-4 py-6 text-center text-xs italic text-muted-foreground">
            {{ $t('functions.noParameters') }}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('close')">
          {{ $t('common.cancel') }}
        </Button>
        <Button :disabled="!canSave" @click="onSave">
          {{ $t('common.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
