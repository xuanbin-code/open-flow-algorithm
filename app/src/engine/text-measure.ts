// ============================================================
// text-measure.ts — Canvas 文本渲染宽度测量工具
//
// 用于替代 label.length * 8 的粗略估算，
// 实现精确的节点宽度计算。
// ============================================================

let ctx: CanvasRenderingContext2D | null = null

function getCtx(): CanvasRenderingContext2D {
  if (!ctx) {
    ctx = document.createElement('canvas').getContext('2d')!
  }
  return ctx
}

/**
 * 测量文本在浏览器中的实际渲染宽度
 * @param text     待测量文本
 * @param fontSize 字号（px）
 * @param fontWeight 字重（'normal' | 'bold' | '600' 等）
 * @returns 文本渲染宽度（px）
 */
export function measureTextWidth(
  text: string,
  fontSize: number,
  fontWeight?: string,
): number {
  const c = getCtx()
  const weight = fontWeight ?? 'normal'
  c.font = `${weight} ${fontSize}px sans-serif`
  return c.measureText(text).width
}
