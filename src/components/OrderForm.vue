<script setup lang="ts">
import { ref, onMounted } from 'vue'
import liff from '@line/liff'

interface Profile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

const isLoggedIn = ref<boolean>(false)
const profile = ref<Profile | null>(null)
const errorMsg = ref<string>('')
const isLoading = ref<boolean>(false) // 防止重複點擊的狀態

// 🌟 新增：表單的響應式變數
const gasWeight = ref<string>('20') // 預設 20 公斤
const quantity = ref<number>(1)     // 預設 1 桶
const address = ref<string>('')     // 送貨地址

onMounted(async () => {
  try {
    // ⚠️ 記得換成你的 LIFF ID
    await liff.init({ liffId: '2010214891-TocDb9gS' })

    if (liff.isLoggedIn()) {
      isLoggedIn.value = true
      profile.value = await liff.getProfile() as Profile
    } else {
      liff.login()
    }
  } catch (err) {
    console.error('LIFF 初始化失敗', err)
    errorMsg.value = '系統載入失敗，請稍後再試。'
  }
})

const handleOrder = async (): Promise<void> => {
  if (!profile.value) return;
  
  // 🌟 表單驗證：檢查有沒有填寫地址
  if (!address.value.trim()) {
    alert('老闆，請記得填寫送貨地址喔！')
    return;
  }

  isLoading.value = true

  try {
    // ⚠️ 記得換成你 Port 3000 的 SSH 穿透網址
    const backendUrl = 'https://gas-saas-backend.onrender.com/api/order';
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.value.userId,
        displayName: profile.value.displayName,
        gasWeight: gasWeight.value, // 傳送瓦斯規格
        quantity: quantity.value,   // 傳送數量
        address: address.value      // 傳送地址
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('🎉 訂單已成功送達！我們會盡快為您派送！');
      // 訂單送出後，可選擇自動關閉 LIFF 視窗
      if (liff.isInClient()) {
        liff.closeWindow();
      }
    } else {
      alert(`⚠️ 伺服器回報失敗: ${result.message}`);
    }
  } catch (err) {
    console.error('發送訂單錯誤:', err);
    alert('💥 連線失敗，請稍後再試！');
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="app-container">
    <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
    
    <div v-else-if="!isLoggedIn" class="loading">
      <h2>🔄 系統連線中...</h2>
    </div>
    
    <div v-else class="order-card">
      <div class="user-info">
        <img v-if="profile?.pictureUrl" :src="profile.pictureUrl" alt="頭像" class="avatar" />
        <h3>{{ profile?.displayName }}，您好！</h3>
      </div>
      
      <hr class="divider" />

      <div class="form-group">
        <label>🔥 瓦斯規格</label>
        <div class="radio-group">
          <label><input type="radio" value="16" v-model="gasWeight" /> 16 公斤</label>
          <label><input type="radio" value="20" v-model="gasWeight" /> 20 公斤</label>
        </div>
      </div>

      <div class="form-group">
        <label>🔢 叫貨數量</label>
        <input type="number" v-model="quantity" min="1" max="10" class="input-field" />
      </div>

      <div class="form-group">
        <label>📍 送貨地址</label>
        <input type="text" v-model="address" placeholder="請輸入完整地址" class="input-field" />
      </div>
      
      <button class="order-btn" @click="handleOrder" :disabled="isLoading">
        {{ isLoading ? '發送中...' : '確認送出訂單' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  padding: 20px;
  font-family: 'PingFang TC', 'Microsoft JhengHei', sans-serif;
}
.order-card {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  width: 100%;
  max-width: 400px;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}
.avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
}
.divider {
  border: 0;
  height: 1px;
  background: #eee;
  margin: 20px 0;
}
.form-group {
  margin-bottom: 20px;
  text-align: left;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
}
.radio-group {
  display: flex;
  gap: 20px;
}
.input-field {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  box-sizing: border-box;
}
.input-field:focus {
  border-color: #06c755;
  outline: none;
}
.order-btn {
  background-color: #06c755;
  color: white;
  border: none;
  padding: 15px;
  font-size: 18px;
  border-radius: 8px;
  cursor: pointer;
  width: 100%;
  font-weight: bold;
  transition: 0.3s;
}
.order-btn:disabled {
  background-color: #a5d8b9;
  cursor: not-allowed;
}
</style>