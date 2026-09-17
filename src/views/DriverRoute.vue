<template>
  <div class="driver">
    <!-- 確認身分中 -->
    <div v-if="authState === 'checking'" class="state-card">
      <div class="spinner" aria-hidden="true"></div>
      <p class="state-title">確認身分中…</p>
      <p class="state-hint">正在向 LINE 確認您的帳號</p>
    </div>

    <!-- 不在師傅名單上 -->
    <div v-else-if="authState === 'denied'" class="state-card state-denied" role="alert">
      <p class="state-icon" aria-hidden="true">🔒</p>
      <p class="state-title">您不在配送人員名單中</p>
      <p class="state-hint">
        {{ deniedName ? `${deniedName}，這個頁面` : '這個頁面' }}只開放給瓦斯行的配送人員使用。
      </p>

      <template v-if="deniedUid">
        <p class="uid-label">如果您是配送人員，請把下面這串代碼給老闆加入名單：</p>
        <code class="uid-box">{{ deniedUid }}</code>
        <button class="btn-copy" @click="copyUid">{{ copied ? '已複製 ✓' : '複製代碼' }}</button>
      </template>
    </div>

    <!-- 驗證本身出錯（token 過期、網路問題、後端沒設定名單） -->
    <div v-else-if="authState === 'authError'" class="state-card" role="alert">
      <p class="state-icon" aria-hidden="true">⚠️</p>
      <p class="state-title">無法確認身分</p>
      <p class="state-hint">{{ authErrorMsg }}</p>
      <button class="btn-copy" @click="reload">重新載入</button>
    </div>

    <!-- 通過驗證，以下是正式內容 -->
    <template v-else>
      <header class="page-head">
        <div>
          <h1>配送清單</h1>
          <p class="subtitle">{{ subtitle }}</p>
        </div>
        <button class="btn-ghost" :disabled="isLoading" @click="fetchRoute">
          {{ isLoading ? '載入中…' : '重新整理' }}
        </button>
      </header>

      <p v-if="errorMsg" class="banner" role="alert">
        <span aria-hidden="true">⚠️</span>
        <span>{{ errorMsg }}</span>
      </p>

      <template v-if="isLoading">
        <div class="skeleton" v-for="n in 3" :key="n"></div>
      </template>

      <template v-else-if="errorMsg">
        <div class="empty-state">
          <p class="empty-icon" aria-hidden="true">🔌</p>
          <p class="empty-title">暫時無法載入配送清單</p>
          <p class="empty-hint">請確認網路與後端狀態，再按上方的「重新整理」。</p>
        </div>
      </template>

      <template v-else-if="!stops.length && !unroutable.length">
        <div class="empty-state">
          <p class="empty-icon" aria-hidden="true">🎉</p>
          <p class="empty-title">今天的單都送完了</p>
          <p class="empty-hint">有新訂單進來時，按「重新整理」就會出現。</p>
        </div>
      </template>

      <template v-else>
        <a
          v-if="fullRouteUrl"
          class="btn-route"
          :href="fullRouteUrl"
          target="_blank"
          rel="noopener"
        >🗺️ 整條路線丟給 Google Maps</a>

        <p v-if="truncated" class="route-note">
          停靠點較多，整條路線只包含前面幾站；其餘請用各站的「導航」按鈕。
        </p>

        <ol class="stop-list">
          <li v-for="stop in stops" :key="stop.order_id" class="stop-card">
            <div class="stop-top">
              <span class="stop-seq" aria-hidden="true">{{ stop.seq }}</span>
              <div class="stop-who">
                <p class="stop-customer">{{ stop.customer_name }}</p>
                <p class="stop-spec">{{ stop.gas_weight }} 公斤 × {{ stop.quantity }} 桶</p>
              </div>
              <span class="stop-no">{{ stop.order_no }}</span>
            </div>

            <p class="stop-address">{{ stop.address }}</p>

            <div class="stop-actions">
              <a class="btn-nav" :href="stop.maps_url" target="_blank" rel="noopener">導航</a>
              <button
                class="btn-done"
                :disabled="savingId === stop.order_id"
                @click="markDelivered(stop)"
              >
                {{ savingId === stop.order_id ? '更新中…' : '已送達' }}
              </button>
            </div>
          </li>
        </ol>

        <!-- 沒有地址的訂單絕對不能默默消失，不然師傅根本不知道有這一單 -->
        <section v-if="unroutable.length" class="unroutable">
          <h2 class="unroutable-title">⚠️ 無法導航（{{ unroutable.length }} 單）</h2>
          <p class="unroutable-hint">這些訂單沒有填地址，請直接聯絡客人確認後再送。</p>
          <ul class="unroutable-list">
            <li v-for="order in unroutable" :key="order.order_id" class="unroutable-item">
              <div>
                <p class="stop-customer">{{ order.customer_name }}</p>
                <p class="stop-spec">{{ order.order_no }}・{{ order.gas_weight }} 公斤 × {{ order.quantity }} 桶</p>
              </div>
              <button
                class="btn-done btn-done--sm"
                :disabled="savingId === order.order_id"
                @click="markDelivered(order)"
              >
                {{ savingId === order.order_id ? '更新中…' : '已送達' }}
              </button>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import liff from '@line/liff';
