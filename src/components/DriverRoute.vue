<script setup lang="ts">
/**
 * 師傅送貨路線規劃
 *
 * 使用流程：
 *   1. 選起點（目前位置 / 瓦斯行 / 手動輸入）
 *   2. 勾選今天要送的訂單
 *   3. 按「排出最佳路線」，系統算出最短順序
 *   4. 每一站按「導航」直接開 Google 地圖，或用「整趟路線」一次帶入所有點
 */
import { computed, onMounted, ref } from 'vue'
import {
  fetchDeliveryConfig,
  fetchDeliveryOrders,
  getCurrentPosition,
  planRoute,
  updateOrderStatus,
  type DeliveryConfig,
  type DeliveryOrder,
  type RoutePlan,
  type RouteStop
} from '../api/delivery'

const STORAGE_KEY = 'gas-driver-route'

const config = ref<DeliveryConfig | null>(null)
const orders = ref<DeliveryOrder[]>([])
const selectedIds = ref<Array<number | string>>([])
const plan = ref<RoutePlan | null>(null)
const planStartedAt = ref<number>(Date.now())
const doneOrderIds = ref<Array<number | string>>([])

const loading = ref(false)
const planning = ref(false)
const errorMsg = ref('')
const noticeMsg = ref('')

const originMode = ref<'gps' | 'depot' | 'manual'>('gps')
const manualAddress = ref('')
const gpsPosition = ref<{ lat: number; lng: number } | null>(null)
const returnToOrigin = ref(false)
const dateFilter = ref('')

// ── 計算屬性 ───────────────────────────────────────────
const selectedOrders = computed(() =>
  orders.value.filter((order) => selectedIds.value.includes(order.id))
)
const selectedCylinders = computed(() =>
  selectedOrders.value.reduce((sum, order) => sum + order.quantity, 0)
)
const allSelected = computed(
  () => orders.value.length > 0 && selectedIds.value.length === orders.value.length
)
const remainingStops = computed(() => {
  if (!plan.value) return 0
  return plan.value.stops.filter((stop) => !isStopDone(stop)).length
})

function isStopDone(stop: RouteStop) {
  return stop.orderIds.every((id) => doneOrderIds.value.includes(id))
}

