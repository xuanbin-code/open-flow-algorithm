// ============================================================
// useSound.ts — 音效 composable
//
// 封装 @rexa-developer/tiks，在 soundEffects 设置关闭时跳过播放。
// ============================================================

import { createTiks } from '@rexa-developer/tiks'
import { useSettingsStore } from '../stores/settings'

const tik = createTiks({ theme: 'soft' })

export function useSound() {
  const store = useSettingsStore()

  const ok = () => store.soundEffects

  return {
    /** 运行 / 步进开始 */
    playStart:       () => ok() && tik.notify(),
    /** 步进节拍（仅 Step 模式） */
    playTick:        () => ok() && tik.click(),
    /** 等待用户输入 */
    playInputPrompt: () => ok() && tik.warning(),
    /** 执行出错 */
    playError:       () => ok() && tik.error(),
    /** 执行完成 */
    playDone:        () => ok() && tik.success(),
    /** 手动终止 */
    playStop:        () => ok() && tik.toggle(false),
  }
}
