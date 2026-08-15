import type { AppState } from '../types'
import { mockData } from './mockData'
import { MigrationError, runMigrations } from './migrations'
import { enqueueChange, scheduleAutoSync, type SyncEntity } from './syncService'

const STORAGE_KEY = 'travel_footprint_data'

/** 损坏数据隔离区 key（保留原始字符串现场）。 */
export const QUARANTINE_KEY = 'travel_footprint_data_corrupted'

export type LoadSource = 'fresh' | 'stored' | 'migrated' | 'quarantined'

export interface LoadStateResult {
  state: AppState
  source: LoadSource
  error?: string
}

const QUARANTINE_MAX = 5

/** 读 QUARANTINE_KEY（JSON 数组）追加 {savedAt, raw}，保留最近 5 份；同 raw 已隔离过则不再追加。 */
function quarantine(raw: string): void {
  try {
    const prev = JSON.parse(localStorage.getItem(QUARANTINE_KEY) ?? '[]')
    const list = Array.isArray(prev) ? (prev as unknown[]) : []
    const alreadyQuarantined = list.some(
      (item) => item && typeof item === 'object' && (item as { raw?: unknown }).raw === raw,
    )
    if (alreadyQuarantined) return
    list.push({ savedAt: new Date().toISOString(), raw })
    const kept = list.slice(-QUARANTINE_MAX)
    localStorage.setItem(QUARANTINE_KEY, JSON.stringify(kept))
  } catch {
    // 隔离区自身写入失败时静默忽略，绝不因隔离逻辑让应用崩溃
  }
}

/** 结构校验：三个数组字段存在即可（旧数据无 version/schemaVersion 不再视为损坏）。 */
function isValidStateShape(record: Record<string, unknown>): boolean {
  return (
    Array.isArray(record.visitedCities) &&
    Array.isArray(record.scenicSpots) &&
    Array.isArray(record.memories)
  )
}

/**
 * 行为矩阵：
 * ① key 不存在 → 写 mockData，返回 fresh；
 * ② 解析成功且三数组字段均存在 → runMigrations，migrated 则立即 saveState 并返回 migrated，否则 stored；
 * ③ 解析失败或结构校验失败 → quarantine(原始字符串)，不覆盖 STORAGE_KEY 原值（现场保留），
 *    内存返回 mockData（不写回），返回 quarantined 并 console.warn。
 */
export function loadStateDetailed(): LoadStateResult {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockData))
    return { state: mockData, source: 'fresh' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    quarantine(raw)
    console.warn('[storage] 本地数据 JSON 解析失败，已隔离并回退到内置示例数据', err)
    return { state: mockData, source: 'quarantined', error: String(err) }
  }

  const record = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  if (!isValidStateShape(record)) {
    quarantine(raw)
    console.warn('[storage] 本地数据结构校验失败，已隔离并回退到内置示例数据')
    return { state: mockData, source: 'quarantined', error: 'invalid state shape' }
  }

  try {
    const { state, migrated } = runMigrations(parsed)
    if (migrated) {
      saveState(state)
      return { state, source: 'migrated' }
    }
    return { state, source: 'stored' }
  } catch (err) {
    quarantine(raw)
    const msg = err instanceof MigrationError ? err.message : String(err)
    console.warn('[storage] 数据迁移失败，已隔离并回退到内置示例数据', err)
    return { state: mockData, source: 'quarantined', error: msg }
  }
}

export function loadState(): AppState {
  return loadStateDetailed().state
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/** patchState 写入口 → 同步队列实体映射（仅三个用户数据数组；schemaVersion/version 不入队）。 */
const ENTITY_MAP: Partial<Record<keyof AppState, SyncEntity>> = {
  visitedCities: 'cities',
  scenicSpots: 'spots',
  memories: 'memories',
}

/** 各实体记录主键字段名。 */
const ID_FIELD: Record<SyncEntity, string> = { cities: 'cityId', spots: 'spotId', memories: 'memoryId' }

/** 入队抑制开关：置位期间 patchState 跳过 enqueueArrayDiff 与自动同步（本地落盘不受影响）。 */
let suppressEnqueue = false

/**
 * 入队抑制窗口：置位 suppressEnqueue 执行 fn 后复位（try/finally 保证异常也不泄漏置位）。
 * 用途：拉取写回编排（cloudPull.pullCloudAndApply）在 changed 时用本函数包裹三 store
 * reloadFromStorage——写回只走 saveState + reloadFromStorage，不触发 enqueueArrayDiff →
 * 不触发自动同步 → 无循环推送（内容全等路径本身零入队，本开关兜底内容不同场景）。
 * 默认 false：patchState 原行为不变。
 */
export function withEnqueueSuppressed<T>(fn: () => T): T {
  suppressEnqueue = true
  try {
    return fn()
  } finally {
    suppressEnqueue = false
  }
}

/**
 * 内容 diff 入队：按 entityId 建 Map，JSON.stringify 判内容相等。
 * - 新有旧无 / 内容变化 → upsert（payload 为整条新记录）；
 * - 旧有新无 → delete（不带 payload）；
 * - 两边皆同 → 跳过（不产生噪声队列项）。
 * 整体 try/catch：入队任何异常只 console.warn，绝不影响已完成的本地落盘。
 */
function enqueueArrayDiff(entity: SyncEntity, prev: unknown[], next: unknown[]): void {
  try {
    const idField = ID_FIELD[entity]
    const prevById = new Map(
      prev.map((r) => [(r as Record<string, unknown>)[idField], r] as const),
    )
    const nextById = new Map(
      next.map((r) => [(r as Record<string, unknown>)[idField], r] as const),
    )
    for (const [id, rec] of nextById) {
      if (typeof id !== 'string') continue // 无 id 记录防御性跳过
      const old = prevById.get(id)
      if (!old || JSON.stringify(old) !== JSON.stringify(rec)) {
        enqueueChange({ entity, action: 'upsert', entityId: id, payload: rec as Record<string, unknown> })
      }
    }
    for (const id of prevById.keys()) {
      if (!nextById.has(id)) enqueueChange({ entity, action: 'delete', entityId: id as string })
    }
  } catch (err) {
    console.warn('[storage] 同步入队失败（不影响本地落盘）', err)
  }
}

export function patchState<K extends keyof AppState>(key: K, value: AppState[K]): void {
  const { state, source } = loadStateDetailed()
  // 损坏数据已隔离：不写回 mockData，保护 STORAGE_KEY 的损坏现场（不覆盖原值）
  if (source === 'quarantined') return
  const prev = state[key] as unknown[]
  state[key] = value
  saveState(state)
  // 先落盘、后入队：入队任何异常都不影响 localStorage 写盘；内容全等（如启动 init）则零入队
  const entity = ENTITY_MAP[key]
  if (entity && Array.isArray(prev) && Array.isArray(value)) {
    // 拉取写回抑制：跳过入队与自动同步（本地落盘已完成；杜绝回推与循环推送）
    if (suppressEnqueue) return
    enqueueArrayDiff(entity, prev, value)
    // 变更自动推送挂钩：2s 防抖；守卫（未配置/离线/未登录/队列空）在 syncService 内静默跳过
    scheduleAutoSync()
  }
}
