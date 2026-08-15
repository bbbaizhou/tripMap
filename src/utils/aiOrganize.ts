/**
 * 智能整理纯函数（任务 5.6）
 * 全部为纯函数，无 DOM / store / 网络依赖，便于独立验证（验收以手动 + build 为准）。
 * 类型复用 types/index.ts（TravelMemory / ScenicSpot）。
 */
import type { ScenicSpot, TravelMemory } from '../types'

/** 标签合并上限（5.6-B：防标签膨胀）。 */
export const TAG_CAP = 8

/** 选中无标签回忆（!tags.length）。 */
export function pickUntaggedMemories(memories: TravelMemory[]): TravelMemory[] {
  return memories.filter((m) => !m.tags || m.tags.length === 0)
}

/** 选中缺失坐标景点（lat===0 && lng===0，5.6-A 坐标兜底范围）。 */
export function pickSpotsMissingCoords(spots: ScenicSpot[]): ScenicSpot[] {
  return spots.filter((s) => s.lat === 0 && s.lng === 0)
}

/** 选中缺失简介景点（!description，5.6-C 信息补全范围）。 */
export function pickSpotsMissingDesc(spots: ScenicSpot[]): ScenicSpot[] {
  return spots.filter((s) => !s.description || !s.description.trim())
}

/**
 * 合并标签：trim + 去重 + 保序（existing 在前，incoming 追加），上限 TAG_CAP 个。
 * 空串/纯空白标签忽略。
 */
export function mergeTags(existing: string[], incoming: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of [...existing, ...incoming]) {
    const trimmed = tag.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
    if (result.length >= TAG_CAP) break
  }
  return result
}
