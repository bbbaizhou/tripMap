# Phase 4 同步优化：任务 A / B 详细规格（测试验收闭环）

> 阅读对象：编码 Agent ｜ 唯一实现依据 ｜ 前置阅读：`src/components/CloudSyncPanel.vue`、`src/utils/syncService.ts`、`src/utils/storage.ts`、`src/stores/{footprint,scenic,memory}Store.ts`、`PHASE4_SUPABASE_TASKS.md`
> 红线：不引 Element Plus；Vue 3.4 + `<script setup lang="ts">`；strict + `noUnusedLocals`/`noUnusedParameters`（未用参数加 `_` 前缀）；服务层（syncService）与 storage 既有签名零改动；现有功能 100% 不变。

---

## 任务 A：CloudSyncPanel 离线状态显示优化（A 独立，可先行）

### A.1 目标
组件展示层叠加 `navigator.onLine` 即时反馈：断网即显示「离线」、恢复在线立即回「已就绪」，均不依赖「点过立即同步」。服务层 `getSyncStatus()`/`syncNow()` 语义与实现**零改动**（仍以 syncNow 为准），仅组件层做展示覆盖。

### A.2 文件清单
- 修改：`src/components/CloudSyncPanel.vue`（仅 `<script setup>` 与模板徽标处；样式零改动）

### A.3 接口 / 实现要点
1. 新增 `online` ref 与 `displayStatus` computed 作为**唯一展示出口**：
```ts
const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
const displayStatus = computed<SyncStatus>(() => {
  if (status.value === 'disabled') return 'disabled'         // 未配置不随网络变
  if (!online.value) return 'offline'                        // 离线覆盖 idle/error/syncing
  return status.value === 'offline' ? 'idle' : status.value  // 在线时不再粘滞 offline
})
```
2. `statusLabel` 改由 `displayStatus` 推导；模板徽标 `:class="displayStatus"`（离线灰底）。
3. 事件回调直接更新展示态：`const onOnline = () => { online.value = true; refresh() }`、`onOffline = () => { online.value = false; refresh() }`（refresh 仍同步服务层缓存，防后续服务态变化被吞）。
4. `onMounted`：先 `online.value = navigator.onLine` 再 `refresh()`（初始即正确），随后照旧注册 `online`/`offline` 监听；`onBeforeUnmount` 照旧移除。
5. 服务层语义保持：`v-if="status === 'disabled'"` 分支与按钮 `:disabled="busy || status === 'syncing'"` 仍读**服务层 status**（syncing 是服务态，不得被展示层覆盖）；`status`/`refresh`/`handleSync` 原样保留。

### A.4 注意项
- 不新增 import（复用已有 `computed`/`ref`）；navigator 访问带 `typeof navigator !== 'undefined'` 守卫（与 syncService 同风格）。
- `displayStatus === 'offline'` 时按钮仍可点（syncNow 会再置 offline），符合「立即同步」反馈语义。
- 服务层 `currentStatus` 可能残留 `'offline'`（上次离线点同步所致），展示层映射为 `'idle'` 即修复粘滞；服务层字段不动，4.2 真实推送后由 syncNow 自然复位。

### A.5 完成 = 以下验收可通过
1. 已配置（`.env` 有值）且 DevTools Offline → **刷新页面**，徽标直接显示「离线」（灰），无需任何点击。
2. 恢复 Online → 徽标**立即**变「已就绪」，不点同步也不粘滞「离线」。
3. 在线时切 Offline → 徽标立即变「离线」。
4. 未配置（无 `.env`）→ 无论在线/离线都显示「云同步未配置」卡片。
5. 点「立即同步」行为不变（syncing 短暂出现后回落）；`npm run build` 通过。

---

## 任务 B：store 写入口接入同步队列（挂钩点激活）

### B.1 目标
不改变现有行为，让三个 store 的**用户主动写操作**经 patchState 自动入队（upsert/delete），由 `enqueueChange` 持久化；为 4.2 凭据注入后真实推送备好完整队列。`loadState()` 内部流程（fresh 初始化、migration 写回）与启动 init **不得入队**。

### B.2 文件清单
- 修改：`src/utils/storage.ts`（新增私有 diff 入队函数 + patchState 内挂钩；import `enqueueChange`/`SyncEntity`）
- 不改：`src/utils/syncService.ts`（`enqueueChange` 已具合并/500 上限/容错）、三个 store（签名与调用点零改动）

### B.3 挂钩方案（关键决策）
1. **挂钩点选 patchState 内部、saveState 之后**：先落盘、后入队 → 入队任何异常都不影响 localStorage 写盘（硬约束满足）。
2. **来源区分用「内容 diff」，不引入 source 参数/标志**：
   - 实证（grep）：`patchState` 仅被三个 store 的 deep watch 调用；fresh 初始化走 `setItem`、migration 写回走 `saveState`——都**不经过** patchState，天然不入队；
   - 唯一非用户触发是启动 `main.ts` 三连 init → ref 赋值 → deep watch 触发 → patchState（全量同值）。diff 逐条比较全等 → **零入队**。即「变了才入队」隐式完成来源判别，无需改任何签名。
