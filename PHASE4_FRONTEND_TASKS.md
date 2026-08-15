# Phase 4 纯前端任务技术规格（4.5 / 4.6 / 4.8 / 4.4）

> 阅读对象：编码 Agent ｜ 本文件是唯一实现依据，每条规格必须可执行 ｜ 范围：不依赖外部凭据的 4 个纯前端任务

## 0. 全局约束与前置

- **前置 4.0**：`npm run build` 当前有 6 处 TS 错误（见 PRODUCT_RD_PLAN.md §1.4），开工首日先修复并提交基线；本批 4 个任务全部完成后 `npm run build` 必须通过。
- **技术约束**（vue-expert skill）：Vue 3.4 + `<script setup>` + strict TS（已开 `noUnusedLocals`/`noUnusedParameters`，禁止未使用 import 与隐式 any）；新逻辑一律放 `src/utils/` 或 `src/composables/`；**唯一允许新增依赖为 vite-plugin-pwa**；样式沿用 `src/assets/styles/variables.scss` 的 CSS 变量（主色 `--color-primary: #2e7d32`），新代码不引 Element Plus。
- **现状要点（实测）**：① DataV `100000_full.json` 实为 **582,522 字节（≈570KB）**，`100000.json` ≈159KB——远小于预估 2-4MB，**无需简化**，直接用 full 版；② 路由为 `createWebHistory()`，ChinaMap 仅在 `/map`（一级路由）挂载，相对路径 `data/china-provinces.json` 在 dev / GH Pages（`base:'./'`）下均解析到应用根，可用；③ 三个 store 的 `init()` 都调用 `loadState()`，改动 storage 时保持其导出签名兼容。

---

## 1. 任务 4.5 —— GeoJSON 本地化 + 多源降级

### 1.1 目标
省份边界数据不再单点依赖阿里 DataV CDN：本地文件优先、CDN 兜底、双失败降级提示；地图永不因数据源单点故障白屏。

### 1.2 文件清单
- 新建数据：`public/data/china-provinces.json` —— 用 `Invoke-WebRequest https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json`（或浏览器另存）下载得到，直接放入，**不裁剪不简化**（570KB 可接受）。
- 修改：`src/utils/geojsonLoader.ts`（改造为多源加载）
- 修改：`src/components/ChinaMap.vue`（改用新 API，删除硬编码 URL 常量与 `CHINA_GEOJSON_URL`）

### 1.3 接口签名（`src/utils/geojsonLoader.ts`）
```ts
export type GeoJSONSource = 'local' | 'cdn' | null
export interface GeoJSONLoadResult { data: unknown; source: GeoJSONSource }
export const CHINA_PROVINCES_LOCAL_URL = 'data/china-provinces.json' // 相对路径，勿加前导 '/'
export const CHINA_PROVINCES_CDN_URL =
  'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'
export async function loadGeoJSON(url: string): Promise<unknown> // 保留：通用 fetch+内存缓存（现有逻辑）
export async function loadChinaProvinces(): Promise<GeoJSONLoadResult>
// 行为：本地→CDN 依次尝试，全失败返回 { data: null, source: null }（不 throw，由调用方决定降级展示）
```

### 1.4 实现要点
- `loadChinaProvinces()` 内部复用现有 `Map` 缓存（key 用 URL）；先 `loadGeoJSON(LOCAL_URL)`，catch 后 `loadGeoJSON(CDN_URL)`，再失败返回 `{data:null, source:null}`。
- ChinaMap.vue：`onMounted` 中把 `loadGeoJSON(CHINA_GEOJSON_URL)` 改为 `const { data, source } = await loadChinaProvinces()`；`data` 存在才 `L.geoJSON(...)`，否则 `fallbackVisible.value = true`；新增一个只读 `geoSourceText`（`'本地离线数据' | '在线数据' | ''`）显示在 fallback-notice 同款小条上（可选，不阻塞验收）。
- 本地 URL 用相对路径的理由：history 路由下 `/map` 页相对解析到应用根；若未来在二级路由挂地图，再改 `import.meta.env.BASE_URL + 'data/china-provinces.json'`（当前不引入）。
- 城市标记渲染（`renderCityMarkers`）不受 GeoJSON 失败影响，保持现状。

