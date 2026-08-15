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
      <div class="stat-title">到访城市</div>
      <div class="stat-value">{{ props.cityCount }}</div>
    </article>
    <article class="stat-card">
      <div class="stat-title">打卡景区</div>
      <div class="stat-value">{{ props.spotCount }}</div>
    </article>
    <article class="stat-card">
      <div class="stat-title">回忆篇</div>
      <div class="stat-value">{{ props.memoryCount }}</div>
    </article>
    <article class="stat-card">
      <div class="stat-title">旅行照片</div>
      <div class="stat-value">{{ props.photoCount }}</div>
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
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.stat-title {
  color: #6b7280;
  font-size: 14px;
}

.stat-value {
  margin-top: 12px;
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
}
</style>
