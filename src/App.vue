<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
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

// 表單的響應式變數
const gasWeight = ref<string>('20') // 預設 20 公斤
const quantity = ref<number>(1)     // 預設 1 桶
const address = ref<string>('')     // 送貨地址

// 畫面提示訊息（取代跳出視窗，直接顯示在畫面上比較好懂）
const addressError = ref<string>('')
const submitError = ref<string>('')
const isDone = ref<boolean>(false)

const gasOptions = [
  { value: '16', title: '16 公斤', desc: '小桶，一般家庭常用' },
  { value: '20', title: '20 公斤', desc: '大桶，用量較多或營業用' }
]

const selectedGas = computed(
  () => gasOptions.find((item) => item.value === gasWeight.value) ?? gasOptions[1]
)

const MAX_QUANTITY = 10

const changeQuantity = (step: number): void => {
  const next = quantity.value + step
  if (next < 1 || next > MAX_QUANTITY) return
  quantity.value = next
}

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

  submitError.value = ''

  // 表單驗證：檢查有沒有填寫地址
  if (!address.value.trim()) {
    addressError.value = '請填寫送貨地址，我們才能把瓦斯送到府上。'
    return;
  }
  addressError.value = ''

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
      isDone.value = true
    } else {
      submitError.value = `訂單沒有送出：${result.message || '請稍後再試一次'}`
    }
  } catch (err) {
    console.error('發送訂單錯誤:', err);
    submitError.value = '連線失敗，請確認網路後再送一次。'
  } finally {
    isLoading.value = false
  }
}

// 送出成功後，由使用者自己按「關閉」，避免畫面一閃就不見
const closeWindow = (): void => {
  if (liff.isInClient()) {
    liff.closeWindow()
  } else {
    isDone.value = false
  }
}

const orderAgain = (): void => {
  isDone.value = false
  quantity.value = 1
}
</script>

<template>
  <div class="app-container">
    <!-- 系統錯誤 -->
    <div v-if="errorMsg" class="card state-card">
      <div class="state-icon">⚠️</div>
      <h2 class="state-title">系統載入失敗</h2>
      <p class="state-text">{{ errorMsg }}</p>
    </div>

    <!-- 連線中 -->
    <div v-else-if="!isLoggedIn" class="card state-card">
      <div class="spinner" aria-hidden="true"></div>
      <h2 class="state-title">系統連線中</h2>
      <p class="state-text">請稍候幾秒鐘…</p>
    </div>

    <!-- 送出成功 -->
    <div v-else-if="isDone" class="card state-card">
      <div class="state-icon success">✓</div>
      <h2 class="state-title">訂單已送出</h2>
      <p class="state-text">
        {{ selectedGas.title }}，共 {{ quantity }} 桶<br />
        我們會盡快為您派送！
      </p>
      <button class="big-btn" @click="closeWindow">關閉</button>
      <button class="text-btn" @click="orderAgain">再叫一次</button>
    </div>

    <!-- 叫貨表單 -->
    <div v-else class="order-card card">
      <header class="user-info">
        <img
          v-if="profile?.pictureUrl"
          :src="profile.pictureUrl"
          alt="您的 LINE 頭像"
          class="avatar"
        />
        <div>
          <p class="greeting">{{ profile?.displayName }}，您好！</p>
          <p class="greeting-sub">請選擇要叫的瓦斯</p>
        </div>
      </header>

      <p v-if="submitError" class="alert" role="alert">{{ submitError }}</p>

      <section class="form-group">
        <h2 class="field-label"><span class="step">1</span>瓦斯規格</h2>
        <div class="option-list">
          <label
            v-for="option in gasOptions"
            :key="option.value"
            class="option"
            :class="{ selected: gasWeight === option.value }"
          >
            <input
              type="radio"
              name="gasWeight"
              :value="option.value"
              v-model="gasWeight"
              class="option-input"
            />
            <span class="option-text">
              <span class="option-title">{{ option.title }}</span>
              <span class="option-desc">{{ option.desc }}</span>
            </span>
            <span class="option-check" aria-hidden="true">✓</span>
          </label>
        </div>
      </section>

      <section class="form-group">
        <h2 class="field-label"><span class="step">2</span>叫貨數量</h2>
        <div class="stepper">
          <button
            type="button"
            class="step-btn"
            aria-label="減少一桶"
            :disabled="quantity <= 1"
            @click="changeQuantity(-1)"
          >
            −
          </button>
          <span class="step-value">{{ quantity }} <small>桶</small></span>
          <button
            type="button"
            class="step-btn"
            aria-label="增加一桶"
            :disabled="quantity >= MAX_QUANTITY"
            @click="changeQuantity(1)"
          >
            ＋
          </button>
        </div>
      </section>

      <section class="form-group">
        <h2 class="field-label"><span class="step">3</span>送貨地址</h2>
        <input
          type="text"
          v-model="address"
          placeholder="例如：台中市西區民生路 100 號"
          class="input-field"
          :class="{ 'has-error': addressError }"
          @input="addressError = ''"
        />
        <p v-if="addressError" class="field-error" role="alert">{{ addressError }}</p>
      </section>

      <footer class="submit-area">
        <p class="summary">
          您要叫：<strong>{{ selectedGas.title }}，共 {{ quantity }} 桶</strong>
        </p>
        <button class="big-btn" @click="handleOrder" :disabled="isLoading">
          {{ isLoading ? '發送中…' : '確認送出訂單' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  justify-content: center;
  min-height: 100vh;
  padding: 20px 16px 32px;
}

.card {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  width: 100%;
  max-width: 440px;
}

.order-card {
  padding: 20px;
}

/* 使用者資訊 */
.user-info {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}
.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid var(--brand-soft);
  object-fit: cover;
}
.greeting {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.greeting-sub {
  margin: 2px 0 0;
  font-size: 15px;
  color: var(--ink-2);
}

/* 錯誤提示 */
.alert {
  margin: 16px 0 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--danger-soft);
  color: var(--danger);
  font-weight: 600;
}

