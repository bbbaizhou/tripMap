# Phase 4 完整版云同步激活 — 技术规格

> 范围：前端登录（邮箱+密码）+ 安全 RLS 云同步全通。本文件只输出规格，不修改任何代码。
> 现状依据：`src/utils/supabase.ts`（惰性单例）、`src/utils/syncService.ts`（`SYNC_DRY_RUN=true` 骨架）、`src/components/CloudSyncPanel.vue`（两态面板）、`docs/supabase_schema.sql`（三表+RLS，已生成未执行）。

## 0. 前置条件（用户侧，必须先完成）
- [ ] 登录 supabase.com → 项目 → **SQL Editor** → 粘贴并执行 `docs/supabase_schema.sql`（建三表 + RLS 策略），用文末验证查询确认返回 3 行。
- [ ] 本地 `.env` 已含 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（不入库，已在 .gitignore）。
- 未执行建表 SQL 时：登录可成功，但同步会被 RLS 拒绝 → 面板 error 态提示「请确认已在 Supabase 执行 docs/supabase_schema.sql 建表」。

## 1. 全局约束（strict，三子任务共用）
- Vue 3.4 + `<script setup lang="ts">` + strict TS；新逻辑只放 `src/utils/` 或 `src/stores/`。
- 组件样式复用现有 CSS 变量（`var(--color-*)` / `--radius-*` / `--shadow-*`），不引 Element Plus。
- 不新增 npm 依赖（`@supabase/supabase-js` 已存在）。
- 不破坏现有降级路径：无 .env 时全链路返回 null/false/未配置态，纯本地功能零影响。
- 不改 `docs/supabase_schema.sql`；所有新代码全程 try/catch，不 throw。

---

## 2. 子任务 1：Supabase Auth 前端接入

### 2.1 目标
实现邮箱+密码注册/登录/退出；session 本地持久化 + 刷新恢复；未配置时安全降级；登录入口在 AppHeader 右侧 + CloudSyncPanel 内引导。

### 2.2 文件清单
- 改 `src/utils/supabase.ts`：新增 5 个 auth 封装（client 为 null 时全部安全降级）
- 新 `src/stores/authStore.ts`：登录态 Pinia store（含登录面板开关 UI 态）
- 新 `src/components/AuthPanel.vue`：登录/注册弹层（全局单实例）
- 改 `src/components/AppHeader.vue`：右侧登录入口 / 用户邮箱 + 退出
- 改 `src/App.vue`：根级挂载 `<AuthPanel />`
- 改 `src/main.ts`：与其它 store 一起调用 `authStore.init()`

### 2.3 接口签名
`src/utils/supabase.ts`（新增；`getSupabase()` 为 null → 全部返回 null，不发请求）：
- `signUp(email: string, password: string): Promise<AuthResponse | null>`（内部 `auth.signUp({ email, password })`）
- `signIn(email: string, password: string): Promise<AuthResponse | null>`（内部 `auth.signInWithPassword`）
- `signOut(): Promise<{ error: AuthError | null } | null>`（内部 `auth.signOut()`）
- `getSession(): Promise<{ data: { session: Session | null } } | null>`（内部 `auth.getSession()`）
- `onAuthStateChange(cb: (event: AuthChangeEvent, session: Session | null) => void): { data: { subscription: { unsubscribe(): void } } } | null`
- 类型自 `'@supabase/supabase-js'` 导入（`Session`/`User`/`AuthResponse`/`AuthError`/`AuthChangeEvent`，supabase-js re-export 自 gotrue；若个别类型不可导入，用 `Awaited<ReturnType<...>>` 推导）。

`src/stores/authStore.ts`（`defineStore('auth', setup 式)`）：
- state/派生：`user: Ref<User | null>`、`session: Ref<Session | null>`、`loading: Ref<boolean>`、`authPanelOpen: Ref<boolean>`、`isLoggedIn = computed(() => session.value !== null)`
- actions：
  - `init(): Promise<void>`：`getSupabase()` 为 null 直接返回；否则先 `getSession()` 回填 session/user，再 `onAuthStateChange` 订阅（SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED → 同步 session/user），保存 unsubscribe（app 生命周期常驻，仅调用一次）
  - `signUp(email, password): Promise<{ ok: true } | { ok: false; message: string }>`
  - `signIn(email, password): Promise<{ ok: true } | { ok: false; message: string }>`
  - `signOut(): Promise<void>`
  - `openAuthPanel(): void` / `closeAuthPanel(): void`
- 错误文案映射（内部 `mapAuthError`，仅此一处写文案）：
  - signIn：400 且含 `invalid login credentials` → 「邮箱或密码错误」；含 `not confirmed` → 「请先到邮箱完成验证」；其余 → 「登录失败，请稍后重试」
  - signUp：含 `already registered` / `already exists` 或 code `user_already_exists` → 「该邮箱已注册」；其余 → 「注册失败，请稍后重试」

