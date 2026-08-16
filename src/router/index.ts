import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: '首页 - 旅行足迹' }
  },
  {
    path: '/map',
    name: 'Map',
    component: () => import('../views/MapView.vue'),
    meta: { title: '足迹地图 - 旅行足迹' }
  },
  {
    path: '/scenic',
    name: 'Scenic',
    component: () => import('../views/ScenicView.vue'),
    meta: { title: '景点打卡 - 旅行足迹' }
  },
  {
    path: '/memories',
    name: 'MemoryList',
    component: () => import('../views/MemoryListView.vue'),
    meta: { title: '旅行回忆 - 旅行足迹' }
  },
  {
    path: '/memory/new',
    name: 'MemoryNew',
    component: () => import('../views/MemoryFormView.vue'),
    meta: { title: '新增回忆 - 旅行足迹' }
  },
  {
    path: '/memory/:memoryId',
    name: 'MemoryDetail',
    component: () => import('../views/MemoryDetailView.vue'),
    props: true,
    meta: { title: '回忆详情 - 旅行足迹' }
  },
  {
    path: '/memory/:memoryId/edit',
    name: 'MemoryEdit',
    component: () => import('../views/MemoryFormView.vue'),
    props: true,
    meta: { title: '编辑回忆 - 旅行足迹' }
  },
  {
    path: '/ai',
    name: 'AiHome',
    component: () => import('../views/AiHomeView.vue'),
    meta: { title: 'AI 旅行助手 - 旅行足迹' }
  },
  {
    path: '/ai/plan',
    name: 'AiPlan',
    component: () => import('../views/AiPlanView.vue'),
    meta: { title: 'AI 行程规划 - 旅行足迹' }
  },
  {
    path: '/ai/insights',
    name: 'AiInsights',
    component: () => import('../views/AiInsightsView.vue'),
    meta: { title: '足迹数据洞察 - 旅行足迹' }
  },
  {
    path: '/ai/organize',
    name: 'AiOrganize',
    component: () => import('../views/AiOrganizeView.vue'),
    meta: { title: 'AI 智能整理 - 旅行足迹' }
  },
  {
    path: '/manage',
    name: 'DataManage',
    component: () => import('../views/DataManageView.vue'),
    meta: { title: '数据管理 - 旅行足迹' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  // BASE_URL 来自 vite base（/tripMap/），保证 history 路由与 GitHub Pages 子路径一致，
  // 否则默认 '/' 会把 /tripMap/ 导航规范化回根路径，破坏 manifest/PWA 安装
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0, behavior: 'smooth' }
  },
  routes,
})

router.beforeEach((to) => {
  if (to.meta?.title) {
    document.title = to.meta.title as string
  }
})
