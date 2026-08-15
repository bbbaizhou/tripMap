import type { YearlyInsightStats } from './insightStats'

/** AI 客户端配置：apiKey 必填（trim 后非空）；endpoint 缺省用默认值。 */
export interface AiConfig {
  apiKey: string
  endpoint: string
}

/** 行程规划请求（子任务 2 表单 → generateItinerary）。 */
export interface ItineraryRequest {
  destination: string
  days: number
  style: string
  budget?: string
  companions?: string
  startDate?: string
}

/** 单日行程中的一个景点。 */
export interface DaySpot {
  name: string
  city: string
  level: string
  duration: number
  tip?: string
}

/** 单日行程计划。 */
export interface DayPlan {
  day: number
  title: string
  spots: DaySpot[]
  budget?: string
  tips?: string
}

/** 数据洞察请求（子任务 3 → generateInsights）。 */
export interface InsightsRequest {
  year: string
  stats: YearlyInsightStats
}

/** 自动标签请求（子任务 4 预留 → autoTag）。 */
export interface AutoTagRequest {
  title: string
  content: string
  cities: string[]
}

/** 默认 DeepSeek 兼容端点（接入后端代理后由 VITE_AI_ENDPOINT 覆盖）。 */
const DEFAULT_ENDPOINT = 'https://api.deepseek.com/chat/completions'

/**
 * AI 是否已配置：仅当 VITE_AI_API_KEY trim 后非空（endpoint 缺省用默认值）。
 * 复刻 supabase.ts 的 trim 判空模式：不抛错、不发起任何网络请求。
 * 调用方契约：先短路本函数再调用三生成函数 → 未配置时页面零请求。
 */
export function isAiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_AI_API_KEY?.trim())
}

/**
 * 读取配置：apiKey trim 判空；空 → null；endpoint 缺省用默认值。
 * 凭据仅经 import.meta.env 注入（构建期静态替换），源码不出现真实 Key。
 */
export function getAiConfig(): AiConfig | null {
  const apiKey = import.meta.env.VITE_AI_API_KEY?.trim()
  if (!apiKey) return null
  const endpoint = import.meta.env.VITE_AI_ENDPOINT?.trim() || DEFAULT_ENDPOINT
  return { apiKey, endpoint }
}

/**
 * 生成行程规划（骨架占位：cfg 非空也仅返回 null，激活条件 = isAiConfigured() 为真且 Phase 5.2 接入）。
 *
 * TODO(Phase 5.2)：fetch(cfg.endpoint) POST，Headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` }
 * body: { model: 'deepseek-chat', messages: [{ role: 'system', content: '<角色约束>' }, { role: 'user', content: '<序列化后的 input>' }],
 *         response_format: { type: 'json_object' }, temperature: 0.7 }
 * 30s 超时用 AbortController；失败返回 null 由调用方降级提示。本轮骨架在 cfg 非空后直接 return null（占位）。
 */
export async function generateItinerary(_input: ItineraryRequest, cfg: AiConfig | null = getAiConfig()): Promise<DayPlan[] | null> {
  if (!cfg) return null
  // TODO(Phase 5.2)：真实调用，见上方注释；当前骨架仅占位。
  return null
}

/**
 * 生成年度数据洞察（3-5 条文本，骨架占位，契约同 generateItinerary）。
 *
 * TODO(Phase 5.2)：fetch(cfg.endpoint) POST，Headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` }
 * body: { model: 'deepseek-chat', messages: [{ role: 'system', content: '<角色约束>' }, { role: 'user', content: '<序列化后的 input>' }],
 *         response_format: { type: 'json_object' }, temperature: 0.7 }
 * 30s 超时用 AbortController；失败返回 null 由调用方降级提示。本轮骨架在 cfg 非空后直接 return null（占位）。
 */
export async function generateInsights(_input: InsightsRequest, cfg: AiConfig | null = getAiConfig()): Promise<string[] | null> {
  if (!cfg) return null
  // TODO(Phase 5.2)：真实调用，见上方注释；当前骨架仅占位。
  return null
}

/**
 * 对回忆内容批量打标签（骨架占位，契约同 generateItinerary）。
 *
 * TODO(Phase 5.2)：fetch(cfg.endpoint) POST，Headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` }
 * body: { model: 'deepseek-chat', messages: [{ role: 'system', content: '<角色约束>' }, { role: 'user', content: '<序列化后的 input>' }],
 *         response_format: { type: 'json_object' }, temperature: 0.7 }
 * 30s 超时用 AbortController；失败返回 null 由调用方降级提示。本轮骨架在 cfg 非空后直接 return null（占位）。
 */
export async function autoTag(_input: AutoTagRequest, cfg: AiConfig | null = getAiConfig()): Promise<string[] | null> {
  if (!cfg) return null
  // TODO(Phase 5.2)：真实调用，见上方注释；当前骨架仅占位。
  return null
}