import api from '../api';
import { LIFF_ID } from '../lineConfig';

// checking：確認身分中｜denied：不在名單上｜authError：驗證出錯｜ok：通過
const authState = ref('checking');
const deniedUid = ref('');
const deniedName = ref('');
const authErrorMsg = ref('');
const copied = ref(false);
const accessToken = ref('');

const stops = ref([]);
const unroutable = ref([]);
const fullRouteUrl = ref(null);
const truncated = ref(false);
const isLoading = ref(true);
const errorMsg = ref('');
const savingId = ref(null);

const subtitle = computed(() => {
  if (isLoading.value) return '載入中…';
  if (errorMsg.value) return '目前無法取得資料';
  const total = stops.value.length + unroutable.value.length;
  if (!total) return '目前沒有待配送的訂單';
  return `尚有 ${total} 單待配送`;
});

// 每次呼叫都帶上 LINE 簽發的 access token。
// 後端會拿它去跟 LINE 換取真實身分，不是直接相信我們送過去的 UID。
const authHeader = () => ({ Authorization: `Bearer ${accessToken.value}` });

// 把後端的驗證錯誤轉成畫面狀態。回傳 true 代表已處理，呼叫端不必再管。
const handleAuthError = (error) => {
  const status = error.response?.status;

  if (status === 403) {
    authState.value = 'denied';
    deniedUid.value = error.response.data?.line_uid || '';
    deniedName.value = error.response.data?.display_name || '';
    return true;
  }

  if (status === 401 || status === 500) {
    const message = error.response?.data?.message;
    // 500 只有在後端還沒設定名單時才會走到這裡，訊息本身講得很清楚
    if (status === 401 || (message && message.includes('名單'))) {
      authState.value = 'authError';
      authErrorMsg.value = message || '登入資訊無效，請重新開啟頁面。';
      return true;
    }
  }

  return false;
};

const fetchRoute = async () => {
  isLoading.value = true;
  errorMsg.value = '';

  try {
    const response = await api.get('/api/route', { headers: authHeader() });

    if (!response.data.success) {
      throw new Error(response.data.message || '後端回報查詢失敗');
    }

    stops.value = response.data.stops || [];
    unroutable.value = response.data.unroutable || [];
    fullRouteUrl.value = response.data.full_route_maps_url || null;
    truncated.value = Boolean(response.data.full_route_truncated);
  } catch (error) {
    if (handleAuthError(error)) return;

    console.error('無法取得配送清單:', error);
    errorMsg.value = '撈不到配送清單，請確認後端服務與資料庫是否正常運作。';
    stops.value = [];
    unroutable.value = [];
    fullRouteUrl.value = null;
  } finally {
    isLoading.value = false;
  }
};

const markDelivered = async (stop) => {
  // 開車途中很容易誤觸，送出前先確認一次
  if (!window.confirm(`確定「${stop.customer_name}」這一單已經送達了嗎？`)) return;

  savingId.value = stop.order_id;

  try {
    await api.patch(
      `/api/orders/${stop.order_id}/status`,
      { status: 'completed' },
      { headers: authHeader() }
    );
    await fetchRoute();
  } catch (error) {
    if (handleAuthError(error)) return;

    console.error('更新訂單狀態失敗:', error);
    errorMsg.value = `「${stop.customer_name}」的狀態沒有更新成功，請再試一次。`;
  } finally {
    savingId.value = null;
  }
};

