<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ImageLightbox from '../components/ImageLightbox.vue'
import { useMemoryStore } from '../stores/memoryStore'

const props = defineProps<{ memoryId: string }>()
const router = useRouter()
const memoryStore = useMemoryStore()

const memory = computed(() => memoryStore.getById(props.memoryId))

const lightboxVisible = ref(false)
const lightboxIndex = ref(0)
const openLightbox = (idx: number) => {
  lightboxIndex.value = idx
  lightboxVisible.value = true
}

const allMemories = computed(() => memoryStore.memories)
const currentPos = computed(() => allMemories.value.findIndex(m => m.memoryId === props.memoryId))
const prevMemory = computed(() => currentPos.value > 0 ? allMemories.value[currentPos.value - 1] : null)
const nextMemory = computed(() => currentPos.value < allMemories.value.length - 1 ? allMemories.value[currentPos.value + 1] : null)

const deleteConfirm = ref(false)
const handleDelete = () => {
  if (!deleteConfirm.value) { deleteConfirm.value = true; return }
  memoryStore.deleteMemory(props.memoryId)
  router.push('/memories')
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
</script>

<template>
  <section class="detail-view">
    <template v-if="memory">
      <div class="detail-nav">
        <RouterLink class="back-btn" to="/memories">← 全部回忆</RouterLink>
        <div class="detail-actions">
          <RouterLink :to="`/memory/${memory.memoryId}/edit`" class="action-btn edit-btn">编辑</RouterLink>
          <button
            class="action-btn delete-btn"
            :class="{ confirm: deleteConfirm }"
            @click="handleDelete"
          >
            {{ deleteConfirm ? '确认删除？' : '删除' }}
          </button>
        </div>
      </div>

      <h1 class="detail-title">{{ memory.title }}</h1>

      <!-- 元信息 -->
      <div class="detail-meta">
        <span class="meta-item">📅 {{ formatDate(memory.startDate) }}
          <template v-if="memory.startDate !== memory.endDate"> — {{ formatDate(memory.endDate) }}</template>
        </span>
        <span v-if="memory.companions.length" class="meta-item">👥 {{ memory.companions.join('、') }}</span>
        <span v-if="memory.cost" class="meta-item">💴 ¥{{ memory.cost.toLocaleString() }}</span>
        <span v-if="memory.cities.length" class="meta-item">📍 {{ memory.cities.join(' → ') }}</span>
      </div>

      <!-- 标签 -->
      <div v-if="memory.tags.length" class="tag-row">
        <span v-for="tag in memory.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>

      <!-- 图片画廊 -->
      <div v-if="memory.images.length" class="image-gallery">
        <img
          v-for="(img, idx) in memory.images"
          :key="idx"
          :src="img"
          class="gallery-thumb"
          :class="{ 'thumb-hero': idx === 0 }"
          alt="旅行图片"
          @click="openLightbox(idx)"
        />
      </div>

      <!-- 正文 -->
      <div class="detail-content">{{ memory.content }}</div>

      <!-- 上下篇导航 -->
      <div class="pagination-nav">
        <RouterLink
          v-if="prevMemory"
          :to="`/memory/${prevMemory.memoryId}`"
          class="page-link prev-link"
        >
          ← {{ prevMemory.title }}
        </RouterLink>
        <span v-else class="page-placeholder" />
        <RouterLink
          v-if="nextMemory"
          :to="`/memory/${nextMemory.memoryId}`"
          class="page-link next-link"
        >
          {{ nextMemory.title }} →
        </RouterLink>
      </div>
    </template>

    <template v-else>
      <div class="not-found">
        <div class="not-found-icon">🔍</div>
        <h2>未找到该回忆</h2>
        <RouterLink to="/memories" class="back-btn">返回列表</RouterLink>
      </div>
    </template>

    <ImageLightbox
      v-if="memory"
      v-model:index="lightboxIndex"
      :images="memory.images"
      :visible="lightboxVisible"
      @update:visible="lightboxVisible = $event"
    />
  </section>
</template>

<style scoped>
.detail-view { padding: 24px; max-width: 860px; margin: 0 auto; }

.detail-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.back-btn { color: #2e7d32; text-decoration: none; font-size: 14px; }
.detail-actions { display: flex; gap: 10px; }
.action-btn {
  padding: 6px 14px; border-radius: 7px; font-size: 13px; font-weight: 600;
  cursor: pointer; text-decoration: none; border: none;
}
.edit-btn { background: #e8f5e9; color: #2e7d32; }
.edit-btn:hover { background: #c8e6c9; }
.delete-btn { background: #f9fafb; color: #9ca3af; border: 1px solid #e4e7ed; }
.delete-btn.confirm { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }

.detail-title { font-size: 28px; font-weight: 800; color: #1f2937; margin: 0 0 16px; }

.detail-meta { display: flex; flex-wrap: wrap; gap: 14px; color: #6b7280; font-size: 14px; margin-bottom: 14px; }
.meta-item { display: flex; align-items: center; gap: 4px; }

.tag-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.tag { background: #e0f2fe; color: #0369a1; border-radius: 999px; padding: 3px 10px; font-size: 12px; }

.image-gallery {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 24px;
  max-height: 360px;
  overflow: hidden;
  border-radius: 12px;
}
.gallery-thumb {
  width: 100%;
  height: 180px;
  object-fit: cover;
  cursor: pointer;
  transition: opacity 200ms ease;
  border-radius: 4px;
}
.gallery-thumb.thumb-hero {
  grid-row: span 2;
  height: 100%;
}
.gallery-thumb:hover { opacity: 0.88; }

.detail-content {
  font-size: 16px;
  color: #374151;
  line-height: 1.9;
  white-space: pre-wrap;
  margin-bottom: 32px;
}

.pagination-nav {
  display: flex;
  justify-content: space-between;
  padding: 20px 0;
  border-top: 1px solid #e4e7ed;
  gap: 16px;
}
.page-link { color: #2e7d32; text-decoration: none; font-size: 14px; font-weight: 600; max-width: 45%; }
.prev-link { text-align: left; }
.next-link { text-align: right; margin-left: auto; }
.page-placeholder { flex: 1; }

.not-found { text-align: center; padding: 80px 20px; }
.not-found-icon { font-size: 48px; margin-bottom: 16px; }

/* ===== 移动端适配（≤768px）：画廊降 2 列、标题缩小 ===== */
@media (max-width: 768px) {
  .detail-view { padding: 16px; }
  .detail-title { font-size: 22px; }
  .image-gallery { grid-template-columns: 1fr 1fr; max-height: none; }
  .gallery-thumb { height: 140px; }
}
</style>
