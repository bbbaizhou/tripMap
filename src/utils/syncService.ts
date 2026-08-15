import { getSupabase, isSupabaseConfigured } from './supabase'
import type { AppState } from '../types'

/**
 * local-first 同步服务（Phase 4.2 激活：真实推送 + 登录前置检查；Phase 5：自动同步 + 拉取合并）。
 *
 * - 队列与元数据使用独立 localStorage key（travel_footprint_sync_*），
 *   与数据 key（travel_footprint_data / *_corrupted）完全隔离；
 *   队列损坏只重置队列，不进 QUARANTINE 隔离区（storage.ts 零改动）。
 * - 未配置 / 离线 / 队列空 / 未登录 四类路径均不抛错、不发任何网络写请求。
 * - 真实推送失败 = all-or-nothing：任一实体失败整队列保留（upsert 幂等，重试可重放）。
 * - utils 层零耦合：登录检查直接用 getSupabase()?.auth.getSession()，不 import authStore；
 *   也不 import storage（避免 storage↔syncService 循环），本地数据读写直接操作 localStorage，
 *   key 与 storage.ts 的 STORAGE_KEY 保持一致（见 DATA_KEY）。
 * - 自动同步：patchState 尾部 scheduleAutoSync（2s 防抖）→ 守卫后 fire-and-forget syncNow；
 *   syncNow 模块级单飞（手动/自动并发复用同一 Promise）；SIGNED_OUT 由 authStore 调 cancelAutoSync。
 * - 拉取合并：pullFromCloud 纯 utils（不 import store、不碰 patchState），
 *   冲突规则 = 内容相等短路 + updated_at 后写优先（rowTimes 记录本地写入时间）。
 */

export type SyncEntity = 'cities' | 'spots' | 'memories' // 对应 AppState 三个数组

export type SyncAction = 'upsert' | 'delete'

export interface SyncQueueItem {
  id: string // crypto.randomUUID()；不可用时回退 entity-entityId-Date.now()-random
  entity: SyncEntity
  action: SyncAction
  entityId: string // 记录主键：cityId / spotId / memoryId
  payload?: Record<string, unknown> // upsert 携带整条记录快照；delete 省略
  updatedAt: string // ISO 8601（与 TravelMemory.updatedAt 同格式）
}

export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'offline' | 'error' | 'needsLogin'

export interface SyncMeta {
  lastSyncedAt: string | null
  /** 各实体记录的本地写入时间（ISO），拉取合并冲突判定「后写优先」的时间来源（enqueueChange 写入）。 */
  rowTimes: Partial<Record<SyncEntity, Record<string, string>>>
}

const QUEUE_KEY = 'travel_footprint_sync_queue'
const META_KEY = 'travel_footprint_sync_meta'
const QUEUE_LIMIT = 500
/** 自动推送防抖窗口（ms）：变更后 2s 内无新变更才实际推送。 */
const AUTO_SYNC_DEBOUNCE_MS = 2000
/** 本地数据 key：与 src/utils/storage.ts 的 STORAGE_KEY 保持一致（避免循环依赖，拉取合并直接读写）。 */
const DATA_KEY = 'travel_footprint_data'

// 初始状态跟随配置：未配置 → disabled；已配置 → idle；由 syncNow 更新。
let currentStatus: SyncStatus = isSupabaseConfigured() ? 'idle' : 'disabled'

// 最近一次推送失败原因（面板 error 态展示；成功/未推送过为 null）。
let lastError: string | null = null

// 自动同步防抖定时器（scheduleAutoSync / cancelAutoSync 管理）。
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null

// syncNow 单飞：模块级 inflight Promise，并发调用复用同一 Promise（手动「立即同步」与自动定时器不重叠）。
let inflight: Promise<boolean> | null = null

function generateId(item: Omit<SyncQueueItem, 'id' | 'updatedAt'>): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${item.entity}-${item.entityId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** 队列项轻校验：核心字段齐全才保留，损坏项直接丢弃。 */
function isSyncQueueItem(value: unknown): value is SyncQueueItem {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    (v.entity === 'cities' || v.entity === 'spots' || v.entity === 'memories') &&
    (v.action === 'upsert' || v.action === 'delete') &&
    typeof v.entityId === 'string' &&
    typeof v.updatedAt === 'string'
  )
}

