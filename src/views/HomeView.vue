<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import FootprintStats from '../components/FootprintStats.vue'
import MemoryCard from '../components/MemoryCard.vue'
import { useFootprintStore } from '../stores/footprintStore'
import { useMemoryStore } from '../stores/memoryStore'
import { useScenicStore } from '../stores/scenicStore'

const router = useRouter()
const footprintStore = useFootprintStore()
const scenicStore = useScenicStore()
const memoryStore = useMemoryStore()

const recentMemories = computed(() => memoryStore.memories.slice(0, 4))
const photoCount = computed(() => memoryStore.memories.reduce((n, m) => n + m.images.length, 0))
const totalDays = computed(() => footprintStore.visitedCities.reduce((n, c) => n + c.totalDays, 0))
</script>

<template>
  <section class="home-view">
    <!-- Hero 区域 -->
    <div class="hero">
      <div class="hero-content">
        <div class="hero-label">我的旅行足迹</div>
        <h1 class="hero-title">探索每一寸土地</h1>
        <p class="hero-sub">
          已走过 <strong>{{ footprintStore.getVisitedProvinces.length }}</strong> 个省份
          <span class="sep">·</span>
          <strong>{{ footprintStore.visitedCities.length }}</strong> 座城市
          <span class="sep">·</span>
          累计旅行 <strong>{{ totalDays }}</strong> 天
        </p>
        <div class="hero-actions">
          <button class="hero-btn primary" @click="router.push('/map')">查看足迹地图</button>
          <button class="hero-btn secondary" @click="router.push('/memory/new')">写回忆</button>
          <button class="hero-btn outline" @click="router.push('/scenic')">景点打卡</button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="section-title">旅行数据</div>
    <FootprintStats
      :city-count="footprintStore.visitedCities.length"
      :spot-count="scenicStore.visitedSpots.length"
      :memory-count="memoryStore.memories.length"
      :photo-count="photoCount"
    />

    <!-- 近期回忆 -->
    <div v-if="recentMemories.length" class="section-header">
      <div class="section-title">近期回忆</div>
      <RouterLink to="/memories" class="see-all">查看全部 →</RouterLink>
    </div>
    <div v-if="recentMemories.length" class="memory-row">
      <MemoryCard v-for="memory in recentMemories" :key="memory.memoryId" :memory="memory" />
    </div>

    <!-- 空状态引导 -->
    <div v-if="memoryStore.memories.length === 0" class="onboarding">
      <div class="onboard-icon">🌏</div>
      <h3>开始记录你的旅行故事</h3>
      <p>添加城市足迹、打卡景点、写下旅行回忆</p>
      <div class="onboard-actions">
        <button class="hero-btn primary" @click="router.push('/manage')">添加城市数据</button>
        <button class="hero-btn outline" @click="router.push('/memory/new')">写第一篇回忆</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-view { padding: 24px; }

.hero {
  background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #43a047 100%);
  border-radius: 20px;
  padding: 40px 48px;
  margin-bottom: 28px;
  color: #fff;
  position: relative;
  overflow: hidden;
}
.hero::before {
  content: '';
  position: absolute;
  right: -40px; top: -40px;
  width: 280px; height: 280px;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
}
.hero::after {
  content: '';
  position: absolute;
  right: 80px; bottom: -60px;
  width: 160px; height: 160px;
  border-radius: 50%;
  background: rgba(255,255,255,0.04);
}
.hero-content { position: relative; z-index: 1; max-width: 600px; }
.hero-label { font-size: 13px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.75; margin-bottom: 10px; }
.hero-title { font-size: 36px; font-weight: 800; margin: 0 0 12px; line-height: 1.2; }
.hero-sub { font-size: 16px; opacity: 0.9; margin: 0 0 24px; line-height: 1.6; }
.hero-sub strong { font-weight: 700; font-size: 18px; }
.sep { margin: 0 8px; opacity: 0.5; }
.hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.hero-btn {
  padding: 10px 22px; border-radius: 10px; font-size: 14px;
  font-weight: 600; cursor: pointer; border: none; transition: opacity 150ms ease;
}
.hero-btn:hover { opacity: 0.88; }
.hero-btn.primary { background: #fff; color: #2e7d32; }
.hero-btn.secondary { background: rgba(255,255,255,0.2); color: #fff; }
.hero-btn.outline { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,0.55); }

.section-title { font-size: 18px; font-weight: 700; color: #1f2937; margin-bottom: 14px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-top: 28px; margin-bottom: 14px; }
.section-header .section-title { margin-bottom: 0; }
.see-all { color: #2e7d32; text-decoration: none; font-size: 14px; font-weight: 500; }

.memory-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.onboarding {
  text-align: center; padding: 60px 20px; margin-top: 24px;
  background: #fff; border-radius: 16px; border: 1px dashed #c8e6c9;
}
.onboard-icon { font-size: 56px; margin-bottom: 16px; }
.onboarding h3 { font-size: 20px; font-weight: 700; color: #1f2937; margin: 0 0 8px; }
.onboarding p { color: #6b7280; margin: 0 0 24px; }
.onboard-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
.onboard-actions .hero-btn.primary { background: #4caf50; color: #fff; }
.onboard-actions .hero-btn.outline { color: #2e7d32; border-color: #a7f3d0; }
</style>
