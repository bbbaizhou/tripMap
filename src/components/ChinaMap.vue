<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useFootprintStore } from '../stores/footprintStore'
import { loadChinaProvinces } from '../utils/geojsonLoader'

const props = withDefaults(defineProps<{
  highlightCities?: string[]
  showTracks?: boolean
  height?: string
}>(), {
  highlightCities: () => [],
  showTracks: false,
  height: '560px',
})

const footprintStore = useFootprintStore()
const mapEl = ref<HTMLElement | null>(null)
const fallbackVisible = ref(false)
const geoSourceText = ref<'本地离线数据' | '在线数据' | ''>('')
let map: L.Map | null = null
let cityMarkersLayer: L.LayerGroup | null = null

// P0-2：视口尺寸变化（resize / 旋转）后重算地图尺寸，防瓦片偏移（仅尺寸重算，不改业务逻辑）
let resizeDebounceTimer: number | undefined
const handleViewportChange = () => {
  window.clearTimeout(resizeDebounceTimer)
  resizeDebounceTimer = window.setTimeout(() => {
    map?.invalidateSize()
  }, 300)
}

const visitedProvinces = computed(() =>
  new Set(footprintStore.visitedCities.map(c => c.province))
)

const getProvinceStyle = (feature: any) => {
  const name: string = feature?.properties?.name ?? ''
  const isVisited = visitedProvinces.value.has(name)
  return {
    fillColor: isVisited ? '#4caf50' : '#e0e0e0',
    fillOpacity: isVisited ? 0.6 : 0.3,
    color: isVisited ? '#388e3c' : '#bdbdbd',
    weight: isVisited ? 1 : 0.5,
  }
}

const onEachFeature = (feature: any, layer: L.Layer) => {
  const name: string = feature?.properties?.name ?? ''
  const isVisited = visitedProvinces.value.has(name)

  layer.bindTooltip(name, { sticky: true, direction: 'auto', className: 'province-tooltip' })

  if (isVisited) {
    const cities = footprintStore.visitedCities.filter(c => c.province === name)
    const cityList = cities.map(c => `${c.cityName}（${c.visitCount}次）`).join('、')
    layer.bindPopup(`
      <div class="china-map-popup">
        <strong>${name}</strong>
        <div style="margin-top:6px;font-size:13px">已访城市：${cityList}</div>
        <div style="font-size:12px;color:#6b7280">共 ${cities.length} 座城市</div>
      </div>
    `)
  }

  ;(layer as L.Path).on('mouseover', () => {
    (layer as L.Path).setStyle({ fillOpacity: 0.85 })
  })
  ;(layer as L.Path).on('mouseout', () => {
    (layer as L.Path).setStyle(getProvinceStyle(feature))
  })
}

const renderCityMarkers = () => {
  if (!map) return
  cityMarkersLayer?.clearLayers()
  if (!cityMarkersLayer) {
    cityMarkersLayer = L.layerGroup().addTo(map)
  }

  footprintStore.visitedCities.forEach(city => {
    const isHighlighted =
      props.highlightCities.length === 0 || props.highlightCities.includes(city.cityName)

    L.circleMarker([city.lat, city.lng] as L.LatLngTuple, {
      radius: 7,
      fillColor: '#4caf50',
      color: '#ffffff',
      weight: 2,
      fillOpacity: isHighlighted ? 0.95 : 0.3,
    })
      .addTo(cityMarkersLayer!)
      .bindTooltip(`${city.cityName} · ${city.province}`, { direction: 'top', offset: [0, -8] })
      .bindPopup(`
        <div class="china-map-popup">
          <strong>${city.cityName}</strong>
          <div>${city.province}</div>
          <div style="font-size:13px;margin-top:4px">访问 ${city.visitCount} 次 · 共 ${city.totalDays} 天</div>
        </div>
      `)
  })
}

onMounted(async () => {
  if (!mapEl.value) return

  map = L.map(mapEl.value, { zoomControl: true, scrollWheelZoom: true }).setView(
    [35.8617, 104.1954],
    4,
  )

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  L.control.scale({ imperial: false, maxWidth: 120 }).addTo(map)

  try {
    const { data, source } = await loadChinaProvinces()
    if (data) {
      L.geoJSON(data as any, {
        style: getProvinceStyle,
        onEachFeature,
      }).addTo(map)
      geoSourceText.value = source === 'local' ? '本地离线数据' : '在线数据'
    } else {
      fallbackVisible.value = true
    }
  } catch {
    fallbackVisible.value = true
  }

  renderCityMarkers()
  setTimeout(() => map?.invalidateSize(), 0)

  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('orientationchange', handleViewportChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('orientationchange', handleViewportChange)
  window.clearTimeout(resizeDebounceTimer)
  map?.remove()
  map = null
  cityMarkersLayer = null
})

watch(() => props.highlightCities, renderCityMarkers, { deep: true })
</script>

<template>
  <div class="china-map-wrapper" :style="{ height: props.height }">
    <div ref="mapEl" class="map-container" aria-label="中国旅行足迹地图" />
    <div v-show="fallbackVisible" class="fallback-notice">
      省份边界数据加载失败，仅显示城市标记模式
    </div>
    <div v-show="!fallbackVisible && geoSourceText" class="geo-source-bar">
      {{ geoSourceText }}
    </div>
  </div>
</template>

<style scoped>
.china-map-wrapper {
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #cbd5e1;
}

/* P0-2：移动端地图高度 55vh（!important 覆盖内联 height prop） */
@media (max-width: 768px) {
  .china-map-wrapper {
    height: 55vh !important;
  }
}

.map-container {
  width: 100%;
  height: 100%;
}

.fallback-notice {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.9);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  color: #6b7280;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  pointer-events: none;
}

.geo-source-bar {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(232, 245, 233, 0.95);
  color: #2e7d32;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  pointer-events: none;
}

:deep(.province-tooltip) {
  border: none;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  font-weight: 600;
  color: #1f2937;
  padding: 4px 10px;
}

:deep(.china-map-popup) {
  min-width: 160px;
  line-height: 1.6;
}

:deep(.china-map-popup strong) {
  display: block;
  font-size: 15px;
  color: #1f2937;
  margin-bottom: 2px;
}

:deep(.leaflet-tooltip) {
  border: none;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.95);
  color: #0f172a;
  padding: 6px 10px;
}
</style>