/** 读队列：失败 / JSON 损坏 → warn 并重置为空队列（可丢弃，不进隔离区）。 */
function readQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      console.warn('[sync] 同步队列格式非法，已重置为空队列')
      try {
        localStorage.removeItem(QUEUE_KEY)
      } catch {
        /* 清理失败静默忽略 */
      }
      return []
    }
    return parsed.filter(isSyncQueueItem)
  } catch (err) {
    console.warn('[sync] 同步队列读取失败，已重置为空队列', err)
    try {
      localStorage.removeItem(QUEUE_KEY)
    } catch {
      /* 清理失败静默忽略 */
    }
    return []
  }
}

/** 写队列：失败仅 console.warn，不抛错。 */
function writeQueue(queue: SyncQueueItem[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch (err) {
    console.warn('[sync] 同步队列写入失败', err)
  }
}

/** 读元数据：损坏 / 缺失一律视为空（lastSyncedAt=null，rowTimes={}）。 */
function readMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return { lastSyncedAt: null, rowTimes: {} }
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Partial<SyncMeta>
      return {
        lastSyncedAt: typeof record.lastSyncedAt === 'string' ? record.lastSyncedAt : null,
        rowTimes: record.rowTimes && typeof record.rowTimes === 'object' ? record.rowTimes : {},
      }
    }
    return { lastSyncedAt: null, rowTimes: {} }
  } catch {
    return { lastSyncedAt: null, rowTimes: {} }
  }
}

/** 写元数据：失败仅 console.warn，不抛错。 */
function writeMeta(meta: SyncMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch (err) {
    console.warn('[sync] 同步元数据写入失败', err)
  }
}

/** 把推送异常归纳为面板可读原因：RLS / 表不存在场景给出建表提示。 */
function describeError(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number } | null
  const message = e?.message ?? String(err)
  const code = e?.code ?? ''
  const looksLikeSchemaIssue =
    /PGRST205|42P01|42501/i.test(code) ||
    /does not exist|row-level security|permission denied/i.test(message) ||
    e?.status === 403
  if (looksLikeSchemaIssue) return '同步失败：请确认已在 Supabase 执行 docs/supabase_schema.sql 建表'
  const reason = message.trim()
  return reason ? `同步失败：${reason}` : '同步失败，请稍后重试'
}

/**
 * 入队（合并规则：同一 entity+entityId 只保留最后一条）。
 * - 来 upsert → 移除该实体旧项（含旧 delete）后追加；
 * - 来 delete → 移除该实体旧项（含旧 upsert）后追加。
 * 队列上限 500 条，超出丢最旧。
 */
export function enqueueChange(item: Omit<SyncQueueItem, 'id' | 'updatedAt'>): void {
  const queue = readQueue()
  const next = queue.filter((q) => !(q.entity === item.entity && q.entityId === item.entityId))
  const updatedAt = new Date().toISOString()
  next.push({
    ...item,
    id: generateId(item),
    updatedAt,
  })
  writeQueue(next.slice(-QUEUE_LIMIT))
  // 同步记录本地写入时间（rowTimes）：拉取合并冲突判定「后写优先」的时间来源（亦为推送的 updated_at）。
  try {
    const meta = readMeta()
    const entityRows = meta.rowTimes[item.entity] ?? {}
    entityRows[item.entityId] = updatedAt
    meta.rowTimes[item.entity] = entityRows
    writeMeta(meta)
  } catch (err) {
    console.warn('[sync] 记录 rowTimes 失败（不影响队列）', err)
  }
}

export function getSyncQueue(): SyncQueueItem[] {
  return readQueue()
}

export function clearSyncQueue(): void {
  writeQueue([])
}

/**
 * syncNow 行为矩阵（全程不 throw）：
 * 1. 未配置（getSupabase() === null）→ disabled，false，不发请求；
 * 2. 离线（navigator.onLine === false）→ offline，false；
 * 3. 队列空 → idle，true（空队列无需登录）；
 * 4. auth.getSession() 无 session → needsLogin，false（不推送、队列原样、不发写请求）；
 * 5. syncing → 真实批量推送（upsert/delete 按 entity 分组）→ 全部成功：
 *    clearSyncQueue() + 写 lastSyncedAt（rowTimes 清空，已推送记录与云端一致）→ idle，true；
 * 6. 任一实体失败（异常 / RLS 拒绝 / 断网）→ 保留整队列 → error，false，lastError 记录原因。
 * 单飞：模块级 inflight Promise，并发调用复用同一 Promise——手动「立即同步」与自动定时器不重叠。
 */
