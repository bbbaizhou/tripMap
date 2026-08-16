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
let chinaGeoLayer: L.GeoJSON | null = null

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

// P0-2 扩展：地图显示框范围自适应（fitBounds 替代硬编码 setView 的 zoom 4）
// 移动端判定与现有 CSS 断点（@media max-width: 768px）保持一致
const isMobileViewport = (): boolean => window.matchMedia('(max-width: 768px)').matches

const getFitPadding = (): L.PointTuple => (isMobileViewport() ? [12, 12] : [20, 20])

/** 移动端兜底：fitBounds 后若 zoom 超出 6 则压回 6（setMaxZoom 已约束，此处防御性兜底）。 */
const clampMobileZoom = () => {
  if (!map || !isMobileViewport()) return
  if (map.getZoom() > 6) map.setZoom(6)
}

/** 计算 bounds 在 padding 约束下可用的目标 zoom（供城市/全境 fit 决策与兜底比较）。 */
const computeFitZoom = (bounds: L.LatLngBounds): number => {
  if (!map) return 0
  return map.getBoundsZoom(bounds, false, L.point(getFitPadding()))
}

/** 中国大陆 bounds（不含南海诸岛）：[西经, 南纬, 东经, 北纬]。
 *  移动端窄框下 fit 完整 bounds（含南海十段线）会使大陆主体缩小且横向溢出，
 *  故移动端用大陆 bounds 让主体填满显示框；桌面用完整 bounds（geoLayer.getBounds()）。 */
const CHINA_MAINLAND_BOUNDS: L.LatLngBoundsExpression = [
  [18.0, 73.5],
  [53.6, 135.1],
]

/** 中国全境完整入框：移动端用大陆 bounds + 显式 zoom 3（392×367 窄框实测最优：
 *  横向 21~372 居中、纵向路径高 343px ≈ 框 367px；fitBounds 依赖容器时序易算出偏大 zoom
 *  导致溢出）。桌面用完整 bounds 的 fitBounds（含南海诸岛）。 */
const fitChinaBounds = (geoLayer: L.GeoJSON) => {
  if (!map || !geoLayer) return
  if (isMobileViewport()) {
    // 大陆中心约 [35.8, 104.3]；中心纬度下移（34.0）让大陆主体 + 南海诸岛在窄高框内
    // 完整入框（实测 zoom 3 下 bottom 从 629 收进框底 622，顶部留 31px）
    map.setView([34.0, 104.3], 3)
    return
  }
  map.fitBounds(geoLayer.getBounds(), { padding: getFitPadding() })
}

/**
 * 已访城市聚焦：
 * - 无已访城市 / 无中国边界层 → 返回 false（调用方回退中国全境 fit）
 * - 移动端：统一回退中国全境（大陆 bounds），保证全中国完整入框——城市聚焦会让
 *   中国大陆横向溢出窄屏显示框（实测 zoom 5 时 469px > 392px 框），用户核心诉求是看足迹全貌
 * - 桌面：城市范围过小（如单城）时 zoom 过高中国会出框 → 回退中国全境；否则城市 fit（不设上限）
 */
const fitCityBounds = (): boolean => {
  if (!map || !chinaGeoLayer) return false
  if (isMobileViewport()) return false // 移动端一律中国全境（完整入框优先）

  const cities = footprintStore.visitedCities
  if (cities.length === 0) return false

  const cityBounds = L.latLngBounds(cities.map(c => [c.lat, c.lng] as L.LatLngTuple))
  const cityZoom = computeFitZoom(cityBounds)
  const chinaZoom = computeFitZoom(chinaGeoLayer.getBounds())

  if (cityZoom > chinaZoom + 2) {
    // 城市范围过小（如单城）：城市视角 zoom 过高，中国边界会出框 → 回退中国全境
    fitChinaBounds(chinaGeoLayer)
    return true
  }

  map.fitBounds(cityBounds, { padding: getFitPadding() })
  return true
}

onMounted(async () => {
  if (!mapEl.value) return

  map = L.map(mapEl.value, { zoomControl: true, scrollWheelZoom: true }).setView(
    [35.8617, 104.1954],
    4,
  )

  // P0-2 扩展：移动端限制最大缩放，防止用户放大到中国超出视野（桌面保持默认 18）
  if (isMobileViewport()) map.setMaxZoom(6)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  L.control.scale({ imperial: false, maxWidth: 120 }).addTo(map)

  try {
    const { data, source } = await loadChinaProvinces()
    if (data) {
      chinaGeoLayer = L.geoJSON(data as any, {
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

  // P0-2 扩展：fitBounds 必须在 invalidateSize 之后执行（容器尺寸正确后才能算出准确的 bounds/zoom）。
  // 延迟 100ms 再 fit：确保 CSS 高度（55vh）与容器布局已完全应用，否则 fitBounds 按错误的容器
  // 尺寸计算 zoom（实测窄屏下 zoom 偏大导致中国横向溢出显示框）
  setTimeout(() => {
    if (!map) return
    map.invalidateSize()
    // 有已访城市 → 聚焦城市范围；无（或城市范围过小回退）→ 中国全境
    if (chinaGeoLayer) {
      const fittedCity = fitCityBounds()
      if (!fittedCity) fitChinaBounds(chinaGeoLayer)
    }
  }, 150)

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
  chinaGeoLayer = null
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
