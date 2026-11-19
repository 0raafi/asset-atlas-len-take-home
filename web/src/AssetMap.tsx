import { divIcon, DomEvent, type LatLngTuple } from 'leaflet'
import { Crosshair, MapPin, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { assetTypes, latitudeLimit, type Asset, type AssetType } from './assets'

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

function MapInteraction({ selected, picking, onPick }: {
  selected?: Asset
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
  const latitude = selected?.latitude
  const longitude = selected?.longitude

  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined) {
      map.panTo([latitude, longitude], { animate: false })
    }
  }, [latitude, longitude, map, selected?.id])

  return null
}

function MapControls() {
  const map = useMap()
  const controls = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const buttonIcon = { size: 17, strokeWidth: 1.9, 'aria-hidden': true } as const
  useEffect(() => {
    const node = controls.current
    if (!node) return
    DomEvent.disableClickPropagation(node)
    DomEvent.disableScrollPropagation(node)
    return () => { DomEvent.off(node) }
  }, [])

  return (
    <div ref={controls} className="map-controls" role="group" aria-label="Map controls">
      <button type="button" title="Reset map to Bandung" aria-label="Reset map to Bandung"
        onClick={() => map.setView(home, homeZoom, { animate: false })}>
        <Crosshair {...buttonIcon} />
      </button>
      <div className="zoom-controls">
        <button type="button" title="Zoom in" aria-label="Zoom in"
          disabled={zoom >= map.getMaxZoom()} onClick={() => map.zoomIn()}>
          <Plus {...buttonIcon} />
        </button>
        <button type="button" title="Zoom out" aria-label="Zoom out"
          disabled={zoom <= map.getMinZoom()} onClick={() => map.zoomOut()}>
          <Minus {...buttonIcon} />
        </button>
      </div>
    </div>
  )
}

export function AssetMap({ assets, selected, draftLocation, picking, onPick, onSelect }: {
  assets: Asset[]
  selected?: Asset
  draftLocation?: LatLngTuple
  picking: boolean
  onPick: (location: LatLngTuple) => void
  onSelect: (asset: Asset) => void
}) {
  const [tileFailed, setTileFailed] = useState(false)
  const currentLoadFailed = useRef(false)

  return (
    <section id="asset-map" className="map-frame" aria-label="Asset locations">
      <MapContainer
        className={picking ? 'map-surface map-surface--picking' : 'map-surface'}
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
        <MapInteraction selected={selected} picking={picking} onPick={onPick} />
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
        {draftLocation && (
          <Marker position={draftLocation} icon={draftPin} title="Draft location"
            keyboard={false} interactive={false} zIndexOffset={600} />
        )}
        <MapControls />
      </MapContainer>
      {picking && (
        <p className="map-hint"><MapPin size={17} aria-hidden="true" /> Select an asset location</p>
      )}
      {tileFailed && (
        <p className="map-warning">Some map tiles could not load. You can still manage asset locations.</p>
      )}
      <ul className="map-legend" aria-label="Asset type legend">
        {Object.entries(assetTypes).map(([type, label]) => (
          <li key={type}><span className={`legend-dot legend-dot--${type}`} />{label}</li>
        ))}
      </ul>
    </section>
  )
}
