# Phase 4 剩余任务：Supabase 集成 —— 纯前端骨架规格（4.1 前端 / 4.2 前端部分 / 4.3 前置）

> 阅读对象：编码 Agent ｜ 本文件是唯一实现依据 ｜ 范围：**不依赖 Supabase 凭据**的前端集成骨架
> 本轮红线：不创建真实 Supabase 项目、不发任何真实网络请求、凭据缺失时现有功能 100% 不受影响。

## 0. 全局约束与现状衔接

- **前置 4.0**：`npm run build`（vue-tsc -b + vite build）必须通过；strict + `noUnusedLocals`/`noUnusedParameters` 已开，未用参数加 `_` 前缀。
- **技术约束**（vue-expert）：Vue 3.4 + `<script setup lang="ts">`；新逻辑只放 `src/utils/` 或 `src/composables/`；样式只用 `variables.scss` 的 CSS 变量（主色 `--color-primary: #2e7d32` 等），**不引 Element Plus**；唯一允许新增依赖 `@supabase/supabase-js`。
- **不破坏现状**：三个 store（footprint/scenic/memory）与 `storage.ts`（`loadState`/`saveState`/`patchState`）签名零改动；`AppState` 结构与 localStorage key（`travel_footprint_data`、`travel_footprint_data_corrupted`）不动；同步队列用**独立 key**。
- **降级红线**：`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 任一缺失或为空 → 同步层进入 `disabled`，`syncNow()` 返回 false 且**不发起任何 fetch**。注：构造 `createClient` 本身不发网络请求（supabase-js 惰性初始化），可放心；只有 Auth/表操作才发请求，本轮不写。
- **凭据安全**：源码与 `.env.example` 中不得出现真实 URL/anon key（允许文档性占位如 `https://your-project-ref.supabase.co`、`eyJ...` 字样仅出现在注释）；验收含 grep 检查。
- **现状衔接点（实测）**：store 变更统一走 `watch(ref, …, {deep:true}) → patchState` 落盘 —— `patchState` 是未来挂同步入队的唯一写入口；`DataManageView.vue`「备份与恢复」tab 目前只渲染 `<DataExportImport />`；`.gitignore` 为 GBK 编码且**未忽略 `.env`**；`src/vite-env.d.ts` 仅一行 `/// <reference types="vite/client" />`。

---

## 1. 任务 1 —— 依赖与环境变量

### 1.1 目标
装好 SDK、提供凭据注入模板与 TS 类型，保证「零配置可跑、配置即生效」。

### 1.2 文件清单
- 新建：`.env.example`
- 修改：`src/vite-env.d.ts`
- 修改：`.gitignore`（追加 `.env` 与 `.env.local` 两行；`.env.example` 必须提交。文件为 GBK 编码，追加时保持编码一致，或整体转 UTF-8 后确认 `git diff` 正常）

### 1.3 依赖安装与模板
```bash
npm i @supabase/supabase-js   # 运行时依赖，本轮唯一新增依赖
```
```dotenv
# Supabase 云同步配置（可选）。两项都填才启用云同步；留空则应用自动降级为纯本地模式，现有功能不受影响。
# 获取方式：登录 supabase.com → New project → 左侧 Project Settings → API
#   Project URL         → VITE_SUPABASE_URL
#   anon / public key   → VITE_SUPABASE_ANON_KEY（公开密钥，可安全放前端；服务端 role key 严禁入前端）
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
```ts
// src/vite-env.d.ts —— 保留原有 /// reference 行，追加以下声明
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### 1.4 实现要点
- 判空统一 `trim()` 后非空；**不设默认值**。`.env` 由 Vite 自动加载，改动后需重启 dev server。
- `VITE_` 前缀保证变量只进 `import.meta.env`、不进客户端 bundle 的 process.env，且可在构建期被识别。

### 1.5 完成 = 以下验收可通过
1. `package.json` dependencies 出现 `@supabase/supabase-js`。
2. 复制 `.env.example` 为 `.env` 留空 → dev 启动无报错；`git status` 不显示 `.env`（已忽略）、显示 `.env.example`。
3. `import.meta.env.VITE_SUPABASE_URL` 类型为 `string | undefined`，`vue-tsc` 通过。

---

## 2. 任务 2 —— client 封装（src/utils/supabase.ts）

### 2.1 目标
凭据缺失 → `null` 单例、零抛错、零网络；凭据齐全才 `createClient`；类型安全。

### 2.2 文件清单
- 新建：`src/utils/supabase.ts`

### 2.3 接口
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
export type { SupabaseClient }   // re-export，消费方统一从本模块取类型

