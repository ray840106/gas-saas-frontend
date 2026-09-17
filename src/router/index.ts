import { createRouter, createWebHistory } from 'vue-router'

// 三頁都用動態載入：點餐頁會帶進整包 LIFF SDK，
// 後台與師傅頁不需要它，分開打包能讓那兩頁在外面用行動網路時輕很多。
const routes = [
  {
    path: '/',
    name: 'order',
    component: () => import('../views/OrderForm.vue'),
    meta: { theme: 'liff', title: '瓦斯叫貨' }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { theme: 'dashboard', title: '儀表板' }
  },
  {
    path: '/driver',
    name: 'driver',
    component: () => import('../views/DriverRoute.vue'),
    meta: { theme: 'driver', title: '配送清單' }
  },
  // 認不得的網址一律回點餐頁，避免 LIFF 把使用者丟到空白畫面
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 舊的 ?view=dashboard 連結（書籤、之前傳給別人的網址）還是能用
router.beforeEach((to) => {
  if (to.path === '/' && to.query.view === 'dashboard') {
    const { view, ...rest } = to.query
    return { path: '/dashboard', query: rest }
  }
  return true
})

// 每一頁底色不同，標在 body 上才能蓋滿視窗（含手機的回彈捲動區域）
router.afterEach((to) => {
  document.body.className = `theme-${(to.meta.theme as string) || 'liff'}`
  if (to.meta.title) {
    document.title = `${to.meta.title} · 瓦斯行`
  }
})

export default router