export function syncNow(): Promise<boolean> {
  if (inflight !== null) return inflight
  inflight = doSyncNow().finally(() => {
    inflight = null
  })
  return inflight
}

async function doSyncNow(): Promise<boolean> {
  try {
    if (getSupabase() === null) {
      currentStatus = 'disabled'
      return false
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      currentStatus = 'offline'
      return false
    }
    const queue = getSyncQueue()
    if (queue.length === 0) {
      currentStatus = 'idle'
      return true
    }

    // 登录前置检查（utils 层独立，不依赖 authStore，避免循环依赖）
    const client = getSupabase()!
    const sessionRes = await client.auth.getSession()
    if (!sessionRes?.data?.session) {
      currentStatus = 'needsLogin'
      return false
    }

    currentStatus = 'syncing'
    try {
      for (const entity of ['cities', 'spots', 'memories'] as const) {
        const items = queue.filter((i) => i.entity === entity)
        if (items.length === 0) continue
        const upserts = items
          .filter((i) => i.action === 'upsert')
          .map((i) => ({ id: i.entityId, payload: i.payload ?? {}, updated_at: i.updatedAt }))
        if (upserts.length > 0) await client.from(entity).upsert(upserts)
        const deleteIds = items.filter((i) => i.action === 'delete').map((i) => i.entityId)
        if (deleteIds.length > 0) await client.from(entity).delete().in('id', deleteIds)
      }
      // 全部成功才清队列（all-or-nothing）+ 写 lastSyncedAt；rowTimes 清空（已推送记录与云端一致，
      // 后续本地再编辑会由 enqueueChange 重新记录，避免无限增长与陈旧时间误导合并）
      clearSyncQueue()
      writeMeta({ lastSyncedAt: new Date().toISOString(), rowTimes: {} })
      lastError = null
      currentStatus = 'idle'
      return true
    } catch (err) {
      console.warn('[sync] 同步推送失败，队列已保留', err)
      lastError = describeError(err)
      currentStatus = 'error'
      return false
    }
  } catch (err) {
    console.warn('[sync] syncNow 异常（已安全降级为 error）', err)
    lastError = describeError(err)
    currentStatus = 'error'
    return false
  }
}

/**
 * 变更自动推送（2s 防抖）：重设定时器；到期后守卫
 * （未配置 / 离线 / 无 session → 静默跳过，零请求），队列非空 → fire-and-forget syncNow。
 * syncNow 不 throw；失败不阻塞：下次变更重新调度或手动重试。
 */
export function scheduleAutoSync(): void {
  if (autoSyncTimer !== null) clearTimeout(autoSyncTimer)
  autoSyncTimer = setTimeout(() => {
    autoSyncTimer = null
    void runAutoSync()
  }, AUTO_SYNC_DEBOUNCE_MS)
}

/** 退出登录时调用：取消未到期的自动推送定时器（不触碰队列，不发起任何请求）。 */
export function cancelAutoSync(): void {
  if (autoSyncTimer !== null) {
    clearTimeout(autoSyncTimer)
    autoSyncTimer = null
  }
}

async function runAutoSync(): Promise<void> {
  try {
    if (getSupabase() === null) return // 未配置：静默跳过
    if (typeof navigator !== 'undefined' && !navigator.onLine) return // 离线：静默跳过
    const sessionRes = await getSupabase()!.auth.getSession()
    if (!sessionRes?.data?.session) return // 未登录：静默跳过（零请求）
    if (getSyncQueue().length === 0) return // 队列空无需推送
    await syncNow() // 单飞：与手动「立即同步」复用同一 Promise，不重叠
  } catch (err) {
    // 守卫或 syncNow 意外异常：静默跳过，不阻塞下次调度
    console.warn('[sync] 自动同步守卫异常（已静默跳过）', err)
  }
}

