export const assetTypes = {
  device: 'IoT device',
  vehicle: 'Vehicle',
  facility: 'Facility',
}

export const assetStatuses = {
  active: 'Active',
  maintenance: 'Maintenance',
  inactive: 'Inactive',
}

export const locationFields = [
  ['district', 'District'],
  ['city', 'City / Regency'],
  ['province', 'Province'],
] as const

export type LocationDetails = Record<(typeof locationFields)[number][0], string>
export const emptyLocationDetails: LocationDetails = { district: '', city: '', province: '' }

export type AssetType = keyof typeof assetTypes
export type AssetStatus = keyof typeof assetStatuses
export type AssetInput = LocationDetails & {
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
    district: asset?.district ?? '',
    city: asset?.city ?? '',
    province: asset?.province ?? '',
  }
}

export function readCoordinate(value: string, limit: number): number | undefined {
  const normalized = value.trim().replace(/−/g, '-').replace(',', '.')
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return
  const coordinate = Number(normalized)
  if (Number.isFinite(coordinate) && Math.abs(coordinate) <= limit) return coordinate
}

export function formatCoordinate(value: number) {
  return value.toLocaleString('en-US', { maximumSignificantDigits: 16, useGrouping: false })
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
    throw new ApiError('Could not connect to the server. Check your connection and try again.')
  }

  if (!response.ok) {
    const payload: { message?: string; fields?: FieldErrors } | null =
      await response.json().catch(() => null)
    throw new ApiError(payload?.message ?? 'The request failed. Try again.', payload?.fields)
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
