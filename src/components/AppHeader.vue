<script setup lang="ts">
import { useAuthStore } from '../stores/authStore'
import { isSupabaseConfigured } from '../utils/supabase'

const auth = useAuthStore()

const handleSignOut = async () => {
  await auth.signOut()
}
</script>

<template>
  <header class="app-header">
    <div class="brand"><span class="brand-icon">🌏</span>个人旅行足迹</div>
    <nav class="nav-links">
      <RouterLink to="/">首页</RouterLink>
      <RouterLink to="/map">地图</RouterLink>
      <RouterLink to="/scenic">景点</RouterLink>
      <RouterLink to="/memories">回忆</RouterLink>
      <RouterLink to="/ai">AI 助手</RouterLink>
      <RouterLink to="/manage">管理</RouterLink>
    </nav>
    <div v-if="isSupabaseConfigured()" class="auth-area">
      <span v-if="auth.isLoggedIn" class="user-email" :title="auth.user?.email">
        {{ auth.user?.email }}
      </span>
      <button
        v-if="auth.isLoggedIn"
        class="auth-btn"
        :disabled="auth.loading"
        @click="handleSignOut"
      >
        {{ auth.loading ? '退出中…' : '退出' }}
      </button>
      <button v-else class="auth-btn" @click="auth.openAuthPanel()">登录</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #ffffff;
  border-bottom: 1px solid #e4e7ed;
}

.brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.brand-icon {
  font-size: 20px;
  line-height: 1;
}

.nav-links {
  display: flex;
  gap: 8px;
}

.nav-links a {
  text-decoration: none;
  color: #6b7280;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 14px;
  transition: all 200ms ease;
}

.nav-links a:hover {
  background: var(--color-primary-lighter);
  color: var(--color-primary);
}

.nav-links a.router-link-active,
.nav-links a.router-link-exact-active {
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  font-weight: 600;
}

.auth-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-email {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.auth-btn {
  padding: 7px 16px;
  border: 1px solid var(--color-primary-light);
  border-radius: 999px;
  background: var(--color-primary-light);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 200ms ease;
}

.auth-btn:hover:not(:disabled) {
  background: var(--color-primary);
}

.auth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .nav-links {
    display: none;
  }
}
</style>
