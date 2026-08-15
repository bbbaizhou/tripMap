import { getSupabase, isSupabaseConfigured } from './supabase'

/**
 * local-first 同步服务骨架（Phase 4.2 之前的占位实现）。
 *
 * - 队列与元数据使用独立 localStorage key（travel_footprint_sync_*），
 *   与数据 key（travel_footprint_data / *_corrupted）完全隔离；
 *   队列损坏只重置队列，不进 QUARANTINE 隔离区（storage.ts 零改动）。
 * - 未配置 / 离线 / 队列空 / dry-run 四类路径均不抛错、不发任何网络请求。
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

export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncMeta {
  lastSyncedAt: string | null
}

const QUEUE_KEY = 'travel_footprint_sync_queue'
const META_KEY = 'travel_footprint_sync_meta'
const QUEUE_LIMIT = 500

/** 4.2 建表 + RLS 就绪后改为 false 并补全下方实现（见 syncNow）。 */
const SYNC_DRY_RUN = true

// 初始状态跟随配置：未配置 → disabled；已配置 → idle；由 syncNow 更新。
let currentStatus: SyncStatus = isSupabaseConfigured() ? 'idle' : 'disabled'

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

/** 读元数据：损坏 / 缺失一律视为 null（写入点留给 4.2）。 */
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
 * - 未配置（getSupabase() === null）→ 置 disabled、返回 false，不发请求；
 * - 离线（navigator.onLine === false）→ 置 offline、返回 false；
 * - 队列空 → 置 idle、返回 true；
 * - 其余 → 置 syncing，走 3.5 dry-run 骨架，结束置回 idle/error 并返回结果。
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

    currentStatus = 'syncing'

    if (SYNC_DRY_RUN) {
      // ---- 3.5 dry-run 骨架（本轮激活路径）----
      // 当前行为：console.info 打印按 entity 分组的待推清单，不修改队列、
      // 返回 false、状态置 'idle'。绝不清空队列。
      logPendingQueue(queue)
      currentStatus = 'idle'
      return false // dry-run 未真正推送，返回 false
    }

    // ---- 真实批量推送（本轮不可达：SYNC_DRY_RUN = true）----
    // TODO(4.2 激活)：SYNC_DRY_RUN 置 false 后补全下方实现
    //   const client = getSupabase()
    //   for (const entity of ['cities', 'spots', 'memories'] as const) {
    //     const items = queue.filter((i) => i.entity === entity)
    //     if (items.length === 0) continue
    //     await client.from(entity).upsert(items
    //       .filter((i) => i.action === 'upsert')
    //       .map((i) => ({ id: i.entityId, payload: i.payload, updated_at: i.updatedAt })))
    //     const deleteIds = items.filter((i) => i.action === 'delete').map((i) => i.entityId)
    //     if (deleteIds.length > 0) await client.from(entity).delete().in('id', deleteIds)
    //   }
    //   全部成功后：clearSyncQueue() + 写 meta.lastSyncedAt
    currentStatus = 'idle'
    return false
  } catch (err) {
    console.warn('[sync] syncNow 异常（已安全降级为 error）', err)
    currentStatus = 'error'
    return false
  }
}

/** dry-run 辅助：按 entity 分组打印待推清单。 */
function logPendingQueue(queue: SyncQueueItem[]): void {
  const byEntity: Record<SyncEntity, SyncQueueItem[]> = { cities: [], spots: [], memories: [] }
  for (const item of queue) byEntity[item.entity].push(item)
  for (const entity of ['cities', 'spots', 'memories'] as const) {
    const items = byEntity[entity]
    if (items.length === 0) continue
    const upserts = items.filter((i) => i.action === 'upsert').length
    const deletes = items.filter((i) => i.action === 'delete').length
    console.info(`[sync:dry-run] ${entity}：upsert ${upserts} 条 / delete ${deletes} 条`)
    for (const item of items) {
      console.info(`[sync:dry-run]   ${item.action} ${item.entityId} @${item.updatedAt}`)
    }
  }
}

export function getSyncStatus(): SyncStatus {
  return currentStatus
}

/** 本轮恒 null（写入点留给 4.2 真正推送成功后）。 */
export function getLastSyncedAt(): string | null {
  return readMeta().lastSyncedAt
}
