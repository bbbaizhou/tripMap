# PHASE 5 任务规格：AI Key 安全升级 + 自动云同步

> 适用范围：tripMap（Vue 3.4 + TS + Pinia + Vite 5）。本文件只输出规格，不修改任何代码。
> 全局约束（strict）：不引 Element Plus、不新增前端依赖（Edge Function 可用 Deno fetch + npm:@supabase/supabase-js@2，supabase-js 已在依赖）；无 .env / 未登录 / 未部署 Edge Function 时现有功能零影响；`syncService.ts` 不得 import authStore（登录态一律 `getSupabase()?.auth.getSession()` 判断）；新逻辑只放 `src/utils/`、`src/stores/`。

## 任务 1：AI Key 安全升级（Supabase Edge Function 代理）

### 1.1 目标
DeepSeek Key 从前端 bundle 移出：Key 存 Supabase Edge Function Secrets；前端改调 Edge Function（携带用户 JWT 鉴权）；默认部署路径下 bundle 零 Key。

### 1.2 文件清单
- 新建 `supabase/functions/ai-proxy/index.ts`（Deno 运行时，Edge Function）
- 修改 `src/utils/aiClient.ts`（代理模式 + 直连降级兼容）
- 修改 `.env.example`（更新 VITE_AI_ENDPOINT 语义注释）
- 新建 `docs/edge_function_deploy.md`（部署 + 验证指引）
- AI 三视图零改动（仅依赖 `isAiConfigured` 与三生成函数，签名不变）

### 1.3 Edge Function 契约（supabase/functions/ai-proxy/index.ts）
```
POST https://<ref>.supabase.co/functions/v1/ai-proxy
Authorization: Bearer <user JWT>            # 必填；缺失/无效 → 401
Content-Type: application/json
Body: { "action": "itinerary"|"insights"|"tags",
        "payload": "<前端 serialize* 产出的中文文本>" }   # payload 为字符串
```
- 三个 systemPrompt 从 `src/utils/aiClient.ts` L189-214 原样复制（ITINERARY / INSIGHTS / AUTO_TAG），两文件头注释互指同步——唯一不同步点，需人工保持一致。
- 转发 DeepSeek：`fetch('https://api.deepseek.com/chat/completions')`，body 与前端直连完全一致（model `deepseek-chat`、messages `[system, user(payload)]`、`response_format:{type:'json_object'}`、temperature 0.7）；`Authorization: Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`——Key 只从环境变量读，绝不写死。
- 响应：DeepSeek `choices[0].message.content` → `JSON.parse` → 原样作为响应 JSON（结构 `{days}`/`{insights}`/`{tags}`，与前端期望一致）。
- 错误：无/坏 JWT → 401；action 非法 → 400；DeepSeek 非 2xx → 502（带上游 status 简述）；JSON 解析失败 → 502。任何错误不向客户端泄漏 DEEPSEEK_API_KEY。
- 鉴权（函数内自校验，不依赖网关 verify-jwt）：
  ```ts
  import { createClient } from 'npm:@supabase/supabase-js@2'
  // SUPABASE_URL / SUPABASE_ANON_KEY 由 Edge Runtime 自动注入
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const token = auth 头 Bearer 部分（缺失 → 401）
  const { data, error } = await sb.auth.getUser(token)   // error 或 !data.user → 401
  ```
- CORS：OPTIONS 预检 → 204 + `Access-Control-Allow-Origin: <ALLOWED_ORIGIN 或 *>`、`Access-Control-Allow-Headers: authorization, content-type`、`Access-Control-Allow-Methods: POST, OPTIONS`；正式响应同样带 allow-origin 头。

### 1.4 前端改造（src/utils/aiClient.ts）
- `AiConfig` 增可选字段 `mode: 'proxy' | 'direct'`（导出类型与三生成函数签名不变）。
- `getAiConfig()`（L76）：`endpoint = VITE_AI_ENDPOINT?.trim()`、`apiKey = VITE_AI_API_KEY?.trim()`；两者皆空 → null；否则 `{ apiKey, endpoint: endpoint || DEFAULT_ENDPOINT, mode: endpoint ? 'proxy' : 'direct' }`。
- `isAiConfigured()`（L68）：`Boolean(endpoint || apiKey)`——endpoint 或 apiKey 任一配置即算已配置。
- `callDeepSeek<T>(cfg, action, systemPrompt, userContent)`（私有，增 action 形参）：
  - `direct`：逻辑与现状完全一致（Bearer apiKey → DEFAULT_ENDPOINT）。
  - `proxy`：`getSupabase()` 为 null 或 `auth.getSession()` 无 session → `console.warn('[aiClient] 代理模式需要登录')` + 返回 null（零网络请求）；否则 POST `cfg.endpoint`，body 改为 `{ action, payload: userContent }`，header `Authorization: Bearer <access_token>`（取 `data.session.access_token`）。响应解析、30s 超时 AbortController、形状校验、失败返 null 语义全部不变。