3. **diff 规则**（按 entityId 建 Map，`JSON.stringify` 判内容相等）：
   - 新有旧无 / 内容变化 → `enqueueChange({ entity, action: 'upsert', entityId, payload: 整条新记录 })`；
   - 旧有新无 → `enqueueChange({ entity, action: 'delete', entityId })`（delete 不带 payload，契合 SyncQueueItem 定义）；
   - 两边皆同 → 跳过（不产生噪声队列项）。
4. **键映射**：`visitedCities→cities`、`scenicSpots→spots`、`memories→memories`；id 字段 `cityId`/`spotId`/`memoryId`。
5. **异常隔离双层**：saveState 先行；diff+enqueue 整体 try/catch，异常仅 console.warn；`enqueueChange` 内部读写队列本就全 try/catch 不抛错。

### B.4 实现要点（伪代码）
```ts
import { enqueueChange, type SyncEntity } from './syncService'
const ENTITY_MAP: Partial<Record<keyof AppState, SyncEntity>> = {
  visitedCities: 'cities', scenicSpots: 'spots', memories: 'memories',
}
const ID_FIELD: Record<SyncEntity, string> = { cities: 'cityId', spots: 'spotId', memories: 'memoryId' }
function enqueueArrayDiff(entity: SyncEntity, prev: unknown[], next: unknown[]): void {
  try {
    const idField = ID_FIELD[entity]
    const prevById = new Map(prev.map(r => [(r as Record<string, unknown>)[idField], r]))
    const nextById = new Map(next.map(r => [(r as Record<string, unknown>)[idField], r]))
    for (const [id, rec] of nextById) {
      if (typeof id !== 'string') continue
      const old = prevById.get(id)
      if (!old || JSON.stringify(old) !== JSON.stringify(rec)) {
        enqueueChange({ entity, action: 'upsert', entityId: id, payload: rec as Record<string, unknown> })
      }
    }
    for (const id of prevById.keys()) if (!nextById.has(id)) enqueueChange({ entity, action: 'delete', entityId: id as string })
  } catch (err) { console.warn('[storage] 同步入队失败（不影响本地落盘）', err) }
}
export function patchState<K extends keyof AppState>(key: K, value: AppState[K]): void {
  const { state, source } = loadStateDetailed()
  if (source === 'quarantined') return   // 损坏隔离：不写回也不入队（现状保持）
  const prev = state[key] as unknown[]
  state[key] = value
  saveState(state)
  const entity = ENTITY_MAP[key]
  if (entity && Array.isArray(prev) && Array.isArray(value)) enqueueArrayDiff(entity, prev, value)
}
```

### B.5 注意项
- 相等判定用 `JSON.stringify`（可选字段 undefined 两端一致丢弃，行为正确）；同 id 连续变更由 `enqueueChange` 合并为最后一条，500 上限由既有逻辑保证。
- 队列 key（`travel_footprint_sync_*`）与数据 key 隔离；未配置/离线照常入队（队列蓄积、4.2 推送后清空），符合 local-first 设计。
- 已知边界：`src/utils/exportImport.ts` 导入批量写直接走 `saveState`，不经 patchState，**本轮不入队**（记录在案；4.2 可选：导入后整表 upsert）。
- 无 id 记录防御性跳过；`quarantined` 分支先于入队返回，不改动。

### B.6 完成 = 以下验收可通过
1. addCity/addSpot/addMemory → 队列新增对应 1 条 upsert（payload 为整条新记录）。
2. updateCity/updateMemory/toggleStatus → 同 id 队列仍 1 条且 payload 为最新（合并生效）。
3. removeCity/removeSpot/deleteMemory → 同 id 队列变为 1 条 delete（无 payload）。
4. 启动刷新/init：数据全等 → 队列长度不变（零噪声）。
5. fresh 初始化（清 key 后首启）与 migration 写回：`travel_footprint_sync_queue` 保持为空。
6. 手工向同步队列 key 写损坏 JSON → 继续正常写数据（patchState 落盘成功，队列自愈为空）。
7. 既有功能回归：导入/导出、隔离区、UI 全不变；`npm run build`（vue-tsc strict）通过。

---

## 实施顺序
A → B（A 独立可先行，改完即跑 A.5 验收）。每任务完成后单独 `npm run build`；两任务全完成后整体冒烟：未配置降级 → 填假凭据 → DevTools Offline/Online 往返 → 恢复无凭据，杜绝错误累积。
