// ai-proxy Edge Function：DeepSeek Key 安全代理。
// 前端（src/utils/aiClient.ts，代理模式）携带用户 JWT 调本函数，本函数用服务端 Secrets 中的
// DEEPSEEK_API_KEY 转发 DeepSeek，保证 bundle 零 Key、且不向客户端泄漏任何上游凭据。
//
// 契约（见 docs/edge_function_deploy.md）：
//   POST https://<ref>.supabase.co/functions/v1/ai-proxy
//   Authorization: Bearer <user JWT>          # 必填；缺失/无效 → 401
//   Body: { "action": "itinerary"|"insights"|"tags"|"spotInfo", "payload": "<前端序列化出的中文文本>" }
//   成功 → 200，响应为 DeepSeek 解析后的 JSON（{days}/{insights}/{tags}，与前端期望一致）。
//
// 注意：下方四个 systemPrompt（ITINERARY / INSIGHTS / AUTO_TAG / SPOT_INFO）与
// src/utils/aiClient.ts 中的同名常量【原样一致，需人工保持同步】——两文件互指注释，
// 唯一不同步点，改动任何一侧必须同步另一侧。
//
// 运行环境：Supabase Edge Runtime（Deno）。依赖仅用 npm:@supabase/supabase-js@2（Deno 风格导入，
// 不用相对导入）；SUPABASE_URL / SUPABASE_ANON_KEY 由 Edge Runtime 自动注入，无需手动配置。

import { createClient } from 'npm:@supabase/supabase-js@2'

/** CORS 允许来源：可选 ALLOWED_ORIGIN env（单来源），缺省 *。 */
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

/** 行程规划 system prompt：资深旅行规划师角色约束。（与 aiClient.ts 原样同步） */
const ITINERARY_SYSTEM_PROMPT = [
  '你是一位资深旅行规划师，擅长制定兼顾体验与效率的旅行行程。请严格遵守：',
  '1) 优先安排用户心愿单中的景点；',
  '2) 每天安排不超过 4 个景点，保留机动时间；',
  '3) 给出每日预算分项说明；',
  '4) 必须只输出合法 JSON，禁止输出任何解释性文字或 Markdown 代码块。',
  'JSON 结构严格为：{ "days": [{ "day": 1, "title": "", "spots": [{ "name": "", "city": "", "level": "", "duration": 0, "tip": "" }], "budget": "", "tips": "" }], "summary": "" }',
  'day 从 1 开始递增；duration 单位为小时；所有字段不可省略。',
].join('\n')

/** 数据洞察 system prompt：数据分析师角色约束（数字必须来自输入）。（与 aiClient.ts 原样同步） */
const INSIGHTS_SYSTEM_PROMPT = [
  '你是一位严谨的数据分析师，负责解读旅行足迹的年度统计数据。请严格遵守：',
  '1) 基于给定的数字生成 3-5 条洞察；',
  '2) 严禁编造数字，所有数字必须来自输入数据；',
  '3) 每条洞察应引用具体数字并给出有价值的解读；',
  '4) 必须只输出合法 JSON，结构严格为：{ "insights": ["...", "..."] }，禁止输出其他内容。',
].join('\n')

/** 自动标签 system prompt：旅行内容标签专家角色约束。（与 aiClient.ts 原样同步） */
const AUTO_TAG_SYSTEM_PROMPT = [
  '你是一位旅行内容标签专家。请根据回忆的标题、正文内容和涉及城市生成标签。请严格遵守：',
  '1) 生成 3-5 个中文短标签，每个 2-6 字；',
  '2) 标签应精准概括内容主题、风格或地点特色；',
  '3) 必须只输出合法 JSON，结构严格为：{ "tags": ["...", "..."] }，禁止输出其他内容。',
].join('\n')

/** 景点信息补全 system prompt：旅行景点资料编辑角色约束。（与 aiClient.ts 原样同步） */
const SPOT_INFO_SYSTEM_PROMPT = [
  '你是一位旅行景点资料编辑。请根据景点名称、所在城市和省份生成资料。请严格遵守：',
  '1) 生成 1-3 句话的景点简介（description），概括其特色、看点与游览价值；',
  '2) 可选给出最佳游玩季节（bestSeason），如「春秋两季」；',
  '3) 简介中不得编造具体门票价格、开放时间等易变信息；',
  '4) 必须只输出合法 JSON，结构严格为：{ "description": "...", "bestSeason": "..." }，禁止输出其他内容。',
].join('\n')

/** action → systemPrompt 分发表。action 非法 → 400。 */
const SYSTEM_PROMPTS: Record<string, string> = {
  itinerary: ITINERARY_SYSTEM_PROMPT,
  insights: INSIGHTS_SYSTEM_PROMPT,
  tags: AUTO_TAG_SYSTEM_PROMPT,
  spotInfo: SPOT_INFO_SYSTEM_PROMPT,
}

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS 预检：204，不带 body。
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'method not allowed' })
  }

  // 鉴权（函数内自校验，不依赖网关 verify-jwt）：Bearer JWT 缺失/无效 → 401。
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
  if (!token) {
    return jsonResponse(401, { error: 'missing bearer token' })
  }
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) {
    return jsonResponse(401, { error: 'unauthorized' })
  }

  // 解析请求体：{ action, payload }。
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { error: 'invalid json body' })
  }
  const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const action = typeof record.action === 'string' ? record.action : ''
  const payload = typeof record.payload === 'string' ? record.payload : ''
  const systemPrompt = SYSTEM_PROMPTS[action]
  if (!systemPrompt) {
    return jsonResponse(400, { error: `invalid action: ${action || '(missing)'}` })
  }
  if (!payload.trim()) {
    return jsonResponse(400, { error: 'payload must be a non-empty string' })
  }

  // 转发 DeepSeek：Key 只从环境变量读取，绝不写死。
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) {
    return jsonResponse(502, { error: 'upstream key not configured' })
  }

  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: payload },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    })

    if (!upstream.ok) {
      // 错误只带上游状态简述，绝不向客户端泄漏 DEEPSEEK_API_KEY。
      return jsonResponse(502, { error: `upstream error: ${upstream.status}` })
    }

    const upstreamData = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = upstreamData.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      return jsonResponse(502, { error: 'upstream empty response' })
    }

    try {
      // DeepSeek content 即目标 JSON（{days}/{insights}/{tags}），原样透传给前端。
      const parsed: unknown = JSON.parse(content)
      return jsonResponse(200, parsed)
    } catch {
      return jsonResponse(502, { error: 'upstream json parse failed' })
    }
  } catch (err) {
    console.error('[ai-proxy] upstream fetch failed', err)
    return jsonResponse(502, { error: 'upstream unavailable' })
  }
})
