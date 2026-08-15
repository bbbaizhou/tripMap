import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

export interface PwaInstallState {
  /** beforeinstallprompt 已触发 */
  isInstallable: Readonly<Ref<boolean>>
  /** appinstalled 或 display-mode:standalone */
  isInstalled: Readonly<Ref<boolean>>
  /** iOS Safari（无 beforeinstallprompt，提示手动加主屏） */
  isIOS: Readonly<Ref<boolean>>
  /** 调 event.prompt()；返回用户是否接受 */
  promptInstall: () => Promise<boolean>
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// 模块级单例状态 + 一次性监听（<script setup> 外使用也可，返回 ref）
const isInstallable = ref(false)
const isInstalled = ref(
  (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) ||
    (typeof navigator !== 'undefined' && Boolean((navigator as unknown as { standalone?: boolean }).standalone)),
)
const isIOS = ref(
  typeof window !== 'undefined' &&
    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream,
)

let deferredPrompt: BeforeInstallPromptEvent | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    isInstallable.value = true
  })
  window.addEventListener('appinstalled', () => {
    isInstalled.value = true
    isInstallable.value = false
  })
}

export function usePwaInstall(): PwaInstallState {
  const promptInstall = async (): Promise<boolean> => {
    const prompt = deferredPrompt
    if (!prompt) return false
    deferredPrompt = null
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') {
      isInstalled.value = true
      isInstallable.value = false
    }
    return choice.outcome === 'accepted'
  }

  return {
    isInstallable: readonly(isInstallable),
    isInstalled: readonly(isInstalled),
    isIOS: readonly(isIOS),
    promptInstall,
  }
}