### 1.5 依赖安装
无。

### 1.6 本任务完成 = 以下验收可通过
1. `public/data/china-provinces.json` 存在，且 Network 面板可见请求指向**本地**（`/data/china-provinces.json`），不再请求 aliyun。
2. DevTools 屏蔽 `geo.datav.aliyun.com` 域名 → `/map` 省份着色正常渲染（走本地）。
3. 临时删除本地文件 + 屏蔽 aliyun → 出现降级提示小条，城市圆点标记仍显示，页面不白屏、无未捕获异常。
4. 重复进入 `/map` 不重复发本地请求（内存缓存生效）。
5. `npm run build` 通过。

---

## 2. 任务 4.6 —— PWA 离线化

### 2.1 目标
应用可安装（manifest 名称/图标/主题色 #2e7d32）、Service Worker 预缓存构建产物与本地 GeoJSON、运行时缓存 OSM 瓦片与 DataV CDN 兜底数据、移动端安装提示。

### 2.2 文件清单
- 修改：`vite.config.ts`（引入 VitePWA）
- 修改：`index.html`（`theme-color` meta、图标 link）
- 修改：`src/App.vue`（挂载 `<InstallPrompt />`）
- 新建：`src/composables/usePwaInstall.ts`（安装状态与提示）
- 新建：`src/components/InstallPrompt.vue`（安装横幅，CSS 变量样式）
- 新建：`public/icons/icon.svg`、`public/icons/favicon.svg`（占位图标：`#2e7d32` 圆角方块 + 白色定位针，手写 SVG，约 20 行）

### 2.3 配置与接口
`vite.config.ts` 追加（Vite 5 兼容）：
```ts
import { VitePWA } from 'vite-plugin-pwa'
plugins: [
  vue(),
  VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icons/favicon.svg'],
    manifest: {
      name: '旅行足迹', short_name: '旅行足迹', lang: 'zh-CN',
      description: '记录你去过的每一座城市与景点',
      start_url: './', scope: './', display: 'standalone',
      background_color: '#f5f7fa', theme_color: '#2e7d32',
      icons: [{ src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,json,svg,png,ico}'], // json 用于预缓存本地 GeoJSON
      navigateFallback: 'index.html',                        // history 路由离线深链兜底
      runtimeCaching: [
        { urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/, handler: 'CacheFirst',
          options: { cacheName: 'osm-tiles', expiration: { maxEntries: 400, maxAgeSeconds: 30*24*60*60 } } },
        { urlPattern: /^https:\/\/geo\.datav\.aliyun\.com\/.*/, handler: 'StaleWhileRevalidate',
          options: { cacheName: 'datav-geojson' } },
      ],
    },
  }),
]
```
`src/composables/usePwaInstall.ts`（`<script setup>` 外使用也可，返回 ref）：
```ts
export interface PwaInstallState {
  isInstallable: Readonly<Ref<boolean>> // beforeinstallprompt 已触发
  isInstalled:   Readonly<Ref<boolean>> // appinstalled 或 display-mode:standalone
  isIOS:         Readonly<Ref<boolean>> // iOS Safari（无 beforeinstallprompt，提示手动加主屏）
  promptInstall: () => Promise<boolean> // 调 event.prompt()；返回用户是否接受
}
export function usePwaInstall(): PwaInstallState
// 内部：模块级单例监听（beforeinstallprompt / appinstalled）；
// TS 需自声明 interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{outcome:'accepted'|'dismissed'}> }
// isInstalled 初始值：matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
```

