<script setup lang="ts">
import type { DayPlan, DaySpot } from '../utils/aiClient'
import { toSpotId } from '../utils/aiPlanActions'

/**
 * 单日行程卡片（任务 5.3，纯展示 + 事件上抛）：
 * - 只读状态由父组件注入 props（addedSpotIds: string[]），不直接操作 store；
 * - spot 行尾「加入心愿单」按钮：已加入时 disabled + 「已加入」文案；
 * - 点击仅 emit('add-to-wishlist', spot)，store 写入统一收敛在父组件。
 */
const props = defineProps<{
  plan: DayPlan
  addedSpotIds: string[]
}>()

const emit = defineEmits<{
  (e: 'add-to-wishlist', spot: DaySpot): void
}>()

const isAdded = (spot: DaySpot): boolean => props.addedSpotIds.includes(toSpotId(spot))
</script>

<template>
  <article class="day-card">
    <div class="ai-badge">AI</div>
    <h3 class="day-title">第 {{ plan.day }} 天 · {{ plan.title }}</h3>
    <ul class="spot-list">
      <li v-for="spot in plan.spots" :key="spot.name" class="spot-row">
        <div class="spot-main">
          <span class="spot-name">{{ spot.name }}</span>
          <button
            class="wishlist-btn"
            :disabled="isAdded(spot)"
            @click="emit('add-to-wishlist', spot)"
          >
            {{ isAdded(spot) ? '已加入' : '加入心愿单' }}
          </button>
        </div>
        <span class="spot-meta">{{ spot.city }} · {{ spot.level }} · 建议停留 {{ spot.duration }} 小时</span>
        <span v-if="spot.tip" class="spot-tip">{{ spot.tip }}</span>
      </li>
    </ul>
    <div v-if="plan.budget" class="day-budget">当日预算：{{ plan.budget }}</div>
    <div v-if="plan.tips" class="day-tips">小贴士：{{ plan.tips }}</div>
  </article>
</template>

<style scoped>
/* 样式语言与 AiPlanView 原 day-card 一致，仅用现有变量，不引 Element Plus */
.day-card {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-md);
  box-shadow: var(--shadow-card);
}

.ai-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  background: var(--color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.day-title {
  margin: 0 0 var(--space-md);
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.spot-list {
  list-style: none;
  margin: 0 0 var(--space-md);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.spot-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
}

.spot-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.spot-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.wishlist-btn {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--color-surface);
  border: 1px solid var(--color-primary-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  white-space: nowrap;
}

.wishlist-btn:hover:not(:disabled) {
  background: var(--color-primary-lighter);
}

.wishlist-btn:disabled {
  color: var(--color-text-secondary);
  background: var(--color-primary-lighter);
  border-color: var(--color-border);
  cursor: not-allowed;
}

.spot-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.spot-tip {
  font-size: 12px;
  color: var(--color-primary);
}

.day-budget {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  margin-bottom: var(--space-xs);
}

.day-tips {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
