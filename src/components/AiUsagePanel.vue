<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AI_FEEDBACK_KEY,
  clearAiUsage,
  exportAiUsage,
  getAiFeedback,
  getAiUsage,
  type AiAction,
  type AiFeedbackRecord,
  type AiUsageSummary,
} from '../utils/aiTracking'

/** 动作展示名（与 5.8 规格 AiAction 全集一一对应）。 */
const ACTION_LABELS: Record<AiAction, string> = {
  itinerary: '行程规划',
  insights: '数据洞察',
  autoTag: '自动标签',
  spotInfo: '信息补全',
  coords: '坐标兜底',
  shareCard: '分享卡片',
}
const ACTION_ORDER: AiAction[] = ['itinerary', 'insights', 'autoTag', 'spotInfo', 'coords', 'shareCard']

const RATING_LABELS: Record<'up' | 'down', string> = { up: '👍', down: '👎' }

/** 面板挂载时读取一次；操作后 refresh 重读（组件随 tab v-if 挂载，天然取最新）。 */
const usage = ref<AiUsageSummary>(getAiUsage())
const feedback = ref<AiFeedbackRecord[]>(getAiFeedback())

const refresh = () => {
  usage.value = getAiUsage()
  feedback.value = getAiFeedback()
}

const usageRows = computed(() =>
  ACTION_ORDER.map((action) => ({
    action,
    label: ACTION_LABELS[action],
    success: usage.value[action]?.success ?? 0,
    fail: usage.value[action]?.fail ?? 0,
  })),
)

const totalSuccess = computed(() => usageRows.value.reduce((sum, row) => sum + row.success, 0))
const totalFail = computed(() => usageRows.value.reduce((sum, row) => sum + row.fail, 0))

/** 导出 JSON：exportAiUsage 序列化 → Blob 下载。 */
const onExport = () => {
  try {
    const json = exportAiUsage()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `travel-footprint-ai-usage-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.warn('[AiUsagePanel] 导出失败', err)
  }
}

/** 一键清空：使用计数（clearAiUsage）+ 反馈（AI_FEEDBACK_KEY 独立 key，仅本面板管理）。 */
const onClear = () => {
  if (!window.confirm('确定清空全部 AI 使用统计与反馈？')) return
  clearAiUsage()
  try {
    localStorage.removeItem(AI_FEEDBACK_KEY)
  } catch (err) {
    console.warn('[AiUsagePanel] 清空反馈失败，已静默降级', err)
  }
  refresh()
}

/** 时间格式化（本地时区 YYYY-MM-DD HH:mm）；坏数据原样返回。 */
const formatTime = (iso: string): string => {
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="ai-usage-panel">
    <div class="usage-header">
      <h4>AI 使用统计</h4>
      <div class="usage-actions">
        <button class="usage-btn" @click="onExport">导出 JSON</button>
        <button class="usage-btn usage-btn-danger" @click="onClear">清空</button>
      </div>
    </div>

    <p class="usage-total">累计成功 {{ totalSuccess }} 次 / 失败 {{ totalFail }} 次</p>

    <table class="usage-table">
      <thead>
        <tr>
          <th>动作</th>
          <th>成功</th>
          <th>失败</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in usageRows" :key="row.action">
          <td>{{ row.label }}</td>
          <td class="num-ok">{{ row.success }}</td>
          <td class="num-fail">{{ row.fail }}</td>
        </tr>
      </tbody>
    </table>

    <h4 class="feedback-title">行程反馈（{{ feedback.length }} 条）</h4>
    <div v-if="feedback.length" class="feedback-list">
      <div v-for="(item, index) in feedback" :key="index" class="feedback-item">
        <span class="feedback-rating">{{ RATING_LABELS[item.rating] ?? item.rating }}</span>
        <span class="feedback-action">{{ ACTION_LABELS[item.action] ?? item.action }}</span>
        <span class="feedback-summary">{{ item.summary || '—' }}</span>
        <span class="feedback-time">{{ formatTime(item.at) }}</span>
      </div>
    </div>
    <div v-else class="feedback-empty">暂无反馈</div>

    <p class="usage-note">数据仅保存在本机（localStorage 独立 key），不参与云同步，可随时导出或清空</p>
  </div>
</template>

<style scoped>
.ai-usage-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-card);
}

.usage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.usage-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.usage-actions {
  display: inline-flex;
  gap: 8px;
}

.usage-btn {
  padding: 6px 14px;
  background: var(--color-surface);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
}

.usage-btn:hover {
  background: var(--color-primary-lighter);
}

.usage-btn-danger {
  color: #dc2626;
  border-color: #fca5a5;
}

.usage-btn-danger:hover {
  background: #fef2f2;
}

.usage-total {
  margin: var(--space-sm) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.usage-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.usage-table th,
.usage-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}

.usage-table th {
  color: var(--color-text-secondary);
  font-weight: 600;
}

.num-ok {
  color: var(--color-primary);
  font-weight: 600;
}

.num-fail {
  color: #dc2626;
  font-weight: 600;
}

.feedback-title {
  margin: var(--space-lg) 0 var(--space-sm);
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.feedback-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.feedback-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.feedback-rating {
  flex-shrink: 0;
}

.feedback-action {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--color-text-primary);
}

.feedback-summary {
  flex: 1;
  min-width: 0;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feedback-time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.feedback-empty {
  padding: var(--space-md);
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.usage-note {
  margin: var(--space-md) 0 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
</style>
