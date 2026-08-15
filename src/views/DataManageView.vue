<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import CloudSyncPanel from '../components/CloudSyncPanel.vue'
import DataExportImport from '../components/DataExportImport.vue'
import { useFootprintStore } from '../stores/footprintStore'
import { useScenicStore } from '../stores/scenicStore'
import type { FootprintCity, ScenicSpot } from '../types'
import { findCityCoords } from '../utils/cityCoords'
import { resolveCityCoords } from '../utils/geoResolver'

const footprintStore = useFootprintStore()
const scenicStore = useScenicStore()

const activeTab = ref<'city' | 'scenic' | 'data'>('data')

// 城市新增表单
const cityForm = ref({ cityName: '', province: '', country: '中国', firstVisitDate: '', visitCount: 1, totalDays: 1, lat: '', lng: '' })
const cityError = ref('')
const citySuccess = ref('')

// 城市名自动解析坐标（300ms 防抖，纯本地坐标库）
const AUTO_FILL_PREFIX = '已自动填充坐标'
const cityHint = ref('')
const isAutoFilled = ref(false)
let debounceTimer: number | undefined

const runCityAutoResolve = async () => {
  const name = cityForm.value.cityName.trim()
  if (!name) {
    cityHint.value = ''
    isAutoFilled.value = false
    return
  }
  const result = await resolveCityCoords({
    cityName: name,
    province: cityForm.value.province.trim() || undefined,
  })
  if (!result) {
    cityHint.value = `未找到「${name}」的坐标，请手动填写`
    return
  }
  if (cityForm.value.lat === '' || cityForm.value.lng === '') {
    cityForm.value.lat = String(result.lat)
    cityForm.value.lng = String(result.lng)
    if (!cityForm.value.province.trim()) {
      const coord = findCityCoords(name)
      if (coord) cityForm.value.province = coord.province
    }
    isAutoFilled.value = true
    cityHint.value = `${AUTO_FILL_PREFIX}（本地坐标库）：${result.lat}, ${result.lng}`
  }
}

const onCityNameChange = () => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    void runCityAutoResolve()
  }, 300)
}

// 用户手动编辑 lat/lng：清掉「自动填充」提示，已手填坐标不被自动覆盖
const onLatLngManualEdit = () => {
  isAutoFilled.value = false
  cityHint.value = ''
}

watch(() => cityForm.value.cityName, onCityNameChange)

onBeforeUnmount(() => {
  window.clearTimeout(debounceTimer)
})

const addCity = () => {
  cityError.value = ''; citySuccess.value = ''
  if (!cityForm.value.cityName || !cityForm.value.province || !cityForm.value.firstVisitDate) {
    cityError.value = '城市名、省份、首次到访日期为必填'; return
  }
  const lat = parseFloat(cityForm.value.lat)
  const lng = parseFloat(cityForm.value.lng)
  if (isNaN(lat) || isNaN(lng)) { cityError.value = '请填写有效的经纬度数字'; return }
  const city: FootprintCity = {
    cityId: `city-${Date.now()}`,
    cityName: cityForm.value.cityName.trim(),
    province: cityForm.value.province.trim(),
    country: cityForm.value.country.trim() || '中国',
    firstVisitDate: cityForm.value.firstVisitDate,
    visitCount: cityForm.value.visitCount,
    totalDays: cityForm.value.totalDays,
    scenicSpotIds: [],
    memoryIds: [],
    lat,
    lng,
  }
  footprintStore.addCity(city)
  citySuccess.value = `已添加城市：${city.cityName}`
  window.clearTimeout(debounceTimer)
  isAutoFilled.value = false
  cityHint.value = ''
  cityForm.value = { cityName: '', province: '', country: '中国', firstVisitDate: '', visitCount: 1, totalDays: 1, lat: '', lng: '' }
}

// 景点新增表单
const scenicForm = ref({ spotName: '', level: '5A', city: '', province: '', type: '自然风光', lat: '', lng: '', description: '' })
const scenicError = ref('')
const scenicSuccess = ref('')
const addScenic = () => {
  scenicError.value = ''; scenicSuccess.value = ''
  if (!scenicForm.value.spotName || !scenicForm.value.city || !scenicForm.value.province) {
    scenicError.value = '景点名、城市、省份为必填'; return
  }
  const spot: ScenicSpot = {
    spotId: `spot-${Date.now()}`,
    spotName: scenicForm.value.spotName.trim(),
    level: scenicForm.value.level as '4A' | '5A',
    city: scenicForm.value.city.trim(),
    province: scenicForm.value.province.trim(),
    type: scenicForm.value.type,
    status: 'wishlist',
    relatedMemoryIds: [],
    lat: parseFloat(scenicForm.value.lat) || 0,
    lng: parseFloat(scenicForm.value.lng) || 0,
    description: scenicForm.value.description.trim() || undefined,
  }
  scenicStore.addSpot(spot)
  scenicSuccess.value = `已添加景点：${spot.spotName}`
  scenicForm.value = { spotName: '', level: '5A', city: '', province: '', type: '自然风光', lat: '', lng: '', description: '' }
}
</script>

