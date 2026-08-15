import type { AppState } from '../types'
import { findCityCoords } from './cityCoords'

/** 当前数据结构版本。 */
export const CURRENT_SCHEMA_VERSION = 2

export type Migration = (state: Record<string, unknown>) => Record<string, unknown>

/** 某版本缺少迁移函数时抛出；由 storage.ts 捕获并走隔离流程。 */
export class MigrationError extends Error {
  constructor(version: number) {
    super(`Missing migration function for schema version ${version}`)
    this.name = 'MigrationError'
  }
}

/**
 * v1 → v2：
 * ① visitedCities 每项 country 缺失时补 '中国'；
 * ② lat/lng 为 0 或非数的，用本地坐标库 findCityCoords 回填；
 * ③ 置 schemaVersion=2，version 更新为 '2.0'。
 */
export function migrateV1toV2(state: Record<string, unknown>): Record<string, unknown> {
  const cities = Array.isArray(state.visitedCities) ? state.visitedCities : []
  const migratedCities = cities.map((rawCity) => {
    const city = (rawCity && typeof rawCity === 'object' ? rawCity : {}) as Record<string, unknown>
    const next: Record<string, unknown> = { ...city }

    if (typeof next.country !== 'string' || !next.country) {
      next.country = '中国'
    }

    const lat = typeof next.lat === 'number' ? next.lat : Number.NaN
    const lng = typeof next.lng === 'number' ? next.lng : Number.NaN
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
      const name = typeof next.cityName === 'string' ? next.cityName : ''
      const province = typeof next.province === 'string' ? next.province : undefined
      const coords = findCityCoords(name, province)
      if (coords) {
        next.lat = coords.lat
        next.lng = coords.lng
      }
    }
    return next
  })

  return {
    ...state,
    visitedCities: migratedCities,
    schemaVersion: 2,
    version: '2.0',
  }
}

const MIGRATIONS: Record<number, Migration> = {
  1: migrateV1toV2,
}

/**
 * 逐级执行迁移管线。
 * - raw.schemaVersion 为 number 则用之，否则视为 1；
 * - 某级缺失迁移函数 → 抛 MigrationError（由 storage 捕获走隔离）。
 */
export function runMigrations(raw: unknown): { state: AppState; migrated: boolean } {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const version = typeof record.schemaVersion === 'number' ? record.schemaVersion : 1

  let state: Record<string, unknown> = record
  let migrated = false
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v]
    if (!migrate) throw new MigrationError(v)
    state = migrate(state)
    migrated = true
  }
  return { state: state as unknown as AppState, migrated }
}
