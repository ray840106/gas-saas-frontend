/**
 * 客戶地址簿 API
 * 對應後端 gas-saas-backend 的 /api/customers/*
 */

import { request } from './base'

export interface SavedAddress {
  id: number | string | null
  lineUid: string | null
  label: string
  address: string
  lat: number | null
  lng: number | null
  isDefault: boolean
  lastUsedAt: string | null
  createdAt: string | null
  /** address-book：已存進地址簿；order-history：從過去訂單找到的 */
  source: 'address-book' | 'order-history' | 'not-persisted'
}

export interface AddressVerifyResult {
  verified: boolean
  address?: string
  formattedAddress?: string
  lat?: number
  lng?: number
  reason?: string
}

/** 取得這位客戶的常用地址（含從歷史訂單找到的） */
export function fetchAddresses(lineUid: string): Promise<SavedAddress[]> {
  return request<SavedAddress[]>(`/api/customers/${encodeURIComponent(lineUid)}/addresses`)
}

/** 存一筆新地址（預設同時設為下次要帶出的地址） */
export function saveAddress(
  lineUid: string,
  payload: { address: string; label?: string; setDefault?: boolean }
): Promise<SavedAddress | null> {
  return request<SavedAddress | null>(`/api/customers/${encodeURIComponent(lineUid)}/addresses`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

/** 把某一筆設成預設地址 */
export function setDefaultAddress(
  lineUid: string,
  id: number | string
): Promise<SavedAddress | null> {
  return request<SavedAddress | null>(
    `/api/customers/${encodeURIComponent(lineUid)}/addresses/${id}`,
    { method: 'PATCH', body: JSON.stringify({ isDefault: true }) }
  )
}

/** 刪除一筆常用地址 */
export function deleteAddress(lineUid: string, id: number | string): Promise<unknown> {
  return request<unknown>(`/api/customers/${encodeURIComponent(lineUid)}/addresses/${id}`, {
    method: 'DELETE'
  })
}

/** 檢查地址在地圖上是否找得到，避免客戶打錯字 */
export function verifyAddress(address: string): Promise<AddressVerifyResult> {
  return request<AddressVerifyResult>('/api/customers/address/verify', {
    method: 'POST',
    body: JSON.stringify({ address })
  })
}
