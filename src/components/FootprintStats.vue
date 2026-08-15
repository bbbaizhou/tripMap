<script setup lang="ts">
const props = defineProps<{
  cityCount: number
  spotCount: number
  memoryCount: number
  photoCount: number
}>()
</script>

<template>
  <section class="stats-grid">
    <article class="stat-card">
      <div class="stat-head">
        <span class="stat-icon" aria-hidden="true">📍</span>
        <span class="stat-title">到访城市</span>
      </div>
      <div class="stat-value">{{ props.cityCount }}<span class="unit">座</span></div>
    </article>
    <article class="stat-card">
      <div class="stat-head">
        <span class="stat-icon" aria-hidden="true">🏔️</span>
        <span class="stat-title">打卡景区</span>
      </div>
      <div class="stat-value">{{ props.spotCount }}<span class="unit">个</span></div>
    </article>
    <article class="stat-card">
      <div class="stat-head">
        <span class="stat-icon" aria-hidden="true">📖</span>
        <span class="stat-title">回忆篇</span>
      </div>
      <div class="stat-value">{{ props.memoryCount }}<span class="unit">篇</span></div>
    </article>
    <article class="stat-card">
      <div class="stat-head">
        <span class="stat-icon" aria-hidden="true">📷</span>
        <span class="stat-title">旅行照片</span>
      </div>
      <div class="stat-value">{{ props.photoCount }}<span class="unit">张</span></div>
    </article>
  </section>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  position: relative;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 18px 16px;
  box-shadow: var(--shadow-card);
  transition: transform 200ms ease, box-shadow 200ms ease;
}
.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--color-primary);
  opacity: 0;
  transition: opacity 200ms ease;
}
.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}
.stat-card:hover::before {
  opacity: 1;
}

.stat-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stat-icon {
  flex-shrink: 0;
  background: var(--color-primary-lighter);
  border-radius: 10px;
  padding: 8px;
  font-size: 18px;
  line-height: 1;
}

.stat-title {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.stat-value {
  margin-top: 12px;
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.unit {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-left: 2px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
