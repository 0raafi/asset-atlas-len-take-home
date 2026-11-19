import type { LatLngTuple } from 'leaflet'
import { latitudeLimit, type LocationDetails } from './assets'

const endpoint = import.meta.env.VITE_GEOCODING_URL || 'https://photon.komoot.io/api/'

export type MapPlace = {
  name: string
  context: string
  location: LatLngTuple
  details: LocationDetails
}

type PhotonFeature = {
  geometry?: { type?: string; coordinates?: unknown[] }
  properties?: Record<string, unknown> | null
}

function readPlace(feature: PhotonFeature): MapPlace | undefined {
  const { geometry } = feature
  const properties = feature.properties ?? {}
  if (geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates)) return

  const [lng, lat] = geometry.coordinates
  if (typeof lat !== 'number' || Math.abs(lat) > latitudeLimit || !Number.isFinite(lat) ||
      typeof lng !== 'number' || Math.abs(lng) > 180 || !Number.isFinite(lng)) return

  const text = (key: string) => typeof properties[key] === 'string' ? properties[key].trim() : ''
  const address = [text('street'), text('housenumber')].filter(Boolean).join(' ')
  const placeName = text('name')
  const type = text('type')
  const district = text('district')
  const city = text('city')
  const county = text('county')
  const state = text('state')
  const labels = [placeName, address, district, city, county, state, text('country')]
  const [name, ...context] = [...new Set(labels.filter(Boolean))]
  if (!name) return
  return {
    name,
    context: context.join(', '),
    location: [lat, lng],
    details: {
      district: (type === 'district' && placeName) || district,
      city: ((type === 'city' || type === 'county') && placeName) || city || county,
      province: (type === 'state' && placeName) || state,
    },
  }
}

export async function findMapPlaces(query: string, signal: AbortSignal): Promise<MapPlace[]> {
  const url = new URL(endpoint, window.location.origin)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '5')
  const response = await fetch(url, {
    credentials: 'omit',
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  })
  if (!response.ok) throw new Error('Location search failed')

  const data: { features?: PhotonFeature[] } | null = await response.json()
  if (!Array.isArray(data?.features)) throw new Error('Invalid location search response')

  const places = new Map<string, MapPlace>()
  for (const feature of data.features.slice(0, 5)) {
    if (!feature) continue
    const place = readPlace(feature)
    if (!place) continue
    const label = `${place.name}\n${place.context}`
    if (!places.has(label)) places.set(label, place)
  }
  return [...places.values()]
}