export function getSyncStatus(): SyncStatus {
  return currentStatus
}

export function getLastSyncedAt(): string | null {
  return readMeta().lastSyncedAt
}

/** 最近一次推送失败原因（无失败/已成功恢复 → null）。 */
export function getLastSyncError(): string | null {
  return lastError
}

// ---------------------------------------------------------------------------
// 拉取合并（Phase 5 自动同步）
// ---------------------------------------------------------------------------

/** 云端行结构（三表均为 id / payload / updated_at，RLS 按当前用户过滤）。 */
interface CloudRow {
  id: string
  payload: Record<string, unknown>
  updated_at: string
}

/** 各实体记录主键字段名（与 storage.ts 的 ID_FIELD 一致）。 */
const ID_FIELD: Record<SyncEntity, string> = { cities: 'cityId', spots: 'spotId', memories: 'memoryId' }

/**
 * 读本地数据（直接读 localStorage，与 storage.ts 的 loadStateDetailed 语义对齐但更轻，避免循环依赖）。
 * 缺失 / 损坏 → 返回「空但合法」的 v1 态（schemaVersion 1）：拉取合并产出 nextState 后由
 * storage.loadStateDetailed 的标准迁移管线逐级升到 CURRENT_SCHEMA_VERSION，避免写出非法版本。
 */
function readLocalState(): AppState {
  const empty: AppState = { schemaVersion: 1, version: '1.0', visitedCities: [], scenicSpots: [], memories: [] }
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return empty
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Partial<AppState>
      if (
        Array.isArray(record.visitedCities) &&
        Array.isArray(record.scenicSpots) &&
        Array.isArray(record.memories)
      ) {
        return {
          schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : empty.schemaVersion,
          version: typeof record.version === 'string' ? record.version : empty.version,
          visitedCities: record.visitedCities,
          scenicSpots: record.scenicSpots,
          memories: record.memories,
        }
      }
    }
    return empty
  } catch {
    return empty
  }
}

/**
 * 单实体合并（冲突规则：内容相等短路 + updated_at 后写优先）：
 * 1. 本地无、云端有 → 添加（payload 即整条记录）。
 * 2. 双方都有且 JSON.stringify 全等 → 跳过（不覆盖、不比较时间）。
 * 3. 双方都有且内容不同 → 比较云端 updated_at 与本地写入时间（rowTimes），后者胜：
 *    云端新（或本地无写入时间记录）→ 云端覆盖本地；本地新（含时间相等）→ 保留本地 + upsert 推上去。
 * 4. 本地有、云端无 → 保留本地 + upsert 推上去。
 */
function mergeEntity(
  localRecords: unknown[],
  cloudRows: CloudRow[],
  entity: SyncEntity,
  rowTimes: SyncMeta['rowTimes'],
): { records: unknown[]; enqueued: boolean } {
  const idField = ID_FIELD[entity]
  const localById = new Map<string, unknown>()
  for (const rec of localRecords) {
    const id = (rec as Record<string, unknown>)[idField]
    if (typeof id === 'string') localById.set(id, rec)
  }
  const cloudById = new Map(cloudRows.map((row) => [row.id, row] as const))

  const merged: unknown[] = []
  const seen = new Set<string>()
  let enqueued = false

  for (const [id, cloudRow] of cloudById) {
    const localRec = localById.get(id)
    if (!localRec) {
      // 规则 1：本地无、云端有 → 添加
      merged.push(cloudRow.payload)
      seen.add(id)
      continue
    }
    if (JSON.stringify(localRec) === JSON.stringify(cloudRow.payload)) {
      // 规则 2：内容全等 → 跳过（不覆盖、不比较时间），保留本地
      merged.push(localRec)
      seen.add(id)
      continue
    }
    // 规则 3：内容不同 → 后写优先
    const localWriteTime = rowTimes[entity]?.[id] ?? null
    const cloudWins = localWriteTime === null || cloudRow.updated_at > localWriteTime
    if (cloudWins) {
      merged.push(cloudRow.payload) // 云端新 → 覆盖本地
    } else {
      merged.push(localRec) // 本地新（或时间相等，保守保本地）→ 保留本地 + upsert 推上去
      enqueueChange({ entity, action: 'upsert', entityId: id, payload: localRec as Record<string, unknown> })
      enqueued = true
    }
    seen.add(id)
  }

  // 规则 4：本地有、云端无 → 保留本地 + upsert 推上去
  for (const [id, localRec] of localById) {
    if (!seen.has(id)) {
      merged.push(localRec)
      enqueueChange({ entity, action: 'upsert', entityId: id, payload: localRec as Record<string, unknown> })
      enqueued = true
    }
  }

  return { records: merged, enqueued }
}