- 三导出函数仅把自身 action 传入（'itinerary'/'insights'/'tags'），其余不变。

### 1.5 验收清单
- `npm run build` 后 dist 与源码 grep 不到真实 Key（`grep -r "sk-" dist/` 为空；直连模式仅作开发降级路径）。
- 未登录 curl（无 token）→ 401；登录后 AI 三功能 → 返回 `{days}`/`{insights}`/`{tags}`。
- `.env` 清空 `VITE_AI_API_KEY`，仅 `VITE_AI_ENDPOINT` + 已登录 → 三视图 AI 可用（Edge Function 已部署后）。
- 未部署/未配置/未登录：`isAiConfigured()` 正确短路，三视图显示引导占位、零请求（现有降级路径不变）。

### 1.6 部署指引（docs/edge_function_deploy.md 要点）
- CLI：`supabase functions deploy ai-proxy --project-ref njoujkyvafmocgpgbxau`；`supabase secrets set DEEPSEEK_API_KEY=sk-xxx --project-ref njoujkyvafmocgpgbxau`（可选 `ALLOWED_ORIGIN`）。
- 前端 `.env`：`VITE_AI_ENDPOINT=https://njoujkyvafmocgpgbxau.supabase.co/functions/v1/ai-proxy`，`VITE_AI_API_KEY` 可留空。
- 无 CLI 备选：Supabase Dashboard → Edge Functions → 新建 ai-proxy → 粘贴代码 → Secrets 填 `DEEPSEEK_API_KEY` → Deploy。
- 验证：curl 无 token → 401；带 JWT → 200 JSON；`grep -r "sk-" dist/` 为空。

## 任务 2：自动同步（变更自动推送 + 登录后拉取）

### 2.1 目标
手动同步升级为自动：数据变更防抖自动推送（2s）；登录成功/恢复 session 后自动拉取云端并合并到本地（多设备）；手动按钮保留。

### 2.2 文件清单
- 修改 `src/utils/syncService.ts`：+`scheduleAutoSync()`、+`cancelAutoSync()`、+`pullFromCloud()`、syncNow 单飞保护
- 修改 `src/utils/storage.ts`：+`withEnqueueSuppressed()` 抑制开关；`patchState` 尾部挂自动同步
- 新建 `src/utils/cloudPull.ts`：`pullCloudAndApply()`（拉取 + 写回 store 的编排，唯一触碰 store 的入口）
- 修改 `src/stores/authStore.ts`：登录成功/恢复 session → 触发拉取；退出 → `cancelAutoSync()`
- 修改 `src/stores/footprintStore.ts` / `scenicStore.ts` / `memoryStore.ts`：+`reloadFromStorage()`
- 修改 `src/components/CloudSyncPanel.vue`：登录卡 +「立即拉取」按钮

### 2.3 接口与数据结构
- `syncService.scheduleAutoSync(): void`：模块级防抖定时器（`AUTO_SYNC_DEBOUNCE_MS = 2000`）；到期后守卫（supabase 未配置 / 无 session / 离线 → 静默跳过，零请求），队列非空 → `void syncNow()`（fire-and-forget，syncNow 不 throw）。失败不阻塞：下次变更重新调度或手动重试。
- `syncService.cancelAutoSync(): void`：清定时器（退出登录调用）。
- syncNow 单飞：模块级 `inflight: Promise<boolean> | null`，并发调用复用同一 Promise——手动「立即同步」与自动定时器不会重叠推送，状态机（disabled/idle/offline/needsLogin/syncing/error）保持原语义。
- `syncService.pullFromCloud(): Promise<{ state: AppState; changed: boolean } | null>`（纯 utils，不 import store、不碰 patchState）：
  1. 守卫：`getSupabase()===null` / 离线 / `auth.getSession()` 无 session → 返回 null（零网络请求）。
  2. 三表 `select('id, payload, updated_at')`（RLS 自动按当前用户过滤）。
  3. 合并冲突（见 2.4），产出 nextState（仅替换三数组，保留 schemaVersion/version）。
  4. 有变化才 `saveState(nextState)`（直接写 localStorage，绝不走 patchState）→ 返回 `{ state, changed }`。
