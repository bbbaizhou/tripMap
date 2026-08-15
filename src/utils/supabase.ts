import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type { SupabaseClient }

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
