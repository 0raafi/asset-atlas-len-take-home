import { ChevronLeft, ChevronRight, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { AssetIcon } from './AssetIcon'
import { assetStatuses, assetTypes, formatCoordinate, type Asset, type AssetStatus } from './assets'

function Status({ status }: { status: AssetStatus }) {
  return (
    <span className={`status-label status-label--${status}`}>
      <span aria-hidden="true" />
      {assetStatuses[status]}
    </span>
  )
}

export function AssetList({ assets, loading, error, onRetry, onAdd, onSelect }: {
  assets: Asset[]
  loading: boolean
  error: string
  onRetry: () => void
  onAdd: () => void
  onSelect: (asset: Asset) => void
}) {
  return (
    <>
      <div className="panel-heading">
        <h2 tabIndex={-1}>Assets</h2>
        {!loading && !error && (
          <span className="count-label">{assets.length} {assets.length === 1 ? 'asset' : 'assets'}</span>
        )}
      </div>
      <div className="panel-body asset-list-body">
        {loading && <p className="panel-message" role="status">Loading assets…</p>}
        {error && (
          <div className="panel-message">
            <p role="alert">{error}</p>
            <button className="button button--secondary" type="button" onClick={onRetry}>Try again</button>
          </div>
        )}
        {!loading && !error && (
          assets.length ? (
            <ul className="asset-list">
              {assets.map((asset) => (
                <li key={asset.id}>
                  <button className="asset-row" type="button" onClick={() => onSelect(asset)}>
                    <AssetIcon type={asset.type} />
                    <span className="asset-row-copy">
                      <strong>{asset.name}</strong>
                      <span>{assetTypes[asset.type]}</span>
                    </span>
                    <Status status={asset.status} />
                    <ChevronRight size={15} aria-hidden="true" className="asset-row-arrow" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <span className="empty-icon"><MapPin size={23} aria-hidden="true" /></span>
              <h3>No assets yet</h3>
              <p>Add your first asset and set its location on the map.</p>
              <button className="button button--secondary" type="button" onClick={onAdd}>
                <Plus size={17} aria-hidden="true" /> Add asset
              </button>
            </div>
          )
        )}
      </div>
    </>
  )
}

export function AssetDetail({ asset, onBack, onEdit, onDelete }: {
  asset: Asset
  onBack: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function confirmDelete() {
    if (deleting) return
    setDeleting(true)
    setError('')
    try {
      await onDelete()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete the asset. Try again.')
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="panel-heading panel-heading--stack">
        <button type="button" className="text-button" onClick={onBack}>
          <ChevronLeft size={17} aria-hidden="true" /> All assets
        </button>
        <h2 tabIndex={-1}>Asset details</h2>
      </div>
      <div className="panel-body asset-detail">
        <div className="detail-identity">
          <AssetIcon type={asset.type} />
          <div>
            <span className="detail-id">Asset #{asset.id}</span>
            <h3>{asset.name}</h3>
          </div>
        </div>
        <dl className="detail-fields">
          <div><dt>Type</dt><dd>{assetTypes[asset.type]}</dd></div>
          <div><dt>Status</dt><dd><Status status={asset.status} /></dd></div>
          <div>
            <dt>Location</dt>
            <dd className="detail-location">
              <MapPin size={16} aria-hidden="true" />
              <span>{formatCoordinate(asset.latitude)}° / {formatCoordinate(asset.longitude)}°</span>
            </dd>
          </div>
        </dl>
        <div className="detail-actions">
          <button className="button button--primary" type="button" onClick={onEdit}>
            <Pencil size={16} aria-hidden="true" /> Edit asset
          </button>
          <button className="button button--danger-outline" type="button" onClick={() => {
            setError('')
            dialog.current?.showModal()
          }}>
            <Trash2 size={16} aria-hidden="true" /> Delete asset
          </button>
        </div>
      </div>
      <dialog ref={dialog} className="delete-dialog" aria-labelledby="delete-title" aria-describedby="delete-description"
        onCancel={(event) => { if (deleting) event.preventDefault() }}>
        <span className="delete-icon"><Trash2 size={22} aria-hidden="true" /></span>
        <h2 id="delete-title">Delete asset?</h2>
        <p id="delete-description"><strong>{asset.name}</strong> will be removed from the list and map.</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="button button--secondary" type="button"
            disabled={deleting} onClick={() => dialog.current?.close()}>Cancel</button>
          <button className="button button--danger" type="button" disabled={deleting} onClick={confirmDelete}>
            {deleting ? 'Deleting…' : 'Delete asset'}
          </button>
        </div>
      </dialog>
    </>
  )
}

export function PanelFooter() {
  return (
    <div className="panel-footer">
      <MapPin size={14} aria-hidden="true" />
      <span>Select a marker or an asset to view its details.</span>
    </div>
  )
}
