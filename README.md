# Pipeline Material Inspector

Third-party materials inspection / documentation PWA for pipeline construction field work.

Not an official Atmos Energy or TJ Inspection application. The app records what an inspector enters. It does not decide that material is acceptable.

## Phase 1

Guest demo, no sign-in. Records stay in IndexedDB on the device. The sync queue shows **OFFLINE — SAVED LOCALLY**, **SYNCING**, or **SYNC COMPLETE**. Phase 1 does not upload to a database, so a guest session stays on the first status until a remote project is connected.

- Mobile shell with Home, Receive, Inventory, Search, and More
- Project setup and local document metadata
- Material receiving (delivery header, packing slip / BOL, photo and GPS stubs, line items)
- Search by heat, joint, serial, PO, BOL, manufacturer, or Material ID
- Light, dark, and high-contrast outdoor themes
- Supabase schema in `supabase/migrations` (not applied from the static site)

Material IDs look like `PMI-PIPE-000001`.

## Scripts

```bash
npm install
npm test
npm run dev
npm run build
```

The dev and production apps use the `/TJMaterials/` base path. GitHub Pages publishes `dist` to the `gh-pages` branch from `.github/workflows/pages.yml`. In the repository settings, set Pages to deploy from that branch.

`Atmos Project #` and `Shipment # (MRC)` are labels copied from the inspector’s MTR request form. They are customer reference fields.
