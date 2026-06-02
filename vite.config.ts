import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // 允許 localtunnel 的網址連線
    // (設定為 true 代表允許所有外部 host，這樣下次 localtunnel 換網址你就不會再被擋了)
    allowedHosts: true, 
  }
})