### 2.4 实现要点与注意事项
- SW 注册用 `registerType:'autoUpdate'` + 默认 `injectRegister`（自动注入），**不要在代码里手动 `navigator.serviceWorker.register`**，避免双注册。
- 图标用 SVG（Chromium 支持 manifest SVG 图标，无需引入 sharp/@vite-pwa/assets-generator 等重型依赖）；iOS 无 PNG 时系统用截图兜底，属已知限制，注明即可。
- InstallPrompt.vue：仅当 `isInstallable || isIOS` 时显示；按钮「立即安装」调 `promptInstall()`（iOS 则展开静态提示文案），「以后再说」置本地会话标志隐藏；样式用 `--color-primary` 系变量 + 现有 `.chip`/`.submit-btn` 风格，不引 Element Plus。
- index.html 加：`<meta name="theme-color" content="#2e7d32" />`、`<link rel="icon" type="image/svg+xml" href="icons/favicon.svg" />`（manifest link 由插件注入，勿手写）。
- 开发态验证注意：PWA 仅在 `npm run build && npm run preview`（或部署）下生效，dev 服务器默认无 SW。

### 2.5 依赖安装
```bash
npm i -D vite-plugin-pwa
```

### 2.6 本任务完成 = 以下验收可通过
1. 构建后 `dist/` 含 `sw.js`、`manifest.webmanifest`、`workbox-*.js`；`index.html` 注入 manifest link 与 theme-color。
2. `npm run preview` 后 Chrome DevTools → Application：manifest 名称/主题色 `#2e7d32` 正确；SW 已激活。
3. DevTools 勾选 Offline 并刷新 → 应用壳、本地省份 GeoJSON 可用（省份地图仍渲染）；已访问过的 OSM 瓦片显示（CacheFirst），未访问过的瓦片空白但应用不崩、无报错。
4. 移动端模拟首次访问出现安装横幅 → 点击触发系统安装流程；安装后横幅不再出现。
5. `npm run build` 通过。

---

## 3. 任务 4.8 —— 数据版本迁移机制

### 3.1 目标
localStorage 数据结构可演进：新增 `schemaVersion`，建立迁移函数管线（v1→v2 示例），损坏数据保留现场（不再静默覆盖丢失）。

### 3.2 文件清单
- 修改：`src/types/index.ts`（AppState 增加 `schemaVersion`）
- 新建：`src/utils/migrations.ts`（版本常量 + 迁移管线）
- 修改：`src/utils/storage.ts`（loadState 走迁移 + 损坏隔离）
- 修改：`src/utils/mockData.ts`（补 `schemaVersion: 2`）
- 修改：`src/utils/exportImport.ts`（导入旧文件时兼容 + 走迁移管线）

### 3.3 数据结构与接口
```ts
// src/types/index.ts —— AppState 增加一行，其余字段不动：
export interface AppState {
  schemaVersion: number   // 新增：当前架构版本（= CURRENT_SCHEMA_VERSION）
  version: string         // 保留：兼容旧导出文件（'1.0'/'2.0'）
  visitedCities: FootprintCity[]
  scenicSpots: ScenicSpot[]
  memories: TravelMemory[]
}
```
```ts
// src/utils/migrations.ts
export const CURRENT_SCHEMA_VERSION = 2
export type Migration = (state: Record<string, unknown>) => Record<string, unknown>
export function migrateV1toV2(state: Record<string, unknown>): Record<string, unknown>
// v1→v2 示例：① visitedCities 每项 country 缺失时补 '中国'；
//   ② lat/lng 为 0 或非数的，用 4.4 的 findCityCoords(cityName) 回填；
//   ③ 置 schemaVersion=2，version 更新为 '2.0'
export function runMigrations(raw: unknown): { state: AppState; migrated: boolean }
// 规则：v = raw.schemaVersion 为 number 则用之，否则视为 1；
//   逐级执行 MIGRATIONS[v]；某级缺失迁移函数 → 抛 MigrationError（由 storage 捕获走隔离）
```
```ts
// src/utils/storage.ts —— 新增导出（loadState 签名保持兼容）：
export const QUARANTINE_KEY = 'travel_footprint_data_corrupted'
export type LoadSource = 'fresh' | 'stored' | 'migrated' | 'quarantined'
export interface LoadStateResult { state: AppState; source: LoadSource; error?: string }
export function loadState(): AppState                    // 内部调 loadStateDetailed，仅返回 state
export function loadStateDetailed(): LoadStateResult     // 供日志/测试
function quarantine(raw: string): void                   // 读 QUARANTINE_KEY(JSON 数组) 追加 {savedAt, raw}，保留最近 5 份
```

