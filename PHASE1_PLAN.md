# Phase 1 开发规格文档 — 数据层夯实

> 生成日期：2026-08-09 | Planner: Claude Code

---

## 目标

让所有数据的增删改查通畅，自动持久化到 localStorage，路由体验优化，建立 CSS 设计系统基础。
**完成本阶段后，整个数据层可作为后续所有交互功能的稳定地基。**

---

## 任务清单

| # | 文件 | 变更类型 | 功能 | 优先级 | 估时 |
|---|------|---------|------|--------|------|
| A | `src/utils/storage.ts` | 修改 | 新增 `patchState<K>()` 修复多Store并发写竞态 | 🔴 高 | 15min |
| B | `src/stores/footprintStore.ts` | 修改 | CRUD actions + watch 自动持久化 | 🔴 高 | 30min |
| C | `src/stores/scenicStore.ts` | 修改 | CRUD actions + watch 自动持久化 | 🔴 高 | 30min |
| D | `src/stores/memoryStore.ts` | 修改 | CRUD actions + watch 自动持久化 | 🔴 高 | 30min |
| E | `src/router/index.ts` | 修改 | 懒加载 + scrollBehavior + meta.title + beforeEach | 🟡 中 | 20min |
| F | `src/components/AppHeader.vue` | 修改 | 激活链接高亮样式 | 🟡 中 | 10min |
| G | `src/assets/styles/variables.scss` | **新建** | CSS 设计 Token 全套变量 | 🟡 中 | 20min |
| H | `src/main.ts` | 修改 | 全局引入 variables.scss | 🟢 低 | 5min |

---

## 接口规格

### A. `patchState`（storage.ts）

```typescript
export function patchState<K extends keyof AppState>(key: K, value: AppState[K]): void
```

- 读取当前完整 state → 覆盖指定 key → 写回 localStorage
- 解决问题：原来各 store 各自调用 `loadState()` 再 `saveState()` 时，如果两个 store 同步触发 save，第二个的 `loadState()` 会读到第一个尚未保存的旧数据，导致覆盖丢失。

### B. footprintStore 新增 actions

```typescript
addCity(city: FootprintCity): void          // 去重插入（按 cityId）
removeCity(cityId: string): void            // 删除
updateCity(cityId: string, updates: Partial<FootprintCity>): void  // 部分更新
getCityById(cityId: string): FootprintCity | undefined             // 按 ID 查找
// computed（已有）
getVisitedProvinces: ComputedRef<string[]>  // 去重省份列表
```

**自动持久化：**
```typescript
watch(visitedCities, () => patchState('visitedCities', visitedCities.value), { deep: true })
```

### C. scenicStore 新增 actions

```typescript
addSpot(spot: ScenicSpot): void                              // 去重插入
removeSpot(spotId: string): void                             // 删除
toggleStatus(spotId: string, status: SpotStatus, visitDate?: string): void  // 切换打卡状态
getSpotById(spotId: string): ScenicSpot | undefined          // 按 ID 查找
getSpotsByProvince(province: string): ScenicSpot[]           // 按省份筛选
// computed（已有）
visitedSpots: ComputedRef<ScenicSpot[]>   // 已打卡
wishlistSpots: ComputedRef<ScenicSpot[]>  // 心愿单
```

### D. memoryStore 新增 actions

```typescript
addMemory(memory: TravelMemory): void                           // 插入到列表头部（最新在前）
updateMemory(memoryId: string, updates: Partial<TravelMemory>): void  // 部分更新，自动刷新 updatedAt
deleteMemory(memoryId: string): void                            // 删除
getById(memoryId: string): TravelMemory | undefined             // 按 ID 查找（供详情页使用）
getByCity(cityName: string): TravelMemory[]                     // 按城市筛选
getByTag(tag: string): TravelMemory[]                           // 按标签筛选
// computed（已有）
groupedByYear: ComputedRef<Map<string, TravelMemory[]>>         // 按年份分组
```

### E. 路由新增规格

| 路由 | name | component | meta.title |
|------|------|-----------|-----------|
| `/memory/new` | MemoryNew | MemoryListView（临时，Phase 4 替换） | 新增回忆 - 旅行足迹 |
| `/memory/:id/edit` | MemoryEdit | MemoryDetailView（临时） | 编辑回忆 - 旅行足迹 |

### F. AppHeader 激活样式

```css
.nav-links a.router-link-active,
.nav-links a.router-link-exact-active {
  color: var(--color-primary);
  font-weight: 600;
  border-bottom: 2px solid var(--color-primary);
  padding-bottom: 2px;
}
```

### G. CSS Token 完整规范

见 `src/assets/styles/variables.scss`，覆盖：
- 颜色：主色调（绿系）/ 中性色 / 地图专用
- 字体：font-family / 7个 font-size 等级
- 间距：5个等级（4px ~ 32px）
- 圆角：4个等级（4px ~ 16px）
- 阴影：card / float 两级
- 过渡：fast(200ms) / base(300ms)

---

## 验收标准

Phase 1 完成后，以下行为必须可以验证：

1. **数据持久化**：修改任意 store 数据后刷新页面，数据保留
2. **Store CRUD**：浏览器 devtools 控制台执行以下代码应无错误：
   ```javascript
   // 注入测试（需在页面加载后执行）
   const { useFootprintStore } = window.__pinia_stores__  // 或通过 Vue devtools
   ```
3. **路由标题**：切换到 `/map` 后，浏览器 Tab 显示"足迹地图 - 旅行足迹"
4. **滚动恢复**：列表页滚动后点击详情，返回时滚动位置恢复
5. **导航高亮**：当前激活路由链接显示绿色高亮（有下划线）
6. **CSS 变量**：浏览器 Elements 面板查看 `:root` 可见所有 `--color-*` 变量

---

## 风险与注意事项

### 竞态风险（已缓解）
- **问题**：多 Store 同时 watch 触发时，`patchState` 内部仍然先 `loadState()` 再写入，理论上仍可能竞态
- **现实情况**：JS 单线程，实际并发极低，对于 localStorage 同步写入场景基本安全
- **真正修复**：Phase 4 引入统一 AppStore，由一个 watch 负责全量序列化（后续优化）

### watch 初始化触发
- watch 的 `immediate: false`（默认），不会在 init 前触发
- 但 watch 注册在 store setup 函数顶层，store 被 use 时立即注册
- `init()` 在 `main.ts` 中调用，晚于 watch 注册，不影响

### SCSS 变量引入
- `variables.scss` 通过 `main.ts` 全局引入，实际输出到 CSS `:root`，所有组件均可通过 `var(--xxx)` 使用
- 不需要在每个组件内 `@import`

---

*Planner: Claude Code | 日期: 2026-08-09*
