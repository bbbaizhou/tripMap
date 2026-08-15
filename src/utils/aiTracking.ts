/**
 * AI 使用埋点 + 反馈（任务 5.8）
 *
 * 全部读写包 try/catch：localStorage 满/禁用/脏数据时静默降级，绝不影响主流程；读失败视为空。
 * 存储 key 独立（travel_footprint_ai_*），与数据 key（travel_footprint_data）和
 * 同步队列 key（travel_footprint_sync_*）完全隔离：不经过 patchState/enqueueChange。
 */

/**
 * 埋点动作全集（任务 5.8 规格）：
 * 注意与 aiClient.AiAction（Edge Function 分发表，'tags' 等）不同——本类型是埋点语义，
 * 自动标签记 'autoTag'，坐标兜底记 'coords'，分享卡片记 'shareCard'。
 */
export type AiAction = 'itinerary' | 'insights' | 'autoTag' | 'spotInfo' | 'coords' | 'shareCard'

/** 独立 key：与数据/同步队列隔离（验收要求：AI 埋点 key 不出现在同步队列/导出数据中）。 */
export const AI_USAGE_KEY = 'travel_footprint_ai_usage'
export const AI_FEEDBACK_KEY = 'travel_footprint_ai_feedback'

export interface AiFeedbackRecord {
  action: AiAction
  rating: 'up' | 'down'
  summary?: string
  at: string
}

export interface AiUsageSummary {
  [action: string]: { success: number; fail: number }
}

/** 反馈列表容量上限：超出丢最旧。 */
const FEEDBACK_MAX = 100
/** 反馈摘要截断上限（字）。 */
const SUMMARY_MAX = 50

/** 读使用计数：坏数据视为空对象，不抛错。 */
function readUsage(): AiUsageSummary {
  try {
    const raw = localStorage.getItem(AI_USAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as AiUsageSummary
    }
    return {}
  } catch {
    return {}
  }
}

function writeUsage(summary: AiUsageSummary): void {
  try {
    localStorage.setItem(AI_USAGE_KEY, JSON.stringify(summary))
  } catch (err) {
    console.warn('[aiTracking] 埋点写入失败（localStorage 不可用），已静默降级', err)
  }
}

/** 反馈条目形状校验（面板读坏数据时不报错）。 */
function isValidFeedback(value: unknown): value is AiFeedbackRecord {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.action === 'string' &&
    (r.rating === 'up' || r.rating === 'down') &&
    typeof r.at === 'string'
  )
}

function readFeedback(): AiFeedbackRecord[] {
  try {
    const raw = localStorage.getItem(AI_FEEDBACK_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter(isValidFeedback)
    return []
  } catch {
    return []
  }
}

/** 摘要截断 ≤ 50 字（如「目的地：成都」）。 */
function truncateSummary(summary?: string): string | undefined {
  if (!summary) return undefined
  return summary.length > SUMMARY_MAX ? `${summary.slice(0, SUMMARY_MAX)}…` : summary
}

/** 使用计数：动作成功/失败各 +1（无该 action 记录时初始化 { success: 0, fail: 0 }）。 */
export function trackAiUse(action: AiAction, ok: boolean): void {
  try {
    const summary = readUsage()
    const record = summary[action] ?? { success: 0, fail: 0 }
    if (ok) record.success += 1
    else record.fail += 1
    summary[action] = record
    writeUsage(summary)
  } catch (err) {
    console.warn('[aiTracking] trackAiUse 异常，已静默降级', err)
  }
}

/** 反馈追加一条；容量超限丢最旧；summary 截断 ≤ 50 字。 */
export function trackAiFeedback(action: AiAction, rating: 'up' | 'down', summary?: string): void {
  try {
    const list = readFeedback()
    list.push({ action, rating, summary: truncateSummary(summary), at: new Date().toISOString() })
    const kept = list.slice(-FEEDBACK_MAX)
    localStorage.setItem(AI_FEEDBACK_KEY, JSON.stringify(kept))
  } catch (err) {
    console.warn('[aiTracking] trackAiFeedback 异常，已静默降级', err)
  }
}

export function getAiUsage(): AiUsageSummary {
  return readUsage()
}

export function getAiFeedback(): AiFeedbackRecord[] {
  return readFeedback()
}

export function clearAiUsage(): void {
  try {
    localStorage.removeItem(AI_USAGE_KEY)
  } catch (err) {
    console.warn('[aiTracking] 清空使用计数失败，已静默降级', err)
  }
}

/** 导出 JSON 字符串（下载文件用）：含使用计数 + 反馈 + 导出时间。 */
export function exportAiUsage(): string {
  try {
    return JSON.stringify(
      { usage: readUsage(), feedback: readFeedback(), exportedAt: new Date().toISOString() },
      null,
      2,
    )
  } catch (err) {
    console.warn('[aiTracking] 导出序列化失败', err)
    return '{}'
  }
}
