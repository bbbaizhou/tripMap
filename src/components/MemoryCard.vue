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
      <!-- 封面层（16:10；有图用首图，无图深绿渐变 + 🌏 水印） -->
      <div class="memory-cover">
        <img v-if="props.memory.images[0]" :src="props.memory.images[0]" alt="" loading="lazy" />
        <span v-else class="cover-placeholder" aria-hidden="true">🌏</span>
      </div>
      <div class="memory-body">
        <div class="memory-title">{{ props.memory.title }}</div>
        <div class="memory-meta">
          {{ formatDate(props.memory.startDate) }} - {{ formatDate(props.memory.endDate) }}
        </div>
        <div class="memory-tags">
          <span v-for="tag in props.memory.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
        <p class="memory-summary">{{ props.memory.content }}</p>
      </div>
    </article>
  </RouterLink>

  <article v-else class="memory-card">
    <div class="memory-cover">
      <span class="cover-placeholder" aria-hidden="true">🌏</span>
    </div>
    <div class="memory-body">
      <div class="memory-title">旅行回忆卡片</div>
      <div class="memory-meta">未知时间 - 未知时间</div>
      <div class="memory-tags"></div>
      <p class="memory-summary">这里用于展示回忆标题、时间、标签与图片摘要。</p>
    </div>
  </article>
</template>

<style scoped>
.memory-link {
  color: inherit;
  text-decoration: none;
}

.memory-card {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  overflow: hidden;
  transition: border-color 200ms ease;
}

/* 封面层：16:10 图像驱动 */
.memory-cover {
  aspect-ratio: 16 / 10;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-forest-700), var(--color-forest-500));
}
.memory-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 400ms ease;
}
.cover-placeholder {
  font-size: 40px;
  line-height: 1;
  opacity: 0.5;
}

.memory-body {
  padding: 16px;
}

.memory-link:hover .memory-card {
  border-color: var(--color-natgeo);
}
.memory-link:hover .memory-cover img {
  transform: scale(1.03);
}

.memory-title {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 8px;
}

.memory-meta {
  color: var(--color-text-secondary);
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.memory-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.tag {
  background: var(--color-primary-lighter);
  color: var(--color-primary);
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
