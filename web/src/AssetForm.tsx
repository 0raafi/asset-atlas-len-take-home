import { useId, useRef, useState, type ComponentRef, type FormEvent } from 'react'
import { Location01Icon } from '@/components/icons/location-01'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  ApiError, assetStatuses, assetTypes, latitudeLimit, locationFields, readCoordinate,
  type AssetInput, type Draft, type FieldErrors,
} from './assets'

export function AssetForm({ draft, editing, saving, onChange, onStartPicking, onCancel, onSave }: {
  draft: Draft
  editing: boolean
  saving: boolean
  onChange: (next: Draft) => void
  onStartPicking: () => void
  onCancel: () => void
  onSave: (input: AssetInput) => Promise<void>
}) {
  const id = useId()
  const locationIcon = useRef<ComponentRef<typeof Location01Icon>>(null)
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
    const first = (['name', 'type', 'status', 'latitude', 'longitude', 'district', 'city', 'province'] as const)
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
    for (const [field] of locationFields) {
      const value = draft[field].trim()
      if (Array.from(value).length > 80) next[field] = 'Use 80 characters or fewer.'
      else if (/\p{Cc}/u.test(value)) next[field] = 'Remove line breaks or other control characters.'
    }
    setSaveError('')

    if (Object.keys(next).length || latitude === undefined || longitude === undefined) {
      showErrors(next)
      return
    }

    setValidation({ draft, errors: {} })
    try {
      await onSave({
        name, type: draft.type, status: draft.status, latitude, longitude,
        district: draft.district.trim(), city: draft.city.trim(), province: draft.province.trim(),
      })
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
      <header className="editor-heading">
        <h2 id="asset-editor-title" tabIndex={-1}>{editing ? 'Edit asset' : 'Add asset'}</h2>
      </header>
      <form className="asset-form" noValidate onSubmit={submit}>
        <fieldset disabled={saving}>
          <div className="form-field">
            <Label htmlFor={fieldID('name')}>Asset name</Label>
            <Input {...fieldProps('name')} autoComplete="off" required
              placeholder="e.g. Braga Sensor" value={draft.name} onChange={(event) => update('name', event.target.value)} />
            {errorMessage('name')}
          </div>

          <div className="field-grid">
            <div className="form-field">
              <Label htmlFor={fieldID('type')}>Type</Label>
              <NativeSelect {...fieldProps('type')} value={draft.type}
                onChange={(event) => update('type', event.target.value as Draft['type'])}>
                {Object.entries(assetTypes).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
              </NativeSelect>
              {errorMessage('type')}
            </div>
            <div className="form-field">
              <Label htmlFor={fieldID('status')}>Status</Label>
              <NativeSelect {...fieldProps('status')} value={draft.status}
                onChange={(event) => update('status', event.target.value as Draft['status'])}>
                {Object.entries(assetStatuses).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>
                ))}
              </NativeSelect>
              {errorMessage('status')}
            </div>
          </div>

          <div className="location-fields">
            <h3>Location</h3>
            <Button id="choose-location" className="location-button" variant="outline"
              aria-controls="asset-map" onMouseEnter={() => locationIcon.current?.startAnimation()} onClick={onStartPicking}>
              <Location01Icon ref={locationIcon} size={16} aria-hidden="true" /> Choose on map
            </Button>
            <div className="field-grid">
              <div className="form-field">
                <Label htmlFor={fieldID('latitude')}>Latitude</Label>
                <Input {...fieldProps('latitude')} required inputMode="decimal"
                  placeholder="−6.911" value={draft.latitude} onChange={(event) => update('latitude', event.target.value)} />
                {errorMessage('latitude')}
              </div>
              <div className="form-field">
                <Label htmlFor={fieldID('longitude')}>Longitude</Label>
                <Input {...fieldProps('longitude')} required inputMode="decimal"
                  placeholder="107.616" value={draft.longitude} onChange={(event) => update('longitude', event.target.value)} />
                {errorMessage('longitude')}
              </div>
            </div>
            <p className="location-hint">Area details are optional. Choose a map search result or enter them manually.</p>
            <div className="field-grid administrative-fields">
              {locationFields.map(([field, label]) => (
                <div className="form-field" key={field}>
                  <Label htmlFor={fieldID(field)}>{label}</Label>
                  <Input {...fieldProps(field)} value={draft[field]}
                    onChange={(event) => update(field, event.target.value)} />
                  {errorMessage(field)}
                </div>
              ))}
            </div>
          </div>
        </fieldset>

        {saveError && <p className="inline-error" role="alert">{saveError}</p>}
        <div className="form-actions">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save asset'}
          </Button>
          <Button variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </>
  )
}
