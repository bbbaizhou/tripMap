/**
 * 内容安全过滤（任务 5.7）
 *
 * 【重要】本词库为基础本地库：零依赖、零 Key、零网络请求，仅覆盖公开常识层面的
 * 不当言论 / 暴力 / 色情基础词，覆盖率有限，【不可替代合规审核】。
 * 公开分享（Phase 6）上线前必须接入远程审核 API（阿里云/腾讯等），见 PHASE6 6.5；
 * 本文件预留 remoteAuditor 扩展点（P2 接入，当前恒 null，本地兜底保留）。
 *
 * 匹配策略：纯子串 includes（统一转小写后匹配，防大小写绕过）；不做正则、不做分词，
 * 避免误杀与性能问题。输入容错：null / undefined / 空串 → { safe: true, hits: [] }。
 *
 * Phase 6 预留：分享导出前强制 checkContent（本任务只留调用点注释/函数，不实现分享）。
 */

/** 内容检查结果：hits 去重、保序。 */
export interface ContentCheckResult {
  safe: boolean
  hits: string[]
}

/** 命中敏感内容时的统一展示占位（safe=false 时不展示原文）。 */
export const UNSAFE_HIDDEN_TEXT = '内容未通过安全校验，已隐藏'

/**
 * 基础敏感词库：不当言论 / 暴力 / 色情三大类各 12 词。
 * 仅覆盖公开常识基础词，不可替代合规审核（见文件头说明）。
 */
export const SENSITIVE_WORDS: string[] = [
  // ── 不当言论（辱骂 / 人身攻击）──
  '傻逼', // 不当言论：常见辱骂粗口
  '妈的', // 不当言论：粗口
  '王八蛋', // 不当言论：辱骂
  '混蛋', // 不当言论：辱骂
  '贱人', // 不当言论：人身攻击
  '白痴', // 不当言论：人身攻击
  '蠢货', // 不当言论：辱骂
  '智障', // 不当言论：侮辱性贬损
  '弱智', // 不当言论：侮辱性贬损
  '去死', // 不当言论：攻击性诅咒
  '找死', // 不当言论：攻击性挑衅
  '草泥马', // 不当言论：谐音粗口

  // ── 暴力（伤害 / 血腥 / 恐怖）──
  '杀人', // 暴力：暴力行为
  '屠杀', // 暴力：大规模暴力
  '砍死', // 暴力：暴力伤害
  '打死', // 暴力：暴力伤害
  '炸死', // 暴力：暴力伤害
  '枪杀', // 暴力：暴力伤害
  '碎尸', // 暴力：血腥内容
  '分尸', // 暴力：血腥内容
  '灭门', // 暴力：极端暴力
  '恐怖袭击', // 暴力：恐怖主义
  '暴动', // 暴力：群体暴力
  '血腥', // 暴力：血腥内容

  // ── 色情（性相关低俗内容）──
  '色情', // 色情：低俗内容
  '裸体', // 色情：裸露内容
  '裸照', // 色情：裸露影像
  '淫乱', // 色情：低俗行为
  '性交', // 色情：露骨性行为
  '做爱', // 色情：露骨性行为
  '自慰', // 色情：露骨性行为
  '嫖娼', // 色情：违法性行为
  '卖淫', // 色情：违法性行为
  '强奸', // 色情：违法性行为
  '群交', // 色情：露骨性行为
  '约炮', // 色情：低俗约见
]

/**
 * 单段内容检查：子串匹配（转小写防大小写绕过），hits 去重保序。
 * null / undefined / 空串 → safe（不抛错）。
 */
export function checkContent(text: string | null | undefined): ContentCheckResult {
  if (!text) return { safe: true, hits: [] }
  const lower = text.toLowerCase()
  const hits: string[] = []
  for (const word of SENSITIVE_WORDS) {
    if (lower.includes(word) && !hits.includes(word)) hits.push(word)
  }
  return { safe: hits.length === 0, hits }
}

/**
 * 多段合并检查（如行程 days 逐段文本）：任一命中 → safe=false。
 * texts 非数组/含 null 均容错，不抛错。
 */
export function checkTexts(texts: string[] | null | undefined): ContentCheckResult {
  const merged = (texts ?? [])
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .join('\n')
  return checkContent(merged)
}

/** 命中词替换为等长 *（供展示降级，保留文本长度便于排版对齐）。 */
export function maskContent(text: string | null | undefined, hits: string[]): string {
  if (!text) return ''
  let masked = text
  for (const hit of hits) {
    if (!hit) continue
    masked = masked.split(hit).join('*'.repeat(hit.length))
  }
  return masked
}

/** P2 扩展点：远程审核 API（阿里云/腾讯）接入后替换为真实实现，并保留本地兜底。本任务恒 null、不发请求。 */
export interface RemoteAuditor {
  audit(text: string): Promise<ContentCheckResult | null>
}

export const remoteAuditor: RemoteAuditor | null = null
