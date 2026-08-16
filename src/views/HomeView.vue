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
      <!-- 足迹轨迹折线装饰（右） -->
      <svg class="hero-trail" viewBox="0 0 400 200" fill="none" aria-hidden="true" focusable="false">
        <path
          d="M8 176 C 60 40, 124 34, 162 96 C 198 152, 252 166, 296 118 C 328 82, 360 68, 392 34"
          stroke="rgba(255,204,0,0.35)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="8" cy="176" r="5" fill="rgba(255,204,0,0.5)" />
        <circle cx="86" cy="70" r="4" fill="rgba(255,204,0,0.5)" />
        <circle cx="162" cy="96" r="5" fill="rgba(255,204,0,0.5)" />
        <circle cx="252" cy="150" r="4" fill="rgba(255,204,0,0.5)" />
        <circle cx="296" cy="118" r="5" fill="rgba(255,204,0,0.5)" />
        <circle class="trail-dot-end" cx="392" cy="34" r="6" fill="#ffcc00" />
      </svg>
      <!-- 定位针装饰（角落） -->
      <svg class="hero-pin" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
          fill="rgba(255,255,255,0.15)"
        />
      </svg>

      <div class="hero-content">
        <div class="hero-label">MY TRAVEL FOOTPRINT · 旅行足迹</div>
        <h1 class="hero-title">探索每一寸土地</h1>
        <p class="hero-tagline">把走过的路，都画成地图</p>
        <p class="hero-sub">
          <span class="stat-pill">已走过 <strong>{{ footprintStore.getVisitedProvinces.length }}</strong> 个省份</span>
          <span class="stat-pill"><strong>{{ footprintStore.visitedCities.length }}</strong> 座城市</span>
          <span class="stat-pill">累计旅行 <strong>{{ totalDays }}</strong> 天</span>
        </p>
        <div class="hero-actions">
          <button class="hero-btn primary" @click="router.push('/map')">查看足迹地图</button>
          <button class="hero-btn secondary" @click="router.push('/memory/new')">写回忆</button>
          <button class="hero-btn outline" @click="router.push('/scenic')">景点打卡</button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="section-head">
      <div class="eyebrow">DATA · 数据</div>
      <h2>旅行数据</h2>
    </div>
    <FootprintStats
      :city-count="footprintStore.visitedCities.length"
      :spot-count="scenicStore.visitedSpots.length"
      :memory-count="memoryStore.memories.length"
      :photo-count="photoCount"
    />

    <!-- 近期回忆 -->
    <div v-if="recentMemories.length" class="section-header">
      <div class="section-head">
        <div class="eyebrow">RECENT · 近期</div>
        <h2>近期回忆</h2>
      </div>
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
  background: radial-gradient(1100px 520px at 82% -12%, var(--color-natgeo-glow), transparent 62%),
    radial-gradient(860px 480px at 8% 112%, rgba(76, 175, 80, 0.28), transparent 58%),
    linear-gradient(162deg, var(--color-forest-900) 0%, var(--color-forest-700) 48%, var(--color-forest-500) 100%);
  border-radius: 20px;
  padding: 40px 48px;
  margin-bottom: 28px;
  color: #fff;
  position: relative;
  overflow: hidden;
}
/* 内联 SVG 噪点（无外部请求） */
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
  pointer-events: none;
}

/* 足迹轨迹折线装饰 */
.hero-trail {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-55%);
  width: 38%;
  max-width: 380px;
  height: auto;
  pointer-events: none;
  filter: drop-shadow(0 0 6px rgba(255, 204, 0, 0.35));
}
.trail-dot-end {
  animation: trail-pulse 2.6s ease-in-out infinite;
}
@keyframes trail-pulse {
  0%, 100% { opacity: 0.9; }
  50% { opacity: 0.35; }
}

/* 定位针装饰 */
.hero-pin {
  position: absolute;
  right: 32px;
  bottom: 24px;
  width: 64px;
  height: 64px;
  pointer-events: none;
}

