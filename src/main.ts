import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import Dashboard from './components/Dashboard.vue'

// 專案還沒有引進 vue-router，先用網址參數決定掛哪一頁：
//   ?view=dashboard → 後台儀表板（純瀏覽器開，不會初始化 LIFF）
//   其他            → LIFF 點餐頁
const isDashboard = new URLSearchParams(location.search).get('view') === 'dashboard'

createApp(isDashboard ? Dashboard : App).mount('#app')
