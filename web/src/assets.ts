export const assetTypes = {
  device: 'Perangkat IoT',
  vehicle: 'Kendaraan',
  facility: 'Fasilitas',
}

export const assetStatuses = {
  active: 'Aktif',
  maintenance: 'Perawatan',
  inactive: 'Nonaktif',
}

export type AssetType = keyof typeof assetTypes
export type AssetStatus = keyof typeof assetStatuses
export type AssetInput = {
  name: string
  type: AssetType
  status: AssetStatus
  latitude: number
  longitude: number
}
export type Asset = AssetInput & { id: number }
export type Draft = Omit<AssetInput, 'latitude' | 'longitude'> & {
  latitude: string
  longitude: string
}
export type FieldErrors = Partial<Record<keyof Draft, string>>

export const latitudeLimit = 85.05112878

export function makeDraft(asset?: Asset): Draft {
  return {
    name: asset?.name ?? '',
    type: asset?.type ?? 'device',
    status: asset?.status ?? 'active',
    latitude: asset ? String(asset.latitude) : '',
    longitude: asset ? String(asset.longitude) : '',
  }
}

export function readCoordinate(value: string, limit: number): number | undefined {
  const normalized = value.trim().replace(/−/g, '-').replace(',', '.')
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return
  const coordinate = Number(normalized)
  if (Number.isFinite(coordinate) && Math.abs(coordinate) <= limit) return coordinate
}

export function formatCoordinate(value: number) {
  return value.toLocaleString('id-ID', { maximumSignificantDigits: 16, useGrouping: false })
}

export class ApiError extends Error {
  constructor(message: string, readonly fields?: FieldErrors) {
    super(message)
  }
}

async function request(path: string, options?: RequestInit) {
  let response: Response
  try {
    response = await fetch(`/api/assets${path}`, options)
  } catch (error) {
    if (options?.signal?.aborted) throw error
    throw new ApiError('API tidak dapat dihubungi. Periksa koneksi lalu coba lagi.')
  }

  if (!response.ok) {
    const payload: { message?: string; fields?: FieldErrors } | null =
      await response.json().catch(() => null)
    throw new ApiError(payload?.message ?? 'Permintaan gagal. Coba lagi.', payload?.fields)
  }
  return response
}

export async function listAssets(signal: AbortSignal): Promise<Asset[]> {
  const response = await request('', { signal })
  return response.json()
}

export async function saveAsset(input: AssetInput, id?: number): Promise<Asset> {
  const response = await request(id === undefined ? '' : `/${id}`, {
    method: id === undefined ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return response.json()
}

export async function deleteAsset(id: number) {
  await request(`/${id}`, { method: 'DELETE' })
}
