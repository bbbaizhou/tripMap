import {
  createClient,
  type AuthChangeEvent,
  type AuthError,
  type AuthResponse,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js'

export type { AuthChangeEvent, AuthError, AuthResponse, Session, SupabaseClient }

/**
 * 凭据注入：VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（见 .env.example）。
 * 任一项缺失或 trim 后为空 → 视为未配置，返回 null（不抛错、不发任何网络请求）。
 * URL 做轻校验：必须是可解析的 https 地址，否则同样按未配置处理。
 */
export function createSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
  } catch {
    return null
  }
  // createClient 本身惰性初始化，不发起网络请求；本轮不调用任何 auth/from 方法。
  return createClient(url, anonKey)
}

let client: SupabaseClient | null = null

/** 惰性单例：首次调用时创建并缓存；多次调用返回同一实例。 */
export function getSupabase(): SupabaseClient | null {
  if (client === null) {
    client = createSupabaseClient()
  }
  return client
}

/** 仅读环境变量判空（trim 后两项均非空），不触发客户端创建。 */
export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  return Boolean(url && anonKey)
}

// ---------------------------------------------------------------------------
// Auth 封装（Phase 4.1）：client 为 null（未配置 / 创建失败）时全部安全降级，
// 返回 null 且不发任何网络请求；内部异常一律吞掉返回 null，不 throw。
// ---------------------------------------------------------------------------

/** 邮箱 + 密码注册（内部 auth.signUp）。未配置 → null。 */
export async function signUp(email: string, password: string): Promise<AuthResponse | null> {
  const client = getSupabase()
  if (client === null) return null
  try {
    return await client.auth.signUp({ email, password })
  } catch (err) {
    console.warn('[auth] signUp 异常（已安全降级为 null）', err)
    return null
  }
}

/** 邮箱 + 密码登录（内部 auth.signInWithPassword）。未配置 → null。 */
export async function signIn(email: string, password: string): Promise<AuthResponse | null> {
  const client = getSupabase()
  if (client === null) return null
  try {
    return await client.auth.signInWithPassword({ email, password })
  } catch (err) {
    console.warn('[auth] signIn 异常（已安全降级为 null）', err)
    return null
  }
}

/** 退出登录（内部 auth.signOut）。未配置 → null。 */
export async function signOut(): Promise<{ error: AuthError | null } | null> {
  const client = getSupabase()
  if (client === null) return null
  try {
    return await client.auth.signOut()
  } catch (err) {
    console.warn('[auth] signOut 异常（已安全降级为 null）', err)
    return null
  }
}

/** 获取当前 session（内部 auth.getSession，从本地存储同步恢复）。未配置 → null。 */
export async function getSession(): Promise<{ data: { session: Session | null } } | null> {
  const client = getSupabase()
  if (client === null) return null
  try {
    return await client.auth.getSession()
  } catch (err) {
    console.warn('[auth] getSession 异常（已安全降级为 null）', err)
    return null
  }
}

/**
 * 订阅登录态变化（内部 auth.onAuthStateChange）。
 * 返回 v2 形态 { data: { subscription } }，解绑用 sub.data.subscription.unsubscribe()。
 * 未配置 → null。
 */
export function onAuthStateChange(
  cb: (event: AuthChangeEvent, session: Session | null) => void,
): { data: { subscription: { unsubscribe(): void } } } | null {
  const client = getSupabase()
  if (client === null) return null
  try {
    return client.auth.onAuthStateChange(cb)
  } catch (err) {
    console.warn('[auth] onAuthStateChange 异常（已安全降级为 null）', err)
    return null
  }
}
