import axios from 'axios'

// 後端網址由 .env.development / .env.production 裡的 VITE_API_BASE_URL 決定
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export default api
