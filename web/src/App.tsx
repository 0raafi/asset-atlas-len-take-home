import { CheckmarkCircle02Icon, Compass01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { LatLngTuple } from 'leaflet'
import { lazy, Suspense, useEffect, useRef, useState, type ComponentRef } from 'react'
import { PlusSignIcon } from '@/components/icons/plus-sign'
import { Button } from '@/components/ui/button'
import { AssetForm } from './AssetForm'
import { AssetDetail, AssetList, type AssetFilters } from './AssetPanel'
import {
  deleteAsset, emptyLocationDetails, latitudeLimit, listAssets, makeDraft, readCoordinate, saveAsset,
  type Asset, type AssetInput, type LocationDetails,
} from './assets'

const emptyFilters: AssetFilters = { type: '', status: '' }
const AssetMap = lazy(() => import('./AssetMap').then(({ AssetMap }) => ({ default: AssetMap })))

function matchesFilters(asset: Asset, filters: AssetFilters) {
  return (!filters.type || asset.type === filters.type) && (!filters.status || asset.status === filters.status)
}

export function App() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [load, setLoad] = useState({ pending: true, error: '' })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [selectedId, setSelectedId] = useState<number>()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [expanded, setExpanded] = useState(false)
  const [editor, setEditor] = useState<{ asset?: Asset }>()
  const [draft, setDraft] = useState(makeDraft)
  const [picker, setPicker] = useState<{ location?: LatLngTuple; details?: LocationDetails }>()
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const pendingSave = useRef(false)
  const focusTarget = useRef<string[]>([])
  const addIcon = useRef<ComponentRef<typeof PlusSignIcon>>(null)

  useEffect(() => {
    const controller = new AbortController()
    listAssets(controller.signal).then((items) => {
      if (controller.signal.aborted) return
      setAssets(items)
      setLoad({ pending: false, error: '' })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setLoad({ pending: false, error: error instanceof Error ? error.message : 'Could not load assets.' })
    })
    return () => controller.abort()
  }, [loadAttempt])

  useEffect(() => {
    const destinations = focusTarget.current
    if (!destinations.length) return
    focusTarget.current = []
    for (const id of destinations) {
      const element = document.getElementById(id)
      if (element?.getClientRects().length) {
        element.focus({ preventScroll: true })
        break
      }
    }
  }, [editor, expanded, picker, selectedId])

  const selected = assets.find((asset) => asset.id === selectedId)
  const visibleAssets = assets.filter((asset) => matchesFilters(asset, filters))
  const latitude = readCoordinate(draft.latitude, latitudeLimit)
  const longitude = readCoordinate(draft.longitude, 180)
  const draftLocation: LatLngTuple | undefined = editor && latitude !== undefined && longitude !== undefined
    ? [latitude, longitude] : undefined

  function openEditor(asset?: Asset) {
    focusTarget.current = ['asset-editor-title']
    setDraft(makeDraft(asset))
    setEditor({ asset })
    setNotice('')
  }

  function startPicking() {
    focusTarget.current = ['location-picker-title']
    setPicker({ location: draftLocation })
  }

  function previewLocation(location: LatLngTuple, details?: LocationDetails) {
    setPicker((current) => current && { location, details })
  }

  function finishPicking(location?: LatLngTuple) {
    if (location) {
      const [lat, lng] = location
      const details = picker?.details
      setDraft((current) => {
        const samePoint = readCoordinate(current.latitude, latitudeLimit) === lat &&
          readCoordinate(current.longitude, 180) === lng
        const fallback = samePoint ? current : emptyLocationDetails
        return {
          ...current,
          latitude: String(lat),
          longitude: String(lng),
          district: details?.district || fallback.district,
          city: details?.city || fallback.city,
          province: details?.province || fallback.province,
        }
      })
    }
    focusTarget.current = ['choose-location']
    setPicker(undefined)
  }

  function selectAsset(asset: Asset) {
    if (picker) {
      const { district, city, province } = asset
      previewLocation([asset.latitude, asset.longitude], { district, city, province })
      return
    }
    if (editor) return

    if (asset.id === selectedId && !expanded) {
      document.getElementById('asset-detail-title')?.focus({ preventScroll: true })
      return
    }

    focusTarget.current = ['asset-detail-title']
    setSelectedId(asset.id)
    setExpanded(false)
    setNotice('')
  }

  function closeDetails() {
    focusTarget.current = [`asset-row-${selectedId}`, 'asset-list-toggle', 'asset-list-title']
    setSelectedId(undefined)
  }

  function updateFilters(next: AssetFilters) {
    setFilters(next)
    if (selected && !matchesFilters(selected, next)) setSelectedId(undefined)
  }

  function cancelEditor() {
    focusTarget.current = editor?.asset ? ['asset-detail-title'] : ['add-asset']
    setEditor(undefined)
  }

  async function persist(input: AssetInput) {
    if (!editor || pendingSave.current) return
    const id = editor.asset?.id
    pendingSave.current = true
    setSaving(true)
    try {
      const saved = await saveAsset(input, id)
      setAssets((current) => id === undefined
        ? [...current, saved]
        : current.map((asset) => asset.id === id ? saved : asset))
      setFilters((current) => ({
        type: current.type === saved.type ? current.type : '',
        status: current.status === saved.status ? current.status : '',
      }))
      focusTarget.current = ['asset-detail-title']
      setSelectedId(saved.id)
      setExpanded(false)
      setEditor(undefined)
      setNotice(id === undefined ? 'Asset added.' : 'Changes saved.')
    } finally {
      pendingSave.current = false
      setSaving(false)
    }
  }

  async function remove(asset: Asset) {
    await deleteAsset(asset.id)
    setAssets((current) => current.filter((entry) => entry.id !== asset.id))
    closeDetails()
    setNotice('Asset deleted.')
  }

  return (
    <>
      <header className="topbar">
        <div className="brand"><span className="brand-icon">
          <HugeiconsIcon icon={Compass01Icon} size={20} aria-hidden="true" />
        </span><span>Asset Atlas</span></div>
        <h1>Asset map</h1>
        {!editor && !load.pending && !load.error && (
          <Button id="add-asset" className="add-button"
            onMouseEnter={() => addIcon.current?.startAnimation()} onClick={() => openEditor()}>
            <PlusSignIcon ref={addIcon} size={17} aria-hidden="true" /> Add asset
          </Button>
        )}
      </header>
      <main className="workspace" data-expanded={expanded} data-editing={Boolean(editor)} data-picking={Boolean(picker)}>
        <aside className="asset-rail" aria-label="Asset management">
          <div className="inventory-panel" hidden={Boolean(editor)}>
            <AssetList assets={visibleAssets} total={assets.length} loading={load.pending} error={load.error}
              search={search} filters={filters} selectedId={selectedId} expanded={expanded}
              onToggle={() => setExpanded((value) => !value)} onSearch={setSearch} onFilter={updateFilters}
              onReset={() => { setSearch(''); setFilters(emptyFilters) }} onAdd={() => openEditor()}
              onRetry={() => {
                setLoad({ pending: true, error: '' })
                setLoadAttempt((count) => count + 1)
              }}
              onSelect={selectAsset} />
          </div>
          {editor && (
            <div className="editor-panel" hidden={Boolean(picker)}>
              <AssetForm draft={draft} editing={Boolean(editor.asset)} saving={saving}
                onChange={setDraft} onSave={persist} onStartPicking={startPicking} onCancel={cancelEditor} />
            </div>
          )}
        </aside>
        <Suspense fallback={<div className="map-frame map-loading" role="status">Loading map…</div>}>
          <AssetMap assets={visibleAssets} selected={editor && !editor.asset ? undefined : selected}
            draftLocation={picker ? picker.location : draftLocation}
            picking={Boolean(picker)} onPick={previewLocation} onSelect={selectAsset} onFinishPicking={finishPicking}
            detail={selected && !editor && (
              <AssetDetail key={selected.id} asset={selected} onClose={closeDetails}
                onEdit={() => openEditor(selected)} onDelete={() => remove(selected)} />
            )}
            notice={notice && (
              <span className="notice">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={17} aria-hidden="true" />{notice}
              </span>
            )} />
        </Suspense>
      </main>
    </>
  )
}
