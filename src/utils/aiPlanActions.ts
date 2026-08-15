/**
 * AI 行程卡片操作纯逻辑（任务 5.3）
 * 组件保持薄：id 生成 / level 归一 / DaySpot→ScenicSpot 映射 / 回忆草稿构造 / Markdown 格式化
 * 全部为纯函数，无 DOM / store / 网络依赖，便于独立验证与日后补单测（无单测基建，验收以手动 + build 为准）。
 * 类型复用 aiClient.ts（DaySpot/DayPlan/ItineraryRequest）与 types/index.ts（ScenicSpot/SpotLevel/TravelMemory）。
 */
import type { DayPlan, DaySpot, ItineraryRequest } from './aiClient'
import type { ScenicSpot, SpotLevel, TravelMemory } from '../types'
import { findCityCoords } from './cityCoords'

/** 确定性 spotId：`ai-${city}-${name}`，同 (city, name) 跨次生成 id 相同（A1-4）。 */
export function toSpotId(spot: DaySpot): string {
  return `ai-${spot.city.trim()}-${spot.name.trim()}`
}

/**
 * level 归一（A1-5）：先 trim，精确 '4A'/'5A' → 自身；包含 '5A' → '5A'；包含 '4A' → '4A'；其余（'必游'/'世界遗产'/空串 等）兜底 '5A'。
 * 原值由调用方（toScenicSpot）备注进 description，不丢失信息。
 */
export function normalizeSpotLevel(level: string): SpotLevel {
  const raw = level.trim()
  if (raw === '4A' || raw === '5A') return raw
  if (raw.includes('5A')) return '5A'
  if (raw.includes('4A')) return '4A'
  return '5A'
}

/**
 * DaySpot → ScenicSpot（操作 1 落库形状，契约见任务书 §3）：
 * - type 固定 'AI 推荐'（与手动 '自然风光' 等区分，ScenicView 可辨识）
 * - 坐标/省份本地坐标库兜底，未命中 lat/lng=0、province=''（不抛错，A1-6）
 * - description = tip 作简介；level 被兜底时追加 `【AI 标记：原值】`（A1-5）
 */
export function toScenicSpot(spot: DaySpot): ScenicSpot {
  const coord = findCityCoords(spot.city)
  const rawLevel = (spot.level ?? '').trim()
  const level = normalizeSpotLevel(rawLevel)
  const levelNote = rawLevel !== '4A' && rawLevel !== '5A' ? `【AI 标记：${rawLevel}】` : ''
  const tip = spot.tip?.trim()
  const description = [tip, levelNote].filter(Boolean).join(' ') || undefined
  return {
    spotId: toSpotId(spot),
    spotName: spot.name.trim(),
    level,
    city: spot.city.trim(),
    province: coord?.province ?? '',
    type: 'AI 推荐',
    status: 'wishlist',
    relatedMemoryIds: [],
    lat: coord?.lat ?? 0,
    lng: coord?.lng ?? 0,
    description,
  }
}

/** 同伴文本按 [,，、] 拆分，trim 后过滤空串（A2-4）。 */
export function splitCompanions(raw: string): string[] {
  return raw
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 本地日期格式化 YYYY-MM-DD（getFullYear/getMonth/getDate 为本地语义，杜绝 UTC 偏移）。 */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 日期字符串（YYYY-MM-DD）加 N 天：本地构造 + setDate 本地算术，避免时区偏移一天（A2-2）。 */
function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return formatLocalDate(date)
}

/** 行程标题：`{destination} {days}日行程（AI 生成）`；destination 为空（如 fixture 未填表单）时避免前导空格。 */
function tripTitle(input: ItineraryRequest): string {
  return [input.destination.trim(), `${input.days}日行程（AI 生成）`].filter(Boolean).join(' ')
}

