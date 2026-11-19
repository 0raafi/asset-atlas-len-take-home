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

## Quick demo

1. Select **Braga Sensor** in the asset list or select its marker to open the details.
2. Select **Add asset**, choose a point on the map, and enter a name, type, and status. You can also enter coordinates directly with a decimal point or comma.
3. Select **Edit asset**, change the status, and choose a new location. Save and reload the page to confirm the new position.
4. Select **Delete asset** and confirm. Reload the page to verify that the asset is gone from the list and map.

## Technology choices

| Component | Rationale |
| --- | --- |
| React and TypeScript | Shared asset types keep the form, list, and map consistent. Local React state suits the single-page workflow. |
| React Leaflet and OpenStreetMap | React Leaflet connects map markers and location selection to React state. OpenStreetMap provides the attributed base map. |
| Vite and Lucide | Vite provides a development server and a static production build. Lucide supplies the interface icons. |
| Go `net/http` and `database/sql` | The standard library handles routing and database access. Go also serves the built frontend so the app and API share one origin. |
| SQLite and `modernc.org/sqlite` | A single database file provides persistent local storage. The pure-Go driver keeps setup independent of a database server or C toolchain. |

### API

| Method and path | Behavior |
| --- | --- |
| `GET /api/assets` | Returns the assets displayed in the list, on the map, and in the details panel. |
| `POST /api/assets` | Creates an asset and returns it with a new ID. |
| `PUT /api/assets/{id}` | Updates the asset's attributes and coordinates while keeping its ID. |
| `DELETE /api/assets/{id}` | Deletes the asset and returns `204 No Content`. |

Create and update requests accept a JSON object with `name`, `type`, `status`, `latitude`, and `longitude`. Supported types are `device`, `vehicle`, and `facility`. Supported statuses are `active`, `maintenance`, and `inactive`. The form displays field-specific validation messages, and the API validates each request independently. Invalid field values return `422` with a `fields` object. Latitude uses the Web Mercator range of ±85.05112878° and longitude uses ±180°.

## Verification

```sh
go test ./...
go vet ./...
npm run typecheck --prefix web
npm run build --prefix web
```

The Go integration tests exercise the HTTP handlers against a temporary SQLite database. They cover persistence after reopening the database, a zero coordinate, validation failures, location updates that preserve the asset ID, and deletion by ID.

Browser verification in Chrome covered CRUD, form validation, map clicks, marker labels, retaining form input after a failed save, keyboard access, persistence after restarting the server, and layout at a 320 px viewport. Playwright used substitute tiles for the interaction checks. Live OpenStreetMap tiles and the failed-tile state were also checked.

## Agentic AI workflow

The candidate approved the scope, technology choices, ticket order, and test coverage. Codex consulted the [Matt Pocock skills](https://github.com/mattpocock/skills) and used them to implement and verify the application.

1. `grill-with-docs` clarified the domain terms and map interactions. The results are captured in the [glossary](GLOSSARY.md) and acceptance criteria.
2. `to-tickets` split the work into three end-to-end flows covering creation and details, edits and location changes, and deletion. See the [local tickets](.scratch/asset-atlas/issues).
3. `implement` and `tdd` guided the Go and React implementation. Codex ran the create, update, and delete API tests before adding their handlers, then reran them after implementation.
4. `code-review` checked the implementation against the assignment and repository standards. The review found that small coordinates could appear in scientific notation and fail validation on edit, and that renamed markers retained an outdated label. Both issues were corrected and retested.

Repository instructions for coding agents are in [AGENT.md](AGENT.md).
