/**
 * 後端 API 的共用設定
 * 網址一律讀 Vite 環境變數 VITE_API_BASE_URL（見 .env.production）
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'https://gas-saas-backend.onrender.com'

/** 統一處理 { success, data, message } 格式的回應 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
