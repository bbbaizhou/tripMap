<script setup lang="ts">
import type { ScenicSpot } from '../types'

defineProps<{ spot: ScenicSpot }>()
const emit = defineEmits<{
  (e: 'check-in', spotId: string): void
  (e: 'toggle-wishlist', spotId: string): void
  (e: 'unmark', spotId: string): void
}>()
</script>

<template>
  <article class="spot-card" :class="{ 'is-visited': spot.status === 'visited', 'is-wishlist': spot.status === 'wishlist' }">
    <div class="card-top">
      <div class="spot-name">{{ spot.spotName }}</div>
      <span class="level-badge" :class="spot.level === '5A' ? 'badge-5a' : 'badge-4a'">
        {{ spot.level }}
      </span>
    </div>

    <div class="spot-info">
      <span>{{ spot.city }} · {{ spot.province }}</span>
      <span class="spot-type">{{ spot.type }}</span>
    </div>

    <p v-if="spot.description" class="spot-desc">{{ spot.description }}</p>

    <div class="card-footer">
      <span class="status-tag" :class="spot.status === 'visited' ? 'tag-visited' : 'tag-wishlist'">
        {{ spot.status === 'visited' ? '✓ 已打卡' : '♡ 心愿单' }}
        <span v-if="spot.status === 'visited' && spot.visitDate" class="visit-date">
          {{ spot.visitDate }}
        </span>
      </span>

      <div class="card-actions">
        <button v-if="spot.status !== 'visited'" class="btn btn-primary" @click="emit('check-in', spot.spotId)">
          打卡
        </button>
        <button v-if="spot.status === 'visited'" class="btn btn-ghost" @click="emit('unmark', spot.spotId)">
          退回心愿单
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.spot-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  border: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 200ms ease, box-shadow 200ms ease;
}
.spot-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.1);
}
.spot-card.is-visited {
  border-color: #c8e6c9;
  background: #f9fffe;
}
.spot-card.is-wishlist {
  border-color: #bbdefb;
  background: #f0f7ff;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.spot-name {
  font-weight: 700;
  font-size: 15px;
  color: #1f2937;
  flex: 1;
}
.level-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}
.badge-5a { background: #fff3e0; color: #e65100; }
.badge-4a { background: #e8f5e9; color: #2e7d32; }

.spot-info {
  font-size: 13px;
  color: #6b7280;
  display: flex;
  gap: 8px;
}
.spot-type {
  background: #f1f5f9;
  padding: 1px 6px;
  border-radius: 4px;
}

.spot-desc {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}
.status-tag {
  font-size: 12px;
  font-weight: 600;
}
.tag-visited { color: #2e7d32; }
.tag-wishlist { color: #3b82f6; }
.visit-date {
  font-weight: 400;
  color: #6b7280;
  margin-left: 4px;
}

.card-actions { display: flex; gap: 6px; }
.btn {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition: opacity 150ms ease;
}
.btn:hover { opacity: 0.85; }
.btn-primary { background: #4caf50; color: #fff; }
.btn-outline { background: transparent; border: 1px solid #3b82f6; color: #3b82f6; }
.btn-ghost { background: transparent; border: 1px solid #e4e7ed; color: #9ca3af; font-size: 11px; }
</style>