const copyUid = async () => {
  try {
    await navigator.clipboard.writeText(deniedUid.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    // 剪貼簿在某些瀏覽器需要特定權限，失敗就讓使用者自己長按複製
    window.prompt('請長按選取並複製這串代碼：', deniedUid.value);
  }
};

const reload = () => window.location.reload();

onMounted(async () => {
  try {
    await liff.init({ liffId: LIFF_ID });

    if (!liff.isLoggedIn()) {
      liff.login();
      return; // 會跳轉到 LINE 登入，這裡不用再往下走
    }

    accessToken.value = liff.getAccessToken() || '';

    if (!accessToken.value) {
      throw new Error('拿不到 LINE 的登入資訊');
    }

    authState.value = 'ok';
    await fetchRoute();
  } catch (err) {
    console.error('LIFF 初始化失敗', err);
    authState.value = 'authError';
    authErrorMsg.value = '無法連上 LINE 登入服務，請從 LINE 裡開啟這個頁面。';
  }
});
</script>

<style scoped>
.driver {
  --surface: #ffffff;
  --border: #dfe3ea;
  --text-primary: #111827;
  --text-secondary: #5b6471;

  max-width: 640px;
  margin: 0 auto;
  padding: 20px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--text-primary);
}

/* ---------- 身分驗證狀態 ---------- */
.state-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 40px 24px;
  margin-top: 40px;
  text-align: center;
}

.state-icon {
  margin: 0 0 8px;
  font-size: 40px;
}

.state-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.state-hint {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.state-denied .state-title {
  color: #9b2226;
}

.uid-label {
  margin: 24px 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.uid-box {
  display: block;
  padding: 12px;
  border-radius: var(--radius-sm);
  background: #f3f4f6;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  word-break: break-all;
  user-select: all;
}

.btn-copy {
  margin-top: 12px;
  min-height: 44px;
  padding: 0 24px;
  border: none;
  border-radius: var(--radius-sm);
  background-color: var(--brand-strong);
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
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

/* ---------- 標頭 ---------- */
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.page-head h1 {
  margin: 0 0 2px;
  font-size: 24px;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.btn-ghost {
  flex-shrink: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 14px;
}

.btn-ghost:disabled {
  opacity: 0.55;
}

/* ---------- 錯誤 ---------- */
.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background-color: #fdecec;
  border: 1px solid #f3b4b4;
  color: #9b2226;
  font-size: 14px;
}

/* ---------- 整條路線 ---------- */
.btn-route {
  display: block;
  padding: 16px;
  border-radius: var(--radius-md);
  background-color: #1a73e8; /* Google Maps 的藍，白字 4.5:1 */
  color: #ffffff;
  font-weight: 700;
  font-size: 16px;
  text-align: center;
  text-decoration: none;
}

.route-note {
  margin: -6px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

/* ---------- 停靠點 ---------- */
.stop-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stop-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.stop-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.stop-seq {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--brand-strong);
  color: #ffffff;
  font-weight: 700;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stop-who {
  flex: 1;
  min-width: 0;
}

.stop-customer {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  word-break: break-word;
}

.stop-spec {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.stop-no {
  flex-shrink: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.stop-address {
  margin: 12px 0 0;
  font-size: 15px;
  line-height: 1.55;
  word-break: break-word;
}

.stop-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}

/* 開車中操作，觸控目標一律做大 */
.btn-nav,
.btn-done {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
  border: none;
}

.btn-nav {
  background-color: #1a73e8;
  color: #ffffff;
}

.btn-done {
  background-color: var(--brand-strong);
  color: #ffffff;
}

.btn-done:disabled {
  opacity: 0.55;
}

.btn-done--sm {
  min-height: 40px;
  padding: 0 14px;
  font-size: 14px;
  flex-shrink: 0;
}

/* ---------- 沒有地址的訂單 ---------- */
.unroutable {
  background: #fff8e6;
  border: 1px solid #f0d089;
  border-radius: var(--radius-md);
  padding: 16px;
}

.unroutable-title {
  margin: 0;
  font-size: 15px;
  color: #7a5200;
}

.unroutable-hint {
  margin: 6px 0 12px;
  font-size: 13px;
  color: #7a5200;
}

.unroutable-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.unroutable-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #ffffff;
  border-radius: var(--radius-sm);
  padding: 12px 14px;
}

/* ---------- 載入中 / 空狀態 ---------- */
.skeleton {
  height: 150px;
  border-radius: var(--radius-md);
  background: linear-gradient(90deg, #e6e9ef 25%, #f1f3f7 50%, #e6e9ef 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}

.empty-state {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  text-align: center;
  padding: 44px 20px;
}

.empty-icon {
  margin: 0;
  font-size: 40px;
}

.empty-title {
  margin: 12px 0 4px;
  font-weight: 700;
  font-size: 17px;
}

.empty-hint {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
