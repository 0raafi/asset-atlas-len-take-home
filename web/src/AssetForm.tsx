import { ChevronLeft, MapPin } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import {
  ApiError, assetStatuses, assetTypes, latitudeLimit, readCoordinate,
  type AssetInput, type Draft, type FieldErrors,
} from './assets'

export function AssetForm({ draft, editing, saving, picking, onChange, onPickToggle, onCancel, onSave }: {
  draft: Draft
  editing: boolean
  saving: boolean
  picking: boolean
  onChange: (next: Draft) => void
  onPickToggle: () => void
  onCancel: () => void
  onSave: (input: AssetInput) => Promise<void>
}) {
  const id = useId()
  const [validation, setValidation] = useState({ draft, errors: {} as FieldErrors })
  const [saveError, setSaveError] = useState('')
  const fieldID = (field: keyof Draft) => `${id}-${field}`
  const fieldError = (field: keyof Draft) =>
    validation.draft[field] === draft[field] ? validation.errors[field] : undefined

  function fieldProps(field: keyof Draft) {
    return {
      id: fieldID(field),
      name: field,
      'aria-invalid': Boolean(fieldError(field)) || undefined,
      'aria-describedby': fieldError(field) ? `${fieldID(field)}-error` : undefined,
    }
  }

  function update<Name extends keyof Draft>(field: Name, value: Draft[Name]) {
    onChange({ ...draft, [field]: value })
    setValidation((current) => ({ ...current, errors: { ...current.errors, [field]: undefined } }))
    setSaveError('')
  }

  function showErrors(next: FieldErrors) {
    setValidation({ draft, errors: next })
    const first = (['name', 'type', 'status', 'latitude', 'longitude'] as const)
      .find((field) => next[field])
    if (first) requestAnimationFrame(() => document.getElementById(fieldID(first))?.focus())
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    const name = draft.name.trim()
    const latitude = readCoordinate(draft.latitude, latitudeLimit)
    const longitude = readCoordinate(draft.longitude, 180)
    const next: FieldErrors = {}
    if (!name || Array.from(name).length > 80) next.name = 'Masukkan nama antara 1 dan 80 karakter.'
    else if (/\p{Cc}/u.test(name)) next.name = 'Hapus karakter kontrol dari nama aset.'
    if (!Object.hasOwn(assetTypes, draft.type)) next.type = 'Pilih jenis aset yang tersedia.'
    if (!Object.hasOwn(assetStatuses, draft.status)) next.status = 'Pilih status yang tersedia.'
    if (latitude === undefined) next.latitude = 'Masukkan lintang antara −85,05112878 dan 85,05112878.'
    if (longitude === undefined) next.longitude = 'Masukkan bujur antara −180 dan 180.'
    setSaveError('')

    if (Object.keys(next).length || latitude === undefined || longitude === undefined) {
      showErrors(next)
      return
    }

    setValidation({ draft, errors: {} })
    try {
      await onSave({ name, type: draft.type, status: draft.status, latitude, longitude })
    } catch (error) {
      if (error instanceof ApiError && error.fields) showErrors(error.fields)
      else setSaveError(error instanceof Error ? error.message : 'Aset gagal disimpan. Coba lagi.')
    }
  }

  function errorMessage(field: keyof Draft) {
    const error = fieldError(field)
    return error ? <span className="field-error" id={`${fieldID(field)}-error`}>{error}</span> : null
  }

  return (
    <>
      <div className="panel-heading panel-heading--stack">
        <button type="button" className="text-button" onClick={onCancel} disabled={saving}>
          <ChevronLeft size={17} aria-hidden="true" /> {editing ? 'Detail aset' : 'Daftar aset'}
        </button>
        <h2 tabIndex={-1}>{editing ? 'Edit aset' : 'Tambah aset'}</h2>
      </div>
      <form className="asset-form panel-body" noValidate onSubmit={submit}>
        <fieldset disabled={saving}>
          <div className="form-field">
            <label htmlFor={fieldID('name')}>Nama aset</label>
            <input {...fieldProps('name')} autoComplete="off" required
              placeholder="Contoh: Sensor Braga" value={draft.name} onChange={(event) => update('name', event.target.value)} />
            {errorMessage('name')}
          </div>

          <div className="field-grid">
            <div className="form-field">
              <label htmlFor={fieldID('type')}>Jenis</label>
              <select {...fieldProps('type')} value={draft.type}
                onChange={(event) => update('type', event.target.value as Draft['type'])}>
                {Object.entries(assetTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {errorMessage('type')}
            </div>
            <div className="form-field">
              <label htmlFor={fieldID('status')}>Status</label>
              <select {...fieldProps('status')} value={draft.status}
                onChange={(event) => update('status', event.target.value as Draft['status'])}>
                {Object.entries(assetStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {errorMessage('status')}
            </div>
          </div>

          <div className="location-fields">
            <h3>Lokasi</h3>
            <button type="button" className="button button--secondary location-button" aria-pressed={picking}
              onClick={onPickToggle}>
              <MapPin size={16} aria-hidden="true" />
              {picking ? 'Batalkan pemilihan titik' : 'Pilih titik di peta'}
            </button>
            <div className="field-grid">
              <div className="form-field">
                <label htmlFor={fieldID('latitude')}>Lintang</label>
                <input {...fieldProps('latitude')} required inputMode="decimal"
                  placeholder="−6,911" value={draft.latitude} onChange={(event) => update('latitude', event.target.value)} />
                {errorMessage('latitude')}
              </div>
              <div className="form-field">
                <label htmlFor={fieldID('longitude')}>Bujur</label>
                <input {...fieldProps('longitude')} required inputMode="decimal"
                  placeholder="107,616" value={draft.longitude} onChange={(event) => update('longitude', event.target.value)} />
                {errorMessage('longitude')}
              </div>
            </div>
          </div>
        </fieldset>

        {saveError && <p className="inline-error" role="alert">{saveError}</p>}
        <div className="form-actions">
          <button className="button button--primary" type="submit" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan aset'}
          </button>
          <button className="button button--secondary" type="button" disabled={saving} onClick={onCancel}>Batal</button>
        </div>
      </form>
    </>
  )
}