- `storage.withEnqueueSuppressed<T>(fn: () => T): T`：模块级 `suppressEnqueue` 置位执行 fn 后复位；`patchState` 在 `enqueueArrayDiff` 前检查，置位则跳过入队与自动同步（本地落盘不受影响）。
- `cloudPull.pullCloudAndApply(): Promise<{ changed: boolean } | null>`：调 `pullFromCloud()`；changed 时 `withEnqueueSuppressed(() => { 三 store.reloadFromStorage() })`。
- 三 store `reloadFromStorage()`：`const { state } = loadStateDetailed(); <arr>.value = state.<arr>`——内容相同的 diff 零入队；内容不同由抑制标志兜底，杜绝回推。
- `authStore` 联动：init() 恢复 session 成功或 onAuthStateChange 收到 SIGNED_IN（session 非空）→ `void pullCloudAndApply()`；去重：模块级记录上次触发用 access_token，相同 token 跳过（防 init+SIGNED_IN 双拉）；SIGNED_OUT → `cancelAutoSync()`。

### 2.4 实现要点
- 自动推送挂钩点：`storage.ts` `patchState`（L142-152）中 `enqueueArrayDiff`（L151）之后调 `scheduleAutoSync()`（storage 已 import syncService，无新依赖、无环）。
- 合并冲突规则（内容相等短路 + updated_at 后写优先）：
  - 本地无、云端有 → 添加（payload 即整条记录）。
  - 双方都有且 `JSON.stringify` 全等 → 跳过（不覆盖、不比较时间）。
  - 双方都有且内容不同 → 比较云端 `updated_at` 与本地写入时间，后者胜。本地写入时间来源：sync meta 扩展为 `{ lastSyncedAt, rowTimes: { [entity]: { [id]: iso } } }`，`enqueueChange`（L143）写入时同步记录 `rowTimes[entity][entityId] = 新 updatedAt`（即队列项时间戳，亦为推送的 updated_at）。云端新 → 覆盖本地；本地新 → 保留本地 + `enqueueChange upsert`（推上去）。
  - 本地有、云端无 → 保留本地 + `enqueueChange upsert`（spec：保留本地）。
- 入队隔离（防循环）：拉取写回只走 `saveState` + `reloadFromStorage()`，全程在 `withEnqueueSuppressed` 内 → 不触发 enqueueArrayDiff → 不触发自动同步 → 无循环；自动推送方向只读队列写云端，不写本地数据 → 单向无环。
- 拉取期间新变更不丢：合并是快照级，本地新记录按「内容不同 + rowTimes 较新」规则保留，不会被云端旧数据覆盖。
- 降级零影响：未配置/未登录/离线时 scheduleAutoSync 与 pullFromCloud 全静默零请求；`suppressEnqueue` 默认 false，patchState 原行为不变。
- UI：CloudSyncPanel 登录卡（L110-125）「立即同步」旁加「立即拉取」按钮（busy 共用、同 status 禁用），onClick → `pullCloudAndApply()` + `refresh()`。

### 2.5 验收清单
- 多设备：A 设备新增一条 → 约 2-3s 自动推送（队列清空、无需点按钮）→ B 设备登录（或刷新）后自动拉取，新数据出现。
- 数据变更（add/update/delete）后 2-3s 内自动推送，面板「待同步 0 条」。
- 拉取写回后观察 ≥1 分钟：无周期性网络调用、队列保持 0（无循环推送）。
- 未登录/未配置：变更数据后 10s 内 Network 面板零请求。
- 「立即同步」「立即拉取」按钮均可用，手动与自动互不冲突（单飞）。

## 实施顺序与衔接点
1. 顺序：任务 1 → 任务 2；两任务改动文件互不重叠（aiClient 与 sync/storage/authStore 分离），可并行开发、各自独立验收。
2. 衔接点：
   - aiClient.ts：三 systemPrompt（L189-214）复制进 Edge Function；`callDeepSeek`（L88）改 mode 分支；`getAiConfig`/`isAiConfigured`（L68/L76）改语义。
   - storage.ts：`patchState`（L142-152）在 `enqueueArrayDiff` 后挂 `scheduleAutoSync()`；`enqueueArrayDiff` 前加 `suppressEnqueue` 检查。
   - authStore.ts：`init()`（L63-70）getSession 恢复分支 + onAuthStateChange 回调（L68）加 `pullCloudAndApply()` 触发。
   - syncService.ts：`enqueueChange`（L143）补 rowTimes；`syncNow`（L172）加单飞。
   - CloudSyncPanel.vue：登录卡（L110-125）按钮区加「立即拉取」。
3. 交付顺序：Edge Function + 部署文档 → aiClient 改造 → syncService/storage/cloudPull → authStore 联动 → CloudSyncPanel → 按两任务验收清单逐条过。
