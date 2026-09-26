<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import liff from '@line/liff'
import { API_BASE } from '../api/base'
import {
  deleteAddress,
  fetchAddresses,
  verifyAddress,
  type AddressVerifyResult,
  type SavedAddress
} from '../api/customer'

interface Profile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

const isLoggedIn = ref<boolean>(false)
const profile = ref<Profile | null>(null)
const errorMsg = ref<string>('')
const isLoading = ref<boolean>(false) // 防止重複點擊的狀態

// 🌟 表單的響應式變數
const gasWeight = ref<string>('20') // 預設 20 公斤
const quantity = ref<number>(1)     // 預設 1 桶

// 🌟 地址簿：常用地址用下拉選單選，不必每次重打
const savedAddresses = ref<SavedAddress[]>([])
const selectedAddressKey = ref<string>('')   // 下拉選單目前選到的地址
const isAddingNewAddress = ref<boolean>(false)
const newAddress = ref<string>('')           // 只有在「輸入新地址」時才用到
const newAddressLabel = ref<string>('')      // 選填，例如「住家」「店面」
const addressCheck = ref<AddressVerifyResult | null>(null)
const isCheckingAddress = ref<boolean>(false)

/** 下拉選單用的唯一值（有 id 用 id，歷史訂單地址就用地址本身） */
const addressKey = (item: SavedAddress) => String(item.id ?? `history:${item.address}`)

const selectedAddress = computed(() =>
  savedAddresses.value.find((item) => addressKey(item) === selectedAddressKey.value) || null
)

/** 這次下單實際要送的地址 */
const effectiveAddress = computed(() =>
  isAddingNewAddress.value ? newAddress.value.trim() : (selectedAddress.value?.address || '')
)

const addressOptionText = (item: SavedAddress) =>
  item.label ? `${item.label}｜${item.address}` : item.address

onMounted(async () => {
  try {
    // ⚠️ 記得換成你的 LIFF ID
    await liff.init({ liffId: '2010214891-TocDb9gS' })

    if (liff.isLoggedIn()) {
      isLoggedIn.value = true
      profile.value = await liff.getProfile() as Profile
      await loadAddresses()
    } else {
      liff.login()
    }
  } catch (err) {
    console.error('LIFF 初始化失敗', err)
    errorMsg.value = '系統載入失敗，請稍後再試。'
  }
})

/** 讀取常用地址，並自動帶出預設（清單第一筆就是預設／最近使用的） */
const loadAddresses = async (): Promise<void> => {
  if (!profile.value) return

  try {
    savedAddresses.value = await fetchAddresses(profile.value.userId)
    if (savedAddresses.value.length) {
      selectedAddressKey.value = addressKey(savedAddresses.value[0])
      isAddingNewAddress.value = false
    } else {
      // 第一次叫瓦斯的新客戶，直接進入輸入模式
      isAddingNewAddress.value = true
    }
  } catch (err) {
    console.error('讀取常用地址失敗', err)
    isAddingNewAddress.value = true // 讀不到也要能照常下單
  }
}

const startNewAddress = (): void => {
  isAddingNewAddress.value = true
  newAddress.value = ''
  newAddressLabel.value = ''
  addressCheck.value = null
}

const cancelNewAddress = (): void => {
  isAddingNewAddress.value = false
  addressCheck.value = null
  if (savedAddresses.value.length && !selectedAddressKey.value) {
    selectedAddressKey.value = addressKey(savedAddresses.value[0])
  }
}

/** 送出前先跟地圖核對一次，打錯字當場就知道 */
const checkNewAddress = async (): Promise<void> => {
  const address = newAddress.value.trim()
  if (!address) {
    addressCheck.value = null
    return
  }

  isCheckingAddress.value = true
  try {
    addressCheck.value = await verifyAddress(address)
  } catch (err) {
    console.error('地址檢查失敗', err)
    addressCheck.value = null // 檢查服務出問題時不擋客戶下單
  } finally {
    isCheckingAddress.value = false
  }
}

const removeSelectedAddress = async (): Promise<void> => {
  const target = selectedAddress.value
  if (!profile.value || !target || target.id == null) return
  if (!confirm(`確定要把「${target.address}」從常用地址移除嗎？`)) return

  try {
    await deleteAddress(profile.value.userId, target.id)
    await loadAddresses()
  } catch (err) {
    alert(`刪除失敗：${(err as Error).message}`)
  }
}

