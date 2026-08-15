<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { pullCloudAndApply } from '../utils/cloudPull'
import { getLastSyncedAt, getLastSyncError, getSyncQueue, getSyncStatus, syncNow, type SyncStatus } from '../utils/syncService'

const auth = useAuthStore()

const status = ref<SyncStatus>(getSyncStatus())
const lastSyncedAt = ref(getLastSyncedAt())
const lastSyncError = ref(getLastSyncError())
const busy = ref(false)

// 网络在线状态（navigator 访问带守卫，与 syncService 同风格）
const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

// 唯一展示出口：disabled 优先 > 离线覆盖 > 已登录粘滞修复 > 服务态。
// 在线时把残留 offline 映射回 idle（修复粘滞）；已登录时把登录前残留的
// needsLogin 映射回 idle（登录后不再提示「请先登录」）。
const displayStatus = computed<SyncStatus>(() => {
  if (status.value === 'disabled') return 'disabled' // 未配置不随网络变
  if (!online.value) return 'offline' // 离线覆盖 idle/error/syncing
  if (status.value === 'offline') return 'idle' // 在线时不再粘滞 offline
  if (auth.isLoggedIn && status.value === 'needsLogin') return 'idle' // 已登录不再粘滞 needsLogin
  return status.value
})

const STATUS_LABELS: Record<SyncStatus, string> = {
  disabled: '未配置',
  idle: '已就绪',
  syncing: '同步中…',
  offline: '离线',
  error: '同步异常',
  needsLogin: '请先登录',
}

const statusLabel = computed(() => STATUS_LABELS[displayStatus.value])
const lastSyncText = computed(() => lastSyncedAt.value ?? '暂无')
const pendingCount = computed(() => getSyncQueue().length)

const refresh = () => {
  status.value = getSyncStatus()
  lastSyncedAt.value = getLastSyncedAt()
  lastSyncError.value = getLastSyncError()
}
const handleSync = async () => {
  if (!auth.isLoggedIn) {
    auth.openAuthPanel() // 防御兜底：未登录态按钮已隐藏，此处避免误触发推送
    return
  }
  busy.value = true
  await syncNow()
  refresh()
  busy.value = false
}
const handlePull = async () => {
  if (!auth.isLoggedIn) return // 防御兜底：未登录态按钮已隐藏
  busy.value = true
  await pullCloudAndApply()
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
        <li>重启 <code>npm run dev</code>，回到本页即可看到同步入口；</li>
        <li>在 Supabase SQL Editor 执行 <code>docs/supabase_schema.sql</code> 建表；</li>
        <li>首次同步前需先登录。</li>
      </ol>
      <strong class="local-safe">当前数据仍安全保存在本机，不影响任何功能。</strong>
    </div>
  </div>

  <!-- 已配置、未登录：请先登录卡 -->
  <div v-else-if="!auth.isLoggedIn" class="action-card sync-card">
    <div class="action-icon">🔐</div>
    <div class="action-title">请先登录</div>
    <div class="action-desc">
      云同步需要登录账号。
      <template v-if="pendingCount > 0">当前有 {{ pendingCount }} 条变更待同步，登录后即可推送到云端。</template>
      <template v-else>登录后即可将数据备份到云端。</template>
      <div class="sync-hint">另请确认已在 Supabase 执行 <code>docs/supabase_schema.sql</code> 建表。</div>
    </div>
    <button class="action-btn sync-btn" @click="auth.openAuthPanel()">登录</button>
  </div>

  <!-- 已配置、已登录：同步 UI + 用户邮箱 -->
  <div v-else class="action-card sync-card">
    <div class="sync-head">
      <span class="status-badge" :class="displayStatus">{{ statusLabel }}</span>
      <span class="pending-hint">待同步 {{ pendingCount }} 条</span>
    </div>
    <div class="action-desc">上次同步：{{ lastSyncText }}</div>
    <div v-if="displayStatus === 'error' && lastSyncError" class="sync-error">{{ lastSyncError }}</div>
    <div class="sync-user">当前账号：{{ auth.user?.email }}</div>
    <div class="sync-actions">
      <button
        class="action-btn sync-btn"
        :disabled="busy || status === 'syncing'"
        @click="handleSync"
      >
        {{ busy || status === 'syncing' ? '同步中…' : '立即同步' }}
      </button>
      <button
        class="action-btn sync-btn"
        :disabled="busy || status === 'syncing'"
        @click="handlePull"
      >
        {{ busy || status === 'syncing' ? '同步中…' : '立即拉取' }}
      </button>
    </div>
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
.sync-actions { display: flex; gap: 10px; flex-wrap: wrap; }

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
.sync-hint { margin-top: 8px; font-size: 12px; color: var(--color-text-secondary); }
.sync-hint code {
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  font-size: 12px;
}

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
.status-badge.offline,
.status-badge.needsLogin {
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-surface));
}
.status-badge.error {
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
}
.pending-hint { font-size: 13px; color: var(--color-text-secondary); }
.sync-error {
  padding: 8px 12px;
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
  color: var(--color-accent);
  border-radius: var(--radius-md);
  font-size: 13px;
}
.sync-user { font-size: 12px; color: var(--color-text-secondary); }
</style>
