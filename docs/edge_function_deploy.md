# Edge Function `ai-proxy` 部署指引（AI Key 安全升级）

> 目标：DeepSeek Key 从前端 bundle 移出，存 Supabase Edge Function Secrets；
> 前端（`src/utils/aiClient.ts` 代理模式）携带用户 JWT 调用本函数，由服务端转发 DeepSeek。

## 1. 函数契约（速览）

```
POST https://<ref>.supabase.co/functions/v1/ai-proxy
Authorization: Bearer <user JWT>      # 必填；缺失/无效 → 401
Content-Type: application/json
Body: { "action": "itinerary"|"insights"|"tags", "payload": "<中文文本>" }
```

- 成功 → `200`，响应为 DeepSeek 解析后的 JSON（`{days}` / `{insights}` / `{tags}`，与前端直连期望一致）。
- 错误映射：无/坏 JWT → 401；action 非法 / payload 非字符串 → 400；DeepSeek 非 2xx /
  JSON 解析失败 / 上游不可达 / 未配置 Key → 502（仅带状态简述，绝不泄漏 `DEEPSEEK_API_KEY`）。
- CORS：OPTIONS 预检 → 204；响应头 `Access-Control-Allow-Origin`（可用 `ALLOWED_ORIGIN` env 限制来源）。

## 2. CLI 部署（推荐）

前置：已安装 Supabase CLI 并登录（`supabase login`），项目 ref `njoujkyvafmocgpgbxau`。

```bash
# 1. 设置 Secrets（Key 只存服务端，绝不进前端 bundle）
supabase secrets set DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx --project-ref njoujkyvafmocgpgbxau

# 2. （可选）限制允许来源，如只允许本应用域名
supabase secrets set ALLOWED_ORIGIN=https://your-app.example.com --project-ref njoujkyvafmocgpgbxau

# 3. 部署函数
supabase functions deploy ai-proxy --project-ref njoujkyvafmocgpgbxau
```

- 函数代码位于 `supabase/functions/ai-proxy/index.ts`（Deno，`npm:@supabase/supabase-js@2` 风格导入）。
- 鉴权在函数内自校验（`createClient` + `auth.getUser(token)`），不依赖网关 verify-jwt。
- 三个 systemPrompt 与 `src/utils/aiClient.ts` 同名常量【原样同步，需人工保持一致】——两文件头注释互指。

## 3. 无 CLI 备选：Dashboard 部署

1. 登录 [supabase.com](https://supabase.com) → 打开项目（ref `njoujkyvafmocgpgbxau`）。
2. 左侧菜单 **Edge Functions → Create a new function**，名称填 `ai-proxy`。
3. 粘贴 `supabase/functions/ai-proxy/index.ts` 全部内容。
4. 左侧 **Edge Functions → Secrets**（或 Deploy 弹窗内）添加：
   - `DEEPSEEK_API_KEY` = 你的 DeepSeek Key
   - （可选）`ALLOWED_ORIGIN` = 允许的前端来源
5. 点击 **Deploy**。
   - `SUPABASE_URL` / `SUPABASE_ANON_KEY` 由 Edge Runtime 自动注入，无需手动配置。

## 4. 前端 `.env` 配置

```
VITE_SUPABASE_URL=https://njoujkyvafmocgpgbxau.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>     # 云同步/登录已配好则已有
VITE_AI_ENDPOINT=https://njoujkyvafmocgpgbxau.supabase.co/functions/v1/ai-proxy
VITE_AI_API_KEY=                      # 留空即可（代理模式下不再需要）
```

> 说明：仅当 `VITE_AI_ENDPOINT` 非空时前端走代理模式；`VITE_AI_API_KEY` 非空且 endpoint 为空时才走直连（开发降级）。

## 5. 验证步骤

```bash
# ① 无 token → 401（鉴权生效）
curl -i -X POST https://njoujkyvafmocgpgbxau.supabase.co/functions/v1/ai-proxy \
  -H 'Content-Type: application/json' \
  -d '{"action":"insights","payload":"test"}'
# 期望：HTTP/1.1 401

# ② 带用户 JWT → 200 JSON（token 从浏览器 localStorage 的 supabase 会话中复制 access_token）
curl -i -X POST https://njoujkyvafmocgpgbxau.supabase.co/functions/v1/ai-proxy \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <user JWT>' \
  -d '{"action":"insights","payload":"请基于以下数字生成洞察：2025 年访问城市数 3，打卡景点数 10，旅行总天数 15。"}'
# 期望：HTTP/1.1 200 + JSON body（{"insights":[...]}）

# ③ bundle 无 Key（默认部署路径下 dist 中 grep 不到真实 Key 特征）
grep -r "sk-" dist/
# 期望：无任何输出（直连模式仅作本地开发降级路径，不在部署环境使用）
```

前端验收（Edge Function 部署完成后）：`.env` 清空 `VITE_AI_API_KEY`、仅保留 `VITE_AI_ENDPOINT`；
登录后进入 AI 三视图（行程规划 / 年度洞察 / 自动标签）→ 正常返回 `{days}` / `{insights}` / `{tags}`。
未登录时调用 → 前端 `console.warn('[aiClient] 代理模式需要登录…')` 且零网络请求。
