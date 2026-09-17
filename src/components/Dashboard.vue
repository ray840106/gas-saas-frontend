<template>
  <div class="dashboard">
    <header class="page-head">
      <div>
        <h1>儀表板</h1>
        <p class="subtitle">即時掌握瓦斯配送與營運狀況</p>
      </div>
      <button class="btn-primary" :disabled="isLoading" @click="fetchOrders">
        {{ isLoading ? '載入中…' : '重新整理' }}
      </button>
    </header>

    <p v-if="errorMsg" class="banner" role="alert">
      <span aria-hidden="true">⚠️</span>
      <span>{{ errorMsg }}</span>
    </p>

    <!-- 數字全部由下方訂單資料即時算出，沒有寫死的假資料 -->
    <section class="kpi-row" aria-label="營運概況">
      <article v-for="kpi in kpis" :key="kpi.label" class="kpi-tile">
        <h2 class="kpi-label">{{ kpi.label }}</h2>
        <p class="kpi-value">{{ isLoading || errorMsg ? '—' : kpi.value }}</p>
        <p class="kpi-note">{{ kpi.note }}</p>
      </article>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2>訂單清單</h2>
        <span v-if="!isLoading && orders.length" class="panel-count">
          共 {{ orders.length }} 筆
        </span>
      </div>

      <div v-if="isLoading" class="skeleton-list" aria-hidden="true">
        <div v-for="n in 4" :key="n" class="skeleton-row"></div>
      </div>

      <div v-else-if="errorMsg" class="empty-state">
        <p class="empty-icon" aria-hidden="true">🔌</p>
        <p class="empty-title">暫時無法載入訂單</p>
        <p class="empty-hint">請確認後端與資料庫的狀態，然後按上方的「重新整理」。</p>
      </div>

      <div v-else-if="!orders.length" class="empty-state">
        <p class="empty-icon" aria-hidden="true">📭</p>
        <p class="empty-title">還沒有任何訂單</p>
        <p class="empty-hint">客人從 LINE 下單之後，訂單就會出現在這裡。</p>
      </div>

      <div v-else class="table-scroll">
        <table class="order-table">
          <thead>
            <tr>
              <th scope="col">訂單編號</th>
              <th scope="col">客戶</th>
              <th scope="col">規格</th>
              <th scope="col">狀態</th>
              <th scope="col" class="align-end">金額</th>
              <th scope="col" class="align-end">下單時間</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id">
              <td data-label="訂單編號" class="order-no">{{ order.orderNo }}</td>
              <td data-label="客戶" class="cell-customer">
                <div class="customer-cell">
                  <span class="customer-name">{{ order.customer }}</span>
                  <span v-if="order.address" class="customer-address">{{ order.address }}</span>
                </div>
              </td>
              <td data-label="規格">
                <span class="gas-tag">{{ order.size }}</span>
              </td>
              <td data-label="狀態">
                <!-- 狀態一律「色塊 + 文字」，不靠顏色單獨表意 -->
                <span class="status-badge" :class="order.statusClass">
                  <span class="status-dot" aria-hidden="true"></span>{{ order.statusText }}
                </span>
              </td>
              <td data-label="金額" class="align-end price">{{ twd(order.price) }}</td>
              <td data-label="下單時間" class="align-end placed-at">{{ order.placedAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../api';

const orders = ref([]);
const isLoading = ref(true);
const errorMsg = ref('');

// 資料庫的英文狀態 → 前端的中文與樣式 class
const STATUS_MAP = {
  pending: { class: 'pending', text: '處理中' },
  delivering: { class: 'delivering', text: '配送中' },
  completed: { class: 'completed', text: '已送達' }
};

const mapStatus = (status) => {
  // gas_order.status 的預設值連同單引號一起存成 'pending'，比對前先去掉頭尾引號
  const key = String(status ?? '').trim().replace(/^'(.*)'$/, '$1').trim();
  return STATUS_MAP[key] || STATUS_MAP.pending;
};

// 單桶價格：20 公斤 850 元，其餘（16 公斤）700 元
const unitPriceOf = (gasWeight) => (String(gasWeight) === '20' ? 850 : 700);

const twd = (amount) => `NT$ ${Number(amount).toLocaleString('zh-TW')}`;

const formatTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const kpis = computed(() => {
  const list = orders.value;
  const done = list.filter((order) => order.statusClass === 'completed').length;
  const revenue = list.reduce((sum, order) => sum + order.price, 0);

  // 註解寫的是資料的真實範圍：後端 /api/orders 回傳的是全部訂單，不是當月
  return [
    { label: '訂單總數', value: list.length, note: '資料庫內全部訂單' },
    { label: '待處理 / 配送中', value: list.length - done, note: '尚未送達' },
    { label: '已送達', value: done, note: '已完成配送' },
    // 幣別放在註解而不是數值裡：窄欄位下 "NT$ 7,200" 會折行，而且單位不必每格重複
    { label: '訂單總額', value: revenue.toLocaleString('zh-TW'), note: '新台幣・依規格 × 數量估算' }
  ];
});

const fetchOrders = async () => {
  isLoading.value = true;
  errorMsg.value = '';

  try {
    const response = await api.get('/api/orders');

    if (!response.data.success) {
      throw new Error(response.data.message || '後端回報查詢失敗');
    }

    // 這裡的欄位要跟後端 insert 進 gas_order 的欄位一致
    orders.value = response.data.data.map((item) => {
      const statusInfo = mapStatus(item.status);
      const quantity = Number(item.quantity) || 1;

      return {
        id: item.id,
        orderNo: `ORD-${String(item.id).padStart(3, '0')}`,
        customer: item.customer_name || '未填寫',
        address: item.address || '',
        size: `${item.gas_weight} 公斤 × ${quantity} 桶`,
        statusClass: statusInfo.class,
        statusText: statusInfo.text,
        price: unitPriceOf(item.gas_weight) * quantity,
        placedAt: formatTime(item.created_at)
      };
    });
  } catch (error) {
    console.error('無法撈取後端訂單資料:', error);
    errorMsg.value = '撈不到訂單資料，請確認後端服務與資料庫是否正常運作。';
    orders.value = [];
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchOrders);
</script>

<style scoped>
.dashboard {
  /* 深色頁面的配色集中在這裡，下面一律用變數 */
  --surface: #1e293b;
  --border: #334155;
  --text-primary: #f1f5f9;   /* 13.4:1 on --surface */
  --text-secondary: #a8b6c8; /*  7.1:1 on --surface */
  --text-muted: #94a3b8;     /*  5.7:1 on --surface */
  --accent: #38bdf8;

  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 20px 56px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: var(--text-primary);
}

/* ---------- 標頭 ---------- */
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px;
}

.page-head h1 {
  margin: 0 0 4px;
  font-size: 26px;
  letter-spacing: 0.01em;
}

.subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.btn-primary {
  background-color: var(--brand-strong);
  color: #ffffff;
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  transition: background-color 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--brand-strong-hover);
}

.btn-primary:disabled {
  opacity: 0.55;
}

/* ---------- 錯誤提示 ---------- */
.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background-color: rgba(208, 59, 59, 0.14);
  border: 1px solid rgba(208, 59, 59, 0.45);
  color: #fca5a5;
  font-size: 14px;
}