### 3.4 实现要点与注意事项
- **行为矩阵**（loadStateDetailed）：① key 不存在 → 写 mockData，返回 `fresh`；② JSON 解析成功且 `visitedCities/scenicSpots/memories` 均为数组 → `runMigrations`，若 `migrated` 则立即 `saveState(迁移结果)` 并返回 `migrated`，否则 `stored`；③ 解析失败或结构校验失败 → `quarantine(原始字符串)`，**不覆盖** STORAGE_KEY 原值（现场保留），内存返回 mockData（不写回），返回 `quarantined` 并 `console.warn`。
- 旧数据（无 `schemaVersion`）**不再是损坏**：校验从「必须有 version」改为「三个数组字段存在即可」，`version` 缺失仅日志提示。
- `patchState` 内部调 `loadState()`，自动获得迁移后状态，**签名与行为不变**，三个 store 零改动。
- 循环依赖：migrations.ts 可 import 4.4 的 `cityCoords.ts`，但 cityCoords/migrations 均不得 import storage.ts。
- exportImport.ts：`importFromJson` 校验改为「三个数组字段存在」，导入时先 `runMigrations` 再 `saveState`；错误文案同步更新（不再要求 version/schemaVersion）。

### 3.5 依赖安装
无。

### 3.6 本任务完成 = 以下验收可通过
1. 全新访问 → localStorage 中 `schemaVersion === 2`。
2. 手工写入 v1 数据（无 `schemaVersion`、某城市 `lat:0`）→ 刷新后数据被迁移：`schemaVersion=2`、country 补齐、lat 回填，原有城市/景点/回忆一条不丢。
3. 写入非法 JSON（如 `'{bad'`）→ 刷新后应用以 mockData 正常启动，`travel_footprint_data_corrupted` 含原始字符串，且 STORAGE_KEY 原值未被覆盖。
4. 导入旧版导出文件（无 schemaVersion）→ 成功，写回后 `schemaVersion=2`。
5. `npm run build` 通过。

---

## 4. 任务 4.4 —— 坐标自动解析（本地坐标库版）

### 4.1 目标
城市表单输入城市名自动带出经纬度（并顺带省份），纯本地零请求；接口预留高德扩展点（不实际接入、无 Key）。

### 4.2 文件清单
- 新建：`src/utils/cityCoords.ts`（内置坐标库 + 查询函数，数据可放同文件）
- 新建：`src/utils/geoResolver.ts`（解析管线 + 高德扩展点）
- 修改：`src/views/DataManageView.vue`（watch 城市名 → 防抖自动填充）

