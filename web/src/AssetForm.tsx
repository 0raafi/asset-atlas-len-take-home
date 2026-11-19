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
    if (!name || Array.from(name).length > 80) next.name = 'Enter an asset name between 1 and 80 characters.'
    else if (/\p{Cc}/u.test(name)) next.name = 'Remove line breaks or other control characters from the asset name.'
    if (!Object.hasOwn(assetTypes, draft.type)) next.type = 'Select an asset type from the list.'
    if (!Object.hasOwn(assetStatuses, draft.status)) next.status = 'Select a status from the list.'
    if (latitude === undefined) next.latitude = 'Enter a latitude between −85.05112878 and 85.05112878.'
    if (longitude === undefined) next.longitude = 'Enter a longitude between −180 and 180.'
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
      else setSaveError(error instanceof Error ? error.message : 'Could not save the asset. Try again.')
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
          <ChevronLeft size={17} aria-hidden="true" /> {editing ? 'Asset details' : 'All assets'}
        </button>
        <h2 tabIndex={-1}>{editing ? 'Edit asset' : 'Add asset'}</h2>
      </div>
      <form className="asset-form panel-body" noValidate onSubmit={submit}>
        <fieldset disabled={saving}>
          <div className="form-field">
            <label htmlFor={fieldID('name')}>Asset name</label>
            <input {...fieldProps('name')} autoComplete="off" required
              placeholder="e.g. Braga Sensor" value={draft.name} onChange={(event) => update('name', event.target.value)} />
            {errorMessage('name')}
          </div>

          <div className="field-grid">
            <div className="form-field">
              <label htmlFor={fieldID('type')}>Type</label>
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
            <h3>Location</h3>
            <button type="button" className="button button--secondary location-button" aria-pressed={picking}
              onClick={onPickToggle}>
              <MapPin size={16} aria-hidden="true" />
              {picking ? 'Cancel location selection' : 'Choose on map'}
            </button>
            <div className="field-grid">
              <div className="form-field">
                <label htmlFor={fieldID('latitude')}>Latitude</label>
                <input {...fieldProps('latitude')} required inputMode="decimal"
                  placeholder="−6.911" value={draft.latitude} onChange={(event) => update('latitude', event.target.value)} />
                {errorMessage('latitude')}
              </div>
              <div className="form-field">
                <label htmlFor={fieldID('longitude')}>Longitude</label>
                <input {...fieldProps('longitude')} required inputMode="decimal"
                  placeholder="107.616" value={draft.longitude} onChange={(event) => update('longitude', event.target.value)} />
                {errorMessage('longitude')}
              </div>
            </div>
          </div>
        </fieldset>

        {saveError && <p className="inline-error" role="alert">{saveError}</p>}
        <div className="form-actions">
          <button className="button button--primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save asset'}
          </button>
          <button className="button button--secondary" type="button" disabled={saving} onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </>
  )
}