<template>
  <section class="manage-view">
    <div class="manage-header">
      <h2>数据管理</h2>
      <p>添加足迹数据或备份/恢复旅行记录</p>
    </div>

    <div class="tab-bar">
      <button :class="['tab', activeTab === 'data' && 'active']" @click="activeTab = 'data'">备份与恢复</button>
      <button :class="['tab', activeTab === 'city' && 'active']" @click="activeTab = 'city'">添加城市足迹</button>
      <button :class="['tab', activeTab === 'scenic' && 'active']" @click="activeTab = 'scenic'">添加景点</button>
    </div>

    <!-- 备份恢复 -->
    <div v-if="activeTab === 'data'" class="tab-content">
      <CloudSyncPanel />
      <DataExportImport />
    </div>

    <!-- 添加城市 -->
    <div v-if="activeTab === 'city'" class="tab-content">
      <div v-if="cityError" class="form-error">{{ cityError }}</div>
      <div v-if="citySuccess" class="form-success">{{ citySuccess }}</div>
      <div class="form-grid">
        <div class="fg"><label>城市名称 *</label><input v-model="cityForm.cityName" class="fi" placeholder="如：成都" /></div>
        <div class="fg"><label>省份 *</label><input v-model="cityForm.province" class="fi" placeholder="如：四川省" /></div>
        <div class="fg"><label>国家</label><input v-model="cityForm.country" class="fi" /></div>
        <div class="fg"><label>首次到访日期 *</label><input v-model="cityForm.firstVisitDate" type="date" class="fi" /></div>
        <div class="fg"><label>访问次数</label><input v-model.number="cityForm.visitCount" type="number" min="1" class="fi" /></div>
        <div class="fg"><label>停留天数</label><input v-model.number="cityForm.totalDays" type="number" min="1" class="fi" /></div>
        <div class="fg"><label>纬度（lat） *</label><input v-model="cityForm.lat" class="fi" placeholder="如：30.5728" @input="onLatLngManualEdit" /></div>
        <div class="fg"><label>经度（lng） *</label><input v-model="cityForm.lng" class="fi" placeholder="如：104.0668" @input="onLatLngManualEdit" /></div>
      </div>
      <div class="form-hint">{{ cityHint || '输入城市名将自动填充坐标，也可手动修改' }}</div>
      <button class="submit-btn" @click="addCity">添加城市足迹</button>
      <div class="current-list">
        <h4>已记录的 {{ footprintStore.visitedCities.length }} 个城市</h4>
        <div class="city-chips">
          <span v-for="city in footprintStore.visitedCities" :key="city.cityId" class="chip">
            {{ city.cityName }}
          </span>
        </div>
      </div>
    </div>

    <!-- 添加景点 -->
    <div v-if="activeTab === 'scenic'" class="tab-content">
      <div v-if="scenicError" class="form-error">{{ scenicError }}</div>
      <div v-if="scenicSuccess" class="form-success">{{ scenicSuccess }}</div>
      <div class="form-grid">
        <div class="fg"><label>景点名称 *</label><input v-model="scenicForm.spotName" class="fi" placeholder="如：峨眉山" /></div>
        <div class="fg">
          <label>等级</label>
          <select v-model="scenicForm.level" class="fi">
            <option value="5A">5A</option>
            <option value="4A">4A</option>
          </select>
        </div>
        <div class="fg"><label>城市 *</label><input v-model="scenicForm.city" class="fi" placeholder="如：乐山" /></div>
        <div class="fg"><label>省份 *</label><input v-model="scenicForm.province" class="fi" placeholder="如：四川省" /></div>
        <div class="fg">
          <label>景点类型</label>
          <select v-model="scenicForm.type" class="fi">
            <option>自然风光</option>
            <option>人文景观</option>
            <option>古迹遗址</option>
            <option>宗教人文</option>
            <option>文化创意</option>
          </select>
        </div>
        <div class="fg"><label>纬度</label><input v-model="scenicForm.lat" class="fi" placeholder="可选" /></div>
        <div class="fg"><label>经度</label><input v-model="scenicForm.lng" class="fi" placeholder="可选" /></div>
        <div class="fg full-width"><label>简介</label><input v-model="scenicForm.description" class="fi" placeholder="可选" /></div>
      </div>
      <button class="submit-btn" @click="addScenic">添加到心愿单</button>
    </div>
  </section>
</template>

<style scoped>
.manage-view { padding: 24px; }
.manage-header { margin-bottom: 20px; }
.manage-header h2 { margin: 0 0 4px; }
.manage-header p { margin: 0; font-size: 14px; color: #6b7280; }

.tab-bar { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 2px solid #e4e7ed; }
.tab {
  padding: 10px 20px; background: none; border: none; border-bottom: 2px solid transparent;
  margin-bottom: -2px; font-size: 14px; font-weight: 600; color: #6b7280; cursor: pointer;
}
.tab.active { color: #2e7d32; border-bottom-color: #2e7d32; }

.tab-content { max-width: 860px; }

.form-error { background: #fef2f2; color: #dc2626; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 14px; }
.form-success { background: #f0fdf4; color: #15803d; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 14px; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 12px; }
.fg { display: flex; flex-direction: column; gap: 5px; }
.fg label { font-size: 13px; font-weight: 600; color: #374151; }
.fi {
  padding: 9px 12px; border: 1px solid #e4e7ed; border-radius: 8px;
  font-size: 14px; outline: none; box-sizing: border-box; width: 100%;
}
.fi:focus { border-color: #4caf50; }
.full-width { grid-column: span 2; }

.form-hint { font-size: 12px; color: #9ca3af; margin-bottom: 16px; }
.submit-btn {
  padding: 10px 28px; background: #4caf50; color: #fff; border: none;
  border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 24px;
}
.submit-btn:hover { background: #43a047; }

.current-list h4 { margin: 0 0 10px; font-size: 14px; color: #374151; }
.city-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  padding: 4px 10px; background: #e8f5e9; color: #2e7d32;
  border-radius: 999px; font-size: 13px; font-weight: 500;
}
</style>