/* 每一個步驟 */
.form-group {
  margin-top: 22px;
}
.field-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 700;
}
.step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--brand);
  color: #fff;
  font-size: 15px;
}

/* 瓦斯規格：整塊都可以按，不用點小圓點 */
.option-list {
  display: grid;
  gap: 12px;
}
.option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  min-height: 72px;
  border: 2px solid var(--line);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}
.option.selected {
  border-color: var(--brand);
  background: var(--brand-soft);
}
.option-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.option-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.option-title {
  font-size: 20px;
  font-weight: 700;
}
.option-desc {
  font-size: 15px;
  color: var(--ink-2);
}
.option-check {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid var(--line);
  color: transparent;
  font-size: 17px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.option.selected .option-check {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}
.option-input:focus-visible + .option-text {
  outline: 3px solid var(--brand-dark);
  outline-offset: 4px;
  border-radius: 6px;
}

/* 數量：大顆的加減按鈕，不用打字 */
.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px;
  border: 2px solid var(--line);
  border-radius: 14px;
}
.step-btn {
  width: 60px;
  height: 60px;
  border: none;
  border-radius: 12px;
  background: var(--brand-soft);
  color: var(--brand-dark);
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
}
.step-btn:disabled {
  background: #f1f3f5;
  color: #b8bfc7;
  cursor: not-allowed;
}
.step-value {
  font-size: 26px;
  font-weight: 700;
}
.step-value small {
  font-size: 16px;
  color: var(--ink-2);
}

/* 地址 */
.input-field {
  width: 100%;
  padding: 16px;
  border: 2px solid var(--line);
  border-radius: 14px;
  font-size: 18px;
  background: #fff;
}
.input-field::placeholder {
  color: #a5adb8;
}
.input-field:focus {
  border-color: var(--brand);
  outline: none;
}
.input-field.has-error {
  border-color: var(--danger);
}
.field-error {
  margin: 8px 0 0;
  color: var(--danger);
  font-size: 15px;
  font-weight: 600;
}

/* 送出 */
.submit-area {
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}
.summary {
  margin: 0 0 12px;
  text-align: center;
  font-size: 17px;
  color: var(--ink-2);
}
.summary strong {
  color: var(--ink);
  font-size: 19px;
}
.big-btn {
  width: 100%;
  min-height: 60px;
  border: none;
  border-radius: 14px;
  background: var(--brand);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  transition: background-color 0.15s;
}
.big-btn:hover:not(:disabled) {
  background: var(--brand-dark);
}
.big-btn:disabled {
  background: #a9dcbd;
  cursor: not-allowed;
}
.text-btn {
  width: 100%;
  margin-top: 10px;
  padding: 12px;
  border: none;
  background: none;
  color: var(--ink-2);
  font-size: 17px;
  font-weight: 600;
  text-decoration: underline;
}

/* 載入中 / 成功 / 失敗 的整頁狀態 */
.state-card {
  align-self: center;
  margin-top: 12vh;
  padding: 36px 24px;
  text-align: center;
}
.state-icon {
  font-size: 44px;
  line-height: 1;
}
.state-icon.success {
  width: 76px;
  height: 76px;
  margin: 0 auto;
  border-radius: 50%;
  background: var(--brand);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.state-title {
  margin: 16px 0 8px;
  font-size: 22px;
}
.state-text {
  margin: 0 0 22px;
  color: var(--ink-2);
  font-size: 17px;
}
.spinner {
  width: 48px;
  height: 48px;
  margin: 0 auto;
  border: 5px solid var(--brand-soft);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 3s;
  }
}
</style>
