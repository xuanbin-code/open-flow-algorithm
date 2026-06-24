import { ref } from 'vue'
import { check } from '@tauri-apps/plugin-updater'
import { isTauri } from '@/platform'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'up-to-date'
  | 'error'

export function useUpdater() {
  const status = ref<UpdateStatus>('idle')
  const latestVersion = ref<string | null>(null)
  const currentVersion = ref(__APP_VERSION__)
  const downloadProgress = ref<number>(0)
  const errorMessage = ref<string | null>(null)

  /**
   * Check for available updates.
   * Returns `true` if an update is available, `false` otherwise.
   */
  async function checkForUpdates(): Promise<boolean> {
    if (!isTauri()) {
      status.value = 'error'
      errorMessage.value = 'Updates are only available in the desktop app.'
      return false
    }

    status.value = 'checking'
    errorMessage.value = null
    downloadProgress.value = 0

    try {
      const update = await check()
      if (update) {
        status.value = 'available'
        latestVersion.value = update.version
        return true
      } else {
        status.value = 'up-to-date'
        latestVersion.value = null
        return false
      }
    } catch (err) {
      status.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : String(err)
      return false
    }
  }

  /**
   * Download and install the available update.
   * The app will restart automatically after installation.
   */
  async function downloadAndInstall(): Promise<void> {
    if (!isTauri()) return

    status.value = 'downloading'
    errorMessage.value = null
    downloadProgress.value = 0

    try {
      const update = await check()
      if (!update) {
        status.value = 'up-to-date'
        latestVersion.value = null
        return
      }

      let downloaded = 0
      let contentLength = 0

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0
            downloaded = 0
            break
          case 'Progress':
            downloaded += event.data.chunkLength
            if (contentLength > 0) {
              downloadProgress.value = Math.round((downloaded / contentLength) * 100)
            }
            break
          case 'Finished':
            downloadProgress.value = 100
            break
        }
      })

      // The app will restart automatically after downloadAndInstall completes
      status.value = 'installing'
    } catch (err) {
      status.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : String(err)
    }
  }

  /** Reset all state back to idle. */
  function reset() {
    status.value = 'idle'
    latestVersion.value = null
    downloadProgress.value = 0
    errorMessage.value = null
  }

  return {
    status,
    latestVersion,
    currentVersion,
    downloadProgress,
    errorMessage,
    checkForUpdates,
    downloadAndInstall,
    reset,
    isTauri,
  }
}