/* ---------- 數據磚 ---------- */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.kpi-tile {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 18px 20px;
}

.kpi-label {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.kpi-value {
  margin: 8px 0 4px;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.kpi-note {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

/* ---------- 訂單面板 ---------- */
.panel {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-head h2 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary);
}

.panel-count {
  font-size: 13px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

/* ---------- 載入中 ---------- */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-row {
  height: 44px;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, #243349 25%, #2d3e57 50%, #243349 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-row { animation: none; }
}

/* ---------- 空狀態 ---------- */
.empty-state {
  text-align: center;
  padding: 44px 20px;
}

.empty-icon {
  margin: 0;
  font-size: 40px;
}

.empty-title {
  margin: 12px 0 4px;
  font-weight: 600;
}

.empty-hint {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
}

/* ---------- 表格 ---------- */
.table-scroll {
  overflow-x: auto;
}

.order-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 14px;
}

.order-table th {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  font-weight: 500;
  font-size: 13px;
  white-space: nowrap;
}

.order-table td {
  padding: 14px;
  border-bottom: 1px solid rgba(51, 65, 85, 0.6);
  vertical-align: middle;
}

.order-table tbody tr:last-child td {
  border-bottom: none;
}

.align-end {
  text-align: right;
}

.order-no {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--accent);
  white-space: nowrap;
}

.customer-cell {
  display: flex;
  flex-direction: column;
}

.customer-name {
  font-weight: 500;
}

.customer-address {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}

.gas-tag {
  display: inline-block;
  background-color: #334155;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  white-space: nowrap;
}

.price {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.placed-at {
  color: var(--text-muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ---------- 狀態標籤 ----------
   顏色永遠搭配文字，不單獨用顏色表意：
   這三個色在卡片底 #1e293b 上都過 3:1，但綠與藍在藍黃色盲下
   的色差落在警戒區間，文字標籤就是必要的輔助編碼，別拿掉。 */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.status-badge.pending {
  background-color: rgba(245, 158, 11, 0.14);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.status-badge.delivering {
  background-color: rgba(59, 130, 246, 0.14);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.35);
}

.status-badge.completed {
  background-color: rgba(16, 185, 129, 0.14);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.35);
}

/* ---------- 手機版：表格改成卡片 ---------- */
@media (max-width: 680px) {
  .dashboard {
    padding: 20px 16px 40px;
  }

  .page-head {
    align-items: stretch;
  }

  .btn-primary {
    width: 100%;
  }

  .kpi-value {
    font-size: 24px; /* 兩欄寬度下 NT$ 金額才不會折行 */
  }

  .order-table thead {
    /* 視覺上隱藏，但每一格改用 data-label 顯示欄位名 */
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .order-table tr {
    display: block;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    margin-bottom: 12px;
    overflow: hidden;
  }

  .order-table tbody tr:last-child {
    margin-bottom: 0;
  }

  .order-table td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(51, 65, 85, 0.5);
    text-align: right;
  }

  .order-table td::before {
    content: attr(data-label);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    text-align: left;
    flex-shrink: 0;
  }

  /* 地址很長，這一格改成「標題在上、內容在下」並靠左，才不會被擠成兩欄 */
  .order-table td.cell-customer {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    text-align: left;
  }
}
</style>