const handleOrder = async (): Promise<void> => {
  if (!profile.value) return;

  // 🌟 表單驗證：檢查有沒有填寫地址
  if (!effectiveAddress.value) {
    alert('老闆，請記得選擇或填寫送貨地址喔！')
    return;
  }

  // 新地址還沒核對過就先核對，讓客戶有機會修正
  if (isAddingNewAddress.value && !addressCheck.value) {
    await checkNewAddress()
  }
  if (isAddingNewAddress.value && addressCheck.value && !addressCheck.value.verified) {
    const goAhead = confirm(
      `⚠️ 地圖上找不到「${effectiveAddress.value}」。\n` +
      `送出後師傅可能會找不到路，確定要用這個地址嗎？`
    )
    if (!goAhead) return
  }

  isLoading.value = true

  try {
    // 後端網址讀 VITE_API_BASE_URL（本機開發時可在 .env.development 覆蓋）
    const backendUrl = `${API_BASE}/api/order`;
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.value.userId,
        displayName: profile.value.displayName,
        gasWeight: gasWeight.value,   // 傳送瓦斯規格
        quantity: quantity.value,     // 傳送數量
        address: effectiveAddress.value, // 傳送地址
        addressLabel: isAddingNewAddress.value ? newAddressLabel.value.trim() : '' // 新地址的自訂名稱
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

        <!-- 有存過的地址：直接用下拉選單挑，預設帶出最常用的那一個 -->
        <template v-if="!isAddingNewAddress">
          <select v-model="selectedAddressKey" class="input-field">
            <option
              v-for="item in savedAddresses"
              :key="addressKey(item)"
              :value="addressKey(item)"
            >
              {{ addressOptionText(item) }}
            </option>
          </select>

          <!-- 下拉選單會截斷長地址，這裡補上完整內容讓客戶再確認一次 -->
          <p v-if="selectedAddress" class="address-hint">
            {{ selectedAddress.address }}
            <span v-if="selectedAddress.source === 'order-history'">（來自您過去的訂單）</span>
          </p>

          <div class="address-actions">
            <button type="button" class="text-btn" @click="startNewAddress">
              ✏️ 送到其他地址
            </button>
            <button
              v-if="selectedAddress && selectedAddress.id != null"
              type="button"
              class="text-btn danger"
              @click="removeSelectedAddress"
            >
              🗑 移除這個地址
            </button>
          </div>
        </template>

        <!-- 輸入新地址：離開欄位時自動跟地圖核對一次 -->
        <template v-else>
          <input
            type="text"
            v-model="newAddress"
            placeholder="請輸入完整地址（含縣市、路名、門牌號碼）"
            class="input-field"
            @blur="checkNewAddress"
          />
          <input
            type="text"
            v-model="newAddressLabel"
            placeholder="幫這個地址取個名字（選填，例如：住家、店面）"
            class="input-field sub-field"
          />

          <p v-if="isCheckingAddress" class="address-hint">🔍 地址確認中…</p>
          <p v-else-if="addressCheck?.verified" class="address-hint ok">
            ✅ 地圖已找到：{{ addressCheck.formattedAddress }}
          </p>
          <p v-else-if="addressCheck" class="address-hint warn">
            ⚠️ {{ addressCheck.reason }}
          </p>
          <p v-else class="address-hint">送出後會自動記住，下次直接選取就好。</p>

          <div class="address-actions">
            <button
              v-if="savedAddresses.length"
              type="button"
              class="text-btn"
              @click="cancelNewAddress"
            >
              ↩ 改用常用地址
            </button>
          </div>
        </template>
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
  background: #fff;
  color: #333;
}
.input-field:focus {
  border-color: #06c755;
  outline: none;
}
.sub-field {
  margin-top: 8px;
  font-size: 15px;
}
.address-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 10px;
}
.text-btn {
  background: none;
  border: none;
  padding: 0;
  font-size: 14px;
  color: #06c755;
  cursor: pointer;
}
.text-btn.danger { color: #c0392b; }
.address-hint {
  font-size: 13px;
  color: #6b7684;
  margin: 8px 0 0;
  line-height: 1.5;
  word-break: break-all;
}
.address-hint.ok { color: #1b7a3d; }
.address-hint.warn { color: #b3261e; }
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
