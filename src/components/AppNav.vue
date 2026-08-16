<script setup lang="ts">
</script>

<template>
  <nav class="app-nav" aria-label="底部导航">
    <RouterLink to="/" class="nav-item" exact-active-class="active">
      <span class="nav-icon">🏠</span>
      <span class="nav-label">首页</span>
    </RouterLink>
    <RouterLink to="/map" class="nav-item" active-class="active">
      <span class="nav-icon">🗺️</span>
      <span class="nav-label">地图</span>
    </RouterLink>
    <RouterLink to="/scenic" class="nav-item" active-class="active">
      <span class="nav-icon">🏔️</span>
      <span class="nav-label">景点</span>
    </RouterLink>
    <RouterLink to="/memories" class="nav-item" active-class="active">
      <span class="nav-icon">📖</span>
      <span class="nav-label">回忆</span>
    </RouterLink>
    <RouterLink to="/ai" class="nav-item" active-class="active">
      <span class="nav-icon">🤖</span>
      <span class="nav-label">AI</span>
    </RouterLink>
    <RouterLink to="/manage" class="nav-item" active-class="active">
      <span class="nav-icon">⚙️</span>
      <span class="nav-label">管理</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.app-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: #ffffff;
  border-top: 1px solid #e4e7ed;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.nav-item {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  text-decoration: none;
  color: #9ca3af;
  padding: 8px 0;
  transition: transform 200ms ease, color 200ms ease;
}
.nav-item.active {
  color: var(--color-primary);
  transform: translateY(-2px);
}
.nav-item.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-primary);
}
.nav-item.active .nav-label {
  font-weight: 700;
}
.nav-icon { font-size: 18px; line-height: 1; }
.nav-label { font-size: 10px; font-weight: 600; }

@media (max-width: 768px) {
  .app-nav { display: flex; }
}
</style>
