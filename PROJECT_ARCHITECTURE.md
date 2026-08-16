# 旅行足迹（Travel Footprint）项目架构文档

> 版本：v1.0 ｜ 更新日期：2026-08-16 ｜ 适用代码基线：`3faa5c4`
> 本文档详细描述项目的技术架构、模块组成、数据流与工程实践，供开发者快速理解与维护。

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈](#2-技术栈)
3. [目录结构](#3-目录结构)
4. [架构总览与数据流](#4-架构总览与数据流)
5. [前端核心：路由与导航](#5-前端核心路由与导航)
6. [状态管理（Pinia Stores）](#6-状态管理pinia-stores)
7. [数据层：localStorage 存储体系](#7-数据层localstorage存储体系)
8. [云同步模块](#8-云同步模块)
9. [AI 模块](#9-ai-模块)
10. [地图模块](#10-地图模块)
11. [UI 设计与响应式](#11-ui-设计与响应式)
12. [PWA 与离线能力](#12-pwa-与离线能力)
13. [部署与 CI/CD](#13-部署与-cicd)
14. [测试](#14-测试)
15. [环境变量与密钥管理](#15-环境变量与密钥管理)
16. [开发约定与规范](#16-开发约定与规范)
17. [已知限制与后续规划](#17-已知限制与后续规划)

---

## 1. 项目概览

**旅行足迹（Travel Footprint）** 是一个个人旅行记录 Web 应用，核心价值是「记录你去过的每一座城市与景点，可视化你的旅行人生」。当前形态为 **PWA（Progressive Web App）**，支持安装到移动端主屏、离线使用、云同步多设备、AI 辅助规划。

### 1.1 核心能力

| 模块 | 能力 |
|------|------|
| **足迹地图** | 中国省份着色地图、城市圆点标记、年份/同伴筛选、GeoJSON 本地化离线 |
| **景点打卡** | 全国 318 个 5A 景区库、打卡/心愿单、省份/等级/状态/关键词筛选、分页 |
| **旅行回忆** | 图文日记 CRUD、多图灯箱、标签筛选、上下篇导航 |
| **云同步** | Supabase 账号体系（邮箱登录）、local-first 自动同步、多设备读取 |
| **AI 助手** | 行程规划、足迹数据洞察、智能整理（标签/坐标/信息补全）、年度分享卡 |
| **数据安全** | 版本化迁移、损坏数据隔离、JSON 备份恢复 |
| **PWA** | 可安装、离线可用、Service Worker 预缓存 |

### 1.2 项目规模

- 代码：TS 约 2,839 行 + Vue 约 5,663 行
- 组件：13 个（components）+ 12 个页面（views，含 AiDayPlanCard 卡片组件）
- Store：4 个（auth/footprint/scenic/memory）
- Utils：17 个工具模块
- 提交历史：25 次提交

---

## 2. 技术栈

| 层次 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Vue 3 `<script setup>` | ^3.4 | SFC 组件 + Composition API |
| 语言 | TypeScript | ^5.4 | 严格模式类型安全 |
| 构建 | Vite | ^5.2 | 开发服务器 + 生产构建 |
| 类型检查 | vue-tsc | ^2.0 | vue-tsc -b 严格检查 |
| 状态管理 | Pinia | ^2.1 | 全局状态 + 持久化 |
| 路由 | Vue Router 4 | ^4.3 | History 模式 + 懒加载 |
| 地图 | Leaflet + @vue-leaflet | ^1.9 / ^0.10 | 中国省份地图 |
| 云同步 | @supabase/supabase-js | ^2.112 | Auth + 数据库 + Edge Function |
| AI | DeepSeek API（原生 fetch） | — | 行程/洞察/标签生成 |
| PWA | vite-plugin-pwa | ^1.3 | Service Worker + Manifest |
| 样式 | SCSS + CSS Variables | ^1.75 | 设计系统 Token |
| 部署 | GitHub Actions + Pages | — | 自动构建部署 |

**未使用但已安装**：Element Plus（^2.7）在依赖中但未注册使用（项目全部纯 CSS 自定义），评估后保留或移除。

---

## 3. 目录结构

```
tripMap/
├── .env                      # 本地密钥（git 忽略）
├── .env.example              # 环境变量模板（提交）
├── .env.production           # 生产构建配置（Key 留空，AI 走代理）
├── .gitignore
├── .github/workflows/deploy.yml  # CI/CD 部署
├── index.html                # HTML 入口（viewport/favicon）
├── package.json
├── vite.config.ts            # Vite + PWA 配置（base 双模式）
├── tsconfig.json / tsconfig.node.json
├── public/
│   ├── data/
│   │   ├── china-provinces.json      # 中国省份 GeoJSON（本地化，582KB）
│   │   └── scenic-spots-base.json    # 全国 5A 景区种子数据（319 条）
│   └── icons/
│       ├── icon.svg                  # PWA 应用图标
│       └── favicon.svg               # 浏览器 favicon
├── src/
│   ├── main.ts              # 应用入口（注册 store + 初始化）
│   ├── App.vue              # 根组件（布局/全局样式）
│   ├── vite-env.d.ts        # 环境变量类型声明
│   ├── assets/styles/
│   │   └── variables.scss   # CSS 设计 Token
│   ├── types/index.ts       # 领域类型定义
│   ├── router/index.ts      # 路由表
│   ├── stores/              # Pinia Stores
│   │   ├── index.ts         # store 聚合导出
│   │   ├── authStore.ts     # 登录态
│   │   ├── footprintStore.ts # 城市足迹
│   │   ├── scenicStore.ts   # 景点打卡
│   │   └── memoryStore.ts   # 旅行回忆
│   ├── components/          # 可复用组件（13 个）
│   ├── composables/
│   │   └── usePwaInstall.ts # PWA 安装状态
│   ├── utils/               # 工具模块（17 个）
│   └── views/               # 页面视图（12 个，含 AiDayPlanCard）
├── supabase/functions/
│   └── ai-proxy/index.ts    # Edge Function（DeepSeek 代理）
├── docs/
│   ├── supabase_schema.sql  # 云同步建表 SQL
│   └── edge_function_deploy.md  # Edge Function 部署指引
├── tests/                   # Playwright 验收脚本
└── *.md                     # 规划/规格/方案文档
```

---

## 4. 架构总览与数据流

### 4.1 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                       前端（Vue 3 SPA + PWA）                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Views   │→│  Store   │→│  Utils   │→│ localStorage │   │
│  │ 组件视图  │ │  Pinia   │ │ 工具层   │ │ 本地主源      │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│       ↓            ↓            ↓            ↓              │
│  ┌──────────┐ ┌─────────────────────────────────────────┐  │
│  │  Router  │ │      Services（异步外部服务）            │  │
│  └──────────┘ │  supabase.ts   → Supabase Auth/DB       │  │
│               │  syncService   → 同步队列/推送/拉取      │  │
│               │  aiClient      → DeepSeek API（代理）    │  │
│               │  geojsonLoader → 本地/CDN GeoJSON        │  │
│               └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        │                │                │
        ▼                ▼                ▼
┌──────────────┐ ┌────────────────┐ ┌──────────────────┐
│ GitHub Pages │ │ Supabase       │ │ DeepSeek API     │
│ 静态托管      │ │ Postgres+Auth  │ │（经 Edge Function│
│ /tripMap/    │ │ +Edge Function │ │  代理，Key 在服务端│
└──────────────┘ └────────────────┘ └──────────────────┘
```

### 4.2 核心数据流

```
用户操作（View）
   ↓ 调用
Store Actions（Pinia）
   ↓ 响应式 watch
patchState（storage.ts）
   ├─ 写 localStorage（travel_footprint_data）  ← 本地主源，秒存
   ├─ 内容 diff → enqueueChange（同步队列）      ← 待推送变更
   └─ scheduleAutoSync（2s 防抖）
        ↓
syncNow() → Supabase upsert/delete（登录态）
        ↓ 成功
clearSyncQueue + lastSyncedAt
```

### 4.3 同步双向数据流

```
写入方向（本地 → 云端）：
  Store 变更 → patchState → 队列入队 → 防抖 2s → syncNow → Supabase 表

读取方向（云端 → 本地）：
  登录成功/恢复 session → pullCloudAndApply → pullFromCloud
    → 合并冲突（updated_at 后写优先）
    → saveState 直写 + withEnqueueSuppressed 内 reloadFromStorage（防循环）
```

---

## 5. 前端核心：路由与导航

### 5.1 路由表（12 条，全部懒加载）

| 路径 | 名称 | 视图 | 说明 |
|------|------|------|------|
| `/` | Home | HomeView | 首页 |
| `/map` | Map | MapView | 足迹地图 |
| `/scenic` | Scenic | ScenicView | 景点打卡 |
| `/memories` | MemoryList | MemoryListView | 回忆列表 |
| `/memory/new` | MemoryNew | MemoryFormView | 新增回忆 |
| `/memory/:memoryId` | MemoryDetail | MemoryDetailView | 回忆详情 |
| `/memory/:memoryId/edit` | MemoryEdit | MemoryFormView | 编辑回忆 |
| `/ai` | AiHome | AiHomeView | AI 助手首页 |
| `/ai/plan` | AiPlan | AiPlanView | AI 行程规划 |
| `/ai/insights` | AiInsights | AiInsightsView | 足迹数据洞察 |
| `/ai/organize` | AiOrganize | AiOrganizeView | AI 智能整理 |
| `/manage` | DataManage | DataManageView | 数据管理 |
| `/:pathMatch(.*)*` | — | 重定向 / | 404 兜底 |

### 5.2 关键路由配置

- **History 模式**：`createWebHistory(import.meta.env.BASE_URL)` —— base 来自 Vite 配置（生产 `/tripMap/`、dev `/`），保证 GitHub Pages 子路径下路由与资源解析一致
- **懒加载**：所有路由组件 `() => import(...)` 按需分包
- **标题管理**：`router.beforeEach` 根据 `meta.title` 设置 `document.title`
- **滚动恢复**：`scrollBehavior` 支持返回时恢复滚动位置

### 5.3 导航组件

| 组件 | 作用 | 说明 |
|------|------|------|
| AppHeader | 桌面顶部导航 | ≥769px 显示，6 个链接（含 AI 助手） |
| AppNav | 移动端底部导航 | ≤768px 显示，6 个 Tab（含 AI），顶部指示条 |

---

## 6. 状态管理（Pinia Stores）

### 6.1 Store 一览

| Store | 状态 | 核心 Actions | 持久化 |
|-------|------|--------------|--------|
| **authStore** | user/session/loading/authPanelOpen | init（订阅 onAuthStateChange）、signUp/signIn/signOut、openAuthPanel | supabase-js 自动持久化 session |
| **footprintStore** | visitedCities | addCity/removeCity/updateCity、reloadFromStorage | localStorage |
| **scenicStore** | spots | addSpot/removeSpot/updateSpot/toggleStatus、reloadFromStorage | localStorage |
| **memoryStore** | memories | addMemory/updateMemory/deleteMemory、reloadFromStorage | localStorage |

### 6.2 持久化模式

```typescript
// 每个数据 store 的模式（setup 式）
watch(spots, () => patchState('scenicSpots', spots.value), { deep: true })
// 变更 → patchState → localStorage + 同步队列
```

### 6.3 authStore 登录态联动

```
authStore.init()（main.ts 调用）
  → getSession() 恢复本地 session
  → onAuthStateChange 订阅（SIGNED_IN/OUT/TOKEN_REFRESHED）
      ├─ 登录成功 → pullCloudAndApply()（自动拉取云端数据，token 去重防双拉）
      └─ 退出 → cancelAutoSync()
```

---

## 7. 数据层：localStorage 存储体系

### 7.1 Key 一览

| Key | 用途 | 管理模块 |
|-----|------|----------|
| `travel_footprint_data` | 主数据（AppState） | storage.ts |
| `travel_footprint_data_corrupted` | 损坏数据隔离区（保留 5 份） | storage.ts |
| `travel_footprint_sync_queue` | 同步队列（上限 500 条） | syncService.ts |
| `travel_footprint_sync_meta` | 同步元数据（lastSyncedAt/rowTimes） | syncService.ts |
| `travel_footprint_ai_usage` | AI 使用计数 | aiTracking.ts |
| `travel_footprint_ai_feedback` | AI 反馈记录（上限 100 条） | aiTracking.ts |
| `sb-<ref>-auth-token` | Supabase session（自动） | supabase-js |
| `travel_footprint_install_dismissed` | PWA 安装提示关闭（sessionStorage） | InstallPrompt.vue |

### 7.2 数据版本与迁移

```typescript
// src/types/index.ts
interface AppState {
  schemaVersion: number   // 当前 = 2（CURRENT_SCHEMA_VERSION）
  version: string         // '2.0'
  visitedCities: FootprintCity[]
  scenicSpots: ScenicSpot[]
  memories: TravelMemory[]
}
```

- **迁移管线**：`migrations.ts` 的 `runMigrations()` 逐级执行（v1→v2：补齐 country、回填坐标）
- **损坏隔离**：`loadStateDetailed()` 检测到非法 JSON → 隔离到 `_corrupted`（保留现场、不覆盖原值）+ 内存回退 mockData
- **抑制入队**：`withEnqueueSuppressed()` —— 种子加载/云端拉取写回时跳过同步队列（防污染）

### 7.3 领域类型（types/index.ts）

```typescript
interface FootprintCity {
  cityId, cityName, province, country, firstVisitDate,
  visitCount, totalDays, scenicSpotIds[], memoryIds[], lat, lng
}
interface ScenicSpot {
  spotId, spotName, level: '4A'|'5A', city, province, type,
  status: 'visited'|'wishlist', visitDate?, relatedMemoryIds[], lat, lng, description?
}
interface TravelMemory {
  memoryId, title, startDate, endDate, companions[], tags[],
  cost?, content, images[], videoUrl?, cities[], spotIds[], createdAt, updatedAt
}
```

---

## 8. 云同步模块

### 8.1 架构

```
┌─────────────────────────────────────────────────────┐
│ 前端                                                  │
│  authStore ──→ supabase.ts（Auth 封装）              │
│  syncService（同步队列 + syncNow + pullFromCloud）   │
│  cloudPull（拉取编排，唯一触碰 store 的入口）         │
│  CloudSyncPanel（UI 三态：未配置/未登录/已登录）      │
└────────────────────────┬────────────────────────────┘
                         │
                    Supabase
              ┌──────────┴──────────┐
              │ Auth（邮箱登录）     │
              │ Postgres 三表       │
              │ cities/spots/memories│
              │ RLS（按 user 隔离）  │
              └─────────────────────┘
```

### 8.2 同步服务（syncService.ts）

| 能力 | 说明 |
|------|------|
| 队列 | `enqueueChange`：合并规则（同 entity+id 只留最后）、500 上限、独立 key |
| 推送 | `syncNow()`：行为矩阵（未配置→disabled / 离线→offline / 队列空→idle / 未登录→needsLogin / 否则→syncing 推送） |
| 拉取 | `pullFromCloud()`：三表 select → 合并冲突 → 直写 localStorage |
| 防循环 | 拉取写回经 `withEnqueueSuppressed` + 内容全等 diff 零入队 |
| 单飞 | syncNow 模块级 inflight Promise，手动/自动不重叠 |

### 8.3 冲突合并规则

```
本地无、云端有 → 添加
双方有且内容全等 → 跳过
双方有且不同 → 比较 updated_at（云端 vs 本地 rowTimes），后者胜
本地有、云端无 → 保留本地 + 入队 upsert 推上
```

### 8.4 Supabase 数据表（docs/supabase_schema.sql）

三表结构一致：`id (text PK, = entityId)` + `user_id (uuid, RLS 隔离)` + `payload (jsonb 整条记录)` + `updated_at/created_at`，每表含按 `auth.uid()` 的 RLS 策略。

---

## 9. AI 模块

### 9.1 架构

```
┌─────────────────────────────────────────────────────┐
│ 前端                                                  │
│  aiClient.ts（统一客户端）                            │
│    ├─ isAiConfigured / getAiConfig（env 判定）        │
│    ├─ generateItinerary → DayPlan[]                  │
│    ├─ generateInsights → string[]                    │
│    └─ autoTag / describeSpot → string[] / Info        │
│  Views：AiHome/AiPlan/AiInsights/AiOrganize          │
│  AiDayPlanCard / YearlyShareCard / AiUsagePanel      │
└────────────────────────┬────────────────────────────┘
                         │ proxy 模式（Bearer JWT）
                         ▼
        Supabase Edge Function（ai-proxy）
        ├─ 校验 JWT（auth.getUser）→ 401
        ├─ 分发表（itinerary/insights/tags/spotInfo）
        └─ DeepSeek API（Key 在服务端 Secrets）
```

### 9.2 双模式（aiClient.ts）

| 模式 | 触发条件 | 请求方式 |
|------|----------|----------|
| **proxy** | `VITE_AI_ENDPOINT` 已配置 | 带用户 JWT 调 Edge Function，bundle 零 Key |
| **direct** | 仅 `VITE_AI_API_KEY` | 开发模式直连 DeepSeek |

### 9.3 三大能力

| 能力 | 视图 | 核心逻辑 |
|------|------|----------|
| **行程规划** | AiPlanView | 表单（目的地/天数/风格/预算）→ generateItinerary → DayPlan 卡片流 + 加入心愿单/存草稿/复制 Markdown |
| **数据洞察** | AiInsightsView | insightStats 前端精确聚合（防幻觉）→ generateInsights 解读 + YearlyShareCard 分享卡 |
| **智能整理** | AiOrganizeView | 坐标兜底（geoResolver）、自动标签（autoTag）、信息补全（describeSpot） |

### 9.4 配套模块

| 模块 | 作用 |
|------|------|
| **aiPlanActions.ts** | 行程操作纯函数（spotId/level 兜底/草稿构造/Markdown） |
| **aiOrganize.ts** | 整理筛选/合并纯函数（mergeTags 上限 8） |
| **insightStats.ts** | 年度统计聚合（口径精确、可单测） |
| **aiTracking.ts** | 埋点 + 👍/👎 反馈（独立 key） |
| **contentFilter.ts** | 敏感词过滤（展示前检查，remoteAuditor 扩展点） |
| **yearlyCard.ts** | Canvas 1080×1080 分享卡绘制 |

---

## 10. 地图模块

### 10.1 组件结构

```
MapView（筛选栏 + 统计）
  └── ChinaMap（Leaflet 地图）
        ├─ GeoJSON 省份着色（loadChinaProvinces）
        ├─ 城市 CircleMarker（renderCityMarkers）
        ├─ 筛选联动（highlightCities）
        └─ 数据来源小条 + 降级提示
```

### 10.2 关键设计

| 设计 | 说明 |
|------|------|
| **多源加载** | geojsonLoader：本地 `data/china-provinces.json` 优先 → CDN 兜底 → 双失败降级 |
| **显示框自适应** | 移动端显式 setView([34.0, 104.3], zoom 3) 全境入框；桌面 fitBounds 完整 bounds |
| **尺寸感知** | resize/orientationchange 监听（300ms 防抖 invalidateSize） |
| **响应式** | ≤768px：筛选栏折叠为横向滚动胶囊条、地图全宽 55vh |

### 10.3 本地坐标库

`cityCoords.ts` 内置 **333 座城市**经纬度（province 命名与 App 一致，含同名消歧），用于：坐标自动填充、迁移回填、AI 景点坐标兜底。

---

## 11. UI 设计与响应式

### 11.1 设计系统（variables.scss）

```scss
:root {
  --color-primary: #2e7d32;          // 主绿
  --color-primary-light: #4caf50;
  --color-primary-lighter: #e8f5e9;
  --color-accent: #ff6b6b;           // 错误红
  --color-accent-blue: #42a5f5;      // 信息蓝
  --color-bg: #f5f7fa;
  --color-surface: #ffffff;
  --color-text-primary: #1f2937;
  --color-text-secondary: #6b7280;
  // 字体/间距/圆角/阴影/过渡 Token
}
```

### 11.2 设计语言

- **绿色胶囊标签**：所有模块切换标签统一「浅绿底 + 深绿字 + 圆角胶囊」风格（导航/页签/筛选按钮）
- **主页 Hero**：SVG 足迹轨迹 + 定位针装饰 + 数字胶囊统计
- **响应式断点**：统一 `@media (max-width: 768px)`（移动端），480px 微调
- **触控目标**：主按钮 ≥44px、次要按钮 ≥36px（移动端）
- **iOS 防护**：表单控件移动端 font-size:16px（防聚焦缩放）

### 11.3 响应式规则

| 规则 | 桌面 | 移动端（≤768px） |
|------|------|------------------|
| 导航 | AppHeader 顶部链接 | AppNav 底部 6 Tab |
| 景点网格 | 3 列 + 分页 30 条 | 1 列 + 分页 10 条 |
| 统计卡 | 4 列 | 2 列 |
| 表单 | 双列 | 单列 |
| 地图 | 完整 fitBounds | 全境 zoom 3 + 胶囊筛选 |

---

## 12. PWA 与离线能力

### 12.1 配置（vite.config.ts VitePWA）

| 项 | 配置 |
|----|------|
| registerType | autoUpdate（自动更新 SW） |
| manifest | name/短名「旅行足迹」、start_url/scope=/tripMap/、display=standalone、主题色 #2e7d32 |
| 预缓存 | 全部 js/css/html/json/svg/png/ico（含本地 GeoJSON） |
| navigateFallback | index.html（SPA 深链离线兜底） |
| 运行时缓存 | OSM 瓦片 CacheFirst（400 条/30 天）、DataV GeoJSON StaleWhileRevalidate |

### 12.2 安装与离线

- `usePwaInstall` composable：beforeinstallprompt/appinstalled 监听、iOS 检测
- `InstallPrompt` 组件：安装横幅（含 iOS「添加到主屏幕」指引）
- 离线场景：应用壳 + 本地 GeoJSON + 已访问瓦片可用（CacheFirst）

---

## 13. 部署与 CI/CD

### 13.1 部署架构

```
GitHub → push main → GitHub Actions（deploy.yml）
  ├─ build job：checkout → npm ci → npm run build → cp 404.html → upload artifact
  └─ deploy job：deploy-pages（需要 Pages 已启用 GitHub Actions 源）
产出 → https://bbbaizhou.github.io/tripMap/
```

### 13.2 关键部署配置

| 项 | 配置 |
|----|------|
| **base 双模式** | 生产 `/tripMap/`、dev `/`（`vite.config.ts` mode 判断） |
| **404.html** | 构建后复制 index.html（GitHub Pages SPA 深链兜底） |
| **资源路径** | 种子数据/图标用 `import.meta.env.BASE_URL` 拼接（子路径不 404） |
| **PWA manifest** | start_url/scope 绝对路径 `/tripMap/`（可安装性） |

### 13.3 部署注意点（踩坑记录）

1. `vite.config.js` 编译产物会遮蔽 `.ts` 配置（Vite 按 .js 优先）→ 需删除，保留 .ts
2. `base: './'` 在 SW navigateFallback 下导致资源路径漂移 → 用绝对 `/tripMap/`
3. 资源绝对路径 `/data/...` 在子路径部署下 404 → 用 BASE_URL 拼接
4. 生产构建 Key 会经 `import.meta.env` 注入 bundle → `.env.production` 覆盖留空

---

## 14. 测试

### 14.1 测试体系（Playwright + Python）

```
tests/
├── helpers.py               # 测试辅助
├── test_44_coords.py        # 坐标解析验收
├── test_45_geojson.py       # GeoJSON 本地化验收
├── test_46_pwa.py           # PWA 验收
├── test_48_migration.py     # 数据迁移验收
└── acceptance/              # 功能验收
    ├── common.py
    ├── test_taskA_configured.py   # CloudSyncPanel 配置态
    ├── test_taskA_unconfigured.py # CloudSyncPanel 未配置态
    └── test_taskB.py             # 同步队列行为
```

### 14.2 测试方式

- 环境：`.venv`（Playwright + Chromium）
- 运行：`python tests/test_*.py`（需 dev 服务器在 localhost:5173）
- 验证重点：数据迁移、坐标解析、PWA 离线、同步队列、AI 页面降级

---

## 15. 环境变量与密钥管理

### 15.1 变量清单

| 变量 | 用途 | 存放位置 |
|------|------|----------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL | .env（本地）/ .env.production（公开） |
| `VITE_SUPABASE_ANON_KEY` | Supabase 公开 key（可前端） | .env / .env.production |
| `VITE_AI_API_KEY` | DeepSeek Key（开发直连） | .env（生产留空） |
| `VITE_AI_ENDPOINT` | Edge Function URL（生产代理） | .env / .env.production |
| `DEEPSEEK_API_KEY` | Edge Function 服务端 Key | Supabase Secrets（不落前端） |
| `ALLOWED_ORIGIN` | Edge Function CORS 白名单（可选） | Supabase Secrets |

### 15.2 安全实践

- `.env` 在 .gitignore（本地密钥不入库）
- `.env.production` 提交但 **VITE_AI_API_KEY 留空**（生产 bundle 零 Key）
- DeepSeek Key 生产走 Edge Function（服务端 Secrets），前端只持用户 JWT
- 源码 grep 不到任何真实 Key

---

## 16. 开发约定与规范

### 16.1 代码规范（vue-expert skill）

- Vue 3.4 + `<script setup>` + Composition API（禁 Options API）
- TypeScript strict（noUnusedLocals/noUnusedParameters 已开）
- 新逻辑放 `src/utils/` 或 `src/composables/`（组件保持薄）
- 状态用 Pinia（禁 Vuex）；`ref()` 原语 / `reactive()` 对象
- 不引 Element Plus（纯 CSS 变量设计系统）
- 资源路径用 `import.meta.env.BASE_URL` 拼接（子路径兼容）

### 16.2 数据流约定

- **单向数据流**：View → Store → Utils → localStorage/云
- **写入收敛**：数据写操作统一经 `patchState`（唯一同步挂钩点）
- **降级优先**：所有外部服务（Supabase/DeepSeek）未配置时返回 null/false，绝不抛错
- **入队隔离**：种子/拉取写回用 `withEnqueueSuppressed`，用户操作才入队

### 16.3 文档约定

- 规划/规格文档：`PHASE*_*.md`（规划 Agent 产出，编码唯一依据）
- 方案文档：`MOBILE_UI_PLAN.md` 等
- 架构文档：本文档

---

## 17. 已知限制与后续规划

### 17.1 已知限制

| 项 | 说明 |
|----|------|
| 4A 景点数据 | 仅 1 条种子，未全量（全国 3400+ 家数据分散难获取） |
| AI 直连模式 | 开发用；生产必须走 Edge Function（已配置默认） |
| Edge Function 部署 | 代码已就绪，需 `supabase functions deploy` 激活 spotInfo 等 |
| 敏感词库 | 基础本地库（36 词），覆盖率有限，公开分享前需接审核 API |
| 同步触发 | 手动「立即同步」+ 变更防抖自动；无后台定时同步 |

### 17.2 后续规划（按计划书）

| 阶段 | 内容 |
|------|------|
| Phase 6（轻社交） | 足迹分享卡片/公开页、世界地图、轨迹动画、埋点体系、内容审核 |
| 远期 | AI 回忆生成、移动端 App（Flutter/uni-app）、行程协作、4A 全量扩充 |

---

*本文档由项目实际代码与配置整理生成，与基线 `3faa5c4` 对应。*
