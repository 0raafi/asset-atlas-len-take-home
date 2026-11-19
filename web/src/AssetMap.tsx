import { divIcon, DomEvent, type LatLngTuple } from 'leaflet'
import {
  Alert02Icon, Gps01Icon, Location01Icon, MinusSignIcon, PlusSignIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { Button } from '@/components/ui/button'
import { MapLocationSearch } from './MapLocationSearch'
import { assetTypes, formatCoordinate, latitudeLimit, type Asset, type AssetType, type LocationDetails } from './assets'
import type { MapPlace } from './mapPlaces'

const home: LatLngTuple = [-6.911, 107.616]
const homeZoom = 13
const bounds: [LatLngTuple, LatLngTuple] = [[-latitudeLimit, -180], [latitudeLimit, 180]]
const tileUrl = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'

function pin(type: AssetType | 'draft', selected = false) {
  return divIcon({
    className: 'map-pin-shell',
    iconSize: [40, 44],
    iconAnchor: [20, 42],
    html: `<span class="map-pin map-pin--${type}${selected ? ' map-pin--selected' : ''}"><span></span></span>`,
  })
}

const pins = {
  device: [pin('device'), pin('device', true)],
  vehicle: [pin('vehicle'), pin('vehicle', true)],
  facility: [pin('facility'), pin('facility', true)],
}
const draftPin = pin('draft', true)
const placePin = divIcon({ className: 'map-place-pin', iconSize: [18, 18] })

function MapInteraction({ selected, place, picking, onPick }: {
  selected?: Asset
  place?: MapPlace
  picking: boolean
  onPick: (location: LatLngTuple) => void
}) {
  const map = useMapEvents({
    click(event) {
      if (!picking) return
      const { lat, lng } = event.latlng.wrap()
      const latitude = Math.min(latitudeLimit, Math.max(-latitudeLimit, Number(lat.toFixed(6))))
      onPick([latitude, Number(lng.toFixed(6))])
    },
  })
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false, debounceMoveend: true })
    })
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  const latitude = selected?.latitude
  const longitude = selected?.longitude

  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined) {
      map.panTo([latitude, longitude], { animate: false })
    }
  }, [latitude, longitude, map, selected?.id])

  useEffect(() => {
    if (place) map.setView(place.location, Math.max(map.getZoom(), 15), { animate: false })
  }, [map, place])

  return null
}

