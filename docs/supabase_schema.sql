# Supabase 云同步建表 SQL

> 使用方式：登录 supabase.com → 打开你的项目 → **SQL Editor** → New query → 粘贴下方 SQL 全部执行。
> 说明：本 SQL 创建 `cities` / `spots` / `memories` 三张同步表 + RLS 安全策略，与前端 `syncService.ts` 的推送逻辑（upsert/delete、id=entityId、payload jsonb）完全对应。

## 一、建表（三张表结构一致）

```sql
-- ============ cities（城市足迹）============
create table if not exists public.cities (
  id         text primary key,              -- 对应前端 cityId
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,  -- 整条 FootprintCity 记录
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists cities_user_idx on public.cities (user_id, updated_at desc);

-- ============ spots（景点打卡）============
create table if not exists public.spots (
  id         text primary key,              -- 对应前端 spotId
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,  -- 整条 ScenicSpot 记录
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists spots_user_idx on public.spots (user_id, updated_at desc);

-- ============ memories（旅行回忆）============
create table if not exists public.memories (
  id         text primary key,              -- 对应前端 memoryId
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,  -- 整条 TravelMemory 记录
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists memories_user_idx on public.memories (user_id, updated_at desc);
```

## 二、RLS 安全策略（行级安全：每个用户只能读写自己的数据）

> 需先启用 RLS，再逐表建策略。下面三块分别对应三张表，内容相同。

```sql
-- ============ cities RLS ============
alter table public.cities enable row level security;

create policy "cities_select_own" on public.cities
  for select using (auth.uid() = user_id);
create policy "cities_insert_own" on public.cities
  for insert with check (auth.uid() = user_id);
create policy "cities_update_own" on public.cities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cities_delete_own" on public.cities
  for delete using (auth.uid() = user_id);

-- ============ spots RLS ============
alter table public.spots enable row level security;

create policy "spots_select_own" on public.spots
  for select using (auth.uid() = user_id);
create policy "spots_insert_own" on public.spots
  for insert with check (auth.uid() = user_id);
create policy "spots_update_own" on public.spots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "spots_delete_own" on public.spots
  for delete using (auth.uid() = user_id);

-- ============ memories RLS ============
alter table public.memories enable row level security;

create policy "memories_select_own" on public.memories
  for select using (auth.uid() = user_id);
create policy "memories_insert_own" on public.memories
  for insert with check (auth.uid() = user_id);
create policy "memories_update_own" on public.memories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "memories_delete_own" on public.memories
  for delete using (auth.uid() = user_id);
```

## 三、验证

执行完后，在 SQL Editor 运行以下查询确认三张表存在：

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('cities','spots','memories')
order by table_name;
-- 期望返回 3 行：cities / memories / spots
```

## ⚠️ 重要说明（读我）

1. **RLS 依赖登录用户**：以上策略要求请求带有效用户 JWT（`auth.uid()` 非空）。当前前端**尚未接入登录流程**（Phase 4.1 的 Supabase Auth 待做），因此**未登录状态下 anon key 直连会被 RLS 拒绝**。
2. **两个可执行路径**：
   - **路径 A（推荐，安全）**：先按上面 SQL 建表 → 我随后实现前端登录（邮箱 + 密码注册/登录）→ 登录后云同步全通。
   - **路径 B（快速验证，不安全）**：暂时把 RLS 策略改为允许 anon 读写（见下方「临时放行」SQL）→ 立即可同步，但任何拿到你 anon key 的人都能读写你的数据（个人项目可接受，上线前必须改回）。
3. **临时放行 SQL（仅路径 B 用，慎用）**：
   ```sql
   drop policy if exists "cities_select_own" on public.cities; -- 同理三表各四个策略全部 drop
   -- 然后为三表各加：
   -- create policy "cities_anon_all" on public.cities for all using (true) with check (true);
   ```
