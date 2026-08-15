<template>
  <div class="app-shell">
    <AppHeader />
    <main class="page-container">
      <RouterView />
    </main>
    <AppNav />
    <InstallPrompt />
    <AuthPanel />
  </div>
</template>

<script setup lang="ts">
import AppHeader from './components/AppHeader.vue'
import AppNav from './components/AppNav.vue'
import InstallPrompt from './components/InstallPrompt.vue'
import AuthPanel from './components/AuthPanel.vue'
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: #f5f7fa;
  color: #1f2937;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.page-container {
  padding: 16px;
}

/* 手机端为底部导航留出空间 */
@media (max-width: 768px) {
  .page-container {
    padding-bottom: 76px;
  }
}
</style>
