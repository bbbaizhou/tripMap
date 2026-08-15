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
      <div>
        <h2>足迹地图</h2>
        <p>已访问城市与景点在地图上的分布</p>
      </div>
      <div class="map-stats">
        <span>{{ footprintStore.visitedCities.length }} 个城市</span>
        <span>{{ footprintStore.getVisitedProvinces.length }} 个省份</span>
        <span>{{ visitedScenicCount }} 个景点</span>
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

.map-header h2 {
  margin: 0 0 4px;
  font-size: 22px;
}

.map-header p {
  margin: 0;
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
  border-color: #4caf50;
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
</style>