export function createSupabaseClient(): SupabaseClient | null
export function getSupabase(): SupabaseClient | null
export function isSupabaseConfigured(): boolean
```
- `createSupabaseClient()`：读两个 env，`trim()` 后**都**非空 → `createClient(url, key)`；否则返回 null（不抛错）。URL 加轻校验：`new URL(url)` 且 `protocol === 'https:'`，不通过按未配置处理。
- `getSupabase()`：模块级 `let client: SupabaseClient | null = null` 惰性单例，首次调用创建并缓存。
- `isSupabaseConfigured()`：只读 env 判空，不触发创建。

### 2.4 要点
- 模块顶层**不执行** `createClient`（模块无副作用）；单例只在 `getSupabase()` 被调用时建立。
- 不 import 未使用的符号（`noUnusedLocals`）；本轮不调用任何 `auth`/`from` 方法，故构造后零网络。

### 2.5 完成 = 以下验收可通过
1. 无 `.env` → `getSupabase() === null`、`isSupabaseConfigured() === false`，`createSupabaseClient()` 不抛错。
2. Network 面板：全程无任何 supabase 域名请求。
3. `.env` 填 `https://demo.supabase.co` + 任意非空 key → `getSupabase()` 返回非 null 的 `SupabaseClient`，仍无网络请求。
4. 多次 `getSupabase()` 为同一实例；`npm run build` 通过。

---

## 3. 任务 3 —— local-first 同步服务骨架（src/utils/syncService.ts）

### 3.1 目标
变更队列（入队/持久化/合并）+ `syncNow()` 安全降级 + 状态查询；store 接入点预留，本轮不改 store。

### 3.2 文件清单
- 新建：`src/utils/syncService.ts`