/**
 * 从云端拉取并合并到本地（纯 utils：不 import store、不碰 patchState）。
 * 1. 守卫：未配置 / 离线 / 无 session → 返回 null（零网络请求）。
 * 2. 三表并行 select('id, payload, updated_at')（RLS 自动按当前用户过滤；任一表错误 → 整体放弃，不写本地）。
 * 3. 合并冲突（见 mergeEntity），产出 nextState（仅替换三数组，保留 schemaVersion/version）。
 * 4. 有变化才直接写 localStorage（绝不走 patchState，避免触发入队/自动同步 → 无循环）→ 返回 { state, changed }。
 *    合并期间产生的「本地新/本地独有」upsert 已入队，末位 scheduleAutoSync 推上去（队列非空才实际推送）。
 */
export async function pullFromCloud(): Promise<{ state: AppState; changed: boolean } | null> {
  try {
    const client = getSupabase()
    if (client === null) return null
    if (typeof navigator !== 'undefined' && !navigator.onLine) return null
    const sessionRes = await client.auth.getSession()
    if (!sessionRes?.data?.session) return null

    const [citiesRes, spotsRes, memoriesRes] = await Promise.all([
      client.from('cities').select('id, payload, updated_at'),
      client.from('spots').select('id, payload, updated_at'),
      client.from('memories').select('id, payload, updated_at'),
    ])
    // 任一表查询失败（表缺失 / RLS 拒绝等）→ 整体放弃，不写本地、不误判云端为空
    const allResults = [citiesRes, spotsRes, memoriesRes]
    for (const res of allResults) {
      if (res.error) {
        console.warn('[sync] pullFromCloud 拉取失败（请确认已执行 docs/supabase_schema.sql 建表）', res.error)
        return null
      }
    }

    const local = readLocalState()
    const rowTimes = readMeta().rowTimes

    const cities = mergeEntity(local.visitedCities, (citiesRes.data ?? []) as CloudRow[], 'cities', rowTimes)
    const spots = mergeEntity(local.scenicSpots, (spotsRes.data ?? []) as CloudRow[], 'spots', rowTimes)
    const memories = mergeEntity(local.memories, (memoriesRes.data ?? []) as CloudRow[], 'memories', rowTimes)

    const changed =
      JSON.stringify(cities.records) !== JSON.stringify(local.visitedCities) ||
      JSON.stringify(spots.records) !== JSON.stringify(local.scenicSpots) ||
      JSON.stringify(memories.records) !== JSON.stringify(local.memories)

    if (!changed) {
      // 无变化不写盘；若合并产生了待推项（本地新/本地独有），调度自动推送（队列非空才实际推送）
      if (cities.enqueued || spots.enqueued || memories.enqueued) scheduleAutoSync()
      return { state: local, changed: false }
    }

    const nextState: AppState = {
      schemaVersion: local.schemaVersion,
      version: local.version,
      visitedCities: cities.records as AppState['visitedCities'],
      scenicSpots: spots.records as AppState['scenicSpots'],
      memories: memories.records as AppState['memories'],
    }
    // 直接写 localStorage（saveState 语义），绝不走 patchState → 不触发入队/自动同步（防循环）
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(nextState))
    } catch (err) {
      console.warn('[sync] pullFromCloud 写回本地失败', err)
      return { state: local, changed: false }
    }
    // 合并期间入队的「本地新/本地独有」upsert：调度自动推送推上去（队列非空才实际推送）
    if (cities.enqueued || spots.enqueued || memories.enqueued) scheduleAutoSync()
    return { state: nextState, changed: true }
  } catch (err) {
    console.warn('[sync] pullFromCloud 异常（已安全降级为 null）', err)
    return null
  }
}
