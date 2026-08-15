<template>
  <header class="app-header">
    <div class="brand">个人旅行足迹</div>
    <nav class="nav-links">
      <RouterLink to="/">首页</RouterLink>
      <RouterLink to="/map">地图</RouterLink>
      <RouterLink to="/scenic">景点</RouterLink>
      <RouterLink to="/memories">回忆</RouterLink>
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
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.nav-links {
  display: flex;
  gap: 16px;
}

.nav-links a {
  text-decoration: none;
  color: #6b7280;
}

.nav-links a:hover {
  color: #2e7d32;
}

.nav-links a.router-link-active,
.nav-links a.router-link-exact-active {
  color: #2e7d32;
  font-weight: 600;
  border-bottom: 2px solid #2e7d32;
  padding-bottom: 2px;
}

@media (max-width: 768px) {
  .nav-links {
    display: none;
  }
}
</style>
