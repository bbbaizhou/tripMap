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

@media (max-width: 768px) {
  .nav-links {
    display: none;
  }
}
</style>
