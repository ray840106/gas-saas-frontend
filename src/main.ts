import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')

import axios from 'axios';

const request = axios.create({
  // 動態讀取 Vite 的環境變數
  baseURL: import.meta.env.VITE_API_BASE_URL, 
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default request;