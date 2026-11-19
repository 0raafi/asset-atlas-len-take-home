# Asset Atlas

Asset Atlas is a map-based inventory for IoT devices, vehicles, and facilities. Open an asset from the map or list to view its details, update its attributes or location, or delete it.

## Getting started

Install Go 1.23 or later and Node.js 22.12 or later. From the repository root, run:

```sh
npm ci --prefix web
npm run build --prefix web
go run ./cmd/asset-atlas -seed
```

Open [Asset Atlas](http://127.0.0.1:8080). The `-seed` flag adds six fictional assets in Bandung when the database is first created. Changes are saved to `data/assets.db` and persist across server restarts. To start with an empty inventory, run `go run ./cmd/asset-atlas -db data/empty.db`.

For frontend development, leave the Go server running and run `npm run dev --prefix web` in another terminal. Vite proxies `/api` requests to the local backend.

The base map uses OpenStreetMap tiles and requires an internet connection. The asset list, details, coordinates, and editing controls remain available if tiles fail to load. Set `VITE_TILE_URL` at build time to use an alternative endpoint with the same OpenStreetMap attribution.

The map's location search sends the submitted place or address to [Photon](https://github.com/komoot/photon). Set `VITE_GEOCODING_URL` at build time to use a different Photon search endpoint.

## Quick demo

1. Search the list or filter by type and status. Filters apply to the list and map. Select **Braga Sensor** from either view to highlight both its row and marker. On a phone, use **Assets** to open the list.
2. Select **Add asset** and enter a name, type, and status. Select **Choose on map**, then click a point or search for a place or address. **Use location** applies the coordinates and any district, city or regency, and province supplied by the search result. You can also enter the coordinates and area details manually.
3. Select **Edit asset** and choose a new location. The saved marker moves after **Save asset** succeeds. Reload the page to confirm the new position.
4. Select **Delete asset** and confirm. Reload the page to verify that the asset is gone from the list and map.

## Technology choices

| Component | Rationale |
| --- | --- |
| React and TypeScript | Shared asset types keep the form, list, and map consistent. Local React state suits the single-page workflow. |
| React Leaflet and OpenStreetMap | React Leaflet connects map markers and location selection to React state. OpenStreetMap provides the attributed base map. |
| Vite and shadcn/ui | Vite builds the React frontend. [shadcn/ui](https://ui.shadcn.com/docs/installation/vite) supplies the buttons, inputs, native selects, badges, and confirmation dialog. See the [MIT license](web/licenses/shadcn-ui.txt). |
| Boneyard | [Boneyard](https://github.com/0xGF/boneyard) renders a static loading skeleton from measurements of the asset rows at 320, 430, 1024, and 1440 px. |
| Hugeicons | [Hugeicons Animated](https://github.com/enesgules/hugeicons-animated) supplies the hover feedback for **Add asset** and **Choose on map**. Other controls use the static Hugeicons set. See the [MIT license](web/licenses/HugeiconsAnimated.txt). |
| Go `net/http` and `database/sql` | The standard library handles routing and database access. Go also serves the built frontend so the app and API share one origin. |
| SQLite and `modernc.org/sqlite` | A single database file provides persistent local storage. The pure-Go driver keeps setup independent of a database server or C toolchain. |

### API

| Method and path | Behavior |
| --- | --- |
| `GET /api/assets` | Returns the assets displayed in the list, on the map, and in the details panel. |
| `POST /api/assets` | Creates an asset and returns it with a new ID. |
| `PUT /api/assets/{id}` | Updates the asset's attributes and coordinates while keeping its ID. |
| `DELETE /api/assets/{id}` | Deletes the asset and returns `204 No Content`. |

Create and update requests accept a JSON object with `name`, `type`, `status`, `latitude`, and `longitude`, plus optional `district`, `city` (city or regency), and `province` strings of up to 80 characters each. On update, an empty string clears a label. Omitted labels are preserved when coordinates stay the same and cleared when coordinates change. Existing databases gain these fields at startup, with empty labels for existing assets.

Supported types are `device`, `vehicle`, and `facility`. Supported statuses are `active`, `maintenance`, and `inactive`. The form displays field-specific validation messages, and the API validates each request independently. Invalid field values return `422` with a `fields` object. Latitude uses the Web Mercator range of ±85.05112878° and longitude uses ±180°.

## Verification

```sh
go test ./...
go vet ./...
npm run typecheck --prefix web
npm run build --prefix web
```

The Go integration tests exercise the HTTP handlers against a temporary SQLite database. They cover persistence after reopening the database, a zero coordinate, validation failures, location updates that preserve the asset ID, and deletion by ID.

For the shadcn refresh, Codex reran the Go HTTP tests, `go vet`, the frontend typecheck and build, and React Doctor on the changed files. Chrome checks with a temporary SQLite database covered Boneyard during a delayed load, synchronized filters and selection, keyboard access, field validation, previewing and cancelling a location, retrying a failed save or delete, persistence across a server restart, and the sticky header at a 320 px viewport. Chrome also verified icon hover feedback, reduced motion, and live and failed OpenStreetMap tile loads.

The controls update was verified in Chrome on desktop and at 320 px. Checks covered status selection and saving, list spacing and skeleton loading, map cursor changes while picking and dragging, location search and result placement, and the delete confirmation. Search checks included live Photon results, empty results, and a simulated service failure. The Go tests, `go vet`, typecheck, build, and React Doctor were rerun.

## Agentic AI workflow

The candidate approved the scope, technology choices, ticket order, and test coverage. Codex consulted the [Matt Pocock skills](https://github.com/mattpocock/skills) and used them to implement and verify the application.

1. `grill-with-docs` clarified the domain terms and map interactions. The results are captured in the [glossary](GLOSSARY.md) and acceptance criteria.
2. `to-tickets` split the work into three end-to-end flows covering creation and details, edits and location changes, and deletion. See the [local tickets](.scratch/asset-atlas/issues).
3. `implement` and `tdd` guided the Go and React implementation. Codex ran the create, update, and delete API tests before adding their handlers, then reran them after implementation.
4. `code-review` checked the implementation against the assignment and repository standards. The review found that small coordinates could appear in scientific notation and fail validation on edit, and that renamed markers retained an outdated label. Both issues were corrected and retested.
5. Codex compared Motive, Samsara, Traccar, and ArcGIS Field Maps, then rebuilt the workspace around a persistent asset list on desktop, a map-first view on mobile, and a separate location preview. The [Emil Kowalski skills](https://github.com/emilkowalski/skills) guided motion timing and reduced-motion support.
6. Codex applied the better-layout skill to asset row spacing, recaptured the loading skeleton, and refined the status selector, map location search, placement cursor, and delete action.

Repository instructions for coding agents are in [AGENT.md](AGENT.md).
