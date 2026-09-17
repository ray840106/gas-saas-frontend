import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import Dashboard from './components/Dashboard.vue'

// 專案還沒有引進 vue-router，先用網址參數決定掛哪一頁：
//   ?view=dashboard → 後台儀表板（純瀏覽器開，不會初始化 LIFF）
//   其他            → LIFF 點餐頁
const isDashboard = new URLSearchParams(location.search).get('view') === 'dashboard'

// 兩頁底色不同，標在 body 上才能蓋滿整個視窗（含手機的回彈捲動區域）
document.body.classList.add(isDashboard ? 'theme-dashboard' : 'theme-liff')

createApp(isDashboard ? Dashboard : App).mount('#app')