/** 把「出發後 N 分鐘」換算成時鐘時間，師傅比較好抓客戶等待時間 */
function arrivalClock(minutes: number) {
  const at = new Date(planStartedAt.value + minutes * 60 * 1000)
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} 分`
  return `${Math.floor(minutes / 60)}小時${minutes % 60}分`
}

// ── 本機暫存：App 被切走或不小心關掉，路線還在 ─────────────
function saveLocal() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        plan: plan.value,
        planStartedAt: planStartedAt.value,
        doneOrderIds: doneOrderIds.value,
        returnToOrigin: returnToOrigin.value
      })
    )
  } catch {
    /* 無痕模式等情況寫不進去，忽略即可 */
  }
}

function restoreLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    // 只還原當天的路線，隔天自動重排
    if (saved.planStartedAt && Date.now() - saved.planStartedAt < 12 * 60 * 60 * 1000) {
      plan.value = saved.plan || null
      planStartedAt.value = saved.planStartedAt
      doneOrderIds.value = saved.doneOrderIds || []
      returnToOrigin.value = Boolean(saved.returnToOrigin)
    }
  } catch {
    /* 壞掉的暫存直接略過 */
  }
}

// ── 資料載入 ───────────────────────────────────────────
async function loadOrders() {
  loading.value = true
  errorMsg.value = ''
  try {
    orders.value = await fetchDeliveryOrders(
      dateFilter.value ? { date: dateFilter.value } : {}
    )
    selectedIds.value = orders.value.map((order) => order.id)
  } catch (err) {
    errorMsg.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

async function useCurrentPosition() {
  noticeMsg.value = '定位中…'
  try {
    gpsPosition.value = await getCurrentPosition()
    originMode.value = 'gps'
    noticeMsg.value = '✅ 已取得目前位置'
  } catch (err) {
    noticeMsg.value = ''
    errorMsg.value = (err as Error).message
    if (config.value?.depot) originMode.value = 'depot'
  }
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : orders.value.map((order) => order.id)
}

function toggleOrder(id: number | string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((item) => item !== id)
    : [...selectedIds.value, id]
}

// ── 主要動作 ───────────────────────────────────────────
async function handlePlan() {
  errorMsg.value = ''
  noticeMsg.value = ''

  if (!selectedIds.value.length) {
    errorMsg.value = '請至少勾選一張訂單'
    return
  }

  let origin: { lat?: number; lng?: number; address?: string; label?: string } | undefined
  if (originMode.value === 'gps') {
    if (!gpsPosition.value) {
      await useCurrentPosition()
      if (!gpsPosition.value) return
    }
    origin = { ...gpsPosition.value, label: '目前位置' }
  } else if (originMode.value === 'manual') {
    if (!manualAddress.value.trim()) {
      errorMsg.value = '請輸入起點地址'
      return
    }
    origin = { address: manualAddress.value.trim(), label: '起點' }
  } else if (config.value?.depot) {
    const depot = config.value.depot
    origin = {
      lat: depot.lat ?? undefined,
      lng: depot.lng ?? undefined,
      address: depot.address,
      label: depot.label
    }
  }

  planning.value = true
  try {
    plan.value = await planRoute({
      orderIds: selectedIds.value,
      origin,
      returnToOrigin: returnToOrigin.value
    })
    planStartedAt.value = Date.now()
    doneOrderIds.value = []
    saveLocal()
  } catch (err) {
    errorMsg.value = (err as Error).message
  } finally {
    planning.value = false
  }
}

function openUrl(url: string) {
  window.open(url, '_blank', 'noopener')
}

/** 送達回報：更新後端狀態，即使後端還沒建 status 欄位也讓畫面先打勾 */
async function markStopDone(stop: RouteStop) {
  const previous = [...doneOrderIds.value]
  doneOrderIds.value = [...doneOrderIds.value, ...stop.orderIds]
  saveLocal()

  try {
    await Promise.all(stop.orderIds.map((id) => updateOrderStatus(id, 'completed')))
    noticeMsg.value = `✅ 第 ${stop.seq} 站已回報送達`
  } catch (err) {
    doneOrderIds.value = previous
    saveLocal()
    errorMsg.value = `狀態回報失敗：${(err as Error).message}`
  }
}

function undoStop(stop: RouteStop) {
  doneOrderIds.value = doneOrderIds.value.filter((id) => !stop.orderIds.includes(id))
  saveLocal()
  Promise.all(stop.orderIds.map((id) => updateOrderStatus(id, 'pending'))).catch(() => {
    /* 回復狀態失敗不影響現場作業 */
  })
}

/** 複製整趟地址清單，方便貼到 LINE 群組或其他導航 App */
async function copyAddressList() {
  if (!plan.value) return
  const text = plan.value.stops
    .map((stop) => `${stop.seq}. ${stop.customerName} ${stop.address}（${stop.items.map((item) => `${item.gasWeight}kg×${item.quantity}`).join('、')}）`)
    .join('\n')

  try {
    await navigator.clipboard.writeText(text)
    noticeMsg.value = '📋 已複製地址清單'
  } catch {
    noticeMsg.value = '這個瀏覽器不允許複製，請長按下方清單自行複製'
  }
}

function resetPlan() {
  plan.value = null
  doneOrderIds.value = []
  saveLocal()
  loadOrders()
}

onMounted(async () => {
  restoreLocal()
  try {
    config.value = await fetchDeliveryConfig()
    // 沒開定位權限的話，至少要有瓦斯行地址當備案
    if (!navigator.geolocation && config.value.depot) originMode.value = 'depot'
  } catch (err) {
    errorMsg.value = (err as Error).message
  }
  await loadOrders()
})
</script>

<template>
  <div class="driver-page">
    <header class="page-header">
      <div>
        <h1>🚚 送貨路線</h1>
        <p class="subtitle">
          勾選訂單，系統幫你排出最順的送貨順序
        </p>
      </div>
      <button class="ghost-btn" :disabled="loading" @click="loadOrders">
        {{ loading ? '載入中…' : '↻ 重新整理' }}
      </button>
    </header>

    <p v-if="errorMsg" class="banner error" @click="errorMsg = ''">⚠️ {{ errorMsg }}</p>
    <p v-if="noticeMsg" class="banner notice" @click="noticeMsg = ''">{{ noticeMsg }}</p>

    <!-- ── 尚未排路線：挑起點 + 選訂單 ────────────────── -->
    <template v-if="!plan">
      <section class="card">
        <h2>① 從哪裡出發</h2>
        <div class="chip-row">
          <button
            class="chip"
            :class="{ active: originMode === 'gps' }"
            @click="useCurrentPosition()"
          >
            📍 目前位置
          </button>
          <button
            v-if="config?.depot"
            class="chip"
            :class="{ active: originMode === 'depot' }"
            @click="originMode = 'depot'"
          >
            🏠 {{ config.depot.label }}
          </button>
          <button
            class="chip"
            :class="{ active: originMode === 'manual' }"
            @click="originMode = 'manual'"
          >
            ✏️ 自己輸入
          </button>
        </div>

        <input
          v-if="originMode === 'manual'"
          v-model="manualAddress"
          class="input-field"
          type="text"
          placeholder="例如：台北市中正區忠孝東路一段1號"
        />
        <p v-else-if="originMode === 'gps' && gpsPosition" class="hint">
          目前位置：{{ gpsPosition.lat.toFixed(5) }}, {{ gpsPosition.lng.toFixed(5) }}
        </p>
        <p v-else-if="originMode === 'depot' && config?.depot" class="hint">
          {{ config.depot.address || '使用後端設定的座標' }}
        </p>

        <label class="switch-row">
          <input v-model="returnToOrigin" type="checkbox" />
          <span>送完要繞回出發點（算回程里程）</span>
        </label>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>② 今天要送哪幾單</h2>
          <button class="link-btn" @click="toggleAll">
            {{ allSelected ? '全部取消' : '全部選取' }}
          </button>
        </div>

        <label class="switch-row">
          <span>只看某一天：</span>
          <input v-model="dateFilter" type="date" class="date-input" @change="loadOrders" />
          <button v-if="dateFilter" class="link-btn" @click="dateFilter = ''; loadOrders()">清除</button>
        </label>

        <p v-if="!loading && !orders.length" class="empty">目前沒有待配送的訂單 🎉</p>

        <ul class="order-list">
          <li
            v-for="order in orders"
            :key="order.id"
            class="order-item"
            :class="{ picked: selectedIds.includes(order.id) }"
            @click="toggleOrder(order.id)"
          >
            <input
              type="checkbox"
              :checked="selectedIds.includes(order.id)"
              @click.stop="toggleOrder(order.id)"
            />
            <div class="order-body">
              <div class="order-title">
                {{ order.customerName }}
                <span class="tag">{{ order.gasWeight }}kg × {{ order.quantity }}</span>
              </div>
              <div class="order-address">{{ order.address }}</div>
            </div>
          </li>
        </ul>
      </section>

      <div class="action-bar">
        <div class="action-summary">
          已選 {{ selectedIds.length }} 單 / {{ selectedCylinders }} 桶
        </div>
        <button class="primary-btn" :disabled="planning || !selectedIds.length" @click="handlePlan">
          {{ planning ? '計算中…' : '🧭 排出最佳路線' }}
        </button>
      </div>
    </template>

    <!-- ── 排好路線：導航清單 ──────────────────────── -->
    <template v-else>
      <section class="card summary-card">
        <div class="summary-grid">
          <div><span class="summary-value">{{ plan.summary.stopCount }}</span><span class="summary-label">站</span></div>
          <div><span class="summary-value">{{ plan.summary.totalCylinders }}</span><span class="summary-label">桶</span></div>
          <div><span class="summary-value">{{ plan.summary.totalDistanceKm }}</span><span class="summary-label">公里</span></div>
          <div><span class="summary-value">{{ formatDuration(plan.summary.estimatedMinutes) }}</span><span class="summary-label">預估</span></div>
        </div>
        <p class="hint">
          還有 {{ remainingStops }} 站沒送 ·
          {{ plan.provider === 'google-directions' ? '依 Google 實際路況排序' : '依道路距離估算排序' }}
        </p>

        <div class="button-row">
          <button
            v-for="segment in plan.googleMapsUrls"
            :key="segment.index"
            class="primary-btn small"
            @click="openUrl(segment.url)"
          >
            🗺️ {{ plan.googleMapsUrls.length > 1 ? `第 ${segment.index} 段（${segment.stopCount} 站）` : '在 Google 地圖開啟整趟' }}
          </button>
        </div>
        <div class="button-row">
          <button class="ghost-btn" @click="copyAddressList">📋 複製地址清單</button>
          <button class="ghost-btn" @click="resetPlan">↺ 重排路線</button>
        </div>
        <p v-if="plan.googleMapsUrls.length > 1" class="hint">
          Google 地圖單一連結最多帶 {{ config?.maxWaypointsPerLink || 9 }} 個中途點，
          站數較多時會自動分段，跑完一段再開下一段即可。
        </p>
      </section>

      <ol class="stop-list">
        <li
          v-for="stop in plan.stops"
          :key="stop.seq"
          class="card stop-card"
          :class="{ done: isStopDone(stop) }"
        >
          <div class="stop-head">
            <span class="seq">{{ stop.seq }}</span>
            <div class="stop-title">
              <strong>{{ stop.customerName }}</strong>
              <div class="stop-address">{{ stop.address }}</div>
            </div>
          </div>

          <div class="stop-meta">
            <span v-for="item in stop.items" :key="item.gasWeight" class="tag">
              {{ item.gasWeight }}kg × {{ item.quantity }}
            </span>
            <span v-if="stop.distanceFromPrevKm != null" class="meta-text">
              🚗 {{ stop.distanceFromPrevKm }} km
            </span>
            <span class="meta-text">🕒 約 {{ arrivalClock(stop.etaMinutes) }} 抵達</span>
          </div>

          <div class="button-row">
            <button class="primary-btn small" @click="openUrl(stop.navigationUrl)">🧭 導航</button>
            <a v-if="stop.phone" class="ghost-btn" :href="`tel:${stop.phone}`">📞 打給客戶</a>
            <button v-if="!isStopDone(stop)" class="ghost-btn" @click="markStopDone(stop)">
              ✅ 已送達
            </button>
            <button v-else class="ghost-btn" @click="undoStop(stop)">↩ 取消送達</button>
          </div>
        </li>
      </ol>

      <section v-if="plan.unresolved.length" class="card warn-card">
        <h2>⚠️ 這些地址排不進路線</h2>
        <p class="hint">地圖查不到座標，請確認門牌是否完整，修正後重新排路線。</p>
        <ul class="plain-list">
          <li v-for="item in plan.unresolved" :key="String(item.orderIds[0])">
            {{ item.customerName }} — {{ item.address }}
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.driver-page {
  /* 全域 style.css 有置中設定，這裡改回靠左才符合清單閱讀習慣 */
  text-align: left;
  width: 100%;
  min-height: 100vh;
  background: #f2f4f6;
  padding: 16px 16px 120px;
  font-family: 'PingFang TC', 'Microsoft JhengHei', sans-serif;
  color: #1f2933;
  max-width: 640px;
  margin: 0 auto;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.page-header h1 { font-size: 22px; margin: 0; }
.page-header .ghost-btn { white-space: nowrap; flex: none; }
.subtitle { margin: 4px 0 0; font-size: 13px; color: #6b7684; }

.card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.card h2 { font-size: 15px; margin: 0 0 12px; }
.card-head { display: flex; justify-content: space-between; align-items: center; }

.banner {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  margin: 0 0 12px;
  cursor: pointer;
}
.banner.error { background: #fdecea; color: #b3261e; }
.banner.notice { background: #e7f6ec; color: #1b7a3d; }

.chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.chip {
  border: 1px solid #d6dae0;
  background: #fff;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 14px;
  cursor: pointer;
}
.chip.active { border-color: #06c755; background: #e7f8ee; color: #04863b; font-weight: bold; }

.input-field, .date-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d6dae0;
  border-radius: 8px;
  font-size: 15px;
  box-sizing: border-box;
}
.date-input { width: auto; flex: none; max-width: 190px; }

.switch-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-top: 12px;
  color: #3e4c59;
}
.hint { font-size: 13px; color: #6b7684; margin: 8px 0 0; }
.empty { text-align: center; color: #6b7684; padding: 24px 0; }

.order-list, .stop-list, .plain-list { list-style: none; padding: 0; margin: 12px 0 0; }
.order-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid #eceff2;
  border-radius: 10px;
  margin-bottom: 8px;
  cursor: pointer;
}
.order-item.picked { border-color: #06c755; background: #f6fdf9; }
.order-body { flex: 1; min-width: 0; }
.order-title { font-weight: bold; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.order-address { font-size: 13px; color: #6b7684; margin-top: 4px; word-break: break-all; }

.tag {
  background: #eef1f4;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: normal;
  color: #3e4c59;
}

.summary-card { position: sticky; top: 8px; z-index: 2; }
.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; }
.summary-value { display: block; font-size: 19px; font-weight: bold; color: #04863b; line-height: 1.3; }
.summary-label { font-size: 12px; color: #6b7684; }

.stop-card { padding: 14px; }
.stop-card.done { opacity: 0.55; }
.stop-card.done .stop-title strong { text-decoration: line-through; }
.stop-head { display: flex; gap: 12px; align-items: flex-start; }
.seq {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #06c755;
  color: #fff;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.stop-title { min-width: 0; }
.stop-address { font-size: 13px; color: #6b7684; margin-top: 2px; word-break: break-all; }
.stop-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 10px 0 0 40px; }
.meta-text { font-size: 12px; color: #6b7684; }

.button-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }

.primary-btn {
  background: #06c755;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 18px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
}
.primary-btn.small { padding: 9px 14px; font-size: 14px; flex: 1; min-width: 120px; }
.primary-btn:disabled { background: #a9dcc0; cursor: not-allowed; }

.ghost-btn {
  background: #fff;
  border: 1px solid #d6dae0;
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 14px;
  cursor: pointer;
  color: #3e4c59;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
.link-btn { background: none; border: none; color: #06c755; font-size: 14px; cursor: pointer; padding: 0; }

.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 640px;
  margin: 0 auto;
}
.action-summary { font-size: 14px; color: #3e4c59; flex: none; }
.action-bar .primary-btn { flex: 1; }

.warn-card { border-left: 4px solid #f5a623; }
.plain-list li { padding: 6px 0; font-size: 14px; border-bottom: 1px solid #f0f2f4; }
</style>
