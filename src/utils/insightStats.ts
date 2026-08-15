import type { FootprintCity, ScenicSpot, TravelMemory } from '../types'

/** 洞察聚合输入：与 store 解耦的普通数组（可直接单测）。 */
export interface InsightSourceData {
  cities: FootprintCity[]
  spots: ScenicSpot[]
  memories: TravelMemory[]
}

/** 年度统计口径（LLM 不参与计算，见 PHASE5_AI_TASKS.md §4）。 */
export interface YearlyInsightStats {
  year: string
  cityCount: number
  provinceCount: number
  spotCount: number
  memoryCount: number
  totalDays: number
  totalCost: number
  cityList: string[]
  provinceList: string[]
}

/**
 * 含首尾天数：end - start + 1。
 * 非法输入（空串 / 非 YYYY-MM-DD / 结束早于开始）返回 0。
 * 按本地时区解析，避免 UTC 偏移导致跨日误差。
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate)
  const end = parseDateOnly(endDate)
  if (start === null || end === null) return 0
  const diffMs = end.getTime() - start.getTime()
  if (diffMs < 0) return 0
  return Math.round(diffMs / 86_400_000) + 1
}

/** 解析 YYYY-MM-DD 并校验日期合法性（如 2025-02-30 会被 Date 滚动到 3 月，判为非法）；非法返回 null。 */
function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

/**
 * 按年聚合（口径见 PHASE5_AI_TASKS.md §4）：
 * - cityCount：firstVisitDate 以 year 开头的城市数；provinceCount：上述城市的 province 去重数
 * - spotCount：status === 'visited' 且 visitDate 以 year 开头的景点数
 * - memoryCount：startDate 以 year 开头的回忆数
 * - totalDays：上述回忆的 daysBetween(startDate, endDate) 之和
 * - totalCost：上述回忆的 (cost ?? 0) 之和
 */
export function computeYearlyInsights(data: InsightSourceData, year: string): YearlyInsightStats {
  const yearCities = data.cities.filter((c) => c.firstVisitDate.startsWith(year))
  const provinceSet = new Set<string>()
  for (const city of yearCities) {
    const province = city.province.trim()
    if (province) provinceSet.add(province)
  }

  const yearSpots = data.spots.filter((s) => s.status === 'visited' && s.visitDate?.startsWith(year))
  const yearMemories = data.memories.filter((m) => m.startDate.startsWith(year))

  return {
    year,
    cityCount: yearCities.length,
    provinceCount: provinceSet.size,
    spotCount: yearSpots.length,
    memoryCount: yearMemories.length,
    totalDays: yearMemories.reduce((sum, m) => sum + daysBetween(m.startDate, m.endDate), 0),
    totalCost: yearMemories.reduce((sum, m) => sum + (m.cost ?? 0), 0),
    cityList: yearCities.map((c) => c.cityName),
    provinceList: [...provinceSet],
  }
}

/** 降序去重：memories.startDate ∪ cities.firstVisitDate 的年份（非 4 位数字的脏数据忽略）。 */
export function getInsightYears(data: InsightSourceData): string[] {
  const years = new Set<string>()
  for (const memory of data.memories) {
    const year = memory.startDate.slice(0, 4)
    if (/^\d{4}$/.test(year)) years.add(year)
  }
  for (const city of data.cities) {
    const year = city.firstVisitDate.slice(0, 4)
    if (/^\d{4}$/.test(year)) years.add(year)
  }
  return [...years].sort((a, b) => Number(b) - Number(a))
}