function MapControls() {
  const map = useMap()
  const controls = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  useEffect(() => {
    const node = controls.current
    if (!node) return
    DomEvent.disableClickPropagation(node)
    DomEvent.disableScrollPropagation(node)
    return () => { DomEvent.off(node) }
  }, [])

  return (
    <div ref={controls} className="map-controls" role="group" aria-label="Map controls">
      <Button variant="outline" size="icon" title="Reset map to Bandung" aria-label="Reset map to Bandung"
        onClick={() => map.setView(home, homeZoom, { animate: false })}>
        <HugeiconsIcon icon={Gps01Icon} aria-hidden="true" />
      </Button>
      <div className="zoom-controls">
        <Button variant="outline" size="icon" title="Zoom in" aria-label="Zoom in"
          disabled={zoom >= map.getMaxZoom()} onClick={() => map.zoomIn()}>
          <HugeiconsIcon icon={PlusSignIcon} aria-hidden="true" />
        </Button>
        <Button variant="outline" size="icon" title="Zoom out" aria-label="Zoom out"
          disabled={zoom <= map.getMinZoom()} onClick={() => map.zoomOut()}>
          <HugeiconsIcon icon={MinusSignIcon} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

export function AssetMap({
  assets, selected, draftLocation, picking, onPick, onSelect, onFinishPicking, detail, notice,
}: {
  assets: Asset[]
  selected?: Asset
  draftLocation?: LatLngTuple
  picking: boolean
  onPick: (location: LatLngTuple, details?: LocationDetails) => void
  onSelect: (asset: Asset) => void
  onFinishPicking: (location?: LatLngTuple) => void
  detail: ReactNode
  notice: ReactNode
}) {
  const [tileFailed, setTileFailed] = useState(false)
  const [place, setPlace] = useState<MapPlace>()
  const mapRegion = useRef<HTMLElement>(null)
  const pickerTitle = useRef<HTMLHeadingElement>(null)
  const currentLoadFailed = useRef(false)
  const showDraft = draftLocation && (draftLocation[0] !== selected?.latitude || draftLocation[1] !== selected?.longitude)

  return (
    <section ref={mapRegion} id="asset-map" className="map-frame" data-picking={picking}
      aria-label="Asset locations" tabIndex={-1}>
      <div className="map-viewport">
        <MapContainer
          className="map-surface"
          center={home}
          zoom={homeZoom}
          minZoom={2}
          maxZoom={19}
          maxBounds={bounds}
          maxBoundsViscosity={0.85}
          zoomControl={false}
        >
          <TileLayer url={tileUrl} attribution={tileAttribution} noWrap eventHandlers={{
            loading: () => { currentLoadFailed.current = false },
            tileerror: () => { currentLoadFailed.current = true },
            load: () => setTileFailed(currentLoadFailed.current),
          }} />
          <MapInteraction selected={selected} place={place} picking={picking} onPick={onPick} />
          {assets.map((asset) => (
            <Marker
              key={`${asset.id}:${asset.type}:${asset.name}`}
              title={`${asset.name}, ${assetTypes[asset.type]}`}
              position={[asset.latitude, asset.longitude]}
              icon={pins[asset.type][Number(asset.id === selected?.id)]}
              zIndexOffset={asset.id === selected?.id ? 300 : 0}
              eventHandlers={{
                click: () => onSelect(asset),
                keydown: ({ originalEvent }) => {
                  if (originalEvent.key !== 'Enter' && originalEvent.key !== ' ') return
                  originalEvent.preventDefault()
                  if (!originalEvent.repeat) onSelect(asset)
                },
              }}
            />
          ))}
          {showDraft && (
            <Marker position={draftLocation} icon={draftPin} title="Draft location"
              keyboard={false} interactive={false} zIndexOffset={600} />
          )}
          {place && !picking && !draftLocation && (
            <Marker key={`${place.name}:${place.location.join(',')}`}
              position={place.location} icon={placePin} title={place.name}
              keyboard={false} interactive={false} zIndexOffset={400}>
              <Tooltip direction="top" permanent offset={[0, -12]} className="map-place-label">{place.name}</Tooltip>
            </Marker>
          )}
          <MapControls />
        </MapContainer>
        <div className="map-top">
          <MapLocationSearch onSelect={(result) => {
            setPlace({ ...result })
            if (picking) onPick(result.location, result.details)
            const destination = picking ? pickerTitle.current : mapRegion.current
            destination?.focus({ preventScroll: true })
          }} />
          <ul className="map-legend" aria-label="Asset type legend">
            {Object.entries(assetTypes).map(([type, label]) => (
              <li key={type}><span className={`legend-dot legend-dot--${type}`} />{label}</li>
            ))}
          </ul>
          <div className="map-messages" role="status">
            {notice}
            {tileFailed && (
              <p className="map-warning">
                <HugeiconsIcon icon={Alert02Icon} size={16} aria-hidden="true" />
                Some map tiles could not load.
              </p>
            )}
          </div>
        </div>
        {detail}
        {picking && (
          <section className="location-picker" aria-labelledby="location-picker-title">
            <header>
              <HugeiconsIcon icon={Location01Icon} size={19} aria-hidden="true" />
              <h2 ref={pickerTitle} id="location-picker-title" tabIndex={-1}>Select an asset location</h2>
            </header>
            <p role="status">{draftLocation
              ? `${formatCoordinate(draftLocation[0])}°, ${formatCoordinate(draftLocation[1])}°`
              : 'Click or tap the map to preview a point.'}</p>
            <div className="location-picker-actions">
              <Button variant="outline" onClick={() => onFinishPicking()}>Back to form</Button>
              <Button disabled={!draftLocation} onClick={() => onFinishPicking(draftLocation)}>Use location</Button>
            </div>
          </section>
        )}
      </div>
    </section>
  )
}
