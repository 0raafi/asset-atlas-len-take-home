# Agent instructions

- Read the acceptance criteria in `.scratch/asset-atlas/issues/` and use the terms in `GLOSSARY.md`.
- Complete and verify one user flow before starting the next.
- Test API behavior through HTTP with a temporary SQLite database. Run the frontend typecheck and build, then verify the main flows in a browser.
- Treat the backend as the source of truth. Update a marker after the server confirms a save or deletion.
- Place validation messages next to their fields and support keyboard entry for coordinates.
- Record the AI-assisted changes and the checks actually run in the README.
