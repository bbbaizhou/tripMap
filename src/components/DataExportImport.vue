<script setup lang="ts">
import { ref } from 'vue'
import { exportToJson, getStorageSize, importFromJson } from '../utils/exportImport'

const storageSize = ref(getStorageSize())
const importStatus = ref<{ type: 'success' | 'error'; msg: string } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)

const handleExport = () => {
  exportToJson()
}

const handleImportClick = () => {
  fileInput.value?.click()
}

const handleFileChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  importing.value = true
  importStatus.value = null
  const result = await importFromJson(file)
  importStatus.value = { type: result.success ? 'success' : 'error', msg: result.message }
  importing.value = false
  storageSize.value = getStorageSize()
  if (fileInput.value) fileInput.value.value = ''
  if (result.success) {
    setTimeout(() => window.location.reload(), 1200)
  }
}
</script>

<template>
  <div class="export-import">
    <div class="storage-info">
      <span class="storage-label">本地存储占用</span>
      <span class="storage-size">{{ storageSize }}</span>
      <span class="storage-hint">（上限约 5 MB）</span>
    </div>

    <div class="action-row">
      <div class="action-card">
        <div class="action-icon">📤</div>
        <div class="action-title">导出备份</div>
        <div class="action-desc">将所有数据下载为 JSON 文件，可用于迁移或备份。</div>
        <button class="action-btn export-btn" @click="handleExport">导出 JSON</button>
      </div>

      <div class="action-card">
        <div class="action-icon">📥</div>
        <div class="action-title">导入数据</div>
        <div class="action-desc">从 JSON 备份文件恢复数据（将覆盖当前所有数据）。</div>
        <button class="action-btn import-btn" :disabled="importing" @click="handleImportClick">
          {{ importing ? '导入中...' : '选择文件' }}
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          style="display:none"
          @change="handleFileChange"
        />
      </div>
    </div>

    <div v-if="importStatus" class="status-banner" :class="importStatus.type">
      {{ importStatus.msg }}
      <span v-if="importStatus.type === 'success'" style="margin-left:8px;font-size:12px">即将刷新页面…</span>
    </div>
  </div>
</template>

<style scoped>
.export-import { display: flex; flex-direction: column; gap: 20px; }

.storage-info {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; background: #f0fdf4;
  border: 1px solid #bbf7d0; border-radius: 10px;
  font-size: 14px;
}
.storage-label { color: #374151; font-weight: 600; }
.storage-size { color: #16a34a; font-weight: 700; font-size: 16px; }
.storage-hint { color: #9ca3af; }

.action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.action-card {
  padding: 24px; background: #fff;
  border: 1px solid #e4e7ed; border-radius: 12px;
  display: flex; flex-direction: column; gap: 10px;
}
.action-icon { font-size: 32px; }
.action-title { font-size: 16px; font-weight: 700; color: #1f2937; }
.action-desc { font-size: 13px; color: #6b7280; line-height: 1.5; flex: 1; }
.action-btn {
  align-self: flex-start; padding: 9px 20px;
  border: none; border-radius: 8px;
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.export-btn { background: #4caf50; color: #fff; }
.export-btn:hover:not(:disabled) { background: #43a047; }
.import-btn { background: #3b82f6; color: #fff; }
.import-btn:hover:not(:disabled) { background: #2563eb; }

.status-banner {
  padding: 12px 16px; border-radius: 8px; font-size: 14px;
}
.status-banner.success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.status-banner.error { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }
</style>
