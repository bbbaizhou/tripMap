<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  images: string[]
  initialIndex?: number
  visible: boolean
}>(), {
  initialIndex: 0,
  visible: false,
})

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'switch', index: number): void
}>()

const currentIndex = defineModel<number>('index', { default: 0 })

const close = () => emit('update:visible', false)

const prev = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    emit('switch', currentIndex.value)
  }
}

const next = () => {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value++
    emit('switch', currentIndex.value)
  }
}

const currentSrc = computed(() => props.images[currentIndex.value] ?? '')

const onKeyDown = (e: KeyboardEvent) => {
  if (!props.visible) return
  if (e.key === 'Escape') close()
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}

onMounted(() => {
  currentIndex.value = props.initialIndex
  window.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="lightbox-overlay" @click.self="close">
      <button class="lb-close" aria-label="关闭" @click="close">✕</button>

      <button
        v-if="images.length > 1"
        class="lb-arrow lb-prev"
        :disabled="currentIndex === 0"
        aria-label="上一张"
        @click="prev"
      >‹</button>

      <img :src="currentSrc" class="lb-img" alt="旅行图片" />

      <button
        v-if="images.length > 1"
        class="lb-arrow lb-next"
        :disabled="currentIndex === images.length - 1"
        aria-label="下一张"
        @click="next"
      >›</button>

      <div v-if="images.length > 1" class="lb-counter">
        {{ currentIndex + 1 }} / {{ images.length }}
      </div>

      <div v-if="images.length > 1" class="lb-dots">
        <span
          v-for="(_, i) in images"
          :key="i"
          class="lb-dot"
          :class="{ active: i === currentIndex }"
          @click="currentIndex = i; emit('switch', i)"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lb-img {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  user-select: none;
}

.lb-close {
  position: absolute;
  top: 20px;
  right: 24px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: #fff;
  font-size: 22px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms ease;
}
.lb-close:hover { background: rgba(255, 255, 255, 0.3); }

.lb-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: #fff;
  font-size: 36px;
  width: 48px;
  height: 64px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms ease;
}
.lb-arrow:disabled { opacity: 0.25; cursor: default; }
.lb-arrow:not(:disabled):hover { background: rgba(255, 255, 255, 0.3); }
.lb-prev { left: 20px; }
.lb-next { right: 20px; }

.lb-counter {
  position: absolute;
  top: 22px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 12px;
  border-radius: 20px;
}

.lb-dots {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
}
.lb-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: background 150ms;
}
.lb-dot.active { background: #fff; }
</style>
