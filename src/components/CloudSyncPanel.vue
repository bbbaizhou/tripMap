<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getLastSyncedAt, getSyncQueue, getSyncStatus, syncNow, type SyncStatus } from '../utils/syncService'

const status = ref<SyncStatus>(getSyncStatus())
const lastSyncedAt = ref(getLastSyncedAt())
const busy = ref(false)

// 网络在线状态（navigator 访问带守卫，与 syncService 同风格）
const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

// 唯一展示出口：disabled 优先 > 离线覆盖 > 服务态；在线时把残留 offline 映射回 idle（修复粘滞）
const displayStatus = computed<SyncStatus>(() => {
  if (status.value === 'disabled') return 'disabled' // 未配置不随网络变
  if (!online.value) return 'offline' // 离线覆盖 idle/error/syncing
  return status.value === 'offline' ? 'idle' : status.value // 在线时不再粘滞 offline
})

const STATUS_LABELS: Record<SyncStatus, string> = {
  disabled: '未配置',
  idle: '已就绪',
  syncing: '同步中…',
  offline: '离线',
  error: '同步异常',
}

const statusLabel = computed(() => STATUS_LABELS[displayStatus.value])
const lastSyncText = computed(() => lastSyncedAt.value ?? '暂无')
const pendingCount = computed(() => getSyncQueue().length)

const refresh = () => {
  status.value = getSyncStatus()
  lastSyncedAt.value = getLastSyncedAt()
}
const handleSync = async () => {
  busy.value = true
  await syncNow()
  refresh()
  busy.value = false
}
const onOnline = () => {
  online.value = true
  refresh() // refresh 仍同步服务层缓存，防后续服务态变化被吞
}
const onOffline = () => {
  online.value = false
  refresh()
}

onMounted(() => {
  // 初始即正确：先按当前 navigator.onLine 定展示态，再刷新服务层缓存
  online.value = navigator.onLine
  refresh()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
})
</script>

<template>
  <!-- 未配置：引导说明卡（不渲染按钮） -->
  <div v-if="status === 'disabled'" class="action-card sync-card">
    <div class="action-icon">☁️</div>
    <div class="action-title">云同步未配置</div>
    <div class="action-desc">
      配置后可将足迹数据备份到云端，多设备访问同一份数据。步骤如下：
      <ol class="guide-steps">
        <li>登录 <code>supabase.com</code> 新建项目（Free 套餐即可，无需支付）；</li>
        <li>左侧菜单 Project Settings → API，复制 Project URL 与 anon / public key；</li>
        <li>将项目根目录的 <code>.env.example</code> 复制为 <code>.env</code>，填入上面两项；</li>
        <li>重启 <code>npm run dev</code>，回到本页即可看到同步入口。</li>
      </ol>
      <strong class="local-safe">当前数据仍安全保存在本机，不影响任何功能。</strong>
    </div>
  </div>

  <!-- 已配置：状态徽标 + 待同步条数 + 立即同步按钮（dry-run 骨架） -->
  <div v-else class="action-card sync-card">
    <div class="sync-head">
      <span class="status-badge" :class="displayStatus">{{ statusLabel }}</span>
      <span class="pending-hint">待同步 {{ pendingCount }} 条</span>
    </div>
    <div class="action-desc">上次同步：{{ lastSyncText }}</div>
    <button
      class="action-btn sync-btn"
      :disabled="busy || status === 'syncing'"
      @click="handleSync"
    >
      {{ busy || status === 'syncing' ? '同步中…' : '立即同步' }}
    </button>
  </div>
</template>

<style scoped>
.sync-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}
.action-icon { font-size: 32px; }
.action-title { font-size: 16px; font-weight: 700; color: var(--color-text-primary); }
.action-desc { font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; }
.action-btn {
  align-self: flex-start;
  padding: 9px 20px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sync-btn { background: var(--color-primary-light); color: #fff; }
.sync-btn:hover:not(:disabled) { background: var(--color-primary); }

.guide-steps { margin: 6px 0 0; padding-left: 20px; }
.guide-steps li { margin-bottom: 4px; }
.guide-steps code {
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  font-size: 12px;
}
.local-safe { color: var(--color-primary); }

.sync-head { display: flex; align-items: center; gap: 10px; }
.status-badge {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}
.status-badge.idle {
  color: var(--color-primary);
  background: var(--color-primary-lighter);
}
.status-badge.syncing {
  color: var(--color-accent-blue);
  background: color-mix(in srgb, var(--color-accent-blue) 12%, var(--color-surface));
}
.status-badge.offline {
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-surface));
}
.status-badge.error {
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
}
.pending-hint { font-size: 13px; color: var(--color-text-secondary); }
</style>
