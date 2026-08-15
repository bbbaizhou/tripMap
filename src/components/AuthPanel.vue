<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const formError = ref('')
const successMsg = ref('')
const busy = ref(false)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const isOpen = computed(() => auth.authPanelOpen)

const close = () => {
  auth.closeAuthPanel()
}

const switchMode = (next: 'login' | 'register') => {
  mode.value = next
  formError.value = ''
  successMsg.value = ''
}

/** 内联校验：非法邮箱 / 短密码在此拦截，不调 API。 */
const validate = (): string => {
  if (!EMAIL_RE.test(email.value.trim())) return '请输入有效的邮箱地址'
  if (password.value.length < 6) return '密码至少 6 位'
  return ''
}

const handleSubmit = async () => {
  if (busy.value) return
  const invalid = validate()
  if (invalid) {
    formError.value = invalid
    return
  }
  busy.value = true
  formError.value = ''
  successMsg.value = ''
  try {
    if (mode.value === 'login') {
      const res = await auth.signIn(email.value.trim(), password.value)
      if (!res.ok) {
        formError.value = res.message
      } else {
        close()
      }
    } else {
      const res = await auth.signUp(email.value.trim(), password.value)
      if (!res.ok) {
        formError.value = res.message
      } else if (!auth.isLoggedIn) {
        // 邮箱验证开启：注册成功但无 session → 提示并切到登录模式
        mode.value = 'login'
        formError.value = ''
        successMsg.value = '注册成功，请查收验证邮件后登录'
      } else {
        close()
      }
    }
  } finally {
    busy.value = false
  }
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isOpen.value) close()
}

// 每次打开时清掉上次的瞬时提示
watch(isOpen, (open) => {
  if (open) {
    formError.value = ''
    successMsg.value = ''
  }
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="isOpen" class="auth-overlay" @click.self="close">
    <div class="auth-card" role="dialog" aria-modal="true" aria-label="账号登录">
      <button class="auth-close" aria-label="关闭" @click="close">✕</button>
      <h3 class="auth-title">{{ mode === 'login' ? '登录' : '注册' }}</h3>
      <p class="auth-sub">云同步需要登录账号（邮箱 + 密码）</p>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <label class="auth-field">
          <span>邮箱</span>
          <input
            v-model.trim="email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            :disabled="busy"
          />
        </label>
        <label class="auth-field">
          <span>密码</span>
          <input
            v-model="password"
            type="password"
            placeholder="至少 6 位"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            :disabled="busy"
          />
        </label>

        <div v-if="formError" class="auth-error">{{ formError }}</div>
        <div v-if="successMsg" class="auth-success">{{ successMsg }}</div>

        <button class="auth-submit" type="submit" :disabled="busy">
          {{ busy ? '处理中…' : mode === 'login' ? '登录' : '注册' }}
        </button>
      </form>

      <div class="auth-switch">
        <template v-if="mode === 'login'">
          还没有账号？<a href="#" @click.prevent="switchMode('register')">注册新账号</a>
        </template>
        <template v-else>
          已有账号？<a href="#" @click.prevent="switchMode('login')">去登录</a>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 16px;
}
.auth-card {
  position: relative;
  width: 100%;
  max-width: 380px;
  padding: 28px 24px 24px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
}
.auth-close {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 30px;
  height: 30px;
  border: none;
  background: none;
  font-size: 15px;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}
.auth-close:hover { background: var(--color-primary-lighter); color: var(--color-text-primary); }
.auth-title { margin: 0 0 4px; font-size: 18px; color: var(--color-text-primary); }
.auth-sub { margin: 0 0 18px; font-size: 13px; color: var(--color-text-secondary); }

.auth-form { display: flex; flex-direction: column; gap: 14px; }
.auth-field { display: flex; flex-direction: column; gap: 6px; }
.auth-field span { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.auth-field input {
  padding: 9px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  width: 100%;
}
.auth-field input:focus { border-color: var(--color-primary-light); }
.auth-field input:disabled { opacity: 0.6; }

.auth-error {
  padding: 8px 12px;
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
  color: var(--color-accent);
  border-radius: var(--radius-md);
  font-size: 13px;
}
.auth-success {
  padding: 8px 12px;
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  border-radius: var(--radius-md);
  font-size: 13px;
}

.auth-submit {
  margin-top: 4px;
  padding: 10px 0;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-primary-light);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.auth-submit:hover:not(:disabled) { background: var(--color-primary); }
.auth-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.auth-switch {
  margin-top: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.auth-switch a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 600;
}
.auth-switch a:hover { text-decoration: underline; }
</style>
