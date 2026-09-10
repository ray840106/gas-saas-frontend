/**
 * 送貨路線 API 的前端介接層
 * 對應後端 gas-saas-backend 的 /api/delivery/*
 */

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'https://gas-saas-backend.onrender.com'

export interface DeliveryOrder {
  id: number | string
  lineUid: string | null
  customerName: string
  phone: string | null
  address: string
  gasWeight: string
  quantity: number
  status: string
  note: string | null
  createdAt: string | null
  lat: number | null
  lng: number | null
}

export interface RouteStop {
  seq: number
  customerName: string
  phone: string | null
  address: string
  formattedAddress: string
  lat: number
  lng: number
  orderIds: Array<number | string>
  orders: DeliveryOrder[]
  items: Array<{ gasWeight: string; quantity: number }>
  totalCylinders: number
  distanceFromPrevKm: number | null
  etaMinutes: number
  navigationUrl: string
}

export interface RoutePlan {
  origin: { lat: number; lng: number; address?: string; label?: string }
  provider: string
  returnToOrigin: boolean
  stops: RouteStop[]
  unresolved: Array<{
    address: string
    customerName: string
    orderIds: Array<number | string>
    reason: string
  }>
  googleMapsUrls: Array<{
    index: number
    url: string
    fromLabel: string
    toLabel: string
    stopCount: number
  }>
  summary: {
    stopCount: number
    orderCount: number
    unresolvedCount?: number
    totalDistanceKm: number
    estimatedMinutes: number
    totalCylinders: number
  }
  message?: string
}

export interface DeliveryConfig {
  depot: { lat: number | null; lng: number | null; address: string; label: string } | null
  geocoder: string
  googleDirections: boolean
  maxWaypointsPerLink: number
  ordersTable: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success === false) {
    throw new Error(body.message || `伺服器回應 ${response.status}`)
  }
  return body.data as T
}

/** 取得起點預設值與地圖服務資訊 */
export function fetchDeliveryConfig(): Promise<DeliveryConfig> {
  return request<DeliveryConfig>('/api/delivery/config')
}

/** 取得可以排路線的訂單（預設只回未完成的） */
export function fetchDeliveryOrders(params: { date?: string } = {}): Promise<DeliveryOrder[]> {
  const query = new URLSearchParams()
  if (params.date) query.set('date', params.date)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<DeliveryOrder[]>(`/api/delivery/orders${suffix}`)
}

/** 排出最佳送貨順序 */
export function planRoute(payload: {
  orderIds?: Array<number | string>
  origin?: { lat?: number; lng?: number; address?: string; label?: string }
  returnToOrigin?: boolean
  date?: string
}): Promise<RoutePlan> {
  return request<RoutePlan>('/api/delivery/route', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

/** 回報單一訂單的配送狀態 */
export function updateOrderStatus(
  orderId: number | string,
  status: 'pending' | 'delivering' | 'completed' | 'cancelled'
): Promise<DeliveryOrder[]> {
  return request<DeliveryOrder[]>(`/api/delivery/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  })
}

/** 取得手機目前位置，讓路線從師傅現在的地方開始排 */
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('這台裝置不支援定位功能'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(new Error(`無法取得目前位置：${error.message}`)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  })
}