/** content 逐天完整文本（操作 2，A2-3）：按天分段，含景点（名称/城市/时长/tip）、当日预算、当日 Tips，可被 MemoryFormView 直接编辑。 */
function plansToText(input: ItineraryRequest, plans: DayPlan[]): string {
  const header = `【${tripTitle(input)}】 风格：${input.style.trim()}；预算：${input.budget?.trim() || '未指定'}；同行：${input.companions?.trim() || '未指定'}`
  const dayBlocks = plans.map((plan) => {
    const spotLines = plan.spots
      .map((spot) => {
        const base = `- ${spot.name.trim()}（${spot.city.trim()} · 建议停留 ${spot.duration} 小时）`
        const tip = spot.tip?.trim()
        return tip ? `${base}\n  ${tip}` : base
      })
      .join('\n')
    const lines = [`第 ${plan.day} 天 · ${plan.title}`, spotLines]
    if (plan.budget?.trim()) lines.push(`当日预算：${plan.budget.trim()}`)
    if (plan.tips?.trim()) lines.push(`小贴士：${plan.tips.trim()}`)
    return lines.join('\n')
  })
  return [header, '', ...dayBlocks, '', '（内容由 AI 生成，仅供参考，出行前请核实）'].join('\n')
}

/**
 * 回忆草稿构造（操作 2，A2-1～A2-4）：
 * - title/日期推算（无出发日期则今天；endDate = startDate + (days-1)，本地算术）
 * - companions 按 [,，、] 拆分；tags = [style, 'AI 行程'] 去重；cities 按出现顺序去重
 * - spotIds = linkedSpotIds（调用方保存时经 scenicStore 反查已加入心愿单的 spotId）
 * - cost 保持 undefined：AI 预算为文本，不强行转 number（防脏数据）
 */
export function buildMemoryDraft(input: ItineraryRequest, plans: DayPlan[], linkedSpotIds: string[]): TravelMemory {
  const now = new Date().toISOString()
  const startDate = input.startDate?.trim() || formatLocalDate(new Date())
  const endDate = addDaysToDateStr(startDate, Math.max(1, input.days) - 1)
  const cities: string[] = []
  for (const plan of plans) {
    for (const spot of plan.spots) {
      const city = spot.city.trim()
      if (city && !cities.includes(city)) cities.push(city)
    }
  }
  return {
    memoryId: `m${Date.now()}`,
    title: tripTitle(input),
    startDate,
    endDate,
    companions: splitCompanions(input.companions ?? ''),
    tags: [...new Set([input.style.trim(), 'AI 行程'])].filter(Boolean),
    cost: undefined,
    content: plansToText(input, plans),
    images: [],
    cities,
    spotIds: linkedSpotIds,
    createdAt: now,
    updatedAt: now,
  }
}

/** Markdown 产物（操作 3，A3-2）：以 `# 标题` 开头，含 `## 第 X 天 · title`、景点行、预算与 Tips，可直接粘贴任意 Markdown 编辑器。 */
export function plansToMarkdown(input: ItineraryRequest, plans: DayPlan[]): string {
  const title = `# ${tripTitle(input)}`
  const summary = `> 风格：${input.style.trim()} · 预算：${input.budget?.trim() || '未指定'} · 同行人：${input.companions?.trim() || '未指定'}`
  const daySections = plans.map((plan) => {
    const lines: string[] = [`## 第 ${plan.day} 天 · ${plan.title}`]
    for (const spot of plan.spots) {
      lines.push(`- ${spot.name.trim()}（${spot.city.trim()} · 建议停留 ${spot.duration} 小时）`)
      const tip = spot.tip?.trim()
      if (tip) lines.push(`  - ${tip}`)
    }
    if (plan.budget?.trim()) lines.push(`- 当日预算：${plan.budget.trim()}`)
    if (plan.tips?.trim()) lines.push(`- 小贴士：${plan.tips.trim()}`)
    return lines.join('\n')
  })
  return [title, summary, '', ...daySections, '', '---', '*内容由 AI 生成，仅供参考*'].join('\n')
}
