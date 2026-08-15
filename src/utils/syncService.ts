import { getSupabase, isSupabaseConfigured } from './supabase'

/**
 * local-first 同步服务（Phase 4.2 激活：真实推送 + 登录前置检查）。
 *
 * - 队列与元数据使用独立 localStorage key（travel_footprint_sync_*），
 *   与数据 key（travel_footprint_data / *_corrupted）完全隔离；
 *   队列损坏只重置队列，不进 QUARANTINE 隔离区（storage.ts 零改动）。
 * - 未配置 / 离线 / 队列空 / 未登录 四类路径均不抛错、不发任何网络写请求。
 * - 真实推送失败 = all-or-nothing：任一实体失败整队列保留（upsert 幂等，重试可重放）。
 * - utils 层零耦合：登录检查直接用 getSupabase()?.auth.getSession()，不 import authStore。
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
}

const QUEUE_KEY = 'travel_footprint_sync_queue'
const META_KEY = 'travel_footprint_sync_meta'
const QUEUE_LIMIT = 500

// 初始状态跟随配置：未配置 → disabled；已配置 → idle；由 syncNow 更新。
let currentStatus: SyncStatus = isSupabaseConfigured() ? 'idle' : 'disabled'

// 最近一次推送失败原因（面板 error 态展示；成功/未推送过为 null）。
let lastError: string | null = null

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

/** 读元数据：损坏 / 缺失一律视为 null。 */
function readMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return { lastSyncedAt: null }
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'lastSyncedAt' in parsed) {
      return { lastSyncedAt: (parsed as SyncMeta).lastSyncedAt }
    }
    return { lastSyncedAt: null }
  } catch {
    return { lastSyncedAt: null }
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
  next.push({
    ...item,
    id: generateId(item),
    updatedAt: new Date().toISOString(),
  })
  writeQueue(next.slice(-QUEUE_LIMIT))
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
 *    clearSyncQueue() + 写 lastSyncedAt → idle，true；
 * 6. 任一实体失败（异常 / RLS 拒绝 / 断网）→ 保留整队列 → error，false，lastError 记录原因。
 */
export async function syncNow(): Promise<boolean> {
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
      // 全部成功才清队列（all-or-nothing）+ 写 lastSyncedAt
      clearSyncQueue()
      writeMeta({ lastSyncedAt: new Date().toISOString() })
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
