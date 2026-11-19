import { Cancel01Icon, Location01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { findMapPlaces, type MapPlace } from './mapPlaces'

type SearchState =
  | { kind: 'idle' | 'loading' | 'error' }
  | { kind: 'ready'; places: MapPlace[] }

function searchMessage(state: SearchState) {
  if (state.kind === 'loading') return 'Searching locations…'
  if (state.kind === 'error') return 'Location search is unavailable. Try again.'
  if (state.kind === 'ready') {
    const count = state.places.length
    return count ? `${count} ${count === 1 ? 'location' : 'locations'} found` : 'No locations found.'
  }
}

export function MapLocationSearch({ onSelect }: { onSelect: (place: MapPlace) => void }) {
  const resultsID = useId()
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({ kind: 'idle' })
  const input = useRef<HTMLInputElement>(null)
  const pending = useRef<AbortController>(null)

  useEffect(() => () => pending.current?.abort(), [])

  function clearResults() {
    pending.current?.abort()
    setState({ kind: 'idle' })
  }

  function closeResults() {
    clearResults()
    input.current?.focus({ preventScroll: true })
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!query.trim() || state.kind === 'loading') return
    pending.current?.abort()
    const request = new AbortController()
    pending.current = request
    setState({ kind: 'loading' })
    try {
      const places = await findMapPlaces(query.trim(), request.signal)
      if (!request.signal.aborted) setState({ kind: 'ready', places })
    } catch {
      if (!request.signal.aborted) setState({ kind: 'error' })
    }
  }

  return (
    <form className="map-search" role="search" aria-label="Map locations" onSubmit={search}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || state.kind === 'idle') return
        event.preventDefault()
        closeResults()
      }}>
      <div className="map-search-control">
        <Input ref={input} type="search" maxLength={200} autoComplete="off" aria-label="Search map locations"
          placeholder="Search a place or address" aria-controls={state.kind !== 'idle' ? resultsID : undefined}
          value={query} onChange={(event) => {
            clearResults()
            setQuery(event.target.value)
          }} />
        <Button type="submit" variant="ghost" size="icon" aria-label="Search location"
          disabled={!query.trim() || state.kind === 'loading'}>
          <HugeiconsIcon icon={Search01Icon} aria-hidden="true" />
        </Button>
      </div>
      <span role="status" className="sr-only">{searchMessage(state)}</span>
      {state.kind !== 'idle' && (
        <div className="map-search-menu" id={resultsID}>
          <div className="map-search-menu-heading">
            <p>{searchMessage(state)}</p>
            <Button size="icon" variant="ghost" aria-label="Close location results" onClick={closeResults}>
              <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
            </Button>
          </div>
          {state.kind === 'ready' && state.places.length > 0 && (
            <ul className="map-search-results" aria-label="Location results">
              {state.places.map((place) => (
                <li key={`${place.name}:${place.location.join(',')}`}>
                  <Button variant="ghost" onClick={() => {
                    setQuery(place.name)
                    clearResults()
                    onSelect(place)
                  }}>
                    <HugeiconsIcon icon={Location01Icon} aria-hidden="true" />
                    <span><strong>{place.name}</strong>{place.context && <small>{place.context}</small>}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  )
}