### 4.3 数据结构与接口
```ts
// src/utils/cityCoords.ts
export interface CityCoord { cityName: string; province: string; lat: number; lng: number }
export const CITY_COORDS: CityCoord[] // 内置 ~200 座：直辖市/省会/计划单列市/主要地级市；
// province 必须与 App 内命名一致（如 '四川省' 而非 '四川'）；
// 参考值（验收用）：成都 30.5728/104.0668 四川省；北京 39.9042/116.4074 北京市；
// 上海 31.2304/121.4737 上海市；广州 23.1291/113.2644 广东省
export function findCityCoords(cityName: string, province?: string): CityCoord | null // 精确匹配，province 消歧
export function searchCityCoords(keyword: string, limit?: number): CityCoord[]        // 包含匹配，预留搜索建议
```
```ts
// src/utils/geoResolver.ts
export interface CoordResult { lat: number; lng: number; source: 'local' | 'remote' }
export interface GeoQuery { cityName: string; province?: string }
export interface GeoResolver { readonly id: string; resolve(q: GeoQuery): Promise<CoordResult | null> }
export class LocalCityResolver implements GeoResolver { /* 查 cityCoords，Promise 包装 */ }
export class AmapGeoResolver implements GeoResolver {   // 扩展点：本任务不实现网络调用
  constructor(private readonly key?: string) {}
  async resolve(_q: GeoQuery): Promise<CoordResult | null> {
    // 预留实现：if (!this.key) return null;
    // fetch(`https://restapi.amap.com/v3/geocode/geo?address=${q.cityName}&key=${this.key}`)
    return null
  }
}
export async function resolveCityCoords(q: GeoQuery): Promise<CoordResult | null>
// 管线：本地 → 预留远程（当前恒 null）→ null；source 供 UI 标注数据来源
```

### 4.4 实现要点与注意事项（DataManageView.vue）
- 新增 `watch(() => cityForm.value.cityName, onCityNameChange)`；`onCityNameChange` 内 300ms 防抖（`let timer: number | undefined` + `clearTimeout`，卸载时 `onBeforeUnmount` 清理）。
- 逻辑：`name = cityForm.value.cityName.trim()`；空 → 清提示返回；命中 `resolveCityCoords({ cityName: name, province: cityForm.value.province || undefined })` 且（lat 或 lng 为空）→ 同时填充 lat/lng；`province` 为空时顺带填 `findCityCoords` 的 province；提示文本 `已自动填充坐标（本地坐标库）：30.5728, 104.0668`。未命中 → 提示 `未找到「${name}」的坐标，请手动填写`，不填充。
- 用户手动编辑 lat/lng 后清掉「自动填充」提示（标记 `isAutoFilled=false`），**已手填坐标不被自动覆盖**。
- `addCity` 成功后重置表单与解析状态（沿用现有重置逻辑）。
- 模板：lat/lng 输入框下加一行提示（复用 `.form-hint` 样式类），原「💡 坐标可在高德/百度查询」文案改为「输入城市名将自动填充坐标，也可手动修改」。
- 注意 `noUnusedLocals`：watch 回调、防抖 timer、`onBeforeUnmount` 均需实际使用；`AmapGeoResolver` 的 `key` 参数以 `_q` 前缀规避未使用参数报错（或使用该参数）。
- 扩展点仅预留接口与空实现，**不引入任何真实 Key、不发网络请求**。

### 4.5 依赖安装
无。

### 4.6 本任务完成 = 以下验收可通过
1. 城市名输入「成都」停止输入 300ms 后 → lat/lng 自动填 `30.5728`/`104.0668` 并显示自动填充提示，无需点击任何按钮。
2. 输入「北京」→ 自动填 `39.9042`/`116.4074`。
3. 省份为空时输入「成都」→ 省份自动填「四川省」。
4. 先手动填写 lat/lng 再输入城市名 → 已填坐标不被覆盖。
5. 输入未知名称（如「亚特兰蒂斯」）→ 不填坐标，显示「未找到」提示，仍可手动填写并提交。
6. DevTools Offline 下功能照常（纯本地数据）。
7. 源码中 grep 不到任何高德/百度真实 API Key；`npm run build` 通过。

---

## 5. 实施顺序与跨任务依赖

- 建议顺序：**4.8 → 4.4 → 4.5 → 4.6**（4.8 的 v1→v2 迁移复用 4.4 的 `cityCoords.ts`；4.6 预缓存 4.5 的本地 GeoJSON）。
- 每任务完成后单独跑 `npm run build`，杜绝错误累积；全部完成后以 `npm run preview` 做一次 PWA + 离线冒烟。
- 4.5/4.8/4.4 均不新增依赖，4.6 为唯一新增依赖（vite-plugin-pwa），先装后配置。