### 2.4 实现要点与注意
- **session 恢复**：supabase-js 默认自动持久化到 localStorage（key 形如 `sb-<project-ref>-auth-token`），`init()` 的 `getSession()` 从本地同步恢复 → 刷新不掉登录，无需自写持久化（确认即可）。
- **面板开关**：`authPanelOpen` 放 authStore（跨组件共享入口，避免 props 钻透）；AppHeader 与 CloudSyncPanel 均调 `authStore.openAuthPanel()`，AuthPanel 仅由该值驱动显隐。
- **表单校验**：邮箱正则 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`；密码 ≥ 6 位；校验失败内联提示、不调 API；`busy` 时禁用提交防重复。
- **邮箱验证开启时**：signUp 成功但 session 为 null → 提示「注册成功，请查收验证邮件后登录」并切到登录模式。
- **AppHeader**：登录区仅在 `isSupabaseConfigured()` 为 true 时渲染；未登录显示「登录」按钮，已登录显示邮箱 + 「退出」。
- onAuthStateChange 返回 v2 形态 `{ data: { subscription } }`，解绑用 `sub.data.subscription.unsubscribe()`。

### 2.5 完成 = 以下验收可通过
- [ ] 无 .env 启动：无报错、无登录入口、CloudSyncPanel 仍为「未配置」卡（降级路径完好）。
- [ ] 有 .env：注册新邮箱成功（或收到验证邮件）；重复注册 → 「该邮箱已注册」。
- [ ] 错误密码登录 → 「邮箱或密码错误」；正确密码 → isLoggedIn=true、Header 显示邮箱。
- [ ] 刷新页面仍保持登录（session 本地恢复）。
- [ ] 退出后 Header 回到「登录」；非法邮箱 / 短密码被内联拦截且不调 API。

---

## 3. 子任务 2：同步服务激活真实推送

### 3.1 目标
`SYNC_DRY_RUN` 置 false，补全 `syncNow()` 真实 upsert/delete；未登录不推送（状态标注需登录）；部分失败保留队列不丢数据。

### 3.2 文件清单
- 改 `src/utils/syncService.ts`（状态机扩展 + 真实推送 + 登录前置检查 + 错误信息；CloudSyncPanel 配套改动归子任务 3）

### 3.3 接口签名（syncService.ts 内变更）
- `type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'offline' | 'error' | 'needsLogin'`（新增 `needsLogin`）
- `syncNow(): Promise<boolean>` 行为矩阵更新（见 3.4）
- 新增 `getLastSyncError(): string | null`（面板 error 态展示原因；内部 `lastError` 变量）
- `getLastSyncedAt()` 沿用现有 `readMeta()`，无需改动

### 3.4 实现要点与注意
`syncNow()` 检查顺序（保留现有前序，插入登录检查）：
1. `getSupabase() === null` → disabled，false
2. `navigator.onLine === false` → offline，false
3. 队列空 → idle，true（空队列无需登录，保持现有短路径）
4. `client.auth.getSession()` 无 session → **needsLogin，false**（不推送、队列原样、不发任何写请求）
5. syncing → 真实推送 → 全部成功：`clearSyncQueue()` + `writeMeta({ lastSyncedAt: new Date().toISOString() })` → idle，true
6. 任一实体失败（异常 / RLS 拒绝 / 断网）：**保留整队列**（不丢数据；upsert 幂等，重试可重放）→ error，false，`lastError` 记录原因（RLS 场景提示「请确认已在 Supabase 执行 docs/supabase_schema.sql 建表」）

真实推送实现（替换 TODO 注释块；`SYNC_DRY_RUN` 置 false）：
```ts
const client = getSupabase()!
for (const entity of ['cities', 'spots', 'memories'] as const) {
  const items = queue.filter((i) => i.entity === entity)
  if (items.length === 0) continue
  const upserts = items
    .filter((i) => i.action === 'upsert')
    .map((i) => ({ id: i.entityId, payload: i.payload ?? {}, updated_at: i.updatedAt }))
  if (upserts.length > 0) await client.from(entity).upsert(upserts)
  const deleteIds = items.filter((i) => i.action === 'delete').map((i) => i.entityId)
  if (deleteIds.length > 0) await client.from(entity).delete().in('id', deleteIds)
}
```
- **失败语义 = all-or-nothing**：全部成功才清队列；任何失败整队列保留（满足「部分失败保留队列」且实现最简、零丢失风险）。
- utils 层独立：登录检查直接用 `getSupabase()?.auth.getSession()`，**不 import authStore**（保持 utils 零耦合，避免循环依赖）。

### 3.5 完成 = 以下验收可通过
- [ ] `SYNC_DRY_RUN` 为 false，真实推送代码可达（不再走 logPendingQueue 分支）。
- [ ] 未登录 + 有队列 → syncNow 返回 false、状态 needsLogin、队列原样、无网络写请求。
- [ ] 登录后同步 → 队列清空、lastSyncedAt 更新；Supabase Table Editor 三表出现对应行（id=entityId、payload=整条记录、updated_at=ISO、user_id=当前用户）。
- [ ] 删除本地记录再同步 → 云端对应行被删除。
- [ ] 人为制造失败（如临时改表名）：状态 error、队列保留、lastSyncedAt 不变；恢复后再次同步成功（幂等重放）。

---

## 4. 子任务 3：CloudSyncPanel 三态与引导完善

### 4.1 目标
面板按登录态三态展示；登录入口跨组件可用；引导文案注明「需先登录 + 已在 Supabase 执行建表 SQL」。

### 4.2 文件清单
- 改 `src/components/CloudSyncPanel.vue`（三态 + needsLogin 展示 + 用户信息）
- 改 `src/views/DataManageView.vue`（可选：「备份与恢复」tab 顶部弱提示行）

### 4.3 实现要点与注意
- 引入 `useAuthStore()`，用响应式 `isLoggedIn` 驱动三态（`v-if` 分支）：
  1. `status === 'disabled'` → 现有「未配置」引导卡；步骤列表**追加**两条：「在 Supabase SQL Editor 执行 `docs/supabase_schema.sql` 建表」「首次同步前需先登录」；「数据仍安全保存在本机」提示保留
  2. `status !== 'disabled' && !isLoggedIn` → 「请先登录」卡：说明文案 + 「登录」按钮 → `authStore.openAuthPanel()`
  3. `status !== 'disabled' && isLoggedIn` → 现有同步 UI + 用户邮箱展示（`authStore.user?.email`）
- `STATUS_LABELS: Record<SyncStatus, string>` 增加 `needsLogin: '请先登录'`；`.status-badge` 增加 `.needsLogin` 样式（复用 offline 灰阶）。
- **粘滞修复**：已登录分支把残留 `needsLogin` 显示为 idle（登录前曾触发同步留下的状态），逻辑仿照现有 offline→idle 映射。
- **联动核心**：登录/退出由 `onAuthStateChange` 自动写 store → 面板无需手动刷新即三态切换。
- handleSync 前 `!isLoggedIn` 兜底调 `openAuthPanel()`（未登录态按钮已隐藏，此为防御）。
- DataManageView「备份与恢复」tab 顶部加一行弱提示：「云同步需先登录，且需已在 Supabase 执行 docs/supabase_schema.sql 建表」。

### 4.4 完成 = 以下验收可通过
- [ ] 三态切换正确：未配置引导卡 → 已配置未登录「请先登录」卡 → 已配置已登录同步 UI + 邮箱。
- [ ] 未登录点「登录」→ AuthPanel 打开；登录成功 → 面板自动切到同步 UI（无刷新）。
- [ ] 退出 → 面板自动回到「请先登录」。
- [ ] error 态显示 `getLastSyncError()` 友好文案（如建表未执行提示）。
- [ ] 未配置时全部新 UI 不出现，现有本地功能与文案不变。

---

## 5. 实施顺序与依赖
**1 → 2 → 3**，每步可独立提交、独立验收：
- 步骤 1 完成即可注册/登录验证（此时同步仍 dry-run，队列只打印不推送）。
- 步骤 2 完成后需在 Supabase Table Editor 真实验证云端数据（见 3.5）。
- 步骤 3 收尾三态 UI；若 1、2 先行而 3 未做，面板在 needsLogin 分支暂时显示为 error 态属预期中间态，不影响验收。

## 6. 登录态与同步状态联动设计（汇总）

| 触发 | authStore | syncService | 面板展示 |
|---|---|---|---|
| 未配置（无 .env） | isLoggedIn=false（init 空转） | disabled | 未配置引导卡 |
| 已配置、未登录 | isLoggedIn=false | 手动 sync → needsLogin | 请先登录卡 |
| 登录成功（onAuthStateChange） | session/user 写入 | 队列保留 | 自动切同步 UI |
| 刷新页面 | getSession 本地恢复 | — | 保持已登录同步 UI |
| 退出（onAuthStateChange） | session=null | 下次 sync → needsLogin | 自动回请先登录 |
| 推送失败（RLS/断网） | 不变 | error + lastError | 同步异常 + 原因 |
| 推送成功 | 不变 | idle + lastSyncedAt | 已就绪 + 上次同步时间 |

- 数据流单向：AuthPanel / AppHeader → authStore →（只读）CloudSyncPanel；syncService 独立用 `auth.getSession()` 判登录，不依赖 store，utils 层零耦合。

## 7. 风险与回滚
- RLS 拒绝（建表未执行）：推送 error、队列保留、面板提示 → 用户执行 SQL 后重试即可，无数据丢失。
- 邮箱验证开启：注册后需先验证邮件才能登录，面板文案已覆盖。
- 回滚：git revert 各步骤提交；`SYNC_DRY_RUN` 改回 true 即回到 dry-run 安全态。
