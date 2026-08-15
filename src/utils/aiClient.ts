import { getSupabase } from './supabase'
import type { YearlyInsightStats } from './insightStats'

/**
 * AI 客户端配置：
 * - mode 'proxy'（VITE_AI_ENDPOINT 指向 Supabase Edge Function ai-proxy）：
 *   携带用户 JWT 调 Edge Function，DeepSeek Key 由服务端 Secrets 保管，bundle 零 Key。
 * - mode 'direct'（开发降级路径）：直接调 DeepSeek，Bearer apiKey（仅本地开发用）。
 * 下方三个 systemPrompt（ITINERARY / INSIGHTS / AUTO_TAG）与
 * supabase/functions/ai-proxy/index.ts 中的同名常量【原样一致，需人工保持同步】——
 * 两文件互指注释，唯一不同步点，改动任何一侧必须同步另一侧。
 */
export interface AiConfig {
  apiKey: string
  endpoint: string
  mode: 'proxy' | 'direct'
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

/** 请求超时（毫秒）：30s，超时后 AbortController 中止，调用方降级为 null。 */
const TIMEOUT_MS = 30_000

/** DeepSeek Chat Completions 响应骨架（仅取需要的字段，其余忽略）。 */
interface DeepSeekChatResponse {
  choices?: Array<{
    message?: { content?: string }
  }>
}

/**
 * AI 是否已配置：VITE_AI_ENDPOINT 或 VITE_AI_API_KEY 任一 trim 后非空即视为已配置
 * （endpoint 优先：配了 endpoint 走 Edge Function 代理，不再需要 apiKey）。
 * 复刻 supabase.ts 的 trim 判空模式：不抛错、不发起任何网络请求。
 * 调用方契约：先短路本函数再调用三生成函数 → 未配置时页面零请求。
 */
export function isAiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_AI_ENDPOINT?.trim() || import.meta.env.VITE_AI_API_KEY?.trim())
}

/**
 * 读取配置：endpoint / apiKey 两者皆空 → null；
 * endpoint 优先：有 endpoint → mode 'proxy'（apiKey 可留空）；否则 mode 'direct'（apiKey 必填）。
 * 凭据仅经 import.meta.env 注入（构建期静态替换），源码不出现真实 Key。
 */
export function getAiConfig(): AiConfig | null {
  const endpoint = import.meta.env.VITE_AI_ENDPOINT?.trim()
  const apiKey = import.meta.env.VITE_AI_API_KEY?.trim()
  if (!endpoint && !apiKey) return null
  return { apiKey: apiKey ?? '', endpoint: endpoint || DEFAULT_ENDPOINT, mode: endpoint ? 'proxy' : 'direct' }
}

/** AI 动作类型：与 Edge Function 的 action 分发表一一对应。 */
export type AiAction = 'itinerary' | 'insights' | 'tags'

/**
 * 通用 AI 调用封装（私有）：POST 到 cfg.endpoint，30s 超时，要求 JSON 输出。
 * - direct：与现状一致，Bearer apiKey → 默认 DeepSeek 端点（开发降级路径）。
 * - proxy：需登录（getSupabase() 为 null 或无 session → console.warn + 返回 null，零网络请求），
 *   否则 POST cfg.endpoint（Edge Function），body 改 { action, payload: userContent }，
 *   Authorization: Bearer <access_token>；Edge Function 校验 JWT 后转发 DeepSeek。
 * 任何失败（网络/超时/非 2xx/JSON 解析/结构缺失）都返回 null，绝不 throw；
 * 非 2xx 时读取 resp.status 与 error body 记 console.warn。
 */
