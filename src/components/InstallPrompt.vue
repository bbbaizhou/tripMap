<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePwaInstall } from '../composables/usePwaInstall'

const { isInstallable, isInstalled, isIOS, promptInstall } = usePwaInstall()

const SESSION_DISMISS_KEY = 'travel_footprint_install_dismissed'
const dismissed = ref(false)
const showIOSHint = ref(false)

// 运行时拼接，避免 Vite 将模板相对 URL 当作静态资源处理，且兼容 base:'./' 子路径部署
const installIconSrc = import.meta.env.BASE_URL + 'icons/icon.svg'

onMounted(() => {
  try {
    dismissed.value = sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'
  } catch {
    dismissed.value = false
  }
})

const visible = computed(
  () => !dismissed.value && !isInstalled.value && (isInstallable.value || isIOS.value),
)

const handleInstall = async () => {
  if (isIOS.value) {
    showIOSHint.value = true
    return
  }
  await promptInstall()
}

const handleDismiss = () => {
  dismissed.value = true
  showIOSHint.value = false
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, '1')
  } catch {
    // 隐私模式等场景 sessionStorage 可能不可用，忽略
  }
}
</script>

<template>
  <div v-if="visible" class="install-prompt">
    <div class="install-body">
      <img :src="installIconSrc" alt="旅行足迹" class="install-icon" />
      <div class="install-info">
        <div class="install-title">安装「旅行足迹」</div>
        <div class="install-desc">安装后可离线查看你的旅行足迹</div>
        <div v-if="showIOSHint" class="ios-hint">
          iOS 暂不支持一键安装：请在 Safari 中点击「分享」按钮，再选择「添加到主屏幕」。
        </div>
      </div>
      <div class="install-actions">
        <button class="install-btn" @click="handleInstall">立即安装</button>
        <button class="install-later" @click="handleDismiss">以后再说</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.install-prompt {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 16px;
  z-index: 1000;
}

.install-body {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
  padding: 12px 16px;
}

.install-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  flex-shrink: 0;
}

.install-info { flex: 1; min-width: 0; }
.install-title { font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
.install-desc { font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }
.ios-hint { font-size: 12px; color: var(--color-accent-blue); margin-top: 4px; line-height: 1.5; }

.install-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.install-btn {
  padding: 8px 16px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.install-btn:hover { background: var(--color-primary-light); }

.install-later {
  padding: 8px 10px;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
}

/* 手机端底部导航上方留出空间 */
@media (max-width: 768px) {
  .install-prompt {
    bottom: 72px;
  }
}
</style>
