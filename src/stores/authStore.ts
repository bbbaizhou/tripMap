import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import {
  getSession,
  getSupabase,
  onAuthStateChange,
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
} from '../utils/supabase'
import { pullCloudAndApply } from '../utils/cloudPull'
import { cancelAutoSync } from '../utils/syncService'

type AuthResult = { ok: true } | { ok: false; message: string }

/**
 * 登录态 Pinia store（Phase 4.1；Phase 5：登录/恢复 session → 自动拉取合并，退出 → 取消自动推送）。
 * - session 由 supabase-js 自动持久化到 localStorage，刷新由 init() 的 getSession() 恢复。
 * - onAuthStateChange 订阅常驻（SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED 等全部同步）。
 * - 登录成功 / 恢复 session → void pullCloudAndApply()（多设备自动拉取合并）；
 *   去重：模块级记录上次触发用 access_token，相同 token 跳过（防 init getSession + SIGNED_IN 双拉）。
 * - SIGNED_OUT → cancelAutoSync()（取消 2s 防抖自动推送定时器）。
 * - authPanelOpen 为登录面板开关 UI 态（跨组件共享入口，避免 props 钻透）。
 * - 未配置（getSupabase() === null）时全部空转：isLoggedIn 恒 false、无订阅、零网络请求。
 */

/** 上次触发自动拉取使用的 access_token（模块级去重，相同 token 不重复拉取）。 */
let lastPullAccessToken: string | null = null

function triggerPullIfNeeded(accessToken: string): void {
  if (lastPullAccessToken === accessToken) return
  lastPullAccessToken = accessToken
  void pullCloudAndApply() // fire-and-forget：内部守卫（未配置/离线/无 session/表缺失）全静默降级
}

/** 错误文案映射（仅此一处写文案）。 */
function mapAuthError(
  action: 'signIn' | 'signUp',
  error: { message?: string; status?: number; code?: string } | null,
): string {
  if (error === null) {
    return action === 'signIn' ? '登录失败，请稍后重试' : '注册失败，请稍后重试'
  }
  const message = error.message ?? ''
  if (action === 'signIn') {
    if (error.status === 400 && message.includes('invalid login credentials')) return '邮箱或密码错误'
    if (message.includes('not confirmed')) return '请先到邮箱完成验证'
    return '登录失败，请稍后重试'
  }
  if (
    message.includes('already registered') ||
    message.includes('already exists') ||
    error.code === 'user_already_exists'
  ) {
    return '该邮箱已注册'
  }
  return '注册失败，请稍后重试'
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const loading = ref(false)
  const authPanelOpen = ref(false)

  const isLoggedIn = computed(() => session.value !== null)

  let unsubscribe: (() => void) | null = null

  const syncFromSession = (next: Session | null) => {
    session.value = next
    user.value = next?.user ?? null
  }

  /** 初始化：未配置直接返回；否则 getSession() 回填 + 订阅 onAuthStateChange（仅一次）。 */
  const init = async (): Promise<void> => {
    if (unsubscribe !== null) return // 已订阅，幂等
    if (getSupabase() === null) return // 未配置：空转，isLoggedIn 恒 false
    const res = await getSession()
    if (res?.data.session) {
      syncFromSession(res.data.session)
      triggerPullIfNeeded(res.data.session.access_token) // 恢复 session → 自动拉取合并（多设备）
    }
    const sub = onAuthStateChange((event, next) => {
      syncFromSession(next)
      if (event === 'SIGNED_IN' && next) {
        triggerPullIfNeeded(next.access_token) // 登录成功 → 自动拉取合并
      } else if (event === 'SIGNED_OUT') {
        cancelAutoSync() // 退出登录 → 取消未到期的自动推送定时器
      }
    })
    unsubscribe = sub?.data.subscription.unsubscribe ?? null
  }

  const signUp = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const res = await apiSignUp(email, password)
      if (res === null) return { ok: false, message: mapAuthError('signUp', null) }
      if (res.error) return { ok: false, message: mapAuthError('signUp', res.error) }
      if (res.data.session) {
        syncFromSession(res.data.session)
        triggerPullIfNeeded(res.data.session.access_token) // 注册成功即登录 → 自动拉取（token 去重防双拉）
      }
      return { ok: true }
    } catch (err) {
      console.warn('[auth] signUp 处理异常（已安全降级）', err)
      return { ok: false, message: mapAuthError('signUp', null) }
    }
  }

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const res = await apiSignIn(email, password)
      if (res === null) return { ok: false, message: mapAuthError('signIn', null) }
      if (res.error) return { ok: false, message: mapAuthError('signIn', res.error) }
      if (res.data.session) {
        syncFromSession(res.data.session)
        triggerPullIfNeeded(res.data.session.access_token) // 登录成功 → 自动拉取（token 去重防双拉）
      }
      return { ok: true }
    } catch (err) {
      console.warn('[auth] signIn 处理异常（已安全降级）', err)
      return { ok: false, message: mapAuthError('signIn', null) }
    }
  }

  const signOut = async (): Promise<void> => {
    loading.value = true
    try {
      await apiSignOut()
    } catch (err) {
      console.warn('[auth] signOut 处理异常（已安全降级）', err)
    } finally {
      // 本地 session 立即清空（无论服务端是否成功，退出是本地用户意图；onAuthStateChange 亦会同步）
      syncFromSession(null)
      loading.value = false
    }
  }

  const openAuthPanel = (): void => {
    authPanelOpen.value = true
  }
  const closeAuthPanel = (): void => {
    authPanelOpen.value = false
  }

  return {
    user,
    session,
    loading,
    authPanelOpen,
    isLoggedIn,
    init,
    signUp,
    signIn,
    signOut,
    openAuthPanel,
    closeAuthPanel,
  }
})
