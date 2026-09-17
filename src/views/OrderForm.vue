<script setup lang="ts">
import { ref, onMounted } from 'vue'
import liff from '@line/liff'
import { LIFF_ID } from '../lineConfig'

interface Profile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

const isLoggedIn = ref<boolean>(false)
const profile = ref<Profile | null>(null)
const errorMsg = ref<string>('')
const isLoading = ref<boolean>(false) // 防止重複點擊的狀態

// 表單的響應式變數
const gasWeight = ref<string>('20') // 預設 20 公斤
const quantity = ref<number>(1)     // 預設 1 桶
const address = ref<string>('')     // 送貨地址

onMounted(async () => {
  try {
    await liff.init({ liffId: LIFF_ID })

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

  // 表單驗證：檢查有沒有填寫地址
  if (!address.value.trim()) {
    alert('老闆，請記得填寫送貨地址喔！')
    return;
  }

  isLoading.value = true

  try {
    // 後端網址來自 .env.development / .env.production 的 VITE_API_BASE_URL
    const backendUrl = `${import.meta.env.VITE_API_BASE_URL}/api/order`;

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
  <div class="page">
    <div v-if="errorMsg" class="state-card state-error" role="alert">
      <p class="state-icon" aria-hidden="true">⚠️</p>
      <p class="state-title">{{ errorMsg }}</p>
    </div>

    <div v-else-if="!isLoggedIn" class="state-card">
      <div class="spinner" aria-hidden="true"></div>
      <p class="state-title">系統連線中…</p>
      <p class="state-hint">正在確認您的 LINE 帳號</p>
    </div>

    <form v-else class="order-card" @submit.prevent="handleOrder">
      <header class="user-info">
        <img
          v-if="profile?.pictureUrl"
          :src="profile.pictureUrl"
          alt=""
          class="avatar"
        />
        <div>
          <p class="greeting">您好，</p>
          <p class="user-name">{{ profile?.displayName }}</p>
        </div>
      </header>

      <fieldset class="form-group">
        <legend class="field-label">瓦斯規格</legend>
        <div class="segmented">
          <label class="segment" :class="{ 'is-active': gasWeight === '16' }">
            <input type="radio" value="16" v-model="gasWeight" name="gasWeight" />
            <span class="segment-value">16</span>
            <span class="segment-unit">公斤</span>
          </label>
          <label class="segment" :class="{ 'is-active': gasWeight === '20' }">
            <input type="radio" value="20" v-model="gasWeight" name="gasWeight" />
            <span class="segment-value">20</span>
            <span class="segment-unit">公斤</span>
          </label>
        </div>
      </fieldset>

      <div class="form-group">
        <span class="field-label">叫貨數量</span>
        <div class="stepper">
          <button
            type="button"
            class="stepper-btn"
            aria-label="減少數量"
            :disabled="quantity <= 1"
            @click="quantity = Math.max(1, quantity - 1)"
          >−</button>
          <span class="stepper-value" aria-live="polite">{{ quantity }} 桶</span>
          <button
            type="button"
            class="stepper-btn"
            aria-label="增加數量"
            :disabled="quantity >= 10"
            @click="quantity = Math.min(10, quantity + 1)"
          >+</button>
        </div>
      </div>

      <div class="form-group">
        <label class="field-label" for="address">送貨地址</label>
        <input
          id="address"
          type="text"
          v-model="address"
          placeholder="例：台北市中山區民生東路一段 1 號"
          class="input-field"
          autocomplete="street-address"
        />
      </div>

      <button class="order-btn" type="submit" :disabled="isLoading">
        {{ isLoading ? '發送中…' : '確認送出訂單' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.page {
  --surface: #ffffff;
  --border: #e3e6ea;
  --text-primary: #1f2937;   /* 14.7:1 on white */
  --text-secondary: #6b7280; /*  4.8:1 on white */

  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px 16px;
  color: var(--text-primary);
}

/* ---------- 載入中 / 錯誤 ---------- */
.state-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 40px 28px;
  width: 100%;
  max-width: 420px;
  text-align: center;
}

.state-icon {
  margin: 0 0 8px;
  font-size: 34px;
}

.state-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.state-hint {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.state-error .state-title {
  color: #b42318;
}

.spinner {
  width: 32px;
  height: 32px;
  margin: 0 auto 16px;
  border: 3px solid #e5e7eb;
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .spinner { animation-duration: 3s; }
}

/* ---------- 訂購卡片 ---------- */
.order-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 24px;
  width: 100%;
  max-width: 420px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 20px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
}

.avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.greeting {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.user-name {
  margin: 2px 0 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
  word-break: break-word;
}

/* ---------- 表單區塊 ---------- */
.form-group {
  margin: 0;
  padding: 20px 0 0;
  border: none;
}

.field-label {
  display: block;
  padding: 0;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ---------- 規格：分段選擇器 ---------- */
.segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.segment {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 14px 8px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

/* 真的 radio 還在，只是視覺上藏起來，鍵盤與輔助技術照常運作 */
.segment input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.segment-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
}

.segment-unit {
  font-size: 12px;
  color: var(--text-secondary);
}

.segment.is-active {
  border-color: var(--brand);
  background-color: rgba(6, 199, 85, 0.08);
}

.segment.is-active .segment-unit {
  color: var(--brand-strong);
}

.segment:has(input:focus-visible) {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}

/* ---------- 數量：加減控制 ---------- */
.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 6px;
}

.stepper-btn {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-sm);
  background-color: #f3f4f6;
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 600;
  line-height: 1;
  transition: background-color 0.15s;
}

.stepper-btn:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.stepper-btn:disabled {
  opacity: 0.4;
}

.stepper-value {
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* ---------- 地址 ---------- */
.input-field {
  width: 100%;
  padding: 13px 14px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: 16px; /* 16px 以下 iOS Safari 會自動放大畫面 */
  color: var(--text-primary);
  background-color: var(--surface);
  transition: border-color 0.15s;
}

.input-field::placeholder {
  color: #9ca3af;
}

.input-field:focus {
  border-color: var(--brand);
  outline: none;
  box-shadow: 0 0 0 3px rgba(6, 199, 85, 0.15);
}

/* ---------- 送出 ---------- */
.order-btn {
  width: 100%;
  margin-top: 24px;
  padding: 15px;
  border: none;
  border-radius: var(--radius-md);
  background-color: var(--brand-strong);
  color: #ffffff;
  font-size: 17px;
  font-weight: 700;
  transition: background-color 0.2s;
}

.order-btn:hover:not(:disabled) {
  background-color: var(--brand-strong-hover);
}

.order-btn:disabled {
  background-color: #9cc4ab;
}
</style>
