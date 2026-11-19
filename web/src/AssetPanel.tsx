import {
  ArrowDown01Icon, Cancel01Icon, Delete02Icon, Edit02Icon, Location01Icon,
  MapsIcon, Search01Icon, SlidersHorizontalIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Skeleton } from 'boneyard-js/react'
import { useRef, useState } from 'react'
import { AssetIcon } from './AssetIcon'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import listBones from '@/bones/asset-list.bones.json'
import {
  assetStatuses, assetTypes, formatCoordinate, locationFields, type Asset, type AssetStatus, type AssetType,
} from './assets'

export type AssetFilters = { type: AssetType | ''; status: AssetStatus | '' }

function Status({ status }: { status: AssetStatus }) {
  return (
    <Badge variant="secondary" className={`status-label status-label--${status}`}>
      <span aria-hidden="true" />
      {assetStatuses[status]}
    </Badge>
  )
}

function InventoryResults({ matches, total, error, selectedId, onRetry, onReset, onAdd, onSelect }: {
  matches: Asset[]
  total: number
  error: string
  selectedId?: number
  onRetry: () => void
  onReset: () => void
  onAdd: () => void
  onSelect: (asset: Asset) => void
}) {
  if (error) {
    return (
      <div className="rail-message">
        <Alert variant="destructive">
          <AlertTitle>Could not load assets</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={onRetry}>Try again</Button>
      </div>
    )
  }

  if (!matches.length) {
    return (
      <div className="empty-state">
        <span className="empty-icon">
          <HugeiconsIcon icon={total ? SlidersHorizontalIcon : Location01Icon} size={22} aria-hidden="true" />
        </span>
        <h3>{total ? 'No matching assets' : 'No assets yet'}</h3>
        <p>{total ? 'Clear your search and filters to see all assets.' : 'Add your first asset and set its location.'}</p>
        <Button variant="outline" onClick={total ? onReset : onAdd}>
          {total ? 'Clear search and filters' : 'Add your first asset'}
        </Button>
      </div>
    )
  }

  return (
    <ul className="asset-list">
      {matches.map((asset) => (
        <li key={asset.id}>
          <Button variant="ghost" className="asset-row" id={`asset-row-${asset.id}`}
            aria-pressed={asset.id === selectedId} onClick={() => onSelect(asset)}>
            <AssetIcon type={asset.type} />
            <span className="asset-row-copy">
              <strong>{asset.name}</strong>
              <span>{assetTypes[asset.type]}</span>
            </span>
            <Status status={asset.status} />
          </Button>
        </li>
      ))}
    </ul>
  )
}