async function callDeepSeek<T>(cfg: AiConfig, action: AiAction, systemPrompt: string, userContent: string): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let resp: Response
    if (cfg.mode === 'proxy') {
      const client = getSupabase()
      const token = client === null ? null : ((await client.auth.getSession())?.data?.session?.access_token ?? null)
      if (!token) {
        console.warn('[aiClient] 代理模式需要登录（supabase 未配置或未登录），已跳过请求')
        return null
      }
      resp = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, payload: userContent }),
        signal: controller.signal,
      })
    } else {
      resp = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
        signal: controller.signal,
      })
    }
    if (!resp.ok) {
      let errorBody = ''
      try {
        errorBody = await resp.text()
      } catch {
        // 读取错误 body 失败不影响主流程
      }
      console.warn(`[aiClient] DeepSeek 请求失败：HTTP ${resp.status}`, errorBody.slice(0, 500))
      return null
    }
    // proxy 模式响应即目标 JSON（Edge Function 已解析 DeepSeek content 并透传）；direct 需再剥一层 choices
    if (cfg.mode === 'proxy') {
      return (await resp.json()) as T
    }
    const data = (await resp.json()) as DeepSeekChatResponse
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) return null
    return JSON.parse(content) as T
  } catch (error) {
    console.warn('[aiClient] DeepSeek 调用异常（网络/超时/解析）', error)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 形状校验：是否为 string[]。 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/** 形状校验：是否为 DayPlan[]（day 数字 / title 字符串 / spots 数组，缺一判结构不符）。 */
function isDayPlanArray(value: unknown): value is DayPlan[] {
  if (!Array.isArray(value)) return false
  return value.every(
    (day): day is DayPlan =>
      typeof day === 'object' &&
      day !== null &&
      typeof (day as DayPlan).day === 'number' &&
      typeof (day as DayPlan).title === 'string' &&
      Array.isArray((day as DayPlan).spots),
  )
}

/** 序列化行程请求为可读中文文本（供 user message 使用）。 */
function serializeItineraryRequest(input: ItineraryRequest): string {
  return [
    '请为以下旅行需求规划行程：',
    `- 目的地：${input.destination}`,
    `- 旅行天数：${input.days} 天`,
    `- 旅行风格：${input.style}`,
    `- 预算：${input.budget?.trim() || '未指定'}`,
    `- 同行人：${input.companions?.trim() || '未指定'}`,
    `- 出发日期：${input.startDate?.trim() || '未指定'}`,
  ].join('\n')
}

/** 序列化年度统计为中文统计文本（数字全部来自输入，LLM 不得编造）。 */
function serializeInsightsRequest(input: InsightsRequest): string {
  const s = input.stats
  return [
    `以下是 ${input.year} 年的旅行统计数据，请严格基于这些数字生成 3-5 条数据洞察：`,
    `- 访问城市数：${s.cityCount}`,
    `- 覆盖省份数：${s.provinceCount}`,
    `- 打卡景点数：${s.spotCount}`,
    `- 旅行回忆篇数：${s.memoryCount}`,
    `- 旅行总天数：${s.totalDays}`,
    `- 旅行总花费：${s.totalCost} 元`,
    `- 访问城市列表：${s.cityList.join('、') || '无'}`,
    `- 覆盖省份列表：${s.provinceList.join('、') || '无'}`,
  ].join('\n')
}

/** 序列化自动标签请求为中文文本。 */
function serializeAutoTagRequest(input: AutoTagRequest): string {
  return [
    '请为以下旅行回忆生成 3-5 个中文短标签（每个 2-6 字）：',
    `- 标题：${input.title}`,
    `- 内容：${input.content}`,
    `- 涉及城市：${input.cities.join('、') || '无'}`,
  ].join('\n')
}

/** 行程规划 system prompt：资深旅行规划师角色约束。（与 supabase/functions/ai-proxy/index.ts 原样同步） */
const ITINERARY_SYSTEM_PROMPT = [
  '你是一位资深旅行规划师，擅长制定兼顾体验与效率的旅行行程。请严格遵守：',
  '1) 优先安排用户心愿单中的景点；',
  '2) 每天安排不超过 4 个景点，保留机动时间；',
  '3) 给出每日预算分项说明；',
  '4) 必须只输出合法 JSON，禁止输出任何解释性文字或 Markdown 代码块。',
  'JSON 结构严格为：{ "days": [{ "day": 1, "title": "", "spots": [{ "name": "", "city": "", "level": "", "duration": 0, "tip": "" }], "budget": "", "tips": "" }], "summary": "" }',
  'day 从 1 开始递增；duration 单位为小时；所有字段不可省略。',
].join('\n')

/** 数据洞察 system prompt：数据分析师角色约束（数字必须来自输入）。（与 supabase/functions/ai-proxy/index.ts 原样同步） */
const INSIGHTS_SYSTEM_PROMPT = [
  '你是一位严谨的数据分析师，负责解读旅行足迹的年度统计数据。请严格遵守：',
  '1) 基于给定的数字生成 3-5 条洞察；',
  '2) 严禁编造数字，所有数字必须来自输入数据；',
  '3) 每条洞察应引用具体数字并给出有价值的解读；',
  '4) 必须只输出合法 JSON，结构严格为：{ "insights": ["...", "..."] }，禁止输出其他内容。',
].join('\n')

/** 自动标签 system prompt：旅行内容标签专家角色约束。（与 supabase/functions/ai-proxy/index.ts 原样同步） */
const AUTO_TAG_SYSTEM_PROMPT = [
  '你是一位旅行内容标签专家。请根据回忆的标题、正文内容和涉及城市生成标签。请严格遵守：',
  '1) 生成 3-5 个中文短标签，每个 2-6 字；',
  '2) 标签应精准概括内容主题、风格或地点特色；',
  '3) 必须只输出合法 JSON，结构严格为：{ "tags": ["...", "..."] }，禁止输出其他内容。',
].join('\n')

/**
 * 生成行程规划：真实调用 DeepSeek，失败/超时/结构不符返回 null（调用方降级提示）。
 * 未配置（cfg 为 null）直接返回 null，不发起任何网络请求。
 */
export async function generateItinerary(input: ItineraryRequest, cfg: AiConfig | null = getAiConfig()): Promise<DayPlan[] | null> {
  if (!cfg) return null
  const result = await callDeepSeek<{ days?: unknown }>(cfg, 'itinerary', ITINERARY_SYSTEM_PROMPT, serializeItineraryRequest(input))
  if (!result || !isDayPlanArray(result.days)) return null
  return result.days
}

/**
 * 生成年度数据洞察（3-5 条文本）：真实调用 DeepSeek，失败/超时/结构不符返回 null。
 * 未配置（cfg 为 null）直接返回 null，不发起任何网络请求。
 */
export async function generateInsights(input: InsightsRequest, cfg: AiConfig | null = getAiConfig()): Promise<string[] | null> {
  if (!cfg) return null
  const result = await callDeepSeek<{ insights?: unknown }>(cfg, 'insights', INSIGHTS_SYSTEM_PROMPT, serializeInsightsRequest(input))
  if (!result || !isStringArray(result.insights)) return null
  return result.insights
}

/**
 * 对回忆内容批量打标签：真实调用 DeepSeek，失败/超时/结构不符返回 null。
 * 未配置（cfg 为 null）直接返回 null，不发起任何网络请求。
 */
export async function autoTag(input: AutoTagRequest, cfg: AiConfig | null = getAiConfig()): Promise<string[] | null> {
  if (!cfg) return null
  const result = await callDeepSeek<{ tags?: unknown }>(cfg, 'tags', AUTO_TAG_SYSTEM_PROMPT, serializeAutoTagRequest(input))
  if (!result || !isStringArray(result.tags)) return null
  return result.tags
}
