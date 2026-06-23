// ============================================================
// 预设流程图模板 — 内置常用算法模板
// 通过 Vite ?raw 导入在构建时将 .fprg 文件内联为字符串
// ============================================================

export interface PresetTemplate {
  /** 机器可读的标识符，如 "fibonacci"、"bubbleSort" */
  id: string
  /** i18n 键: newFileDialog.presets.<id>.name */
  nameKey: string
  /** i18n 键: newFileDialog.presets.<id>.desc */
  descKey: string
  /** 原始 .fprg XML 内容 */
  xml: string
  /** 分类键: newFileDialog.presetCategories.<category> */
  category: 'math' | 'loops' | 'arrays'
}

// ── Vite ?raw 导入 — 在构建时将文件内容内联为字符串 ──
import fibXml from '@/fprg/fib.fprg?raw'
import factorialXml from '@/fprg/factorial.fprg?raw'
import gcdXml from '@/fprg/gcd.fprg?raw'
import fizzBuzzXml from '@/fprg/fizzBuzz.fprg?raw'
import isPrimeXml from '@/fprg/isPrime.fprg?raw'
import sum1toNXml from '@/fprg/sum1toN.fprg?raw'
import multiplicationTableXml from '@/fprg/multiplicationTable.fprg?raw'
import maxOfThreeXml from '@/fprg/maxOfThree.fprg?raw'
import bubbleSortXml from '@/fprg/bubbleSort.fprg?raw'
import binarySearchXml from '@/fprg/binarySearch.fprg?raw'

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'fibonacci',
    nameKey: 'newFileDialog.presets.fibonacci.name',
    descKey: 'newFileDialog.presets.fibonacci.desc',
    xml: fibXml,
    category: 'loops',
  },
  {
    id: 'factorial',
    nameKey: 'newFileDialog.presets.factorial.name',
    descKey: 'newFileDialog.presets.factorial.desc',
    xml: factorialXml,
    category: 'math',
  },
  {
    id: 'gcd',
    nameKey: 'newFileDialog.presets.gcd.name',
    descKey: 'newFileDialog.presets.gcd.desc',
    xml: gcdXml,
    category: 'math',
  },
  {
    id: 'fizzBuzz',
    nameKey: 'newFileDialog.presets.fizzBuzz.name',
    descKey: 'newFileDialog.presets.fizzBuzz.desc',
    xml: fizzBuzzXml,
    category: 'loops',
  },
  {
    id: 'isPrime',
    nameKey: 'newFileDialog.presets.isPrime.name',
    descKey: 'newFileDialog.presets.isPrime.desc',
    xml: isPrimeXml,
    category: 'math',
  },
  {
    id: 'sum1toN',
    nameKey: 'newFileDialog.presets.sum1toN.name',
    descKey: 'newFileDialog.presets.sum1toN.desc',
    xml: sum1toNXml,
    category: 'math',
  },
  {
    id: 'multiplicationTable',
    nameKey: 'newFileDialog.presets.multiplicationTable.name',
    descKey: 'newFileDialog.presets.multiplicationTable.desc',
    xml: multiplicationTableXml,
    category: 'loops',
  },
  {
    id: 'maxOfThree',
    nameKey: 'newFileDialog.presets.maxOfThree.name',
    descKey: 'newFileDialog.presets.maxOfThree.desc',
    xml: maxOfThreeXml,
    category: 'arrays',
  },
  {
    id: 'bubbleSort',
    nameKey: 'newFileDialog.presets.bubbleSort.name',
    descKey: 'newFileDialog.presets.bubbleSort.desc',
    xml: bubbleSortXml,
    category: 'arrays',
  },
  {
    id: 'binarySearch',
    nameKey: 'newFileDialog.presets.binarySearch.name',
    descKey: 'newFileDialog.presets.binarySearch.desc',
    xml: binarySearchXml,
    category: 'arrays',
  },
]
