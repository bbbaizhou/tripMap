<script setup lang="ts">
import { computed, ref } from 'vue'
import ChinaMap from '../components/ChinaMap.vue'
import { useFootprintStore } from '../stores/footprintStore'
import { useMemoryStore } from '../stores/memoryStore'
import { useScenicStore } from '../stores/scenicStore'

const footprintStore = useFootprintStore()
const memoryStore = useMemoryStore()
const scenicStore = useScenicStore()

const selectedYear = ref<string>('all')
const selectedCompanion = ref<string>('all')

const yearOptions = computed(() => {
  const years = Array.from(memoryStore.groupedByYear.keys()).sort((a, b) => Number(b) - Number(a))
  return [{ value: 'all', label: '全部年份' }, ...years.map(y => ({ value: y, label: `${y} 年` }))]
})

const companionOptions = [
  { value: 'all', label: '全部' },
  { value: '家人', label: '家人' },
  { value: '朋友', label: '朋友' },
  { value: '独行', label: '独行' },
]

const filteredCities = computed<string[]>(() => {
  if (selectedYear.value === 'all' && selectedCompanion.value === 'all') return []

  let memories = memoryStore.memories

  if (selectedYear.value !== 'all') {
    memories = memories.filter(m => m.startDate.startsWith(selectedYear.value))
  }
  if (selectedCompanion.value !== 'all') {
    memories = memories.filter(m => m.companions.includes(selectedCompanion.value))
  }

  return [...new Set(memories.flatMap(m => m.cities))]
})

const visitedScenicCount = computed(() => scenicStore.visitedSpots.length)
</script>

<template>
  <section class="map-view">
    <div class="map-header">
      <div class="section-head">
        <div class="eyebrow">MAP · 地图</div>
        <h2>足迹地图</h2>
        <p>已访问城市与景点在地图上的分布</p>
      </div>
      <div class="map-stats">
        <span class="map-stat"><strong>{{ footprintStore.visitedCities.length }}</strong> 个城市</span>
        <span class="map-stat"><strong>{{ footprintStore.getVisitedProvinces.length }}</strong> 个省份</span>
        <span class="map-stat"><strong>{{ visitedScenicCount }}</strong> 个景点</span>
      </div>
    </div>

    <div class="map-body">
      <aside class="filter-panel">
        <div class="filter-section">
          <div class="filter-label">年份</div>
          <select v-model="selectedYear" class="filter-select">
            <option v-for="opt in yearOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div class="filter-section">
          <div class="filter-label">同伴</div>
          <select v-model="selectedCompanion" class="filter-select">
            <option v-for="opt in companionOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div v-if="filteredCities.length > 0" class="filter-result">
          筛选到 {{ filteredCities.length }} 座城市
        </div>
        <div v-else-if="selectedYear !== 'all' || selectedCompanion !== 'all'" class="filter-result filter-empty">
          无匹配城市
        </div>
      </aside>

      <div class="map-main">
        <ChinaMap
          :highlight-cities="filteredCities"
          height="calc(100vh - 196px)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.map-view {
  padding: 24px;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 16px;
}

.map-header .section-head {
  margin: 0;
}

.map-header p {
  margin: 8px 0 0;
  font-size: 14px;
  color: #6b7280;
}

.map-stats {
  display: flex;
  gap: 20px;
  font-weight: 600;
  color: #1f2937;
  font-size: 15px;
  flex-shrink: 0;
}

.map-stat strong {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  margin-right: 2px;
}

.map-body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.filter-panel {
  width: 176px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 16px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.filter-select {
  padding: 8px 10px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  font-size: 14px;
  background: #f9fafb;
  color: #1f2937;
  cursor: pointer;
  outline: none;
  transition: border-color 200ms ease;
}

.filter-select:focus {
  border-color: var(--color-natgeo);
}

.filter-result {
  font-size: 13px;
  color: #2e7d32;
  font-weight: 500;
  padding-top: 4px;
  border-top: 1px solid #e4e7ed;
}

.filter-empty {
  color: #9ca3af;
}

.map-main {
  flex: 1;
  min-width: 0;
}

/* ===== 移动端适配（≤768px）：筛选栏折叠为横向滚动胶囊条，地图全宽 ===== */
@media (max-width: 768px) {
  .map-view {
    padding: 12px 0;
  }

  .map-header {
    padding: 0 12px;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .map-stats {
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 13px;
  }

  .map-body {
    flex-direction: column;
    gap: 12px;
  }

  .filter-panel {
    width: 100%;
    box-sizing: border-box; /* content-box + width:100% + padding 会撑破视口（400px>390） */
    flex-direction: row;
    gap: 10px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding: 10px 12px;
    flex-shrink: 0;
  }

  .filter-section {
    flex: 0 0 auto;
    min-width: 128px;
  }

  .filter-result {
    flex: 0 0 auto;
  }

  .map-main {
    width: 100%;
    flex: none;
  }

  /* P2-1A：胶囊高度 + P2-3：16px 防 iOS 聚焦缩放 */
  .filter-select {
    min-height: 40px;
    font-size: 16px;
  }
}
</style>
