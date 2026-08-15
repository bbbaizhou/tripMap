<script setup lang="ts">
import { computed, ref } from 'vue'
import MemoryCard from '../components/MemoryCard.vue'
import { useMemoryStore } from '../stores/memoryStore'

const memoryStore = useMemoryStore()

const filterTag = ref<string>('')

const groupedMemories = computed(() => {
  const entries = Array.from(memoryStore.groupedByYear.entries())
    .sort((a, b) => Number(b[0]) - Number(a[0]))
  if (!filterTag.value) return entries
  return entries
    .map(([year, mems]) => [year, mems.filter(m => m.tags.includes(filterTag.value))] as [string, typeof mems])
    .filter(([, mems]) => mems.length > 0)
})

const allTags = computed(() => {
  const tagCount = new Map<string, number>()
  memoryStore.memories.forEach(m => m.tags.forEach(t => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)))
  return Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20)
})
</script>

<template>
  <section class="memory-list-view">
    <div class="list-header">
      <div>
        <h2>旅行回忆</h2>
        <p>共 {{ memoryStore.memories.length }} 段旅程</p>
      </div>
      <RouterLink to="/memory/new" class="new-btn">+ 写回忆</RouterLink>
    </div>

    <!-- 标签快速筛选 -->
    <div v-if="allTags.length" class="tag-filter">
      <button
        :class="['tag-chip', !filterTag && 'active']"
        @click="filterTag = ''"
      >全部</button>
      <button
        v-for="[tag, count] in allTags"
        :key="tag"
        :class="['tag-chip', filterTag === tag && 'active']"
        @click="filterTag = filterTag === tag ? '' : tag"
      >{{ tag }} <span class="tag-count">{{ count }}</span></button>
    </div>

    <!-- 按年份分组列表 -->
    <div v-if="groupedMemories.length" class="memory-list">
      <section v-for="[year, memories] in groupedMemories" :key="year" class="year-group">
        <div class="year-label">{{ year }} 年</div>
        <div class="memory-items">
          <MemoryCard
            v-for="memory in memories"
            :key="memory.memoryId"
            :memory="memory"
          />
        </div>
      </section>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">✈️</div>
      <div class="empty-text">
        {{ filterTag ? `没有标签为「${filterTag}」的回忆` : '还没有旅行回忆' }}
      </div>
      <RouterLink v-if="!filterTag" to="/memory/new" class="empty-cta">记录第一段旅程</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.memory-list-view { padding: 24px; }

.list-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
}
.list-header h2 { margin: 0 0 4px; }
.list-header p { margin: 0; font-size: 14px; color: #6b7280; }
.new-btn {
  padding: 8px 18px; background: #4caf50; color: #fff; text-decoration: none;
  border-radius: 8px; font-weight: 600; font-size: 14px;
}
.new-btn:hover { background: #43a047; }

.tag-filter {
  display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;
  padding: 14px 16px; background: #fff;
  border: 1px solid #e4e7ed; border-radius: 12px;
}
.tag-chip {
  padding: 5px 12px; border: 1px solid #e4e7ed; border-radius: 999px;
  background: #f9fafb; font-size: 13px; cursor: pointer; color: #374151;
  display: flex; align-items: center; gap: 4px;
}
.tag-chip.active { background: #4caf50; color: #fff; border-color: #4caf50; }
.tag-chip:hover:not(.active) { border-color: #a7f3d0; }
.tag-count { font-size: 11px; opacity: 0.7; }

.memory-list { display: flex; flex-direction: column; gap: 28px; }
.year-group {}
.year-label {
  font-size: 20px; font-weight: 800; color: #1f2937;
  margin-bottom: 14px; padding-bottom: 8px;
  border-bottom: 2px solid #e8f5e9;
}
.memory-items { display: grid; gap: 14px; }

.empty-state { text-align: center; padding: 80px 20px; color: #9ca3af; }
.empty-icon { font-size: 48px; margin-bottom: 16px; }
.empty-text { font-size: 16px; font-weight: 600; color: #6b7280; margin-bottom: 16px; }
.empty-cta {
  display: inline-block; padding: 10px 24px; background: #4caf50;
  color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;
}
</style>
