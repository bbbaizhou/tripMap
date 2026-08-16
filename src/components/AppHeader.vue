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
    <div class="brand"><span class="brand-icon">🌏</span>旅行足迹</div>
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
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #1f2937;
  /* 编辑风杂志导航：右缘 2px 黄竖条 */
  border-right: 2px solid var(--color-natgeo);
  padding-right: 12px;
}

.brand-icon {
  font-size: 20px;
  line-height: 1;
}

.nav-links {
  display: flex;
  gap: 4px;
}

.nav-links a {
  text-decoration: none;
  color: var(--color-text-primary);
  padding: 8px 14px;
  border-radius: 0;
  font-size: 14px;
  transition: color 200ms ease, border-color 200ms ease;
}

.nav-links a:hover {
  background: transparent;
  color: var(--color-primary);
  border-bottom: 2px solid var(--color-natgeo-glow);
}

.nav-links a.router-link-active,
.nav-links a.router-link-exact-active {
  background: transparent;
  color: #1f2937;
  font-weight: 700;
  border-bottom: 2px solid var(--color-natgeo);
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
  .app-header { padding: 12px 16px; }
  .nav-links {
    display: none;
  }
}

@media (max-width: 480px) {
  .user-email { display: none; }
  .brand { font-size: 17px; }
}
</style>
