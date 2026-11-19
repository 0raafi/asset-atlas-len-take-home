import type { LatLngTuple } from 'leaflet'
import { Check, LocateFixed, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AssetForm } from './AssetForm'
import { AssetMap } from './AssetMap'
import { AssetDetail, AssetList, PanelFooter } from './AssetPanel'
import {
  deleteAsset, latitudeLimit, listAssets, makeDraft, readCoordinate, saveAsset,
  type Asset, type AssetInput,
} from './assets'

type View = { kind: 'list' } | { kind: 'detail'; id: number } | { kind: 'editor'; asset?: Asset }

export function App() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [load, setLoad] = useState({ pending: true, error: '' })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [draft, setDraft] = useState(makeDraft)
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const panel = useRef<HTMLElement>(null)
  const focusPanel = useRef(false)

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
    if (!focusPanel.current) return
    focusPanel.current = false
    panel.current?.querySelector('h2')?.focus()
  }, [view])

  const selected = view.kind === 'detail' ? assets.find((asset) => asset.id === view.id) : undefined
  const latitude = readCoordinate(draft.latitude, latitudeLimit)
  const longitude = readCoordinate(draft.longitude, 180)
  const draftLocation: LatLngTuple | undefined = view.kind === 'editor' &&
    latitude !== undefined && longitude !== undefined ? [latitude, longitude] : undefined

  function navigate(next: View) {
    focusPanel.current = true
    setNotice('')
    setView(next)
  }

  function openEditor(asset?: Asset) {
    setDraft(makeDraft(asset))
    setPicking(!asset)
    navigate({ kind: 'editor', asset })
  }

  function selectLocation([lat, lng]: LatLngTuple) {
    if (view.kind !== 'editor' || !picking || saving) return
    setDraft((current) => ({ ...current, latitude: String(lat), longitude: String(lng) }))
    setPicking(false)
    panel.current?.querySelector<HTMLInputElement>('[name="name"]')?.focus()
  }

  function selectAsset(asset: Asset) {
    if (view.kind === 'editor') {
      selectLocation([asset.latitude, asset.longitude])
      return
    }
    navigate({ kind: 'detail', id: asset.id })
  }

  async function persist(input: AssetInput) {
    if (view.kind !== 'editor' || saving) return
    const id = view.asset?.id
    setSaving(true)
    try {
      const saved = await saveAsset(input, id)
      setAssets((current) => id === undefined
        ? [...current, saved]
        : current.map((asset) => asset.id === id ? saved : asset))
      setPicking(false)
      navigate({ kind: 'detail', id: saved.id })
      setNotice(id === undefined ? 'Asset added.' : 'Changes saved.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(asset: Asset) {
    await deleteAsset(asset.id)
    setAssets((current) => current.filter((entry) => entry.id !== asset.id))
    navigate({ kind: 'list' })
    setNotice('Asset deleted.')
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand"><span className="brand-icon"><LocateFixed size={20} aria-hidden="true" /></span>Asset Atlas</div>
          <button className="button button--primary add-button" type="button"
            disabled={load.pending || Boolean(load.error) || view.kind === 'editor'} onClick={() => openEditor()}>
            <Plus size={19} aria-hidden="true" /> Add asset
          </button>
        </div>
      </header>
      <main className="workspace">
        <div className="workspace-heading">
          <h1>Asset map</h1>
          <div className="notice-region" role="status">
            {notice && <span className="notice"><Check size={16} aria-hidden="true" /> {notice}</span>}
          </div>
        </div>
        <div className="workspace-grid">
          <aside className="asset-panel" aria-label="Asset management" ref={panel}>
            {view.kind === 'list' && (
              <>
                <AssetList assets={assets} loading={load.pending} error={load.error}
                  onAdd={() => openEditor()} onSelect={selectAsset} onRetry={() => {
                    setLoad({ pending: true, error: '' })
                    setLoadAttempt((count) => count + 1)
                  }} />
                {assets.length > 0 && <PanelFooter />}
              </>
            )}
            {selected && <AssetDetail key={selected.id} asset={selected} onBack={() => navigate({ kind: 'list' })}
              onEdit={() => openEditor(selected)} onDelete={() => remove(selected)} />}
            {view.kind === 'editor' && (
              <AssetForm draft={draft} editing={view.asset !== undefined} saving={saving} picking={picking}
                onChange={setDraft} onSave={persist} onPickToggle={() => {
                  setPicking(!picking)
                  if (!picking) document.getElementById('asset-map')?.scrollIntoView({ block: 'nearest' })
                }}
                onCancel={() => {
                  setPicking(false)
                  navigate(view.asset ? { kind: 'detail', id: view.asset.id } : { kind: 'list' })
                }} />
            )}
          </aside>
          <AssetMap assets={assets} selected={selected} draftLocation={draftLocation} picking={picking && !saving}
            onPick={selectLocation} onSelect={selectAsset} />
        </div>
      </main>
    </>
  )
}