export function AssetList({
  assets, total, loading, error, search, filters, selectedId, expanded, onToggle,
  onSearch, onFilter, onReset, onRetry, onAdd, onSelect,
}: {
  assets: Asset[]
  total: number
  loading: boolean
  error: string
  search: string
  filters: AssetFilters
  selectedId?: number
  expanded: boolean
  onToggle: () => void
  onSearch: (search: string) => void
  onFilter: (filters: AssetFilters) => void
  onReset: () => void
  onRetry: () => void
  onAdd: () => void
  onSelect: (asset: Asset) => void
}) {
  const query = search.trim().toLowerCase()
  const matches = query ? assets.filter((asset) =>
    [asset.name, assetTypes[asset.type], assetStatuses[asset.status]]
      .some((value) => value.toLowerCase().includes(query)),
  ) : assets
  const count = matches.length === total ? String(total) : `${matches.length} of ${total}`
  const ready = !loading && !error
  const disableTools = !ready || total === 0

  return (
    <>
      <div className="rail-heading">
        <h2 id="asset-list-title" tabIndex={-1}>Assets</h2>
        <Button id="asset-list-toggle" className="rail-toggle" variant="ghost" onClick={onToggle}
          aria-expanded={expanded} aria-controls="asset-inventory">
          <HugeiconsIcon icon={MapsIcon} aria-hidden="true" />
          Assets
          <HugeiconsIcon icon={ArrowDown01Icon} className="rail-toggle-arrow" aria-hidden="true" />
        </Button>
        {ready && <Badge variant="secondary" className="asset-count" role="status">
          {count} {total === 1 ? 'asset' : 'assets'}
        </Badge>}
      </div>
      <div id="asset-inventory" className="asset-inventory">
        <div className="asset-tools">
          <div className="asset-search">
            <HugeiconsIcon icon={Search01Icon} size={17} aria-hidden="true" />
            <Input type="search" aria-label="Search assets by name, type, or status" placeholder="Search assets"
              disabled={disableTools} value={search} onChange={(event) => onSearch(event.target.value)} />
          </div>
          <div className="asset-filters">
            <NativeSelect aria-label="Filter by type" disabled={disableTools}
              value={filters.type} onChange={(event) => onFilter({ ...filters, type: event.target.value as AssetType | '' })}>
              <NativeSelectOption value="">All types</NativeSelectOption>
              {Object.entries(assetTypes).map(([value, label]) =>
                <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
            </NativeSelect>
            <NativeSelect aria-label="Filter by status" disabled={disableTools}
              value={filters.status} onChange={(event) => onFilter({ ...filters, status: event.target.value as AssetStatus | '' })}>
              <NativeSelectOption value="">All statuses</NativeSelectOption>
              {Object.entries(assetStatuses).map(([value, label]) =>
                <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        </div>
        {loading && <span role="status" className="sr-only">Loading assets…</span>}
        <div className="asset-results" aria-busy={loading}>
          <Skeleton name="asset-list" initialBones={listBones} select="viewport"
            loading={loading} color="#e8ece6" animate="solid">
            <InventoryResults matches={matches} total={total} error={error} selectedId={selectedId}
              onRetry={onRetry} onReset={onReset} onAdd={onAdd} onSelect={onSelect} />
          </Skeleton>
        </div>
      </div>
    </>
  )
}

export function AssetDetail({ asset, onClose, onEdit, onDelete }: {
  asset: Asset
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const area = locationFields.filter(([field]) => asset[field])

  async function confirmDelete() {
    if (pending.current) return
    pending.current = true
    setDeleting(true)
    setError('')
    try {
      await onDelete()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete the asset. Try again.')
      setDeleting(false)
      pending.current = false
    }
  }

  return (
    <section className="asset-detail" aria-labelledby="asset-detail-title">
      <header className="detail-header">
        <AssetIcon type={asset.type} />
        <div className="detail-identity">
          <h2 id="asset-detail-title" tabIndex={-1}>{asset.name}</h2>
          <p>{assetTypes[asset.type]} <span aria-hidden="true">·</span> #{asset.id}</p>
        </div>
        <Button className="detail-close" size="icon" variant="ghost" onClick={onClose} aria-label="Close asset details">
          <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
        </Button>
      </header>
      <div className="detail-meta">
        <Status status={asset.status} />
        <div className="detail-location">
          <HugeiconsIcon icon={Location01Icon} size={15} aria-hidden="true" />
          <span aria-label={`Location: latitude ${asset.latitude}, longitude ${asset.longitude}`}>
            {formatCoordinate(asset.latitude)}°, {formatCoordinate(asset.longitude)}°
          </span>
        </div>
        {area.length > 0 && (
          <dl className="detail-area">
            {area.map(([field, label]) => (
              <div key={field}>
                <dt>{label}</dt>
                <dd>{asset[field]}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="detail-actions">
        <Button variant="outline" onClick={onEdit}>
          <HugeiconsIcon icon={Edit02Icon} aria-hidden="true" /> Edit asset
        </Button>
        <AlertDialog open={open} onOpenChange={(next) => {
          if (pending.current) return
          if (next) setError('')
          setOpen(next)
        }}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="delete-trigger">
              <HugeiconsIcon icon={Delete02Icon} aria-hidden="true" /> Delete asset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="delete-dialog"
            onEscapeKeyDown={(event) => { if (pending.current) event.preventDefault() }}
            onCloseAutoFocus={(event) => { if (pending.current) event.preventDefault() }}>
            <AlertDialogHeader className="delete-dialog-header">
              <AlertDialogTitle>Delete asset?</AlertDialogTitle>
              <AlertDialogDescription><strong>{asset.name}</strong> will be removed from the list and map.</AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p className="inline-error" role="alert">{error}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
                {deleting ? 'Deleting…' : 'Delete asset'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  )
}
