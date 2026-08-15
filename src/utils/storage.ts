import type { AppState } from '../types'
import { mockData } from './mockData'
import { MigrationError, runMigrations } from './migrations'

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

export function patchState<K extends keyof AppState>(key: K, value: AppState[K]): void {
  const { state, source } = loadStateDetailed()
  // 损坏数据已隔离：不写回 mockData，保护 STORAGE_KEY 的损坏现场（不覆盖原值）
  if (source === 'quarantined') return
  state[key] = value
  saveState(state)
  // TODO(Phase 4.2 云同步)：store 写入口挂钩点 —— 三个 store 的写操作最终都经 patchState 落盘，
  // 未来在此追加 enqueueChange({ entity: 对应数组名, action: 'upsert', entityId, payload })
  // 即可让每次落盘变更同时进入同步队列（store 签名与 storage.ts 签名均不改动）。
}
