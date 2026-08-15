# PHASE2_PLAN.md — 旅行足迹 App · Phase 2「地图核心」规格文档

Planner: Claude Code | 2026-08-09

---

## 1. 任务清单

| # | 文件 | 变更类型 | 功能描述 | 优先级 |
|---|------|----------|----------|--------|
| 1 | `src/utils/geojsonLoader.ts` | 新建 | GeoJSON 加载器，CDN 拉取 + 内存缓存 | P0 |
| 2 | `src/components/ChinaMap.vue` | 新建 | 中国省份地图核心组件（GeoJSON 着色、Tooltip、Popup、CircleMarker） | P0 |
| 3 | `src/views/MapView.vue` | 修改 | 嵌入 ChinaMap 组件，添加左侧年份/同伴筛选栏 | P1 |

---

## 2. 组件接口规格

### 2.1 `geojsonLoader.ts`
- `loadGeoJSON(url: string): Promise<any>` — 带 Map 缓存，重复调用不重复 fetch

### 2.2 `ChinaMap.vue` Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `highlightCities` | `string[]` | `[]` | 筛选联动时需要特别标记的城市名 |
| `showTracks` | `boolean` | `false` | 是否显示城市间轨迹折线（预留） |
| `height` | `string` | `'560px'` | 容器高度 |

**GeoJSON 数据源：** `https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json`

**省份着色规则：**
- 已访：`#4caf50` fillOpacity:0.6 描边 `#388e3c`
- 未访：`#e0e0e0` fillOpacity:0.3 描边 `#bdbdbd`
- Hover：fillOpacity 提升至 0.85

**城市 CircleMarker：** radius:6, fillColor:#4caf50, color:#fff, weight:2
- highlightCities 非空且城市不在列表中时 fillOpacity 降为 0.35

### 2.3 `MapView.vue` 新布局
- 顶部 header：城市数 / 省份数 / 景点数统计
- 左侧筛选栏（200px）：年份选择 + 同伴类型选择
- 右侧主体：ChinaMap 组件（flex:1）
- 筛选联动：计算 filteredCityNames 传给 ChinaMap.highlightCities

---

## 3. 验收标准

| # | 验收项 | 期望结果 |
|---|--------|----------|
| 1 | 访问 /map | 左侧筛选栏 + 右侧中国地图 |
| 2 | 省份着色 | 山东省、江苏省、北京市绿色，其余灰色 |
| 3 | Hover Tooltip | 悬停省份显示省份名 |
| 4 | 已访省份 Popup | 点击显示城市列表 |
| 5 | 城市 CircleMarker | 绿色圆点，点击显示详情 |
| 6 | 离线降级 | 网络不可用时不崩溃，仅显示 markers |
| 7 | 年份筛选 | 筛选后城市标记联动高亮/弱化 |
| 8 | 页面离开 | 路由切换后无 Leaflet 报错 |
