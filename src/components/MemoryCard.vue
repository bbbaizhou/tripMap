<script setup lang="ts">
import type { TravelMemory } from '../types'

const props = withDefaults(
  defineProps<{
    memory?: TravelMemory
  }>(),
  {
    memory: undefined,
  },
)

const formatDate = (value?: string) => {
  if (!value) {
    return '未知时间'
  }
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <RouterLink v-if="props.memory" :to="`/memory/${props.memory.memoryId}`" class="memory-link">
    <article class="memory-card">
      <div class="memory-title">{{ props.memory.title }}</div>
      <div class="memory-meta">
        {{ formatDate(props.memory.startDate) }} - {{ formatDate(props.memory.endDate) }}
      </div>
      <div class="memory-tags">
        <span v-for="tag in props.memory.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>
      <p class="memory-summary">{{ props.memory.content }}</p>
    </article>
  </RouterLink>

  <article v-else class="memory-card">
    <div class="memory-title">旅行回忆卡片</div>
    <div class="memory-meta">未知时间 - 未知时间</div>
    <div class="memory-tags"></div>
    <p class="memory-summary">这里用于展示回忆标题、时间、标签与图片摘要。</p>
  </article>
</template>

<style scoped>
.memory-link {
  color: inherit;
  text-decoration: none;
}

.memory-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.memory-title {
  font-weight: 700;
  margin-bottom: 8px;
}

.memory-meta {
  color: #64748b;
  font-size: 13px;
  margin-bottom: 10px;
}

.memory-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.tag {
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 12px;
}

.memory-summary {
  margin: 0;
  color: #475569;
  line-height: 1.6;
}
</style>