.hero-content { position: relative; z-index: 1; max-width: 600px; }
.hero-label {
  color: var(--color-natgeo);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
  opacity: 1;
  margin-bottom: 12px;
}
.hero-label::before {
  content: '';
  display: inline-block;
  width: 24px;
  height: 2px;
  background: var(--color-natgeo);
  vertical-align: middle;
  margin-right: 10px;
}
.hero-title {
  font-family: var(--font-display);
  font-size: var(--font-size-hero);
  font-weight: 600;
  line-height: var(--line-height-display);
  letter-spacing: 0.5px;
  margin: 0 0 8px;
}
.hero-tagline {
  font-size: 18px;
  font-weight: 400;
  letter-spacing: 1px;
  opacity: 0.8;
  margin: 0 0 20px;
}
.hero-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  opacity: 0.95;
  margin: 0 0 26px;
  line-height: 1.6;
}
.stat-pill {
  display: inline-block;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--color-natgeo-glow);
  border-radius: 999px;
  padding: 4px 12px;
  white-space: nowrap;
}
.stat-pill strong {
  font-family: var(--font-display);
  font-size: 22px;
  color: var(--color-natgeo);
  margin: 0 2px;
}
.hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.hero-btn {
  padding: 10px 22px; border-radius: 2px; font-size: 14px;
  font-weight: 600; cursor: pointer; border: 1px solid transparent;
  transition: transform 200ms ease, opacity 200ms ease, background 200ms ease, border-color 200ms ease;
}
.hero-btn:hover { transform: translateY(-2px); opacity: 0.92; }
.hero-btn.primary { background: var(--color-natgeo); color: var(--color-forest-900); border: none; }
.hero-btn.primary:hover { box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18); }
.hero-btn.secondary { background: rgba(255, 255, 255, 0.2); color: #fff; border: 1px solid rgba(255, 255, 255, 0.55); }
.hero-btn.secondary:hover { background: rgba(255, 255, 255, 0.28); border-color: var(--color-natgeo); }
.hero-btn.outline { background: transparent; color: #fff; border: 1px solid rgba(255, 255, 255, 0.55); }
.hero-btn.outline:hover { background: rgba(255, 255, 255, 0.08); border-color: var(--color-natgeo); }

.section-header { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 28px; margin-bottom: 8px; }
.section-header .section-head { margin: 0; }
.see-all { color: #2e7d32; text-decoration: none; font-size: 14px; font-weight: 500; }

.memory-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.onboarding {
  text-align: center; padding: 60px 20px; margin-top: 24px;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(135deg, #e8f5e9, #a5d6a7 50%, #c8e6c9) border-box;
  border: 2px solid transparent;
  border-radius: 16px;
  box-shadow: 0 6px 24px rgba(46, 125, 50, 0.08);
}
.onboard-icon { font-size: 72px; line-height: 1; margin-bottom: 16px; }
.onboard-icon::after {
  content: '';
  display: block;
  width: 40px;
  height: 2px;
  background: var(--color-natgeo);
  margin: 14px auto 0;
}
.onboarding h3 { font-size: 20px; font-weight: 700; color: #1f2937; margin: 0 0 8px; }
.onboarding p { color: #6b7280; margin: 0 0 24px; }
.onboard-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
.onboard-actions .hero-btn.primary { background: #4caf50; color: #fff; }
.onboard-actions .hero-btn.outline { color: #2e7d32; border-color: #a7f3d0; }

@media (max-width: 768px) {
  .home-view { padding: 16px; }
  .hero { padding: 32px 20px; }
  .hero-title { font-size: 40px; }
  .hero-label { font-size: 13px; }
  .memory-row { grid-template-columns: 1fr; gap: 12px; }
  .hero-trail,
  .hero-pin { display: none; }
  /* P2-2：主操作按钮触控目标 ≥44px */
  .hero-btn { min-height: 44px; }
}
</style>