### 3.3 数据结构
```ts
export type SyncEntity = 'cities' | 'spots' | 'memories'    // 对应 AppState 三个数组
export type SyncAction = 'upsert' | 'delete'
export interface SyncQueueItem {
  id: string          // crypto.randomUUID()；不可用时回退 `${entity}-${entityId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  entity: SyncEntity
  action: SyncAction
  entityId: string    // 记录主键：cityId / spotId / memoryId
  payload?: Record<string, unknown>   // upsert 携带整条记录快照；delete 省略
  updatedAt: string   // ISO 8601（与 TravelMemory.updatedAt 同格式）
}
export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'offline' | 'error'
export interface SyncMeta { lastSyncedAt: string | null }
```
localStorage key（延续 `travel_footprint_*` 前缀）：
- `travel_footprint_sync_queue` —— `SyncQueueItem[]`（JSON 数组）
- `travel_footprint_sync_meta` —— `SyncMeta`（JSON）

### 3.4 接口与行为
```ts
export function enqueueChange(item: Omit<SyncQueueItem, 'id' | 'updatedAt'>): void
export function getSyncQueue(): SyncQueueItem[]
export function clearSyncQueue(): void
export async function syncNow(): Promise<boolean>
export function getSyncStatus(): SyncStatus
export function getLastSyncedAt(): string | null
```
- `enqueueChange` 合并规则（同一 `entity+entityId` 队列中只保留最后一条）：来 `upsert` → 移除该实体旧项（含旧 delete）后追加；来 `delete` → 移除该实体旧项（含旧 upsert）后追加。队列上限 500 条，超出丢最旧。
- 持久化：读写全部 try/catch —— 写失败 `console.warn` 不抛错；读失败/JSON 损坏 → warn + 重置空队列（队列可丢弃，**不进隔离区**，与 `storage.ts` QUARANTINE 机制区分，storage.ts 零改动）。
- `syncNow()` 行为矩阵：未配置 → 置 `disabled`、返回 false（**不发请求**）；`typeof navigator !== 'undefined' && !navigator.onLine` → 置 `offline`、返回 false；队列空 → 置 `idle`、返回 true；其余 → 置 `syncing`，走 3.5 骨架，结束置回 `idle`/`error` 并返回结果。全程不 throw。
- `getSyncStatus()`：模块级 `currentStatus`，初始值 = `isSupabaseConfigured() ? 'idle' : 'disabled'`，由 `syncNow` 更新；`getLastSyncedAt()` 读 meta（本轮恒 null，写入点留给 4.2）。

### 3.5 批量推送 TODO 骨架（唯一激活点）
```ts
const SYNC_DRY_RUN = true   // 4.2 建表 + RLS 就绪后改为 false 并补全下方实现
// 骨架当前行为：console.info 打印按 entity 分组的待推清单，不修改队列、返回 false、状态置 'idle'。绝不清空队列。
// TODO(4.2 激活)：const client = getSupabase()
//   for (const entity of ['cities', 'spots', 'memories'] as const) {
//     await client.from(entity).upsert(items.map(i => ({ id: i.entityId, payload: i.payload, updated_at: i.updatedAt })))
//     await client.from(entity).delete().eq('id', ...)   // action === 'delete'
//   }
//   全部成功后：clearSyncQueue() + 写 meta.lastSyncedAt
```
- **store 接入点预留**（本轮不实现，仅注释说明）：三个 store 的写操作最终都经 `patchState` 落盘 —— 未来在 `patchState` 内（或各 store watch 内）追加 `enqueueChange({ entity, action, entityId, payload })` 即可入队，**store 签名与 storage.ts 均不改**。

### 3.6 完成 = 以下验收可通过
1. 入队后 `travel_footprint_sync_queue` 持久化；同一 `entity+entityId` 再次 upsert → 队列仍 1 条且 payload 为最新。
2. upsert 后 delete → 队列只剩 delete；delete 后 upsert → 只剩 upsert。
3. 无 `.env` → `syncNow()` 返回 false、状态 `disabled`、Network 零 supabase 请求、不抛错。
4. DevTools Offline → `syncNow()` 返回 false、状态 `offline`。
5. 向 sync key 手工写入损坏 JSON → 应用不崩，队列重置为空，数据 key（`travel_footprint_data`）不受影响。
6. `npm run build` 通过。

---

## 4. 任务 4 —— 数据管理页云同步区块

### 4.1 目标
未配置 → 引导说明卡（不报错、不误导）；已配置 → 同步状态 + 「立即同步」按钮（骨架）；纯 CSS 变量样式。

### 4.2 文件清单
- 新建：`src/components/CloudSyncPanel.vue`
- 修改：`src/views/DataManageView.vue`（仅两处：顶部 import `<CloudSyncPanel />`；「备份与恢复」tab 内 `<DataExportImport />` **上方**渲染 `<CloudSyncPanel />`，其余一律不动）

### 4.3 组件规格（`<script setup lang="ts">`）
```ts
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getLastSyncedAt, getSyncQueue, getSyncStatus, syncNow, type SyncStatus } from '../utils/syncService'
const status = ref<SyncStatus>(getSyncStatus())
const lastSyncedAt = ref(getLastSyncedAt())
const busy = ref(false)
const refresh = () => { status.value = getSyncStatus(); lastSyncedAt.value = getLastSyncedAt() }
const handleSync = async () => { busy.value = true; await syncNow(); refresh(); busy.value = false }
const onOnline = () => refresh(); const onOffline = () => refresh()
onMounted(() => { window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline) })
onBeforeUnmount(() => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) })
```
- 模板分支：
  - `status === 'disabled'` → 说明卡：☁️ 图标 + 标题「云同步未配置」+ 步骤文案（① 在 supabase.com 新建项目 ② Project Settings → API 复制 Project URL 与 anon key ③ 复制 `.env.example` 为 `.env` 并填入 ④ 重启 `npm run dev`）+ 强调「当前数据仍安全保存在本机，不影响任何功能」。**不渲染按钮**。
  - 已配置 → 状态徽标（`idle` 绿 / `syncing` 蓝「同步中…」/ `offline` 灰 / `error` 红）+ 待同步条数（`getSyncQueue().length`）+ 「上次同步：{{ lastSyncedAt ?? '暂无' }}」+ 按钮「立即同步」（`busy || status === 'syncing'` 时 disabled，文案「同步中…」，点击调 `handleSync`）。
- 样式：复用 `DataExportImport.vue` 的卡片语言（`.action-card` 同款结构），颜色一律走 `variables.scss` 变量：`--color-surface`、`--color-border`、`--color-primary`、`--color-text-secondary`、`--color-accent-blue`、`--radius-md`、`--shadow-card`；**不引 Element Plus**。
- 说明：已配置时按钮调 `syncNow()`（骨架行为，4.2 后真正推云端）；本轮无任何真实云请求。

### 4.4 完成 = 以下验收可通过
1. 无 `.env` → 「备份与恢复」tab 顶部显示「云同步未配置」卡片，含 4 步指引与本地安全提示；无按钮、无报错；导出/导入/添加城市等既有功能照常。
2. `.env` 填假 URL/key → 卡片变为状态徽标 + 「立即同步」按钮；点击后短暂 `syncing` 随即回落（dry-run），页面不崩、无网络请求。
3. 断网刷新 → 徽标显示 `offline`。
4. 样式与现有卡片一致（无 Element Plus class）；`npm run build` 通过；源码 grep 不到真实 URL/key 值。

---

## 5. 实施顺序与冒烟

- 顺序：**1 → 2 → 3 → 4**（2 依赖 1 的依赖与类型；3 依赖 2 的 `isSupabaseConfigured`；4 依赖 3 的接口）。
- 每任务完成单独跑 `npm run build`，杜绝错误累积。
- 全部完成后 `npm run dev` 冒烟：先走未配置降级路径（任务 1.5-2 / 3.6-3 / 4.4-1），再填假凭据走配置路径（任务 2.5-3 / 3.6-4 / 4.4-2），最后恢复无凭据状态。
- 收尾检查：`grep -rn "eyJ\|VITE_SUPABASE_URL=." src/ .env.example` 无命中（允许注释占位符）；`git status` 显示 `.env` 被忽略、`.env.example` 已纳入。
